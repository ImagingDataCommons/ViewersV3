import {
  registerDataAvailabilityChecks,
  unregisterDataAvailabilityChecks,
} from './registerDataAvailabilityChecks';

const mockListedSeries = new Set<string>();

jest.mock('@ohif/core', () => ({
  DicomMetadataStore: {
    getSeries: (_study: string, series: string) => (mockListedSeries.has(series) ? {} : undefined),
  },
  utils: {
    splitComma: (values: string[]) => values.flatMap(value => value.split(',')).filter(Boolean),
  },
}));

jest.mock('@ohif/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options: Record<string, string> = {}) =>
      key.replace(/^\w+:/, '').replace(/{{(\w+)}}/g, (_match, name) => options[name] ?? ''),
  },
}));

const STUDY = '1.2.3';
const CT = '1.2.3.1';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

type Search = jest.Mock<Promise<unknown[]>, [string]>;

function setup(sources: Record<string, { qidoRoot: string; search: Search }>) {
  const listeners: Array<(event) => void> = [];
  const loadedSeries = new Set<string>();
  const services = {
    uiNotificationService: { show: jest.fn(), hide: jest.fn() },
    displaySetService: {
      EVENTS: { DISPLAY_SETS_ADDED: 'added' },
      subscribe: jest.fn((_event, listener) => {
        listeners.push(listener);
        return { unsubscribe: jest.fn() };
      }),
      getDisplaySetsForSeries: jest.fn((uid: string) => (loadedSeries.has(uid) ? [{}] : [])),
    },
  };
  const names = Object.keys(sources);
  const extensionManager = {
    getActiveDataSourceDefinition: () => ({
      sourceName: 'merge',
      configuration: { seriesMerge: { dataSourceNames: names } },
    }),
    getDataSourceDefinition: (name: string) => ({
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      friendlyName: name,
    }),
    getDataSources: (name: string) => [
      {
        getConfig: () => ({ qidoRoot: sources[name].qidoRoot }),
        query: { series: { search: sources[name].search } },
      },
    ],
  };
  const register = (config?) =>
    registerDataAvailabilityChecks({
      servicesManager: { services } as never,
      extensionManager,
      config,
    });
  const addDisplaySets = (...displaySetsAdded) =>
    listeners.forEach(listener => listener({ displaySetsAdded }));
  return { services, register, addDisplaySets, loadedSeries };
}

const IDC_ROOT = 'https://proxy.example/dicomWeb';
const ARCHIVE_ROOT = 'https://archive.example/dicomweb';
const holding = (...uids: string[]): Search =>
  jest.fn(() => Promise.resolve(uids.map(seriesInstanceUid => ({ seriesInstanceUid }))));
const seg = (referencedSeriesInstanceUID: string, SeriesInstanceUID = '9.9') => ({
  StudyInstanceUID: STUDY,
  SeriesInstanceUID,
  Modality: 'SEG',
  label: `SEG ${SeriesInstanceUID}`,
  referencedSeriesInstanceUID,
});

beforeEach(() => {
  window.history.replaceState(null, '', `/viewer?StudyInstanceUIDs=${STUDY}`);
  mockListedSeries.clear();
  unregisterDataAvailabilityChecks();
});

describe('registerDataAvailabilityChecks', () => {
  it('can be turned off', () => {
    const { services, register } = setup({ idc: { qidoRoot: IDC_ROOT, search: holding() } });
    register({ enabled: false });
    expect(services.displaySetService.subscribe).not.toHaveBeenCalled();
  });

  it('sends no request when the referenced series is listed or loaded', async () => {
    const search = holding();
    const { services, register, addDisplaySets, loadedSeries } = setup({
      idc: { qidoRoot: IDC_ROOT, search },
    });
    mockListedSeries.add(CT);
    loadedSeries.add('7.7');
    register();
    addDisplaySets(seg(CT), seg('7.7', '9.8'), { SeriesInstanceUID: '5.5', Modality: 'CT' });
    await flush();

    expect(search).not.toHaveBeenCalled();
    expect(services.uiNotificationService.show).not.toHaveBeenCalled();
  });

  it('asks each source once and warns once per missing series, listing every derived series', async () => {
    const idc = holding('5.5');
    const archive = holding('9.1', '9.2');
    const { services, register, addDisplaySets } = setup({
      idc: { qidoRoot: IDC_ROOT, search: idc },
      archive: { qidoRoot: ARCHIVE_ROOT, search: archive },
    });
    register();
    addDisplaySets(seg(CT, '9.1'), seg(CT, '9.2'));
    await flush();

    expect(idc).toHaveBeenCalledTimes(1);
    expect(archive).toHaveBeenCalledTimes(1);
    const shown = services.uiNotificationService.show.mock.calls.map(([options]) => options);
    expect(new Set(shown.map(options => options.id))).toEqual(
      new Set([`idc-data-availability-reference-${CT}`])
    );
    expect(shown.at(-1).message).toContain('SEG 9.1 (SEG), SEG 9.2 (SEG)');
    expect(shown.at(-1).message).toContain('idc, archive');
  });

  it('does not warn when a source holds the series that was not listed yet', async () => {
    const { services, register, addDisplaySets } = setup({
      idc: { qidoRoot: IDC_ROOT, search: holding(CT) },
    });
    register();
    addDisplaySets(seg(CT));
    await flush();
    expect(services.uiNotificationService.show).not.toHaveBeenCalled();
  });

  it('says which source could not be checked', async () => {
    const { services, register, addDisplaySets } = setup({
      idc: { qidoRoot: IDC_ROOT, search: holding('5.5') },
      archive: { qidoRoot: ARCHIVE_ROOT, search: jest.fn(() => Promise.reject(new Error('403'))) },
    });
    register();
    addDisplaySets(seg(CT));
    await flush();

    const [[options]] = services.uiNotificationService.show.mock.calls;
    expect(options.message).toContain('could not be checked');
    expect(options.message).toContain('archive could not be checked');
  });

  it('drops late results and hides its toasts when the mode exits', async () => {
    let resolve: (value: unknown[]) => void;
    const search = jest.fn(() => new Promise<unknown[]>(r => (resolve = r)));
    const { services, register, addDisplaySets } = setup({
      idc: { qidoRoot: IDC_ROOT, search },
    });
    register();
    addDisplaySets(seg(CT));
    unregisterDataAvailabilityChecks();
    resolve([]);
    await flush();
    expect(services.uiNotificationService.show).not.toHaveBeenCalled();
  });
});
