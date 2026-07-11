# SigNoz Source Development Environment

This setup is pinned to the official SigNoz repository's `develop` branch at
commit `fa90fad37347aeccba34141749e9f99bfcafa2bc` (2024-12-19).

## Verified Host

- macOS 26.5.1 on arm64, 10 CPUs, 16 GiB host memory
- Docker Engine 29.4.0 and Docker Compose v5.1.2
- Docker VM allocation: about 8 GiB
- About 66 GiB was free before setup
- Git 2.39.5, Make 3.81, Node.js 24.18.0, pnpm 10.20.0
- Host Go was absent; the pinned Go container supplies Go 1.22.7
- Ports 3301, 8080, 8085, 4317, 4318, 9000, 9001, 8123, 9090, and
  9093 were free before startup

## Architecture

- Docker infrastructure: ZooKeeper, ClickHouse, schema migrators, Alertmanager,
  and the SigNoz OpenTelemetry Collector.
- Source services in Docker: the community Go query service runs from the
  bind-mounted `pkg/` tree; Webpack runs from the bind-mounted `frontend/`
  tree.
- Important state uses Compose named volumes. `make -f Makefile.dev dev-down`
  preserves those volumes.
- Host-facing ports bind to `127.0.0.1` by default.
- No service mounts the Docker socket or the host root filesystem.
- `ee/` and `cmd/enterprise/` are not mounted, built, modified, or enabled.

The develop manifest's `bitnami/zookeeper:3.7.1` tag is no longer present in
the active Bitnami namespace. This setup uses the exact same version from
Bitnami's `bitnamilegacy` namespace, which provides native amd64 and arm64
manifests.

The repository's `CONTRIBUTING.md` recommends Docker dependencies with the
frontend and query service run from source. The containers here supply the
required Go 1.22.7 and Node/Yarn runtimes so the host does not need Go installed.

## Commands

```sh
make -f Makefile.dev dev                   # start everything
make -f Makefile.dev dev-infra             # start dependency services
make -f Makefile.dev dev-backend           # start/recreate query-service
make -f Makefile.dev dev-frontend          # start/recreate frontend
make -f Makefile.dev dev-backend-restart   # recompile changed Go source
make -f Makefile.dev dev-frontend-restart  # reset Webpack if needed
make -f Makefile.dev dev-ps
make -f Makefile.dev dev-logs
make -f Makefile.dev dev-down              # stop; preserve data volumes
```

Frontend changes are watched by Webpack. Go changes require
`dev-backend-restart`; cached modules and build objects make subsequent
compilation substantially shorter.

The backend rebuild loop was verified with a temporary Debug log-level change:
it returned healthy in 7 seconds, and returned healthy in 6 seconds after the
change was reverted. No test source change remains.

## Endpoints

- UI: http://localhost:3301
- Query API health: http://localhost:8080/api/v1/health
- Query internal API: http://localhost:8085
- ClickHouse HTTP/native: 127.0.0.1:8123 / 127.0.0.1:9000
- Alertmanager: http://localhost:9093
- OTLP gRPC: 127.0.0.1:4317 (plaintext)
- OTLP HTTP: http://127.0.0.1:4318 (plaintext)

Validation completed on 2026-07-11:

- UI returned HTTP 200 and the query health API returned `{"status":"ok"}`.
- Browser-origin API requests returned `Access-Control-Allow-Origin: *`.
- The Collector listened on both OTLP ports and reported ready.
- An OTLP/HTTP test trace for service `signoz-dev-smoke` returned HTTP 200
  and appeared in `signoz_traces.signoz_index_v3`.
- ClickHouse was restarted and the test trace remained present.

Edit `.env` to avoid port conflicts. `.env.example` documents every setting;
the local `.env` is ignored by Git. For a remote server, replace loopback
bindings deliberately and apply host firewall/TLS policy outside this Compose
file rather than disabling either control.

## Source And License Notes

`LICENSE` states that content under `ee/` has its separate license and
content outside the listed restrictions is MIT Expat. This development setup
uses `pkg/query-service` and `frontend` only. The official root Makefile has
enterprise build targets and linker variables, so this setup intentionally
uses the community Go entry point directly instead of those targets.
