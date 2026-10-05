/**
 * IDC Viewer production configuration template.
 *
 * Placeholders like _X___IDC__Z__ROOT___Y_ are replaced during deployment.
 */
window.config = {
  routerBasename: '/v3',
  modesConfiguration: {
    '@ohif/mode-segmentation': {
      hide: { $set: true },
    },
    '@idc/gcp-mode': {
      hide: { $set: true },
    },
  },
  /**
   * IDC branding / white labeling.
   * Logo dimensions follow OHIF standard (h-[28px] with auto width for 4:1 aspect ratio).
   */
  whiteLabeling: {
    createLogoComponentFn: function (React) {
      return React.createElement(
        'a',
        {
          target: '_self',
          rel: 'noopener noreferrer',
          className: 'flex items-center',
          href: '_X___IDC__LOGO__LINK___Y_',
        },
        React.createElement('img', {
          src: '/v3/IDC-Logo-WHITE.svg',
          alt: 'IDC Logo',
          className: 'h-[48px] w-auto',
        })
      );
    },
  },
  investigationalUseDialog: {
    option: 'never',
  },
  idcDownloadCommandsDialog: {
    description: 'Follow the instructions below to download the study or series:',
    instructions: [
      {
        command: 'pip install idc-index --upgrade',
        label: 'First, install the idc-index python package:',
      },
      {
        command: `idc download {{StudyInstanceUID}}`,
        label: 'Then, to download the whole study, run:',
      },
      {
        command: `idc download {{SeriesInstanceUID}}`,
        label: "Or, to download just the active viewport's series, run:",
      },
    ],
  },
  extensions: [],
  modes: [],
  customizationService: {
    global: [
      {
        'studyBrowser.studyMode': { $set: 'primary' },
        'panelSegmentation.disableEditing': { $set: true },
        'panelMeasurement.disableEditing': { $set: true },
      },
    ],
  },
  showStudyList: false,
  disableConfirmationPrompts: true,
  maxNumberOfWebWorkers: 3,
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  strictZSpacingForVolumeViewport: true,
  maxNumRequests: {
    interaction: 100,
    thumbnail: 75,
    prefetch: 25,
  },
  /**
   * Default data source - uses IDC DICOMWeb directly.
   * When ?gcp= param is present, the GCP extension activates the merge data source.
   */
  defaultDataSourceName: 'idc-dicomweb',
  dataSources: [
    /**
     * IDC's primary DICOMWeb server (static WADO).
     */
    {
      friendlyName: 'IDC Data Source',
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'idc-dicomweb',
      configuration: {
        name: 'idc-dicomweb',
        wadoUriRoot: '_X___IDC__Z__ROOT___Y_',
        qidoRoot: '_X___IDC__Z__ROOT___Y_',
        wadoRoot: '_X___IDC__Z__ROOT___Y_',
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: false,
        staticWado: true,
        singlepart: 'bulkdata,video',
        omitQuotationForMultipartRequest: true,
        bulkDataURI: {
          enabled: false,
        },
      },
    },
    /**
     * GCP Healthcare API data source.
     * Dynamically configured from ?gcp= query param.
     */
    {
      friendlyName: 'GCP Healthcare API',
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'gcp',
      configuration: {
        name: 'gcp',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: false,
        singlepart: 'bulkdata,video,pdf',
        bulkDataURI: { enabled: false },
        omitQuotationForMultipartRequest: true,
        onConfiguration: function (dicomWebConfig, options) {
          var query = options.query;
          var gcpParam = query.get('gcp');

          if (!gcpParam) {
            return dicomWebConfig;
          }

          var gcpUrlRegex =
            /^(https:\/\/healthcare\.googleapis\.com\/v1\/)?projects\/([^/]+)\/locations\/([^/]+)\/datasets\/([^/]+)\/dicomStores\/([^/]+)/;
          var match = gcpParam.match(gcpUrlRegex);

          if (!match) {
            console.warn('[GCP Data Source] Invalid GCP URL format:', gcpParam);
            return dicomWebConfig;
          }

          var dicomWebUrl =
            'https://healthcare.googleapis.com/v1/projects/' +
            match[2] +
            '/locations/' +
            match[3] +
            '/datasets/' +
            match[4] +
            '/dicomStores/' +
            match[5] +
            '/dicomWeb';

          return Object.assign({}, dicomWebConfig, {
            wadoUriRoot: dicomWebUrl,
            qidoRoot: dicomWebUrl,
            wadoRoot: dicomWebUrl,
          });
        },
      },
    },
    /**
     * Merge data source - combines IDC and GCP data sources.
     */
    {
      friendlyName: 'IDC + GCP Merge',
      namespace: '@ohif/extension-default.dataSourcesModule.merge',
      sourceName: 'idc-merge',
      configuration: {
        name: 'idc-merge',
        seriesMerge: {
          dataSourceNames: ['idc-dicomweb', 'gcp'],
          defaultDataSourceName: 'idc-dicomweb',
        },
      },
    },
  ],
  httpErrorHandler: error => {
    console.warn(error.status);
    if (error.status == 429) {
      window.location = '_X___IDC__Z__QUOTA___Y_';
    }
  },
  hotkeys: [
    {
      commandName: 'incrementActiveViewport',
      label: 'Next Viewport',
      keys: ['right'],
    },
    {
      commandName: 'decrementActiveViewport',
      label: 'Previous Viewport',
      keys: ['left'],
    },
    { commandName: 'rotateViewportCW', label: 'Rotate Right', keys: ['r'] },
    { commandName: 'rotateViewportCCW', label: 'Rotate Left', keys: ['l'] },
    { commandName: 'invertViewport', label: 'Invert', keys: ['i'] },
    {
      commandName: 'flipViewportHorizontal',
      label: 'Flip Horizontally',
      keys: ['h'],
    },
    {
      commandName: 'flipViewportVertical',
      label: 'Flip Vertically',
      keys: ['v'],
    },
    { commandName: 'scaleUpViewport', label: 'Zoom In', keys: ['+'] },
    { commandName: 'scaleDownViewport', label: 'Zoom Out', keys: ['-'] },
    { commandName: 'fitViewportToWindow', label: 'Zoom to Fit', keys: ['='] },
    { commandName: 'resetViewport', label: 'Reset', keys: ['space'] },
    { commandName: 'nextImage', label: 'Next Image', keys: ['down'] },
    { commandName: 'previousImage', label: 'Previous Image', keys: ['up'] },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'Zoom' },
      label: 'Zoom',
      keys: ['z'],
    },
    {
      commandName: 'windowLevelPreset1',
      label: 'W/L Preset 1',
      keys: ['1'],
    },
    {
      commandName: 'windowLevelPreset2',
      label: 'W/L Preset 2',
      keys: ['2'],
    },
    {
      commandName: 'windowLevelPreset3',
      label: 'W/L Preset 3',
      keys: ['3'],
    },
    {
      commandName: 'windowLevelPreset4',
      label: 'W/L Preset 4',
      keys: ['4'],
    },
    {
      commandName: 'windowLevelPreset5',
      label: 'W/L Preset 5',
      keys: ['5'],
    },
    {
      commandName: 'windowLevelPreset6',
      label: 'W/L Preset 6',
      keys: ['6'],
    },
    {
      commandName: 'windowLevelPreset7',
      label: 'W/L Preset 7',
      keys: ['7'],
    },
    {
      commandName: 'windowLevelPreset8',
      label: 'W/L Preset 8',
      keys: ['8'],
    },
    {
      commandName: 'windowLevelPreset9',
      label: 'W/L Preset 9',
      keys: ['9'],
    },
  ],
};
