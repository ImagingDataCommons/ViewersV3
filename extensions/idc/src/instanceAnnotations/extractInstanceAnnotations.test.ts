import { extractInstanceAnnotations } from './extractInstanceAnnotations';

const REFERENCED_SOP_INSTANCE_UID = '1.2.3.4.5.6.7.8.9';

/**
 * Builds the root ContentSequence of a TID 1500 Imaging Measurement Report whose
 * single Measurement Group carries instance level qualitative codes, mirroring
 * the example in https://github.com/OHIF/Viewers/issues/3358.
 */
function buildReportContentSequence(measurementGroupItems) {
  return [
    {
      RelationshipType: 'HAS CONCEPT MOD',
      ValueType: 'CODE',
      ConceptNameCodeSequence: { CodeValue: '121049', CodeMeaning: 'Language of Content Item' },
    },
    {
      RelationshipType: 'CONTAINS',
      ValueType: 'CONTAINER',
      ConceptNameCodeSequence: { CodeValue: '126010', CodeMeaning: 'Imaging Measurements' },
      ContentSequence: [
        {
          RelationshipType: 'CONTAINS',
          ValueType: 'CONTAINER',
          ConceptNameCodeSequence: { CodeValue: '125007', CodeMeaning: 'Measurement Group' },
          ContentSequence: measurementGroupItems,
        },
      ],
    },
  ];
}

const trackingItems = [
  {
    RelationshipType: 'HAS OBS CONTEXT',
    ValueType: 'TEXT',
    ConceptNameCodeSequence: { CodeValue: '112039', CodeMeaning: 'Tracking Identifier' },
    TextValue: 'Annotations group x',
  },
  {
    RelationshipType: 'HAS OBS CONTEXT',
    ValueType: 'UIDREF',
    ConceptNameCodeSequence: { CodeValue: '112040', CodeMeaning: 'Tracking Unique Identifier' },
    UID: '1.2.826.0.1.3680043.8.498.11346640510041906666146760516895890504',
  },
];

const imageItem = {
  RelationshipType: 'CONTAINS',
  ValueType: 'IMAGE',
  ConceptNameCodeSequence: { CodeValue: '121112', CodeMeaning: 'Source of Measurement' },
  ReferencedSOPSequence: {
    ReferencedSOPClassUID: '1.2.840.10008.5.1.4.1.1.2',
    ReferencedSOPInstanceUID: REFERENCED_SOP_INSTANCE_UID,
  },
};

describe('extractInstanceAnnotations', () => {
  it('extracts qualitative CODE items referencing an image instance', () => {
    const contentSequence = buildReportContentSequence([
      ...trackingItems,
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'CODE',
        ConceptNameCodeSequence: { CodeValue: '123014', CodeMeaning: 'Target Region' },
        ConceptCodeSequence: {
          CodeValue: '69536005',
          CodingSchemeDesignator: 'SCT',
          CodeMeaning: 'Head',
        },
      },
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'CODE',
        ConceptNameCodeSequence: { CodeValue: '123014', CodeMeaning: 'Target Region' },
        ConceptCodeSequence: {
          CodeValue: '45048000',
          CodingSchemeDesignator: 'SCT',
          CodeMeaning: 'Neck',
        },
      },
      imageItem,
    ]);

    const annotations = extractInstanceAnnotations(contentSequence);

    expect(annotations).toHaveLength(2);
    expect(annotations[0]).toMatchObject({
      label: 'Target Region',
      value: 'Head',
      codeValue: '69536005',
      codingSchemeDesignator: 'SCT',
      referencedSOPInstanceUID: REFERENCED_SOP_INSTANCE_UID,
      trackingIdentifier: 'Annotations group x',
    });
    expect(annotations[1]).toMatchObject({ label: 'Target Region', value: 'Neck' });
  });

  it('captures modifiers attached to a qualitative code', () => {
    const contentSequence = buildReportContentSequence([
      ...trackingItems,
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'CODE',
        ConceptNameCodeSequence: { CodeValue: '123014', CodeMeaning: 'Finding' },
        ConceptCodeSequence: { CodeValue: '108369006', CodingSchemeDesignator: 'SCT', CodeMeaning: 'Tumor' },
        ContentSequence: [
          {
            RelationshipType: 'HAS CONCEPT MOD',
            ValueType: 'CODE',
            ConceptNameCodeSequence: { CodeValue: '106233006', CodeMeaning: 'Topographical modifier' },
            ConceptCodeSequence: { CodeValue: '26216008', CodingSchemeDesignator: 'SCT', CodeMeaning: 'Center' },
          },
        ],
      },
      imageItem,
    ]);

    const annotations = extractInstanceAnnotations(contentSequence);

    expect(annotations).toHaveLength(1);
    expect(annotations[0].modifiers).toEqual([
      { label: 'Topographical modifier', value: 'Center' },
    ]);
  });

  it('ignores geometric (SCOORD) measurement groups', () => {
    const contentSequence = buildReportContentSequence([
      ...trackingItems,
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'SCOORD',
        ConceptNameCodeSequence: { CodeValue: '111030', CodeMeaning: 'Image Region' },
        GraphicType: 'POLYLINE',
        GraphicData: [0, 0, 1, 1],
      },
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'CODE',
        ConceptNameCodeSequence: { CodeValue: '123014', CodeMeaning: 'Target Region' },
        ConceptCodeSequence: { CodeValue: '45048000', CodingSchemeDesignator: 'SCT', CodeMeaning: 'Neck' },
      },
      imageItem,
    ]);

    expect(extractInstanceAnnotations(contentSequence)).toHaveLength(0);
  });

  it('ignores groups without an IMAGE reference', () => {
    const contentSequence = buildReportContentSequence([
      ...trackingItems,
      {
        RelationshipType: 'CONTAINS',
        ValueType: 'CODE',
        ConceptNameCodeSequence: { CodeValue: '123014', CodeMeaning: 'Target Region' },
        ConceptCodeSequence: { CodeValue: '45048000', CodingSchemeDesignator: 'SCT', CodeMeaning: 'Neck' },
      },
    ]);

    expect(extractInstanceAnnotations(contentSequence)).toHaveLength(0);
  });

  it('returns an empty list when there are no imaging measurements', () => {
    expect(extractInstanceAnnotations([])).toEqual([]);
    expect(extractInstanceAnnotations(undefined)).toEqual([]);
  });
});
