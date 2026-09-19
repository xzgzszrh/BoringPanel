#!/usr/bin/env bash
set -euo pipefail

[[ ${EUID} -eq 0 ]] || { echo '请使用 root 执行' >&2; exit 1; }
[[ -n ${SCRY_POSTGRES_PASSWORD:-} ]] || { echo '必须设置 SCRY_POSTGRES_PASSWORD' >&2; exit 1; }

sudo -u postgres psql --set=ON_ERROR_STOP=1 --set=password="${SCRY_POSTGRES_PASSWORD}" <<'SQL'
SELECT format('CREATE ROLE scry_agent LOGIN PASSWORD %L', :'password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scry_agent') \gexec
SELECT format('ALTER ROLE scry_agent PASSWORD %L', :'password') \gexec
SELECT 'CREATE DATABASE scry_agent OWNER scry_agent'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'scry_agent') \gexec
REVOKE ALL ON DATABASE scry_agent FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE scry_agent TO scry_agent;
SQL

sudo -u postgres psql --set=ON_ERROR_STOP=1 --dbname=scry_agent <<'SQL'
CREATE SCHEMA IF NOT EXISTS scry_agent AUTHORIZATION scry_agent;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA scry_agent TO scry_agent;
SQL
