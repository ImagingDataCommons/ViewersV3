import React from 'react';

import { SR_SOP_CLASS_UIDS } from './constants';
import { extractInstanceAnnotations } from './extractInstanceAnnotations';
import instanceAnnotationStore from './instanceAnnotationStore';
import InstanceAnnotationsOverlay, {
  InstanceAnnotationsConfig,
} from './InstanceAnnotationsOverlay';

const OVERLAY_ITEM_ID = 'instanceQualitativeAnnotations';

let displaySetsSubscription: { unsubscribe: () => void } | null = null;

function isStructuredReport(displaySet): boolean {
  if (!displaySet) {
    return false;
  }
  if (displaySet.Modality === 'SR') {
    return true;
  }
  const sopClassUID = displaySet.SOPClassUID ?? displaySet.instance?.SOPClassUID;
  return SR_SOP_CLASS_UIDS.includes(sopClassUID);
}

/**
 * Parses a single SR display set for instance level qualitative annotations and
 * adds the result to the shared store. The CODE/IMAGE content items required by
 * this feature live directly in the instance metadata, so no bulk-data load is
 * needed before parsing.
 */
function processDisplaySet(displaySet): void {
  if (!isStructuredReport(displaySet)) {
    return;
  }

  const instance = displaySet.instance ?? displaySet.instances?.[displaySet.instances.length - 1];
  const contentSequence = instance?.ContentSequence;
  if (!contentSequence) {
    return;
  }

  const annotations = extractInstanceAnnotations(contentSequence);
  instanceAnnotationStore.addAnnotations(displaySet.displaySetInstanceUID, annotations);
}

/**
 * Registers the instance level qualitative annotation feature:
 *   1. Parses already loaded and future SR display sets into the shared store.
 *   2. Appends an overlay item that renders the annotations over the referenced
 *      image instances (bottom-right of the viewport).
 *
 * Safe to call on every `onModeEnter`; previous subscriptions are torn down and
 * the store is reset so annotations do not leak across studies/modes.
 */
export function registerInstanceAnnotations({
  servicesManager,
  config,
}: {
  servicesManager: AppTypes.ServicesManager;
  config?: InstanceAnnotationsConfig;
}): void {
  const { displaySetService, customizationService } = servicesManager.services;

  if (config?.enabled === false) {
    return;
  }

  // Reset state from any previous mode/study.
  displaySetsSubscription?.unsubscribe();
  instanceAnnotationStore.clear();

  // Parse SR display sets that were already added before we subscribed.
  displaySetService.getActiveDisplaySets?.().forEach(processDisplaySet);

  displaySetsSubscription = displaySetService.subscribe(
    displaySetService.EVENTS.DISPLAY_SETS_ADDED,
    ({ displaySetsAdded }) => {
      displaySetsAdded?.forEach(processDisplaySet);
    }
  );

  // Append the overlay item to the bottom-right viewport overlay region so it
  // does not collide with the bottom-left text overlays.
  const overlayItem = {
    id: OVERLAY_ITEM_ID,
    config,
    contentF: overlayProps => <InstanceAnnotationsOverlay {...overlayProps} />,
  };

  const existing = customizationService.getCustomization('viewportOverlay.bottomRight');

  // Avoid registering the overlay item more than once for the same mode entry.
  if (Array.isArray(existing) && existing.some(item => item?.id === OVERLAY_ITEM_ID)) {
    return;
  }

  customizationService.setCustomizations({
    'viewportOverlay.bottomRight': Array.isArray(existing)
      ? { $push: [overlayItem] }
      : { $set: [overlayItem] },
  });
}

export default registerInstanceAnnotations;
