#!/bin/sh

set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

dev_vars_file="${CLOUDFLARE_DEV_VARS_FILE:-/run/secrets/cloudflare_dev_vars}"

if [ ! -r "$dev_vars_file" ]; then
  printf 'Cloudflare development variables file is missing or unreadable\n' >&2
  exit 1
fi

set -a
# The user-owned file is mounted read-only at runtime and is never printed.
. "$dev_vars_file"
set +a

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ "$CLOUDFLARE_API_TOKEN" = "replace-with-workers-ai-api-token" ]; then
  printf 'CLOUDFLARE_API_TOKEN is missing or still uses the example placeholder\n' >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] || [ "$CLOUDFLARE_ACCOUNT_ID" = "replace-with-cloudflare-account-id" ]; then
  printf 'CLOUDFLARE_ACCOUNT_ID is missing or still uses the example placeholder\n' >&2
  exit 1
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
