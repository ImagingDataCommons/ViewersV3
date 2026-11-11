/** SOP Class UID of DICOM Segmentation Storage */
const SEG_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.66.4';

/** Maximum content tree depth searched for references to a segmentation */
const MAX_CONTENT_DEPTH = 8;

type SRSegmentationReferences = {
  seriesInstanceUIDs: Set<string>;
  sopInstanceUIDs: Set<string>;
};

/** Parsed SR references, cached because an SR instance never changes */
const srReferencesCache = new WeakMap<object, SRSegmentationReferences>();

function _toArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Collects the series and instances an SR cites as evidence, plus the
 * segmentation instances its content tree points to (e.g. the "Referenced
 * Segment" items of a TID 1411 volumetric measurement).
 */
function _getSRSegmentationReferences(instance): SRSegmentationReferences {
  const cached = srReferencesCache.get(instance);
  if (cached) {
    return cached;
  }

  const seriesInstanceUIDs = new Set<string>();
  const sopInstanceUIDs = new Set<string>();

  const evidence = [
    ..._toArray(instance.CurrentRequestedProcedureEvidenceSequence),
    ..._toArray(instance.PertinentOtherEvidenceSequence),
  ];
  evidence.forEach(study =>
    _toArray(study.ReferencedSeriesSequence).forEach(series => {
      if (series.SeriesInstanceUID) {
        seriesInstanceUIDs.add(series.SeriesInstanceUID);
      }
      _toArray(series.ReferencedSOPSequence).forEach(sop => {
        if (sop.ReferencedSOPClassUID === SEG_SOP_CLASS_UID && sop.ReferencedSOPInstanceUID) {
          sopInstanceUIDs.add(sop.ReferencedSOPInstanceUID);
        }
      });
    })
  );

  const walk = (items, depth) => {
    if (depth > MAX_CONTENT_DEPTH) {
      return;
    }
    _toArray(items).forEach(item => {
      _toArray(item.ReferencedSOPSequence).forEach(sop => {
        if (sop.ReferencedSOPClassUID === SEG_SOP_CLASS_UID && sop.ReferencedSOPInstanceUID) {
          sopInstanceUIDs.add(sop.ReferencedSOPInstanceUID);
        }
      });
      walk(item.ContentSequence, depth + 1);
    });
  };
  walk(instance.ContentSequence, 0);

  const references = { seriesInstanceUIDs, sopInstanceUIDs };
  srReferencesCache.set(instance, references);
  return references;
}

/**
 * Returns the SeriesInstanceUIDs of the image series a derived display set
 * applies to.
 *
 * SEG, RTSTRUCT and similar display sets name their referenced series
 * directly. Measurement SRs computed from a segmentation (for instance the
 * TotalSegmentator radiomics SRs) carry no image series reference of their
 * own, so they are resolved through the segmentation they point to: any SEG
 * display set the SR cites, by series or by instance, contributes the series
 * that SEG references.
 *
 * @param displaySet - The display set to resolve
 * @param displaySets - The display sets to look the segmentations up in
 */
export default function getReferencedSeriesInstanceUIDs(displaySet, displaySets = []): string[] {
  if (!displaySet) {
    return [];
  }

  if (displaySet.referencedSeriesInstanceUID) {
    return [displaySet.referencedSeriesInstanceUID];
  }

  if (displaySet.Modality !== 'SR' || !displaySet.instance) {
    return [];
  }

  const { seriesInstanceUIDs, sopInstanceUIDs } = _getSRSegmentationReferences(displaySet.instance);
  if (!seriesInstanceUIDs.size && !sopInstanceUIDs.size) {
    return [];
  }

  const referenced = new Set<string>();
  displaySets.forEach(ds => {
    if (ds.Modality !== 'SEG' || !ds.referencedSeriesInstanceUID) {
      return;
    }
    if (
      seriesInstanceUIDs.has(ds.SeriesInstanceUID) ||
      sopInstanceUIDs.has(ds.SOPInstanceUID) ||
      _toArray(ds.instances).some(instance => sopInstanceUIDs.has(instance?.SOPInstanceUID))
    ) {
      referenced.add(ds.referencedSeriesInstanceUID);
    }
  });

  return [...referenced];
}
