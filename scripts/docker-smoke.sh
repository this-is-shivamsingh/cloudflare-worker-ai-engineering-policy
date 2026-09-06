#!/bin/sh

set -eu

host_port="${HOST_PORT:-5173}"
url="http://127.0.0.1:${host_port}/"
attempt=1

while [ "$attempt" -le 30 ]; do
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$url" 2>/dev/null || true)"
  if [ "$status" = "200" ]; then
    printf 'Docker HTTP smoke passed: %s returned 200\n' "$url"
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 1
done

printf 'Docker HTTP smoke failed: %s did not return 200 within 30 seconds\n' "$url" >&2
exit 1
