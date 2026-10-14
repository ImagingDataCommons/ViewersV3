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
# See the License for the specific language governing permissions and
# limitations under the License.


if [ "${CONFIG_ONLY}" != "True" ]; then
  export PUBLIC_URL='/v3/'
  # Disable all minification (OHIF 3.13+ uses rspack, check if optimization.minimize exists)
  if [ "${DISABLE_MIN}" == "True" ]; then
    # Try to disable minification if the pattern exists in webpack.base.js
    if grep -q "minimize:" .webpack/webpack.base.js; then
      sed -i 's/minimize: isProdBuild/minimize: false/' .webpack/webpack.base.js
    fi
  fi
  # Bump Node memory
  export NODE_OPTIONS="--max-old-space-size=6000"
  # OHIF 3.13+ uses pnpm instead of yarn
  pnpm install --frozen-lockfile
  # Run in verbose mode to hopefully catch otherwise silent errors
  pnpm run build
else
  mkdir -p platform/app/dist/
fi
