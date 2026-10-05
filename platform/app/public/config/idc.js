/** @type {AppTypes.Config} */

/**
 * IDC production configuration.
 * Based on OHIF 3.13 config structure with IDC-specific customizations.
 */
window.config = {
  name: 'config/idc.js',
  routerBasename: null,
  extensions: [],
  modes: [],

  /**
   * Customization service using the new phased format (OHIF 3.13+).
   * The `global` array is applied after extensions register.
   */
  customizationService: {
    global: [
      {
        'studyBrowser.studyMode': { $set: 'primary' },
        'panelSegmentation.disableEditing': { $set: true },
        'panelMeasurement.disableEditing': { $set: true },
      },
    ],
  },

  /**
   * Disable the investigational use dialog for IDC.
   */
  investigationalUseDialog: {
    option: 'never',
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
          href: '/',
        },
        React.createElement('img', {
          src: '/assets/idc.svg',
          alt: 'IDC Logo',
          className: 'h-[48px] w-auto',
        })
      );
    },
  },

  /**
   * IDC instance annotations configuration (used by @ohif/extension-idc).
   */
  instanceAnnotations: {
    enabled: true,
    maxLabels: 10,
    showColor: true,
  },

  /**
   * IDC download commands dialog configuration (used by @ohif/extension-idc).
   */
  idcDownloadCommandsDialog: {
    description: 'Follow the instructions below to download the study or series:',
    instructions: [
      {
        command: 'pip install idc-index --upgrade',
        label: 'First, install the idc-index python package:',
      },
      {
        command: 'idc download {{StudyInstanceUID}}',
        label: 'Then, to download the whole study, run:',
      },
      {
        command: 'idc download {{SeriesInstanceUID}}',
        label: "Or, to download just the active viewport's series, run:",
      },
    ],
  },

  /**
   * Mode visibility configuration.
   * GCP mode is hidden by default (used via direct routing, not mode selector).
   */
  modesConfiguration: {
    '@ohif/mode-segmentation': {
      hide: { $set: true },
    },
    '@idc/gcp-mode': {
      hide: { $set: true },
    },
  },

  showStudyList: true,
  disableConfirmationPrompts: true,
  maxNumberOfWebWorkers: 3,
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  experimentalStudyBrowserSort: false,
  strictZSpacingForVolumeViewport: true,
  groupEnabledModesFirst: true,
  allowMultiSelectExport: false,

  maxNumRequests: {
    interaction: 100,
    thumbnail: 75,
    prefetch: 25,
  },

  showErrorDetails: 'always',

  /**
   * Default data source - uses IDC DICOMWeb directly.
   * When ?gcp= param is present, the GCP extension activates the merge data source.
   */
  defaultDataSourceName: 'idc-dicomweb',

  dataSources: [
    /**
     * IDC's primary DICOMWeb server.
     */
    {
      friendlyName: 'IDC DICOMWeb Server',
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'idc-dicomweb',
      configuration: {
        name: 'idc-dicomweb',
        wadoUriRoot:
          'https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb',
        qidoRoot:
          'https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb',
        wadoRoot:
          'https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb',
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: false,
        staticWado: true,
        singlepart: 'bulkdata,video',
        bulkDataURI: {
          enabled: false,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
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
    console.warn('test, navigate to https://ohif.org/');
  },

  /**
   * IDC hotkeys configuration.
   */
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

  /**
   * Google OAuth configuration for IDC.
   */
  oidc: [
    {
      authority: 'https://accounts.google.com',
      client_id: '723928408739-k9k9r3i44j32rhu69vlnibipmmk9i57p.apps.googleusercontent.com',
      redirect_uri: '/callback',
      response_type: 'id_token token',
      scope:
        'email profile openid https://www.googleapis.com/auth/cloudplatformprojects.readonly https://www.googleapis.com/auth/cloud-healthcare',
      post_logout_redirect_uri: '/logout-redirect.html',
      revoke_uri: 'https://accounts.google.com/o/oauth2/revoke?token=',
      automaticSilentRenew: true,
      revokeAccessTokenOnSignout: true,
    },
  ],
};
