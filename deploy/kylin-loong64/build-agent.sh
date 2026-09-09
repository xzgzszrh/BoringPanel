#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}/agent-service"
npm ci --ignore-scripts
npm run typecheck
npm run build
npm prune --omit=dev --omit=optional
node -e "if(process.arch!=='loong64')throw new Error('Agent 必须在 loong64 Node.js 下验收')"
