#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="${SCRY_RELEASE_VERSION:-1.0.0}"
RELEASE_NAME="scry-${VERSION}-kylin-v11-loong64"
OUT_DIR="${SCRY_RELEASE_OUT:-${ROOT}/output/releases}"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/scry-release.XXXXXX")"
DEST="${STAGE}/${RELEASE_NAME}"

cleanup() {
  rm -rf "${STAGE}"
}
trap cleanup EXIT

mkdir -p "${DEST}" "${DEST}/deploy/docker"

copy_path() {
  local source="$1"
  local target="${2:-$1}"
  mkdir -p "$(dirname -- "${DEST}/${target}")"
  cp -a "${ROOT}/${source}" "${DEST}/${target}"
}

for file in LICENSE README.md SECURITY.md go.mod go.sum .env.example; do
  copy_path "${file}"
done

copy_path pkg
mkdir -p "${DEST}/agent-service" "${DEST}/frontend"
COPYFILE_DISABLE=1 tar -C "${ROOT}/agent-service" -cf - \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./test' \
  . | tar -C "${DEST}/agent-service" -xf -
COPYFILE_DISABLE=1 tar -C "${ROOT}/frontend" -cf - \
  --exclude='./node_modules' \
  --exclude='./build' \
  --exclude='./.temp_cache' \
  --exclude='./.husky' \
  --exclude='./__mocks__' \
  --exclude='./tests' \
  . | tar -C "${DEST}/frontend" -xf -
copy_path deploy/kylin-loong64
copy_path deploy/scry-ops
copy_path deploy/docker/dashboards deploy/docker/dashboards
copy_path docs/competition
copy_path docs/scry-technical-architecture

rm -rf \
  "${DEST}/agent-service/node_modules" \
  "${DEST}/agent-service/dist" \
  "${DEST}/agent-service/test" \
  "${DEST}/frontend/node_modules" \
  "${DEST}/frontend/build" \
  "${DEST}/frontend/.temp_cache" \
  "${DEST}/frontend/.husky" \
  "${DEST}/frontend/__mocks__" \
  "${DEST}/frontend/tests" \
  "${DEST}/frontend/src/tests" \
  "${DEST}/frontend/src/mocks-server" \
  "${DEST}/pkg/query-service/tests" \
  "${DEST}/pkg/web/testdata"

find "${DEST}" -type d \( \
  -name '__tests__' -o -name '__test__' -o -name '__snapshots__' -o -name '__mock__' \
  -o -name 'tests' -o -name 'test' -o -name 'testdata' \
\) -prune -exec rm -rf {} +

find "${DEST}" -type f \( \
  -name '*_test.go' -o -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.test.js' -o -name '*.test.jsx' \
  -o -name '*.spec.ts' -o -name '*.spec.tsx' -o -name '*.spec.js' -o -name '*.spec.jsx' \
  -o -name '*.snap' -o -name '.DS_Store' -o -name '*.log' -o -name '*.db' -o -name '*.sqlite' \
\) -delete

rm -f \
  "${DEST}/pkg/query-service/rules/threshold_rule_test_data.go" \
  "${DEST}/pkg/query-service/utils/testutils.go" \
  "${DEST}/pkg/query-service/app/integrations/test_utils.go" \
  "${DEST}/pkg/query-service/app/opamp/mocks.go" \
  "${DEST}/frontend/jest.config.ts" \
  "${DEST}/frontend/jest.setup.ts" \
  "${DEST}/frontend/playwright.config.ts" \
  "${DEST}/frontend/sonar-project.properties" \
  "${DEST}/frontend/commitlint.config.ts" \
  "${DEST}/frontend/bundlesize.config.json"

find "${DEST}" -type f | LC_ALL=C sort | sed "s#${DEST}/##" > "${DEST}/PACKAGE_MANIFEST.txt"
printf '%s\n' \
  "Scry ${VERSION}" \
  "Target: Kylin Advanced Server V11 / LoongArch64" \
  "Dependencies: install from go.mod, package-lock.json, and yarn.lock on the target host" \
  "Tests, dependency directories, caches, local databases, and development history are excluded" \
  > "${DEST}/RELEASE_INFO.txt"

mkdir -p "${OUT_DIR}"
ARCHIVE="${OUT_DIR}/${RELEASE_NAME}.tar.gz"
COPYFILE_DISABLE=1 tar -C "${STAGE}" -czf "${ARCHIVE}" "${RELEASE_NAME}"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${ARCHIVE}" > "${ARCHIVE}.sha256"
else
  shasum -a 256 "${ARCHIVE}" > "${ARCHIVE}.sha256"
fi

printf 'Created %s\n' "${ARCHIVE}"
du -h "${ARCHIVE}"
