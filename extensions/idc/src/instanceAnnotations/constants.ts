/**
 * DICOM SR SOP Class UIDs that may contain TID 1500 Imaging Measurement Reports.
 */
export const SR_SOP_CLASS_UIDS = [
  '1.2.840.10008.5.1.4.1.1.88.11', // Basic Text SR
  '1.2.840.10008.5.1.4.1.1.88.22', // Enhanced SR
  '1.2.840.10008.5.1.4.1.1.88.33', // Comprehensive SR
  '1.2.840.10008.5.1.4.1.1.88.34', // Comprehensive 3D SR
];

/**
 * Concept name CodeValues used while traversing a TID 1500 report tree to reach
 * the TID 1501 Measurement Groups holding instance level qualitative codes.
 */
export const CodeNameCodeSequenceValues = {
  ImagingMeasurementReport: '126000',
  ImagingMeasurements: '126010',
  MeasurementGroup: '125007',
  TrackingIdentifier: '112039',
  TrackingUniqueIdentifier: '112040',
};

/**
 * SR content item value types relevant for instance level qualitative annotations.
 */
export const ValueTypes = {
  CODE: 'CODE',
  IMAGE: 'IMAGE',
  SCOORD: 'SCOORD',
  SCOORD3D: 'SCOORD3D',
  NUM: 'NUM',
};

/**
 * Relationship types used to identify modifiers attached to a qualitative code.
 */
export const ModifierRelationshipTypes = ['HAS CONCEPT MOD', 'HAS PROPERTIES'];
