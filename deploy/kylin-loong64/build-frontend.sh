#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}/frontend"
corepack enable
yarn install --frozen-lockfile --ignore-scripts
FRONTEND_API_ENDPOINT=/api AGENT_API_ENDPOINT=/agent-api WEBSOCKET_API_ENDPOINT=/api yarn build
