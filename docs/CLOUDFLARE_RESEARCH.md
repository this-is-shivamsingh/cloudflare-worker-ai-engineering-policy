# Cloudflare Platform Research

Verified against official Cloudflare documentation on 2026-09-05. Statements labeled **Inference** are architectural conclusions rather than direct platform claims.

| Status | Verified fact | Planning decision | Official source |
|---|---|---|---|
| Verified | A Worker invokes Workers AI through an `AI` binding; the documented API is `env.AI.run(model, input)`. | Use the Workers AI binding rather than storing REST credentials in the Worker. | [Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/) |
| Verified | The model catalog currently includes `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, with invocation examples, function calling, and a 24,000-token context window. | Use this exact model identifier. No fallback is needed at planning time. The catalog page does not make an explicit GA-status claim. | [Llama 3.3 model page](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/) |
| Verified | `AIChatAgent` provides persisted messages, resumable streaming, WebSocket synchronization, tools, and integration with the React `useAgentChat` hook. | Extend `AIChatAgent` so chat, coordination, and memory are visible Cloudflare capabilities rather than custom plumbing. | [Chat agents](https://developers.cloudflare.com/agents/communication-channels/chat/chat-agents/) |
| Verified | An Agent instance is implemented as a Durable Object with isolated state, and `routeAgentRequest()` routes `/agents/{agent}/{instance}` requests. | Use one opaque, cryptographically random instance ID per browser session. | [Agent routing](https://developers.cloudflare.com/agents/runtime/communication/routing/) |
| Verified | The documented AI chat Agent configuration uses a Durable Object binding, SQLite-backed storage declaration, and `nodejs_compat`; this application additionally needs a Workers AI binding. | Keep class/binding names aligned and follow the documented chat-Agent and Workers AI configuration. Do not imply that every Agent requires AI. | [Agents configuration](https://developers.cloudflare.com/agents/runtime/operations/configuration/), [Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/) |
| Verified | Durable Object in-memory state can be lost during eviction; durable storage is private, transactional, and strongly consistent, and SQLite is recommended for new namespaces. | Persist review metadata, exception requests, and messages in the Agent's SQLite-backed Durable Object, not in memory or a second database. | [Durable Object storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/) |
| Verified | Workflows provide durable multi-step execution, waiting, and automatic retries at step boundaries. | **Inference:** omit Workflows because MVP reviews complete within an interactive chat turn; Agents already supply the named coordination/state primitive. | [Workflows](https://developers.cloudflare.com/workflows/) |
| Verified | Cloudflare recommends Vitest in the Workers runtime; Agent projects use Workers/Durable Object testing tools. | Unit-test deterministic logic without AI and integration-test routing/state with mocked AI. | [Workers testing](https://developers.cloudflare.com/workers/testing/), [Testing Agents](https://developers.cloudflare.com/agents/getting-started/testing-your-agent/) |
| Verified | Workers AI is not simulated locally; local calls reach the remote service. Cloudflare documents mocking the AI binding in tests. | Mock inference in automated tests and reserve a live-model smoke test for an approved, authenticated Cloudflare environment. | [Local development](https://developers.cloudflare.com/workers/local-development/), [Vitest recipes](https://developers.cloudflare.com/workers/testing/vitest-integration/recipes/) |
| Verified | Workers Static Assets serves frontend assets and Worker code from one deployment, with SPA fallback and selective Worker-first routing. Cloudflare recommends Static Assets for new Workers projects. | Deploy React/Vite assets and agent routes as one Worker to avoid a second Pages project and CORS. | [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) |
| Verified | Wrangler deploys a full-stack Worker to a `workers.dev` subdomain or custom domain. | Use the generated `workers.dev` URL as the public MVP demo; a custom domain is unnecessary. | [Static Assets get started](https://developers.cloudflare.com/workers/static-assets/get-started/) |

## Recommended stack

- TypeScript Cloudflare Worker
- React/Vite SPA through Workers Static Assets
- Cloudflare Agents SDK: `AIChatAgent`, `useAgentChat`, and one SQLite-backed Durable Object per opaque browser session
- Workers AI: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- Pure deterministic policy modules for GitHub Actions and Dockerfiles
- Vitest with the Cloudflare Workers integration and mocked inference
- One `workers.dev` deployment

No Pages, D1, KV, Vectorize, Queues, Workflows, application-level MCP, or runtime multi-agent system is planned for the MVP.

## Constraints to verify during implementation

- Workers AI cannot be validated entirely offline; an approved Cloudflare login and live binding are required for the final model smoke test.
- Anonymous opaque session IDs are acceptable for a public demo, not a production authorization design. Do not place personal identifiers in Agent instance names.
- Re-check the model catalog immediately before implementation/deployment because model availability can change.
