import "server-only";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID.test(value);
}

/** Catalog data is public and changes rarely; a short cache keeps admin edits visible quickly. */
export function json(data: unknown, init: { status?: number; maxAge?: number } = {}) {
  return Response.json(data, {
    status: init.status ?? 200,
    headers: { "Cache-Control": `public, max-age=${init.maxAge ?? 30}` },
  });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

/** Optional uuid query param: undefined if absent, null if present but malformed. */
export function uuidParam(params: URLSearchParams, name: string): string | undefined | null {
  const v = params.get(name);
  if (v === null || v === "") return undefined;
  return isUuid(v) ? v : null;
}
