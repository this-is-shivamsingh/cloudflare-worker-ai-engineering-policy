export function completedChatResponse(text: string): Response {
  return new Response(text, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
