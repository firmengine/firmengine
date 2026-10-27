/** Workers owns HTTP compression. Returning pre-compressed bytes with the default
 * encodeBody=automatic compresses them twice; Vinext may also rewrap Responses.
 * Keep the body plain and let the final Worker boundary encode it exactly once.
 * https://developers.cloudflare.com/workers/runtime-apis/response/
 */
export function jsonResponse(value: unknown, request?: Request, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
  const acceptEncoding = request?.headers.get("accept-encoding") ?? "";
  const acceptsGzip = /(?:^|,)\s*gzip\s*(?:;\s*q=(0(?:\.\d+)?|1(?:\.0+)?)\s*)?(?:,|$)/i.test(acceptEncoding)
    && !/(?:^|,)\s*gzip\s*;\s*q=0(?:\.0+)?\s*(?:,|$)/i.test(acceptEncoding);
  const body = JSON.stringify(value);
  if (acceptsGzip) {
    headers.set("Content-Encoding", "gzip");
    headers.append("Vary", "Accept-Encoding");
    headers.delete("Content-Length");
    return new Response(body, { ...init, headers });
  }
  headers.delete("Content-Encoding");
  return new Response(body, { ...init, headers });
}
