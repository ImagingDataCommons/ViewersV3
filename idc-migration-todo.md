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
| Study List Workflows | ✅ Fixed for servers without ModalitiesInStudy + PR open |
| SR Visibility / Editing Controls | ✅ Fixed in IDC + PRs open |

---

## Upstream PRs Opened During Migration

### OHIF Viewers PRs

| PR | Title | Status | Description |
|----|-------|--------|-------------|
| [#5987](https://github.com/OHIF/Viewers/pull/5987) | feat(Mode): Add mode selector | 🟡 OPEN | ToolbarModeSelector component for switching modes |
| [#6331](https://github.com/OHIF/Viewers/pull/6331) | fix(MergeDataSource): improve series-to-datasource routing | 🟡 OPEN | seriesSourceMap + retrieve.series.metadata tagging |
| [#6333](https://github.com/OHIF/Viewers/pull/6333) | fix(seg): fallback to buffer-based loader when PerFrameFunctionalGroupsSequence is missing | 🟡 OPEN | SEG metadata fallback + bulk data fetch |
| [#6335](https://github.com/OHIF/Viewers/pull/6335) | feat(cornerstone-dicom-sr): add SRPoint tool | 🟡 OPEN | SRPointTool for DICOM SR point annotations |
| [#6419](https://github.com/OHIF/Viewers/pull/6419) | fix(worklist): show launch workflows when the server omits modalities | 🟡 OPEN | Study list workflows when ModalitiesInStudy is missing (IDC: ImagingDataCommons/ViewersV3#164) |
| [#6353](https://github.com/OHIF/Viewers/pull/6353) | fix(ui): respect panelMeasurement.disableEditing in MeasurementsMenu | 🟡 OPEN | Hide delete/actions when measurement editing is disabled (IDC: ImagingDataCommons/ViewersV3#154) |
| [#6420](https://github.com/OHIF/Viewers/pull/6420) | fix(cornerstone-dicom-sr): show SR finding labels and draw SR points as crosses | 🟡 OPEN, stacked on #6335 | SR finding labels, cross previews for SR points, SRPoint / SRRectangleROI in mode tool groups (rest of #5858) |
| [#6354](https://github.com/OHIF/Viewers/pull/6354) | fix(sr): improve SR annotation visibility toggle | 🟡 OPEN | Visibility toggle for SR preview annotations (IDC: ImagingDataCommons/ViewersV3#154) |
| [#5858](https://github.com/OHIF/Viewers/pull/5858) | fix: Add SRPoint and SRRectangleROI sub-types | 🔴 CLOSED (2026-11-11) | Original SR sub-types PR. Replaced by #6335 (SRPoint tool) and #6420 (SR finding labels, point preview crosses, SR sub-types in tool groups) |

Not tracked here: #6392 and #6393 are upstream-only fixes that the IDC fork does not carry.

### Upstream PR Health (checked 2026-11-11)

All open OHIF PRs above merge cleanly into OHIF `master` and pass master's lint and React Compiler gates.

| PR | Review | Notes |
|----|--------|-------|
| #5987 | Changes requested (2026-04-29) | Branch brought up to date with master; fixed the build (`preserveKeys` import), moved `ToolbarModeSelector` to React 19 / React Compiler rules, added the series-search modality fallback. Re-request review once CI is green |
| #6331, #6333, #6353, #6354 | Review required | Up to date with master; CI green |
| #6335 | Review required | Up to date with master; earlier Playwright failure was in unrelated screenshot tests |
| #6419 | Review required | Opened 2026-11-11 on current master |
| #6420 | Review required | Opened 2026-11-11, stacked on #6335; its diff shows #6335's commits until #6335 merges. Playwright SR preview screenshots may need updating |
| #5858 | Closed | Replaced by #6335 and #6420 |
| CS3D #2856 | Changes requested | Not ours (author: daker); conflicts with CS3D main. IDC keeps `@cornerstonejs__core.patch` |

### Cornerstone3D PRs

| PR | Title | Status | Description |
|----|-------|--------|-------------|
| [#2856](https://github.com/cornerstonejs/cornerstone3D/pull/2856) | feat(voi): VOI LUT Function and VOI LUT Sequence support | 🟡 OPEN | VOI LUT validation - IDC has patch |
| [#2882](https://github.com/cornerstonejs/cornerstone3D/pull/2882) | fix(adapters): Index segments by SegmentNumber | 🟢 MERGED (2026-09-01, first in v5.8.7) | LABELMAP support - IDC keeps the patch while on 5.6.8 |
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
- **Remove when:** IDC moves to Cornerstone3D v5.8.7 or later (PR #2882 merged 2026-09-01)

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

**IDC-only follow-ups (not in #5987):**

- The OHIF 3.13 upgrade (ImagingDataCommons/ViewersV3#140) dropped `'Mode'` from the primary toolbar sections when toolbar layouts moved into customization packs. ImagingDataCommons/ViewersV3#163 restored it in:
  - `extensions/cornerstone/src/customizations/toolbarButtonsCustomization.ts` (basic / longitudinal)
  - `extensions/cornerstone/src/customizations/segmentationToolbarCustomization.ts`
  - `extensions/tmtv/src/customizations/toolbarCustomization.ts`
  - `modes/basic-test-mode/src/index.ts`
- Mode validity when the server omits `ModalitiesInStudy` (ImagingDataCommons/ViewersV3#166): `resolveStudyModalities` in `src/utils/modeSelectorUtils.ts` uses the union of series already loaded in `DicomMetadataStore` and the series search. Before, with lazy study loading it saw only the first loaded series and disabled TMTV for PET/CT studies. #5987 has no series-search fallback at all yet; the port to #5987 is in progress.
- The selector icon changed from `icon-list-view` to a new `icon-mode-switch`, because the old one looked like the DICOM tag browser icon (review comment on #5987). Files: `platform/ui-next/src/components/Icons/Sources/ModeSwitch.tsx`, `platform/ui-next/src/components/Icons/Icons.tsx`, `extensions/default/src/Toolbar/ToolbarModeSelector.tsx`. #5987 still uses `icon-list-view`.

### 3. SRPointTool and SR Finding Labels (`extensions/cornerstone-dicom-sr/`, `modes/`)
**Status:** PR [#6335](https://github.com/OHIF/Viewers/pull/6335) open; [#6420](https://github.com/OHIF/Viewers/pull/6420) (stacked on #6335) for the rest

| File | Purpose | Upstream PR |
|------|---------|-------------|
| `src/tools/SRPointTool.ts` | Cross marker rendering for SR points | #6335 |
| `src/tools/toolNames.ts` | Added SRPoint (modified) | #6335 |
| `src/utils/srToolGetTextLines.ts` | SR-specific text line generation | #6335 |
| `src/utils/getLabelForSRMeasurement.js` | Label extraction from SR measurements | #6335 |
| `src/init.ts` | Tool registration (modified) | #6335 |
| `src/utils/getLabelFromDCMJSImportedToolData.js` | Fall back to the coded Finding's CodeMeaning (modified) | #6420 |
| `src/utils/addSRAnnotation.ts` | Preview label from getLabelForSRMeasurement; preview is locked (modified) | #6420 |
| `src/tools/DICOMSRDisplayTool.ts` | Cross rendering for preview points, finding label in the text box (modified) | #6420 |
| `src/getSopClassHandlerModule.ts` | Keep Finding / Finding Site concepts; finding site label (modified) | #6420 |
| `modes/basic`, `modes/basic-test-mode`, `modes/usAnnotation` `initToolGroups` | SRPoint / SRRectangleROI in the default, SR and MPR tool groups | #6420 |

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

### 15. Study List Workflows Without ModalitiesInStudy (`platform/ui-next/`, `platform/app/`)
**Status:** IDC fix in ImagingDataCommons/ViewersV3#164; upstream PR [#6419](https://github.com/OHIF/Viewers/pull/6419) open

Google Healthcare DICOMweb does not return `ModalitiesInStudy`, so the new study list hid every workflow (empty "Launch workflow", empty row menu, double-click did nothing).

| File | Purpose |
|------|---------|
| `platform/ui-next/src/components/StudyList/components/WorkflowsProvider.tsx` | Treat empty modalities as unknown instead of not applicable |
| `platform/app/src/routes/WorkList/SidePanelPreview.tsx` | Derive the selected study's modalities from its fetched series |

Note: the IDC version uses `React.useMemo` in `SidePanelPreview.tsx`; the upstream version is a plain expression because upstream builds with the React Compiler, which disallows adding `useMemo`.

---

### 16. SR Visibility and Editing Controls (`extensions/cornerstone/`, `extensions/cornerstone-dicom-sr/`)
**Status:** IDC fix in ImagingDataCommons/ViewersV3#154; upstream PRs [#6353](https://github.com/OHIF/Viewers/pull/6353) and [#6354](https://github.com/OHIF/Viewers/pull/6354) open

| File | Purpose | Upstream PR |
|------|---------|-------------|
| `extensions/cornerstone/src/components/MeasurementsMenu.tsx` | Respect `panelMeasurement.disableEditing` | #6353 |
| `extensions/cornerstone/src/commandsModule.ts` | `toggleVisibilityMeasurement` handles SR preview annotations | #6354 |
| `extensions/cornerstone-dicom-sr/src/tools/DICOMSRDisplayTool.ts` | Skip hidden annotations when rendering | #6354 |
| `extensions/cornerstone-dicom-sr/src/tools/modules/dicomSRModule.js` | `clearTrackingUniqueIdentifiersForElement` | #6354 |
| `platform/app/public/config/*.js`, `idc-assets/app-config-template.js` | `onBeforeSRHydration` remaps Probe → SRPoint and RectangleROI → SRRectangleROI | IDC config |

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
   - Check that `'Mode'` is in the primary toolbar sections (basic, segmentation, tmtv); keep the IDC entries if upstream does not add them
   - Keep the IDC `icon-mode-switch` icon unless upstream adopts a distinct icon
   - #5987 now carries the series-search modality fallback (IDC #166), so the IDC `resolveStudyModalities` can go with the rest of the mode selector files

2. **When #6331 (MergeDataSource) merges:**
   - Sync fork with upstream
   - Remove IDC-specific MergeDataSource changes

3. **When #6333 (SEG fallback) merges:**
   - Sync fork with upstream
   - Remove IDC-specific SEG loading changes

4. **When #6335 (SRPointTool) and #6420 (SR finding labels) merge:**
   - Sync fork with upstream
   - Remove IDC-specific SRPoint files after #6335; the label, preview and tool group changes after #6420
   - Keep the `onBeforeSRHydration` remap in the IDC configs (it is configuration, not a code change)

5. **When CS3D #2856 (VOI LUT) merges:**
   - Update Cornerstone3D version
   - Remove `@cornerstonejs__core.patch`

6. **CS3D #2882 (LABELMAP) merged 2026-09-01, first released in v5.8.7:**
   - When IDC moves to Cornerstone3D v5.8.7 or later, remove `@cornerstonejs__adapters.patch`
   - Check that the patch has no other changes before removing it

7. **When #6419 (study list workflows without ModalitiesInStudy) merges:**
   - Sync fork with upstream
   - Drop the IDC changes in `WorkflowsProvider.tsx` and `SidePanelPreview.tsx` (ImagingDataCommons/ViewersV3#164) in favor of upstream's

8. **When #6353 (MeasurementsMenu disableEditing) merges:**
   - Sync fork with upstream
   - Drop the IDC `MeasurementsMenu.tsx` change

9. **When #6354 (SR visibility toggle) merges:**
   - Sync fork with upstream
   - Drop the IDC changes in `commandsModule.ts`, `DICOMSRDisplayTool.ts` and `dicomSRModule.js`
   - Keep the `onBeforeSRHydration` config entries; they are IDC configuration

### Final Cleanup

- [ ] Remove this file after all items verified
- [ ] Update README if any workflow changes
- [ ] Tag release after successful deployment
