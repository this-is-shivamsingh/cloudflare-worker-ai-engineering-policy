# Tooling and Approval Inventory

Status: Phase 2 local toolchain installed and verified. Existing GitHub CLI and Wrangler authentication was validated read-only on 2026-09-06; account identifiers are intentionally omitted from this public document. No remote resource was created or changed.

## Currently callable in this Codex environment

| Capability | Observed status | Phase 1 evidence |
|---|---|---|
| General web research | Available | Built-in web access can open official Cloudflare documentation. |
| Generic MCP resource discovery | Available | MCP discovery returned configured Codex plugins/resources but no Cloudflare server or resource template. |
| Cloudflare-specific MCP tools | Not available | Callable-tool inventory contains no tool name with `cloudflare`; discovered MCP resources contain no Cloudflare server. |
| Cloudflare Codex plugin | Not installed/callable | `Cloudflare (cloudflare@openai-curated-remote)` was listed by the user as recommended but not installed; no Cloudflare tool is exposed. |
| Node.js | Available | `node` at `/Users/shivamsingh/.nvm/versions/node/v25.0.0/bin/node`, version `v25.0.0`. |
| npm / npx | Available | npm `11.18.0`; `npx` is present. |
| Wrangler CLI | Not installed as a global executable | `command -v wrangler` returned no path. A project-local version may be installed after plan approval. |
| Git | Available | `/usr/bin/git`, version `2.39.5`. |
| GitHub CLI | Installed and authenticated | Homebrew `gh` 2.100.0 (2026-09-03); active identity and `gh api user` were validated without printing credentials. |

These observations record tool availability. The later read-only identity checks additionally proved both GitHub and Cloudflare authentication without exposing tokens.

## Two different meanings of MCP

1. **Development/deployment tooling:** A Cloudflare connector or MCP server available to Codex could help inspect an account or manage resources. It is not part of the submitted application and is not required to satisfy the assignment.
2. **Application runtime functionality:** The copilot itself could expose or consume MCP tools. That would add scope without serving the MVP user flow, so it is a non-goal unless Shivam later approves it.

## Proposed later installations or connections

Each item requires approval at the appropriate gate; none is authorized by plan approval alone when it changes external state.

| Proposed item | Why it may be needed | Approval gate |
|---|---|---|
| Project-local npm dependencies, including Wrangler and Cloudflare SDK packages selected by the approved architecture | Build, type-check, test, run, and deploy the Worker | Approve implementation and dependency installation after reviewing the exact manifest. |
| Cloudflare account authentication for Wrangler | Create/update the deployed Worker and bindings | Separate approval immediately before login or deployment; confirm the target account. |
| Cloudflare Codex plugin `cloudflare@openai-curated-remote` | Optional account/resource assistance if its exposed tools are useful | Separate plugin-install and connection approval. Do not install merely to demonstrate MCP usage. |
| GitHub CLI or an existing authenticated Git remote workflow | Optional convenience for repository creation, push, and PR creation | Separate approval for installation if chosen, then separate approval for repo creation/push/PR. Git CLI plus GitHub UI is a valid alternative. |

## Recommendation

Do not put MCP inside the product and do not install the Cloudflare plugin solely for optics. Use official Cloudflare application primitives and a project-local Wrangler toolchain. Install or connect account-management tooling only when a concrete approved implementation/deployment step needs it.

## Phase 2 pinned project toolchain

| Package | Version | Reason |
|---|---:|---|
| Node.js | 25.0.0 | Existing local JavaScript runtime. |
| npm | 11.18.0 | Existing package manager. |
| Wrangler | 4.129.0 | Project-local Worker configuration/type generation and later deployment. |
| `agents` | 0.22.0 | Agent routing, Durable Object state, callable methods, and React connection. |
| `@cloudflare/ai-chat` | 0.11.0 | Persistent Agent chat and streaming UI integration. |
| `workers-ai-provider` | 4.0.0 | AI SDK provider for the Workers AI binding. |
| `ai` / `@ai-sdk/react` | 7.0.93 / 4.0.96 | Model streaming/generation and React chat primitives. |
| `@cloudflare/vite-plugin` | 1.54.4 | Single Worker + Static Assets development/build integration. |
| `@cloudflare/vitest-plugin` | 1.1.4 | Current Cloudflare Workers/Miniflare Vitest integration. |
| Vite / Vitest | 8.2.2 / 4.1.0 | Frontend build and test runner; versions satisfy Cloudflare peer constraints. |
| TypeScript | 5.9.3 | Strict type checking; TypeScript 7 was rejected because typescript-eslint 8.69 requires TypeScript below 6.1. |
| ESLint / typescript-eslint | 10.10.0 / 8.69.0 | Source linting with compatible published peer constraints. |
| React / React DOM | 19.2.8 / 19.2.8 | Client UI. |
| YAML / Zod | 2.9.0 / 4.5.4 | AST-based workflow parsing and callable-input validation. |

`npm install` completed with 0 reported vulnerabilities. npm reported blocked lifecycle scripts under its `allow-scripts` policy, but the required Wrangler, Vite, Vitest, TypeScript, and ESLint binaries all executed successfully; no additional script approval was needed.

The first full-stack `npm run dev` attempt was stopped because the Workers AI binding triggered Wrangler's remote OAuth flow. After Shivam separately completed authentication and authorized one minimal live inference, a later local dev smoke connected the remote binding and returned a grounded explanation for the safe GitHub Actions example. The tunnel was stopped immediately; nothing was deployed.
