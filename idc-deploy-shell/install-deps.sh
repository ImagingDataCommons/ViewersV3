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
apt-get install -y make # needed by bun install...
apt-get install -y g++ # needed by bun install...

#
# Following instructions at https://github.com/nodesource/distributions/blob/master/README.md#deb
#

curl -sL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install bun using npm (more reliable than curl)
echo "Installing Bun via npm..."
npm install -g bun

# Verify bun installation
echo "Bun installation complete!"
echo "Bun location: $(which bun)"
bun --version

echo "Libraries Installed"
