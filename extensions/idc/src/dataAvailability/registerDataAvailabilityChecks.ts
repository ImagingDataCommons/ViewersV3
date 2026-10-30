import i18n from '@ohif/i18n';
import { utils } from '@ohif/core';

import {
  CheckedDataSource,
  StudyAvailability,
  checkStudyAvailability,
  describeError,
  isReferencedSeriesMissing,
} from './studyAvailability';

export type DataAvailabilityConfig = {
  enabled?: boolean;
};

const DICOMWEB_NAMESPACE = /dataSourcesModule\.dicomweb$/;

/**
 * Google Cloud Healthcare API stores are diagnosed and reported by the GCP
 * extension, which can tell the user why a store could not be read.
 */
const GCP_HEALTHCARE_HOST = 'healthcare.googleapis.com';

let displaySetsSubscription: { unsubscribe: () => void } | null = null;

/** Bumped on every register and unregister, so results of a left viewer are dropped. */
let generation = 0;

/** Toasts shown for the current viewer, hidden when it is left. */
const shownToastIds = new Set<string>();

let notificationService: { show: (options) => unknown; hide?: (id: string) => void } | null = null;

/** Persistent toasts get a button to close them; the toaster has no close button. */
const dismissAction = () => ({ label: i18n.t('DataAvailability:Dismiss'), onClick: () => {} });

function show(options: { id: string } & Record<string, unknown>) {
  shownToastIds.add(options.id);
  notificationService?.show(options);
}

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
      const qidoRoot: string | undefined = dataSource.getConfig?.()?.qidoRoot;
      if (!qidoRoot) {
        return null;
      }
      return {
        sourceName,
        label: getDataSourceLabel(sourceName, definition, dataSource),
        dataSource,
        reportsOwnErrors: qidoRoot.includes(GCP_HEALTHCARE_HOST),
      };
    })
    .filter(Boolean);
}

/**
 * Notifies about stores that could not be queried. A study missing from one
 * store is not reported: with ?gcp= the study is often only in the user's
 * store, and when no store has it OHIF shows its "study not found" page. GCP
 * stores are left to the GCP extension.
 */
function notifyFailedSources({ StudyInstanceUID, sources }: StudyAvailability) {
  sources
    .filter(source => source.status === 'failed' && !source.reportsOwnErrors)
    .forEach(source => {
      console.warn(
        `[IDC] Could not query ${source.label} for study ${StudyInstanceUID}:`,
        source.error
      );
      show({
        id: `idc-data-availability-failed-${source.sourceName}-${StudyInstanceUID}`,
        title: i18n.t('DataAvailability:Data source unavailable'),
        message: i18n.t(
          'DataAvailability:Could not query {{source}} for study {{studyInstanceUID}} ({{reason}}).',
          {
            source: source.label,
            studyInstanceUID: StudyInstanceUID,
            reason: describeError(source.error),
          }
        ),
        type: 'error',
        duration: Infinity,
        action: dismissAction(),
      });
    });
}

/** Labels of the derived series that reference each missing series, for one toast per series. */
const derivedLabelsByMissingSeries = new Map<string, Set<string>>();

function notifyMissingReferencedSeries(displaySet, availabilities: StudyAvailability[]) {
  const { referencedSeriesInstanceUID } = displaySet;
  if (!isReferencedSeriesMissing(displaySet, availabilities)) {
    return;
  }

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

  console.warn(
    `[IDC] ${displaySet.Modality} ${displaySet.SeriesInstanceUID} references series ` +
      `${referencedSeriesInstanceUID}, which was not found in ${searched}`
  );
  show({
    id: `idc-data-availability-reference-${referencedSeriesInstanceUID}`,
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
    action: dismissAction(),
  });
}

/**
 * Tells the user when the data they asked for is missing from a store:
 *   1. A data source (other than a GCP store) fails to answer for a study.
 *   2. A SEG, RTSTRUCT or other derived series references a series that none
 *      of the data sources hold for the requested studies, so it has no
 *      images to be displayed over.
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
  const dataSources = getDataSourcesToCheck(extensionManager);
  const studyInstanceUIDs = getStudyInstanceUIDsFromQuery();
  if (!dataSources.length || !studyInstanceUIDs.length) {
    return;
  }

  const isCurrent = () => current === generation;
  const availabilities = Promise.all(
    studyInstanceUIDs.map(StudyInstanceUID => checkStudyAvailability(StudyInstanceUID, dataSources))
  );

  availabilities.then(results => {
    if (isCurrent()) {
      results.forEach(notifyFailedSources);
    }
  });

  const checkDisplaySet = displaySet => {
    if (!displaySet?.referencedSeriesInstanceUID) {
      return;
    }
    availabilities.then(results => {
      /** A series already loaded, from any study, is not missing. */
      const loaded = displaySetService.getDisplaySetsForSeries(
        displaySet.referencedSeriesInstanceUID
      );
      if (isCurrent() && !loaded?.length) {
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
