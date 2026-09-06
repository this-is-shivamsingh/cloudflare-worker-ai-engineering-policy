HOST_PORT ?= 5173

.PHONY: docker-build docker-run docker-stop docker-logs docker-test docker-smoke check-cloudflare-auth

docker-build:
	docker compose build

check-cloudflare-auth:
	@test -r .dev.vars || { echo ".dev.vars is required and must be readable" >&2; exit 1; }
	@grep -q '^CLOUDFLARE_API_TOKEN=' .dev.vars || { echo "CLOUDFLARE_API_TOKEN is missing from .dev.vars" >&2; exit 1; }
	@grep -q '^CLOUDFLARE_ACCOUNT_ID=' .dev.vars || { echo "CLOUDFLARE_ACCOUNT_ID is missing from .dev.vars" >&2; exit 1; }

docker-run: check-cloudflare-auth
	HOST_PORT=$(HOST_PORT) docker compose up --build --detach

docker-stop:
	docker compose down

docker-logs:
	docker compose logs --follow app

docker-test:
	docker build --tag engineering-policy-copilot:test .
	docker run --rm --entrypoint sh engineering-policy-copilot:test -c 'npm test && npm run test:worker && npm run typecheck && npm run lint && npm run build'

docker-smoke: docker-run
	HOST_PORT=$(HOST_PORT) ./scripts/docker-smoke.sh
