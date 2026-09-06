#!/bin/sh

set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

token_file="/run/secrets/cloudflare_api_token"

if [ ! -s "$token_file" ]; then
  printf 'Cloudflare API token secret is missing or empty\n' >&2
  exit 1
fi

CLOUDFLARE_API_TOKEN="$(cat "$token_file")"
export CLOUDFLARE_API_TOKEN

exec npm run dev -- --host 0.0.0.0 --port 5173
