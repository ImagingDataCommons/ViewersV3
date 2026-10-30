/** Result of asking one DICOMweb data source which series it holds for a study. */
export type SourceAvailability = {
  sourceName: string;
  label: string;
  status: 'found' | 'empty' | 'failed';
  seriesInstanceUIDs: Set<string>;
  error?: unknown;
  /** True when another extension reports this source's failures itself. */
  reportsOwnErrors?: boolean;
};

export type StudyAvailability = {
  StudyInstanceUID: string;
  sources: SourceAvailability[];
};

export type CheckedDataSource = {
  sourceName: string;
  label: string;
  reportsOwnErrors?: boolean;
  dataSource: {
    query: { series: { search: (studyInstanceUid: string) => Promise<unknown[]> } };
  };
};

/**
 * Queries every data source for the series of a study in parallel. A failed
 * query is recorded rather than thrown, so one unreachable store does not hide
 * the result of the others. Some servers answer 404 for a study they do not
 * hold, so a 404 counts as "no series here", not as a failure.
 */
export async function checkStudyAvailability(
  StudyInstanceUID: string,
  dataSources: CheckedDataSource[]
): Promise<StudyAvailability> {
  const results = await Promise.allSettled(
    dataSources.map(({ dataSource }) => dataSource.query.series.search(StudyInstanceUID))
  );

  const sources = results.map((result, index): SourceAvailability => {
    const { sourceName, label, reportsOwnErrors } = dataSources[index];

    if (result.status === 'rejected' && (result.reason as { status?: number })?.status !== 404) {
      return {
        sourceName,
        label,
        status: 'failed',
        seriesInstanceUIDs: new Set(),
        error: result.reason,
        reportsOwnErrors,
      };
    }

    const value = result.status === 'fulfilled' ? result.value : [];
    const series = (Array.isArray(value) ? value : []) as Array<{
      seriesInstanceUid?: string;
    }>;
    const seriesInstanceUIDs = new Set(series.map(s => s.seriesInstanceUid).filter(Boolean));

    return {
      sourceName,
      label,
      status: seriesInstanceUIDs.size ? 'found' : 'empty',
      seriesInstanceUIDs,
      reportsOwnErrors,
    };
  });

  return { StudyInstanceUID, sources };
}

/**
 * Returns true when a derived display set (SEG, RTSTRUCT, ...) references a
 * series that no successfully queried data source holds in any of the
 * requested studies. A reference into another requested study is fine.
 */
export function isReferencedSeriesMissing(
  displaySet: { referencedSeriesInstanceUID?: string | null },
  availabilities: StudyAvailability[]
): boolean {
  const { referencedSeriesInstanceUID } = displaySet;
  if (!referencedSeriesInstanceUID) {
    return false;
  }

  const answered = availabilities
    .flatMap(availability => availability.sources)
    .filter(source => source.status !== 'failed');
  if (!answered.length) {
    return false;
  }

  return !answered.some(source => source.seriesInstanceUIDs.has(referencedSeriesInstanceUID));
}

/**
 * Extracts a readable reason from a dicomweb-client or fetch error. Status 0
 * means the request got no response at all (offline, firewall or CORS).
 */
export function describeError(error: unknown): string {
  const { status, message, request } = (error ?? {}) as {
    status?: number;
    message?: string;
    request?: { statusText?: string };
  };
  const statusText = request?.statusText;
  if (status === 0) {
    return 'no response from the server';
  }
  if (status) {
    return statusText ? `HTTP ${status} ${statusText}` : `HTTP ${status}`;
  }
  return message || String(error);
}
