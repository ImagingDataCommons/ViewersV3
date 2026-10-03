# IDC Migration TODO: OHIF v3.12.14 → v3.13.10+

This document tracks the migration status from IDC's OHIF v3.12.14 fork to v3.13.10+ (PR #140).

## Migration Status Summary

| Category | Status |
|----------|--------|
| IDC Extension | ✅ Migrated |
| SRPointTool | ✅ Preserved |
| Mode Selector | ✅ Preserved |
| Instance Annotations | ✅ Preserved |
| Deploy Scripts | ✅ Updated |
| Adapters Patch | ✅ Renamed |
| Config Format | ✅ Migrated |
| GCP Extension | ✅ Updated for OHIF 3.13 compatibility |
| GCP Mode | ✅ Updated for OHIF 3.13 compatibility |

---

## Verification Checklist

### Critical (Must Test Before Merge)

- [ ] **SRPoint/SRRectangleROI Rendering**
  - Test with IDC SR annotation studies
  - Verify semantic labels display correctly (e.g., "Lesion" instead of intensity values)
  - See [Potential Regression](#potential-regression-srpointsrrectangleroi-conversion) below

- [ ] **Instance Annotations (TID 1500/1501)**
  - Verify qualitative annotations render on viewport overlays
  - Check color mapping is correct per annotation value
  - Test maxLabels configuration (default: 10)

- [ ] **Segmentation Loading**
  - Test SEG files load correctly with new backend architecture
  - Verify LABELMAP segment color mapping works (adapters patch)
  - Test overlapping segmentations in MPR layout

### Standard Verification

- [ ] **GCP Data Source Merge**
  - Verify Google OAuth login works
  - Test query param approach: `?StudyInstanceUIDs=...&gcp=projects/.../dicomStores/...`
  - Test GCP routing: `/projects/.../locations/.../datasets/.../dicomStores/.../study/...`
  - Confirm both IDC and GCP series appear in merged view
  - Verify mode selector navigation works between modes

- [ ] **Download Dialog**
  - Verify idc-index download commands display correctly
  - Test StudyInstanceUID/SeriesInstanceUID substitution

- [ ] **Microscopy Mode**
  - Test whole slide imaging display
  - Verify dicom-microscopy extension loads

- [ ] **Build & Deploy**
  - CI/CD pipeline runs successfully
  - pnpm install + build completes
  - Node 24 compatibility confirmed

---

## Potential Regression: SRPoint/SRRectangleROI Conversion

### Issue

In `extensions/cornerstone-dicom-sr/src/utils/hydrateStructuredReport.ts`, the conversion logic was removed:

**Before (v3.12.14):**
```javascript
const srAnnotationType =
  annotationType === 'Probe' ? 'SRPoint' :
  annotationType === 'RectangleROI' ? 'SRRectangleROI' :
  annotationType;

annotation.metadata.toolName = srAnnotationType;
```

**After (v3.13.10+):**
```javascript
annotation.metadata.toolName = annotationType;  // Uses Probe/RectangleROI directly
```

### Impact

SR point annotations from DICOM SR files may display as regular `Probe` tools (showing intensity values) instead of `SRPoint` tools (showing semantic labels like "Lesion").

### Fix Required If Regression Confirmed

Restore the conversion logic in `hydrateStructuredReport.ts`:

```javascript
/** Use SR subtypes for Probe and RectangleROI - they show label instead of intensity/stats */
const srAnnotationType =
  annotationType === 'Probe' ? 'SRPoint' :
  annotationType === 'RectangleROI' ? 'SRRectangleROI' :
  annotationType;

const annotation = {
  annotationUID: toolData.annotation.annotationUID,
  data: toolData.annotation.data,
  predecessorImageId: toolData.predecessorImageId,
  metadata: {
    ...referenceData,
    toolName: srAnnotationType,  // Use SR subtype
  },
};
```

---

## Behavioral Change: Annotation Locking

### What Changed

- **Before:** Annotations always locked after SR hydration
- **After:** Annotations locked only if `disableEditing` customization is set

### IDC Status

IDC config sets `panelMeasurement.disableEditing: true`, so this should work correctly. No action needed unless issues observed.

---

## QIDO Enhancements (New Features)

New fields added to study queries:

| Field | Tag | Description |
|-------|-----|-------------|
| ModalitiesInStudy | 00080061 | All modalities in study |
| ReferringPhysicianName | 00080090 | Referring physician |
| PatientBirthDate | 00100030 | Patient DOB |

These are improvements, not regressions.

---

## IDC-Specific Files Inventory

### Preserved Without Changes
- `extensions/cornerstone-dicom-sr/src/tools/SRPointTool.ts`
- `extensions/cornerstone-dicom-sr/src/utils/getLabelForSRMeasurement.js`
- `extensions/cornerstone-dicom-sr/src/utils/srToolGetTextLines.ts`
- `extensions/default/src/Toolbar/ToolbarModeSelector.tsx`
- `extensions/default/src/utils/modeSelectorUtils.ts`
- `extensions/idc/src/*` (all instance annotation code)
- `idc-assets/IDC-Logo-WHITE.svg`
- `idc-assets/favicon-nci.ico`
- `platform/app/public/assets/idc.svg`
- `platform/i18n/src/locales/*/ToolbarModeSelector.json`

### Updated for v3.13 Compatibility
- `extensions/idc/package.json` (peer deps, Node 24, pnpm)
- `idc-assets/app-config-template.js` (customizationService format)
- `idc-deploy-shell/buildViewer.sh` (pnpm, rspack)
- `idc-deploy-shell/install-deps.sh` (Node 24, pnpm)
- `patches/@cornerstonejs+adapters+5.6.8.patch` (renamed from 4.15.29)
- `platform/app/public/config/default.js` (IDC config, customizationService format)
- `platform/app/public/config/dev.js` (IDC dev config, customizationService format)
- `platform/app/pluginConfig.json` (includes @idc/gcp-extension and @idc/gcp-mode)

### Mode Customizations (initToolGroups)
- `modes/basic/src/initToolGroups.ts`
- `modes/basic-test-mode/src/initToolGroups.ts`
- `modes/usAnnotation/src/initToolGroups.js`

---

## GCP Extension/Mode Updates

### OHIF 3.13 Compatibility Changes

The `@idc/gcp-extension` and `@idc/gcp-mode` packages have been updated for OHIF 3.13 compatibility:

| Change | Before (v3.12) | After (v3.13) |
|--------|----------------|---------------|
| `useBulkDataURI` | `useBulkDataURI: false` | `bulkDataURI: { enabled: false }` |

### How GCP Data Sources Work

**GCP Extension** (`preRegistration`):
- Creates `gcp` data source with `onConfiguration` for `?gcp=` query param parsing
- Creates `gcp-extension-merge` merge data source when `?gcp=` param is present
- Provides mode selector customization for navigation

**GCP Mode** (`onModeInit`):
- Creates `gcp-mode-dicomweb-data-source` for route-based GCP paths
- Creates `gcp-mode-merge` merge data source when `?gcp=` param is present
- Provides custom routing: `/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore/study/:StudyInstanceUIDs`

### What's Preserved (No Regressions)

1. **GCP Mode custom routing:** `/projects/:project/locations/:location/datasets/:dataset/dicomStores/:dicomStore/study/:StudyInstanceUIDs`
2. **Query param support:** `?gcp=projects/PROJECT/locations/LOCATION/datasets/DATASET/dicomStores/STORE`
3. **Mode selector customization:** Proper navigation between GCP and standard modes
4. **Merge data source:** Combining IDC + GCP data at series level

---

## Dependencies

Companion PRs needed for the GCP packages with OHIF 3.13 compatibility:
- https://github.com/ImagingDataCommons/ohif-gcp-extension
- https://github.com/ImagingDataCommons/ohif-gcp-mode

---

## Migration Commits

| Commit | Description |
|--------|-------------|
| `0a56b26` | Update IDC config and extensions for OHIF 3.13.12 |
| `0ef83db` | Update IDC code for OHIF 3.13.10 compatibility |
| `bb372d3` | Update IDC CI/CD scripts for OHIF 3.13 |
| `b97fe4d` | Add IDC dependencies and generate pnpm lockfile |

---

## Post-Merge Cleanup

- [ ] Remove this file after all items verified
- [ ] Update README if any workflow changes
- [ ] Tag release after successful deployment
