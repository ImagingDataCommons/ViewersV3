import i18n from '@ohif/i18n';
import { DicomMetadataStore, utils } from '@ohif/core';

import {
  CheckedDataSource,
  StudyAvailability,
  checkStudyAvailability,
  isReferencedSeriesMissing,
} from './studyAvailability';

export type DataAvailabilityConfig = {
  enabled?: boolean;
};

const DICOMWEB_NAMESPACE = /dataSourcesModule\.dicomweb$/;

let displaySetsSubscription: { unsubscribe: () => void } | null = null;

/** Bumped on every register and unregister, so results of a left viewer are dropped. */
let generation = 0;

/** Toasts shown for the current viewer, hidden when it is left. */
const shownToastIds = new Set<string>();

let notificationService: { show: (options) => unknown; hide?: (id: string) => void } | null = null;

/** Labels of the derived series that reference each missing series, for one toast per series. */
const derivedLabelsByMissingSeries = new Map<string, Set<string>>();

/** Reads the study UIDs from the URL the same way the DICOMweb data source does. */
function getStudyInstanceUIDsFromQuery(): string[] {
  const query = new URLSearchParams(window.location.search);
  return utils.splitComma(
    query.getAll('StudyInstanceUIDs').concat(query.getAll('studyInstanceUIDs'))
  );
}

/**
 * Builds a label users can act on. Stores configured at runtime (for example
 * from the ?gcp= query param) are named by their DICOM store, not by the
 * generic friendly name of the data source.
 */
function getDataSourceLabel(sourceName: string, definition, dataSource): string {
  const qidoRoot: string | undefined = dataSource.getConfig?.()?.qidoRoot;
  const store = qidoRoot?.match(/\/dicomStores\/([^/]+)/)?.[1];
  if (store) {
    return i18n.t('DataAvailability:GCP DICOM store {{store}}', { store });
  }
  return definition?.friendlyName || definition?.configuration?.friendlyName || sourceName;
}

/**
 * Returns the DICOMweb data sources behind the active data source: each member
 * of a merge data source, or the active data source itself. Sources without a
 * QIDO root (for example `gcp` without a valid ?gcp= param) are skipped.
 */
function getDataSourcesToCheck(extensionManager): CheckedDataSource[] {
  const activeDefinition = extensionManager.getActiveDataSourceDefinition();
  if (!activeDefinition) {
    return [];
  }

  const sourceNames: string[] = activeDefinition.configuration?.seriesMerge?.dataSourceNames ?? [
    activeDefinition.sourceName,
  ];

  return sourceNames
    .map(sourceName => {
      const definition = extensionManager.getDataSourceDefinition(sourceName);
      const dataSource = extensionManager.getDataSources(sourceName)?.[0];
      if (!DICOMWEB_NAMESPACE.test(definition?.namespace ?? '') || !dataSource?.query?.series) {
        return null;
      }
      if (!dataSource.getConfig?.()?.qidoRoot) {
        return null;
      }
      return {
        sourceName,
        label: getDataSourceLabel(sourceName, definition, dataSource),
        dataSource,
      };
    })
    .filter(Boolean);
}

function notifyMissingReferencedSeries(displaySet, availabilities: StudyAvailability[]) {
  const { referencedSeriesInstanceUID } = displaySet;
  const sources = availabilities.flatMap(availability => availability.sources);
  const unique = (labels: string[]) => [...new Set(labels)].join(', ');
  const searched = unique(sources.filter(s => s.status !== 'failed').map(s => s.label));
  const unchecked = unique(sources.filter(s => s.status === 'failed').map(s => s.label));

  const labels = derivedLabelsByMissingSeries.get(referencedSeriesInstanceUID) ?? new Set();
  labels.add(
    `${displaySet.label || displaySet.SeriesDescription || displaySet.SeriesInstanceUID} (${displaySet.Modality})`
  );
  derivedLabelsByMissingSeries.set(referencedSeriesInstanceUID, labels);

  const options = {
    derived: [...labels].join(', '),
    seriesInstanceUID: referencedSeriesInstanceUID,
    sources: searched,
    unchecked,
  };
  const id = `idc-data-availability-reference-${referencedSeriesInstanceUID}`;

  console.warn(
    `[IDC] ${displaySet.Modality} ${displaySet.SeriesInstanceUID} references series ` +
      `${referencedSeriesInstanceUID}, which was not found in ${searched}`
  );
  shownToastIds.add(id);
  notificationService?.show({
    id,
    title: i18n.t('DataAvailability:Referenced series not found'),
    message: unchecked
      ? i18n.t(
          'DataAvailability:{{derived}} references series {{seriesInstanceUID}}, which was not found in {{sources}}. {{unchecked}} could not be checked and may hold it.',
          options
        )
      : i18n.t(
          'DataAvailability:{{derived}} references series {{seriesInstanceUID}}, which was not found in {{sources}}. It cannot be displayed over its source images.',
          options
        ),
    type: 'warning',
    duration: Infinity,
    /** The toaster has no close button; its action closes the toast. */
    action: { label: i18n.t('DataAvailability:Dismiss'), onClick: () => {} },
  });
}

/**
 * Tells the user when a SEG, RTSTRUCT or other derived series references a
 * series that none of the data sources hold for the requested studies, so it
 * has no images to be displayed over. With ?gcp= the data sources are the
 * members of the merge data source.
 *
 * Normal loads send no extra requests: a reference is first looked up in the
 * loaded display sets and in the series lists OHIF already fetched. Only a
 * reference found in neither makes one series search per study and source.
 *
 * Safe to call on every `onModeEnter`; the previous registration is torn down.
 */
export function registerDataAvailabilityChecks({
  servicesManager,
  extensionManager,
  config,
}: {
  servicesManager: AppTypes.ServicesManager;
  extensionManager;
  config?: DataAvailabilityConfig;
}): void {
  unregisterDataAvailabilityChecks();
  const current = generation;

  if (config?.enabled === false) {
    return;
  }

  const { displaySetService, uiNotificationService } = servicesManager.services;
  notificationService = uiNotificationService;
  const studyInstanceUIDs = getStudyInstanceUIDsFromQuery();
  if (!studyInstanceUIDs.length) {
    return;
  }

  /** A series is known once it is loaded or listed by a source, in any requested study. */
  const isKnown = (seriesInstanceUID: string) =>
    displaySetService.getDisplaySetsForSeries(seriesInstanceUID)?.length > 0 ||
    studyInstanceUIDs.some(StudyInstanceUID =>
      DicomMetadataStore.getSeries(StudyInstanceUID, seriesInstanceUID)
    );

  let availabilities: Promise<StudyAvailability[]> | null = null;
  const getAvailabilities = () => {
    if (!availabilities) {
      const dataSources = getDataSourcesToCheck(extensionManager);
      availabilities = Promise.all(
        studyInstanceUIDs.map(StudyInstanceUID =>
          checkStudyAvailability(StudyInstanceUID, dataSources)
        )
      );
    }
    return availabilities;
  };

  const checkDisplaySet = displaySet => {
    const { referencedSeriesInstanceUID } = displaySet ?? {};
    if (!referencedSeriesInstanceUID || isKnown(referencedSeriesInstanceUID)) {
      return;
    }
    getAvailabilities().then(results => {
      if (
        current === generation &&
        !isKnown(referencedSeriesInstanceUID) &&
        isReferencedSeriesMissing(displaySet, results)
      ) {
        notifyMissingReferencedSeries(displaySet, results);
      }
    });
  };

  displaySetsSubscription = displaySetService.subscribe(
    displaySetService.EVENTS.DISPLAY_SETS_ADDED,
    ({ displaySetsAdded }) => {
      displaySetsAdded?.forEach(checkDisplaySet);
    }
  );
}

/** Drops pending results, hides this viewer's toasts and stops listening when the mode exits. */
export function unregisterDataAvailabilityChecks(): void {
  generation++;
  displaySetsSubscription?.unsubscribe();
  displaySetsSubscription = null;
  shownToastIds.forEach(id => notificationService?.hide?.(id));
  shownToastIds.clear();
  derivedLabelsByMissingSeries.clear();
}
