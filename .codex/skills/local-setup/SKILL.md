---
name: local-setup
description: Check this project's local Docker, Node/npm, Wrangler, Cloudflare authentication, and private `.dev.vars` readiness without exposing credentials. Use when a contributor invokes `$local-setup`, asks to set up or diagnose local development, or needs a safe prerequisite check before running the app.
---

# Local Setup

Perform read-only readiness checks. Do not install software, start Docker, open Wrangler login, edit `.dev.vars`, or change account state unless the user separately authorizes it.

## Safety

- Never ask the user to paste a token or account ID into chat.
- Never run `cat`, `sed`, `env`, `printenv`, shell tracing, or Compose interpolation against `.dev.vars`.
- Check credential keys and non-empty status without printing values. Report only `present`, `missing`, `placeholder`, or `unreadable`.
- Preserve `.gitignore` and `.dockerignore`; `.dev.vars` must remain private and untracked.

## Workflow

1. Read `AGENTS.md`, `README.md`, `package.json`, `.dev.vars.example`, `compose.yaml`, and the relevant ignore files.
2. Check tools without mutating the machine:
   - Docker CLI: `command -v docker` and `docker --version`.
   - Compose: `docker compose version`.
   - Docker daemon: `docker info >/dev/null` and report only success/failure.
   - Node/npm: `node --version` and `npm --version`; compare Node with README requirements.
   - Project Wrangler: check `node_modules/.bin/wrangler`, then run `./node_modules/.bin/wrangler --version`. If absent, report that `npm ci` requires user approval.
3. Check Wrangler authentication with `./node_modules/.bin/wrangler whoami`. Never display environment variables or authentication files. Treat login, browser approval, account selection, network/proxy changes, and permission changes as user actions.
4. Check `.dev.vars` without displaying it:
   - Confirm it is a regular readable file and Git reports it ignored.
   - Check for `CLOUDFLARE_API_TOKEN=`, `CLOUDFLARE_ACCOUNT_ID=`, and `DEBUG_AGENT_EVENTS=` using quiet matching only.
   - Check permissions with the platform's `stat` command; recommend mode `600` when broader access exists.
   - Never source the file during diagnosis. Let the runtime entrypoint validate empty or placeholder values.
5. Return a concise table with check, status, safe evidence, and required owner/action. Do not include credential values.

## User-intervention boundaries

Require the user to act when Docker must be installed or started; Node/npm/Wrangler must be installed or upgraded; Wrangler needs interactive login; `.dev.vars` must be created or edited; a token is absent, expired, or lacks Workers AI permission; an account ID must be selected; or network, proxy, filesystem permission, or account access must change. Provide the exact safe command or Dashboard action, then stop at that boundary.
