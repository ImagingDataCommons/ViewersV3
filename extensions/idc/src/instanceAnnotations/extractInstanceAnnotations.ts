import {
  CodeNameCodeSequenceValues,
  ModifierRelationshipTypes,
  ValueTypes,
} from './constants';

/**
 * A single qualitative annotation (a TID 1501 CODE content item) describing a
 * property of an image instance, e.g. `{ label: 'Target Region', value: 'Neck' }`.
 */
export interface InstanceAnnotation {
  /** Human readable concept name, e.g. "Target Region". */
  label: string;
  /** Human readable concept value, e.g. "Neck". */
  value: string;
  /** Coded value of the concept value, e.g. "45048000". */
  codeValue?: string;
  /** Coding scheme designator of the concept value, e.g. "SCT". */
  codingSchemeDesignator?: string;
  /** Optional modifiers (subordinate codes), e.g. "Topographical modifier: Center". */
  modifiers?: Array<{ label: string; value: string }>;
  /** Tracking identifier of the owning measurement group, if any. */
  trackingIdentifier?: string;
  /** SOP Instance UID(s) referenced by the owning measurement group. */
  referencedSOPInstanceUID: string;
  /** Referenced frame number when the source is a multiframe image. */
  referencedFrameNumber?: number;
}

const toArray = value => (Array.isArray(value) ? value : value ? [value] : []);

const first = value => (Array.isArray(value) ? value[0] : value);

const getConceptName = item => first(item?.ConceptNameCodeSequence);

const getConceptCode = item => first(item?.ConceptCodeSequence);

/**
 * Extracts the modifiers (subordinate coded concepts) attached to a CODE
 * content item via a HAS CONCEPT MOD / HAS PROPERTIES relationship.
 */
function extractModifiers(codeItem): Array<{ label: string; value: string }> {
  const modifiers = [];

  toArray(codeItem?.ContentSequence).forEach(child => {
    if (child?.ValueType !== ValueTypes.CODE) {
      return;
    }

    if (!ModifierRelationshipTypes.includes(child?.RelationshipType)) {
      return;
    }

    const conceptName = getConceptName(child);
    const conceptCode = getConceptCode(child);

    if (!conceptCode) {
      return;
    }

    modifiers.push({
      label: conceptName?.CodeMeaning ?? '',
      value: conceptCode?.CodeMeaning ?? '',
    });
  });

  return modifiers;
}

/**
 * Collects the SOP Instance UIDs (and optional frame numbers) referenced by the
 * IMAGE content items of a TID 1501 measurement group.
 */
function getReferencedInstances(
  imageItems
): Array<{ ReferencedSOPInstanceUID: string; ReferencedFrameNumber?: number }> {
  const referenced = [];

  imageItems.forEach(imageItem => {
    toArray(imageItem?.ReferencedSOPSequence).forEach(ref => {
      if (!ref?.ReferencedSOPInstanceUID) {
        return;
      }

      const frames = toArray(ref.ReferencedFrameNumber);
      if (frames.length) {
        frames.forEach(frame =>
          referenced.push({
            ReferencedSOPInstanceUID: ref.ReferencedSOPInstanceUID,
            ReferencedFrameNumber: Number(frame),
          })
        );
      } else {
        referenced.push({ ReferencedSOPInstanceUID: ref.ReferencedSOPInstanceUID });
      }
    });
  });

  return referenced;
}

/**
 * Parses a single TID 1501 style Measurement Group and returns the qualitative
 * annotations it carries, keyed nowhere yet (callers index by SOP Instance UID).
 *
 * A group is considered an instance level qualitative annotation group when it
 * contains one or more IMAGE content items and one or more CODE content items,
 * and is NOT a geometric measurement (i.e. has no SCOORD / SCOORD3D).
 */
function processMeasurementGroup(group): InstanceAnnotation[] {
  const items = toArray(group?.ContentSequence);

  // Skip geometric measurement groups (handled by the SR extension itself).
  const hasGeometry = items.some(
    item => item?.ValueType === ValueTypes.SCOORD || item?.ValueType === ValueTypes.SCOORD3D
  );
  if (hasGeometry) {
    return [];
  }

  const imageItems = items.filter(item => item?.ValueType === ValueTypes.IMAGE);
  if (!imageItems.length) {
    return [];
  }

  const codeItems = items.filter(item => item?.ValueType === ValueTypes.CODE);
  if (!codeItems.length) {
    return [];
  }

  const trackingIdentifierItem = items.find(
    item => getConceptName(item)?.CodeValue === CodeNameCodeSequenceValues.TrackingIdentifier
  );
  const trackingIdentifier = trackingIdentifierItem?.TextValue;

  const referencedInstances = getReferencedInstances(imageItems);
  if (!referencedInstances.length) {
    return [];
  }

  const annotations: InstanceAnnotation[] = [];

  referencedInstances.forEach(({ ReferencedSOPInstanceUID, ReferencedFrameNumber }) => {
    codeItems.forEach(codeItem => {
      const conceptName = getConceptName(codeItem);
      const conceptCode = getConceptCode(codeItem);

      if (!conceptName || !conceptCode) {
        return;
      }

      const modifiers = extractModifiers(codeItem);

      annotations.push({
        label: conceptName.CodeMeaning ?? '',
        value: conceptCode.CodeMeaning ?? '',
        codeValue: conceptCode.CodeValue,
        codingSchemeDesignator: conceptCode.CodingSchemeDesignator,
        modifiers: modifiers.length ? modifiers : undefined,
        trackingIdentifier,
        referencedSOPInstanceUID: ReferencedSOPInstanceUID,
        referencedFrameNumber: ReferencedFrameNumber,
      });
    });
  });

  return annotations;
}

/**
 * Extracts all instance level qualitative annotations (TID 1500 / TID 1501) from
 * the root content sequence of a DICOM SR instance.
 *
 * @param contentSequence - The root container ContentSequence of the SR instance
 *   (i.e. `srInstance.ContentSequence`).
 * @returns A flat list of {@link InstanceAnnotation}s referencing image instances.
 */
export function extractInstanceAnnotations(contentSequence): InstanceAnnotation[] {
  const rootItems = toArray(contentSequence);
  if (!rootItems.length) {
    return [];
  }

  const imagingMeasurements = rootItems.find(
    item => getConceptName(item)?.CodeValue === CodeNameCodeSequenceValues.ImagingMeasurements
  );

  if (!imagingMeasurements) {
    return [];
  }

  const measurementGroups = toArray(imagingMeasurements.ContentSequence).filter(
    item => getConceptName(item)?.CodeValue === CodeNameCodeSequenceValues.MeasurementGroup
  );

  if (!measurementGroups.length) {
    return [];
  }

  return measurementGroups.flatMap(processMeasurementGroup);
}

export default extractInstanceAnnotations;
