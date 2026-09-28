#!/usr/bin/env bash

# Copyright 2020, Institute for Systems Biology
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific file governing permissions and
# limitations under the License.
#

# Note that CIRCLE_PROJECT_REPONAME is a Circle CI built-in var:
export HOME=/home/circleci/${CIRCLE_PROJECT_REPONAME}
export HOMEROOT=/home/circleci/${CIRCLE_PROJECT_REPONAME}

# Install and update apt-get info
echo "Preparing System..."
apt-get -y install software-properties-common
apt-get update -qq
apt-get upgrade -y

apt-get install -y	git
apt-get install -y make # native builds (node-gyp)
apt-get install -y g++

#
# Following instructions at https://github.com/nodesource/distributions/blob/master/README.md#deb
# OHIF 3.13+ requires Node.js 24+
#

curl -sL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs

# pnpm via Corepack — OHIF 3.13+ uses pnpm instead of yarn
echo "Enabling Corepack and pnpm..."
corepack enable
corepack prepare pnpm@latest --activate

# Verify installations
echo "Installation complete!"
echo "Node version: $(node --version)"
echo "pnpm location: $(which pnpm)"
echo "pnpm version: $(pnpm --version)"

echo "Libraries Installed"
