// Shared helpers for route handlers.
export function jsonError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api]", msg);
  return Response.json({ error: msg }, { status: 500 });
}

export async function handle<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    return jsonError(e);
  }
}
