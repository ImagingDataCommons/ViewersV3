# IDC Migration: OHIF v3.12.14 → v3.13.12

This document tracks the migration status and documents all IDC-specific changes on top of OHIF upstream.

---

## Migration Status Summary

| Category | Status |
|----------|--------|
| IDC Extension | ✅ Migrated |
| SRPointTool | ✅ Preserved + PR opened |
| Mode Selector | ✅ Preserved + PR open |
| MergeDataSource | ✅ Enhanced + PR open |
| Instance Annotations | ✅ Preserved |
| Deploy Scripts | ✅ Updated |
| Patches | ✅ Updated for CS3D 5.6.8 |
| Config Format | ✅ Migrated |
| GCP Extension | ✅ Updated for OHIF 3.13 |
| GCP Mode | ✅ Updated for OHIF 3.13 |
| SEG Loading | ✅ Buffer-based fallback + PR opened |

---

## Upstream PRs Opened During Migration

### OHIF Viewers PRs

| PR | Title | Status | Description |
|----|-------|--------|-------------|
| [#5987](https://github.com/OHIF/Viewers/pull/5987) | feat(Mode): Add mode selector | 🟡 OPEN | ToolbarModeSelector component for switching modes |
| [#6331](https://github.com/OHIF/Viewers/pull/6331) | fix(MergeDataSource): improve series-to-datasource routing | 🟡 OPEN | seriesSourceMap + retrieve.series.metadata tagging |
| [#6333](https://github.com/OHIF/Viewers/pull/6333) | fix(seg): fallback to buffer-based loader when PerFrameFunctionalGroupsSequence is missing | 🟡 OPEN | SEG metadata fallback + bulk data fetch |
| [#6335](https://github.com/OHIF/Viewers/pull/6335) | feat(cornerstone-dicom-sr): add SRPoint tool | 🟡 OPEN | SRPointTool for DICOM SR point annotations |

### Cornerstone3D PRs

| PR | Title | Status | Description |
|----|-------|--------|-------------|
| [#2856](https://github.com/cornerstonejs/cornerstone3D/pull/2856) | feat(voi): VOI LUT Function and VOI LUT Sequence support | 🟡 OPEN | VOI LUT validation - IDC has patch |
| [#2882](https://github.com/cornerstonejs/cornerstone3D/pull/2882) | fix(adapters): Index segments by SegmentNumber | Referenced | LABELMAP support - IDC has patch |
| [#2963](https://github.com/cornerstonejs/cornerstone3D/pull/2963) | fix(adapters): add null checks for PerFrameFunctionalGroupsSequence | 🔴 CLOSED | Replaced by buffer-based loader approach |

---

## IDC Patches (Cornerstone3D)

Located in `patches/` directory:

### `@cornerstonejs__core.patch`
- **Purpose:** VOI LUT function validation
- **Upstream PR:** [CS3D #2856](https://github.com/cornerstonejs/cornerstone3D/pull/2856)
- **What it does:** Validates VOI LUT function values and falls back to LINEAR for invalid/undefined values
- **Remove when:** PR #2856 is merged and CS3D version is updated

### `@cornerstonejs__adapters.patch`
- **Purpose:** Index segments by SegmentNumber for LABELMAP support
- **Upstream PR:** [CS3D #2882](https://github.com/cornerstonejs/cornerstone3D/pull/2882)
- **What it does:** Fixes segment color mapping for LABELMAP segmentations where SegmentNumber may start at 0 or have gaps
- **Remove when:** PR #2882 is merged and CS3D version is updated

### SEG PerFrameFunctionalGroupsSequence Fallback
- **Location:** `extensions/cornerstone-dicom-seg/src/getSopClassHandlerModule.ts`
- **Upstream PR:** [OHIF #6333](https://github.com/OHIF/Viewers/pull/6333)
- **Purpose:** Handle SEG files where PerFrameFunctionalGroupsSequence is missing or available via bulk data
- **Loading strategy (in order of preference):**
  1. Inline metadata - If `PerFrameFunctionalGroupsSequence` is present as array → metadata-based loader
  2. Bulk data - If `PerFrameFunctionalGroupsSequence` has `BulkDataURI` → fetch bulk data, then metadata-based loader
  3. Full Part 10 - If bulk data unavailable or fails → buffer-based loader (full DICOM file)
- **Why not a patch:** Implemented in OHIF code, not Cornerstone3D
- **Remove when:** PR #6333 is merged and fork is synced with upstream

---

## Complete IDC Fork Delta (vs Upstream)

### 1. IDC Extension (`extensions/idc/`)
**Status:** IDC-specific, keep in fork

| File | Purpose |
|------|---------|
| `src/index.tsx` | Extension entry point |
| `src/DownloadStudySeriesDialog.tsx` | idc-index download dialog |
| `src/instanceAnnotations/InstanceAnnotationsOverlay.tsx` | Qualitative SR annotations overlay |
| `src/instanceAnnotations/extractInstanceAnnotations.ts` | TID 1500/1501 annotation extraction |
| `src/instanceAnnotations/instanceAnnotationStore.ts` | Annotation state management |
| `src/instanceAnnotations/registerInstanceAnnotations.tsx` | Registration with OHIF |
| `src/instanceAnnotations/constants.ts` | Annotation constants |

### 2. ToolbarModeSelector (`extensions/default/`)
**Status:** PR [#5987](https://github.com/OHIF/Viewers/pull/5987) open

| File | Purpose |
|------|---------|
| `src/Toolbar/ToolbarModeSelector.tsx` | Mode switching UI component |
| `src/utils/modeSelectorUtils.ts` | Mode validation and navigation utilities |
| `src/utils/modeSelectorUtils.test.ts` | Tests |
| `src/customizations/modeSelectorCustomization.ts` | Customization config |
| `src/customizations/modeSelectorCustomization.types.ts` | TypeScript types |
| `src/getToolbarModule.tsx` | Toolbar registration (modified) |
| `src/getHangingProtocolModule.js` | HP module (modified) |

### 3. SRPointTool (`extensions/cornerstone-dicom-sr/`)
**Status:** PR [#6335](https://github.com/OHIF/Viewers/pull/6335) open

| File | Purpose |
|------|---------|
| `src/tools/SRPointTool.ts` | Cross marker rendering for SR points |
| `src/tools/toolNames.ts` | Added SRPoint (modified) |
| `src/utils/srToolGetTextLines.ts` | SR-specific text line generation |
| `src/utils/getLabelForSRMeasurement.js` | Label extraction from SR measurements |
| `src/utils/getLabelFromDCMJSImportedToolData.js` | Label extraction fix (modified) |
| `src/utils/addSRAnnotation.ts` | Uses getLabelForSRMeasurement (modified) |
| `src/init.ts` | Tool registration (modified) |
| `src/tools/DICOMSRDisplayTool.ts` | Cross rendering for points (modified) |
| `src/getSopClassHandlerModule.ts` | SR finding extraction (modified) |

### 4. MergeDataSource Enhancements (`extensions/default/`)
**Status:** PR [#6331](https://github.com/OHIF/Viewers/pull/6331) open

| File | Purpose |
|------|---------|
| `src/MergeDataSource/index.ts` | seriesSourceMap + retrieve.series.metadata handler |
| `src/DicomWebDataSource/index.ts` | Minor modification |
| `src/DicomWebDataSource/qido.js` | Minor modification |

### 5. Measurement Service Mappings (`extensions/cornerstone/`)
**Status:** Part of SRPointTool PR

| File | Purpose |
|------|---------|
| `src/initMeasurementService.ts` | SRPoint/SRRectangleROI mappings |
| `src/utils/measurementServiceMappings/constants/supportedTools.js` | Added SRPoint, SRRectangleROI |
| `src/utils/measurementServiceMappings/measurementServiceMappingsFactory.ts` | Type mappings |

### 6. SEG Loading Fallback (`extensions/cornerstone-dicom-seg/`)
**Status:** PR [#6333](https://github.com/OHIF/Viewers/pull/6333) open

| File | Purpose |
|------|---------|
| `src/getSopClassHandlerModule.ts` | PerFrameFunctionalGroupsSequence detection + bulk data fetch + buffer-based loader fallback |

### 7. Platform Core Changes (`platform/core/`)
**Status:** May need review for upstreaming

| File | Purpose |
|------|---------|
| `src/services/HangingProtocolService/HangingProtocolService.ts` | HP customization additions |
| `src/services/ToolBarService/ToolbarService.ts` | Minor change |
| `src/types/HangingProtocol.ts` | Type additions |

### 8. Internationalization (`platform/i18n/`)
**Status:** Part of ToolbarModeSelector PR

| File | Purpose |
|------|---------|
| `src/locales/en-US/ToolbarModeSelector.json` | English translations |
| `src/locales/en-US/EncapsulatedDocument.json` | Document translations |
| `src/locales/fr/ToolbarModeSelector.json` | French translations |
| `src/locales/nl/ToolbarModeSelector.json` | Dutch translations |
| `src/locales/zh/ToolbarModeSelector.json` | Chinese translations |
| `src/locales/test-LNG/ToolbarModeSelector.json` | Test translations |

### 9. IDC Assets & Branding (`idc-assets/`)
**Status:** IDC-specific, keep in fork

| File | Purpose |
|------|---------|
| `IDC-Logo-WHITE.svg` | IDC logo |
| `app-config-template.js` | Config template for deployment |
| `favicon-nci-16x16.png` | NCI favicon |
| `favicon-nci-32x32.png` | NCI favicon |
| `favicon-nci.ico` | NCI favicon |
| `viewer_deployment_config.txt` | Deployment config |

### 10. IDC Deployment Scripts (`idc-deploy-shell/`)
**Status:** IDC-specific, keep in fork

| File | Purpose |
|------|---------|
| `buildViewer.sh` | Build script (pnpm, rspack) |
| `buildLoadBalancer.sh` | Load balancer setup |
| `cloudCopy.sh` | GCP cloud copy |
| `gcloud_authenticate.sh` | GCP authentication |
| `install-deps.sh` | Dependency installation (Node 24, pnpm) |
| `prepare_config.sh` | Config preparation |
| `pull_config.sh` | Config pulling |
| `killPing.sh` | Utility script |
| `pingJob.sh` | Utility script |

### 11. IDC Configurations (`platform/app/`)
**Status:** IDC-specific, keep in fork

| File | Purpose |
|------|---------|
| `public/config/idc.js` | Main IDC configuration |
| `public/config/default.js` | Modified default config |
| `public/config/dev.js` | Modified dev config |
| `public/assets/idc.svg` | IDC logo in app |
| `pluginConfig.json` | Includes IDC extension + GCP packages |
| `package.json` | GCP package dependencies |

### 12. CI/CD Changes (`.circleci/`, `.github/`)
**Status:** IDC-specific, keep in fork

| File | Purpose |
|------|---------|
| `.circleci/config.yml` | IDC CircleCI deployment to GCP |
| `.github/workflows/github-release.yml` | GitHub release workflow |
| `.github/workflows/playwright.yml` | Fork-safe Playwright config |
| `.github/.dependabot.yaml` | Dependabot config |

### 13. Build Configuration
**Status:** IDC-specific, keep in fork

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | GCP package refs + patches |
| `.npmrc` | npm configuration |
| `.webpack/resolveConfig.js` | Resolve config |
| `.webpack/rules/transpileJavaScript.js` | GCP packages transpilation |
| `.webpack/webpack.base.js` | Webpack base config |
| `Dockerfile` | Container config |

### 14. Mode Customizations
**Status:** IDC-specific toolbar changes

| File | Purpose |
|------|---------|
| `modes/basic/src/initToolGroups.ts` | Tool group customization |
| `modes/basic-dev-mode/src/index.ts` | Dev mode config |
| `modes/basic-dev-mode/src/toolbarButtons.ts` | Toolbar buttons |
| `modes/basic-test-mode/src/initToolGroups.ts` | Test mode tool groups |
| `modes/usAnnotation/src/initToolGroups.js` | US annotation tool groups |
| `modes/usAnnotation/src/index.ts` | US annotation mode |

---

## Verification Checklist

### Critical (Must Test Before Merge)

- [ ] **Segmentation Loading**
  - Test SEG files load correctly (especially from IDC static WADO)
  - Verify PerFrameFunctionalGroupsSequence fallback works
  - Verify LABELMAP segment color mapping works (adapters patch)
  - Test overlapping segmentations in MPR layout

- [ ] **SRPoint/SRRectangleROI Rendering**
  - Test with IDC SR annotation studies
  - Verify semantic labels display correctly (e.g., "Lesion")
  - Verify cross marker rendering for points

- [ ] **Instance Annotations (TID 1500/1501)**
  - Verify qualitative annotations render on viewport overlays
  - Check color mapping is correct per annotation value

### Standard Verification

- [ ] **GCP Data Source Merge**
  - Verify Google OAuth login works
  - Test `?gcp=projects/.../dicomStores/...` query param
  - Confirm both IDC and GCP series appear in merged view
  - Verify mode selector navigation works

- [ ] **Download Dialog**
  - Verify idc-index download commands display correctly

- [ ] **Build & Deploy**
  - CI/CD pipeline runs successfully
  - pnpm install + build completes
  - Node 24 compatibility confirmed

---

## Files Removed/Cleaned

| File | Reason |
|------|--------|
| `lerna-debug.log` | Debug file, should not be committed |
| `testdata` (submodule) | Removed submodule |
| `runtime.txt` | Removed Python runtime file |

---

## Post-Merge Actions

### When Upstream PRs Merge

1. **When #5987 (ToolbarModeSelector) merges:**
   - Sync fork with upstream
   - Remove IDC-specific ToolbarModeSelector files
   - Keep only i18n customizations if any

2. **When #6331 (MergeDataSource) merges:**
   - Sync fork with upstream
   - Remove IDC-specific MergeDataSource changes

3. **When #6333 (SEG fallback) merges:**
   - Sync fork with upstream
   - Remove IDC-specific SEG loading changes

4. **When #6335 (SRPointTool) merges:**
   - Sync fork with upstream
   - Remove IDC-specific SRPoint files

5. **When CS3D #2856 (VOI LUT) merges:**
   - Update Cornerstone3D version
   - Remove `@cornerstonejs__core.patch`

6. **When CS3D #2882 (LABELMAP) merges:**
   - Update Cornerstone3D version
   - Remove `@cornerstonejs__adapters.patch`

### Final Cleanup

- [ ] Remove this file after all items verified
- [ ] Update README if any workflow changes
- [ ] Tag release after successful deployment
