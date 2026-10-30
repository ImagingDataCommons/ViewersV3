import { checkStudyAvailability, isReferencedSeriesMissing } from './studyAvailability';

const STUDY = '1.2.3';
const CT = '1.2.3.1';
const SEG = '1.2.3.2';

const source = (sourceName: string, search: () => Promise<unknown[]>) => ({
  sourceName,
  label: sourceName,
  dataSource: { query: { series: { search } } },
});

describe('checkStudyAvailability', () => {
  it('reports found, empty and failed sources independently', async () => {
    const error = Object.assign(new Error('request failed'), {
      status: 403,
      request: { statusText: 'Forbidden' },
    });

    const result = await checkStudyAvailability(STUDY, [
      source('idc', () => Promise.resolve([])),
      source('gcp', () => Promise.resolve([{ seriesInstanceUid: SEG }])),
      source('other', () => Promise.reject(error)),
    ]);

    expect(result.sources.map(s => s.status)).toEqual(['empty', 'found', 'failed']);
    expect(result.sources[1].seriesInstanceUIDs.has(SEG)).toBe(true);
    expect(result.sources[2].error).toBe(error);
  });

  it('treats a 404 as a source without the study', async () => {
    const notFound = Object.assign(new Error('request failed'), { status: 404 });
    const result = await checkStudyAvailability(STUDY, [
      source('idc', () => Promise.reject(notFound)),
    ]);
    expect(result.sources[0].status).toBe('empty');
  });
});

describe('isReferencedSeriesMissing', () => {
  const sourceWith = (sourceName: string, status, uids: string[]) => ({
    sourceName,
    label: sourceName,
    status,
    seriesInstanceUIDs: new Set(uids),
  });
  const study = (StudyInstanceUID: string, sources) => ({ StudyInstanceUID, sources });
  const availability = [
    study(STUDY, [sourceWith('idc', 'empty', []), sourceWith('gcp', 'found', [SEG])]),
  ];

  it('is true when no source holds the referenced series', () => {
    expect(isReferencedSeriesMissing({ referencedSeriesInstanceUID: CT }, availability)).toBe(true);
  });

  it('is false when a source holds the referenced series', () => {
    expect(isReferencedSeriesMissing({ referencedSeriesInstanceUID: SEG }, availability)).toBe(
      false
    );
  });

  it('is false when the series is in another requested study', () => {
    expect(
      isReferencedSeriesMissing({ referencedSeriesInstanceUID: CT }, [
        ...availability,
        study('4.5.6', [sourceWith('idc', 'found', [CT])]),
      ])
    ).toBe(false);
  });

  it('is false without a reference, or when every query failed', () => {
    expect(isReferencedSeriesMissing({}, availability)).toBe(false);
    expect(
      isReferencedSeriesMissing({ referencedSeriesInstanceUID: CT }, [
        study(STUDY, [sourceWith('idc', 'failed', [])]),
      ])
    ).toBe(false);
  });
});
