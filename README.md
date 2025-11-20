# About

This repository contains a fork of https://github.com/OHIF/Viewers customized for the needs of Imaging Data Commons. It is periodically updated to track the releases of the upstream repository.

## Maintenance process

Due to the peculiarities of the IDC deployment procedure, this repository follows somewhat unconventional approach to branch management.

`master` branch is automatically deployed with each commit to the IDC dev tier. This branch should be used to test updates.

`main` branch should be used to keep the code that is confirmed to be functional, and should be interpreted as the primary branch.

Whenever this repository is updated, the following procedure should be followed:

1. Update `master`.
2. Wait for the dev deploy to be completed (managed via CircleCI in https://app.circleci.com/projects/github/ImagingDataCommons/ViewersV3).
3. Test in IDC dev tier.
4. If test is satisfactory, update `main` to match `master`.
