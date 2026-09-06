import { routeAgentRequest } from "agents";

export { EngineeringPolicyAgent } from "./agent";

const AGENT_ROUTE = /^\/agents\/engineering-policy-agent\/[a-f0-9]{32}(?:\/.*)?$/;

function secureResponse(response: Response): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/agents/")) return new Response("Not found", { status: 404 });
    if (!AGENT_ROUTE.test(url.pathname)) return secureResponse(new Response("Invalid session route", { status: 400 }));

    const agentResponse = await routeAgentRequest(request, env);
    return agentResponse ? secureResponse(agentResponse) : secureResponse(new Response("Not found", { status: 404 }));
  }
} satisfies ExportedHandler<Env>;
