#!/usr/bin/env bash
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.14.0}"
PREFIX="${NODE_PREFIX:-/opt/scry/node}"
WORK_DIR="${SCRY_BUILD_DIR:-/var/tmp/scry-build}"
ARCHIVE="node-v${NODE_VERSION}.tar.gz"
BASE_URL="https://nodejs.org/dist/v${NODE_VERSION}"

[[ $(uname -m) == loongarch64 || $(uname -m) == loong64 ]] || { echo '必须在 LoongArch64 主机执行' >&2; exit 1; }
mkdir -p "${WORK_DIR}"
cd "${WORK_DIR}"
curl --fail --location --remote-name "${BASE_URL}/${ARCHIVE}"
curl --fail --location --remote-name "${BASE_URL}/SHASUMS256.txt"
grep " ${ARCHIVE}$" SHASUMS256.txt | sha256sum --check --status
rm -rf "node-v${NODE_VERSION}"
tar -xzf "${ARCHIVE}"
cd "node-v${NODE_VERSION}"
./configure --prefix="${PREFIX}" --shared-openssl --openssl-use-def-ca-store
make -j"$(nproc)"
make install
"${PREFIX}/bin/node" -e "if(process.arch!=='loong64')throw new Error(process.arch);console.log(process.version,process.arch)"
