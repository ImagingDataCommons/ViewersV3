import {
  registerDataAvailabilityChecks,
  unregisterDataAvailabilityChecks,
} from './registerDataAvailabilityChecks';

jest.mock('@ohif/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options?: Record<string, string>) => `${key} ${JSON.stringify(options ?? {})}`,
  },
}));

const STUDY = '1.2.3';
const CT = '1.2.3.1';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

type Search = (uid: string) => Promise<unknown[]>;

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
const GCP_ROOT =
  'https://healthcare.googleapis.com/v1/projects/p/locations/l/datasets/d/dicomStores/s/dicomWeb';
const forbidden = () => Promise.reject(Object.assign(new Error('request failed'), { status: 403 }));
const seg = (referencedSeriesInstanceUID: string, SeriesInstanceUID = '9.9') => ({
  StudyInstanceUID: STUDY,
  SeriesInstanceUID,
  Modality: 'SEG',
  label: `SEG ${SeriesInstanceUID}`,
  referencedSeriesInstanceUID,
});

beforeEach(() => {
  window.history.replaceState(null, '', `/viewer?StudyInstanceUIDs=${STUDY}`);
  unregisterDataAvailabilityChecks();
});

describe('registerDataAvailabilityChecks', () => {
  it('can be turned off', async () => {
    const { services, register } = setup({ idc: { qidoRoot: IDC_ROOT, search: forbidden } });
    register({ enabled: false });
    await flush();
    expect(services.uiNotificationService.show).not.toHaveBeenCalled();
  });

  it('reports a failed source, but leaves GCP stores to the GCP extension', async () => {
    const { services, register } = setup({
      idc: { qidoRoot: IDC_ROOT, search: forbidden },
      gcp: { qidoRoot: GCP_ROOT, search: forbidden },
    });
    register();
    await flush();

    const shown = services.uiNotificationService.show.mock.calls.map(([options]) => options);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({
      id: `idc-data-availability-failed-idc-${STUDY}`,
      type: 'error',
      duration: Infinity,
    });
  });

  it('does not warn about a study that is only in the GCP store', async () => {
    const { services, register } = setup({
      idc: { qidoRoot: IDC_ROOT, search: () => Promise.resolve([]) },
      gcp: { qidoRoot: GCP_ROOT, search: () => Promise.resolve([{ seriesInstanceUid: CT }]) },
    });
    register();
    await flush();
    expect(services.uiNotificationService.show).not.toHaveBeenCalled();
  });

  it('warns once per missing referenced series, listing every derived series', async () => {
    const { services, register, addDisplaySets } = setup({
      idc: { qidoRoot: IDC_ROOT, search: () => Promise.resolve([{ seriesInstanceUid: '5.5' }]) },
    });
    register();
    addDisplaySets(seg(CT, '9.1'), seg(CT, '9.2'));
    await flush();

    const shown = services.uiNotificationService.show.mock.calls.map(([options]) => options);
    expect(new Set(shown.map(options => options.id))).toEqual(
      new Set([`idc-data-availability-reference-${CT}`])
    );
    expect(shown.at(-1).message).toContain('SEG 9.1 (SEG), SEG 9.2 (SEG)');
  });

  it('does not warn when the referenced series is loaded', async () => {
    const { services, register, addDisplaySets, loadedSeries } = setup({
      idc: { qidoRoot: IDC_ROOT, search: () => Promise.resolve([{ seriesInstanceUid: '5.5' }]) },
    });
    loadedSeries.add(CT);
    register();
    addDisplaySets(seg(CT));
    await flush();
    expect(services.uiNotificationService.show).not.toHaveBeenCalled();
  });

  it('drops late results and hides its toasts when the mode exits', async () => {
    let fail: () => void;
    const { services, register } = setup({
      idc: {
        qidoRoot: IDC_ROOT,
        search: () => new Promise((_resolve, reject) => (fail = () => reject(new Error('x')))),
      },
    });
    register();
    unregisterDataAvailabilityChecks();
    fail();
    await flush();
    expect(services.uiNotificationService.show).not.toHaveBeenCalled();
  });
});
