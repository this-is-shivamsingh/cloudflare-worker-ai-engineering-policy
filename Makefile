HOST_PORT ?= 5173

.PHONY: docker-build docker-run docker-stop docker-logs docker-test docker-smoke check-cloudflare-auth

docker-build:
	docker compose build

check-cloudflare-auth:
	@test -n "$$CLOUDFLARE_ACCOUNT_ID" || { echo "CLOUDFLARE_ACCOUNT_ID is required" >&2; exit 1; }
	@test -n "$$CLOUDFLARE_API_TOKEN_FILE" || { echo "CLOUDFLARE_API_TOKEN_FILE is required" >&2; exit 1; }
	@test -r "$$CLOUDFLARE_API_TOKEN_FILE" || { echo "CLOUDFLARE_API_TOKEN_FILE must name a readable file" >&2; exit 1; }

docker-run: check-cloudflare-auth
	HOST_PORT=$(HOST_PORT) docker compose up --build --detach

docker-stop:
	docker compose down

docker-logs:
	docker compose logs --follow app

docker-test:
	docker compose build
	docker compose run --rm --no-deps app sh -c 'npm test && npm run test:worker && npm run typecheck && npm run lint && npm run build'

docker-smoke: docker-run
	HOST_PORT=$(HOST_PORT) ./scripts/docker-smoke.sh
