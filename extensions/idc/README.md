# ohif-idc-extension

## Description
OHIF Extension for IDC

## Author
Imaging Data Commons

## License
MIT

## Installation
```bash
yarn add @ohif/extension-idc
```

## Features

### Instance level SR qualitative annotations (TID 1500 / TID 1501)

Implements [OHIF/Viewers#3358](https://github.com/OHIF/Viewers/issues/3358).

When a DICOM SR (TID 1500 Imaging Measurement Report) is present in a study and
contains a Measurement Group (TID 1501) with one or more `IMAGE` content items
and one or more `CODE` content items — but no geometric coordinates (`SCOORD` /
`SCOORD3D`) — the coded values are rendered as `concept: value` labels in the
bottom-right of the viewport that shows the referenced image instance (e.g.
`Target Region: Neck`). Hovering a label shows the code value /
coding scheme designator and any modifiers (subordinate codes).

The feature is enabled automatically by the extension's `onModeEnter`. It can be
configured (or disabled) via the app config `instanceAnnotations` key:

```js
window.config = {
  // ...
  instanceAnnotations: {
    enabled: true, // master switch
    maxLabels: 10, // collapse extra labels into a "+N more" indicator
    showColor: true, // render a colored dot before each label
    colors: ['#5acce6', '#fcfa6b', '#7ee37e', '#f7a35c', '#e67ee6', '#ff7f7f'],
  },
};
```
