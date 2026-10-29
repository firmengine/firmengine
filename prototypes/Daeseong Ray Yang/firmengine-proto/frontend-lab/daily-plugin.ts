import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface BriefQuote { symbol: string; name: string; price: number; currency: string; changePercent: number | null; asOf: string; href: string; delayed: true }
export interface BriefHeadline { title: string; href: string; publishedAt: string }
export interface BriefPayload {
  part: "weather" | "market" | "news"; source: string; sourceUrl: string; updatedAt: string; stale: boolean; error?: string;
  weather?: { temperature: number; code: number; asOf: string; latitude: number; longitude: number };
  quotes?: BriefQuote[]; headlines?: BriefHeadline[];
}
const feeds = [{ url: "https://www.yna.co.kr/rss/news.xml", name: "연합뉴스", page: "https://www.yna.co.kr/rss/index" }, { url: "https://feeds.bbci.co.uk/korean/rss.xml", name: "BBC News 코리아", page: "https://www.bbc.com/korean" }];
const symbols = [{ symbol: "^KS11", name: "KOSPI" }, { symbol: "^IXIC", name: "NASDAQ" }, { symbol: "005930.KS", name: "삼성전자" }];
const hostAllowed = (host: string) => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host);
function plain(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|apos);/g, entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[entity] ?? entity).replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => { const n = code.startsWith("x") ? parseInt(code.slice(1), 16) : Number(code); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; }).trim();
}
export function parseBriefFeed(xml: string): BriefHeadline[] {
  const headlines: BriefHeadline[] = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const value = (tag: string) => plain(match[1].match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "");
    const title = value("title"), href = value("link"), published = value("pubDate");
    try {
      const url = new URL(href);
      if (url.protocol !== "https:" || url.username || url.password || !["yna.co.kr", "bbc.com", "bbc.co.uk"].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) continue;
      if (title && !headlines.some(item => item.href === url.href)) headlines.push({ title: title.slice(0, 180), href: url.href, publishedAt: Number.isNaN(Date.parse(published)) ? "" : new Date(published).toISOString() });
    } catch { /* Invalid feed links are discarded rather than rendered. */ }
    if (headlines.length === 8) break;
  }
  return headlines;
}

export function createBriefService(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, { payload: BriefPayload; expires: number }>();
  const pending = new Map<string, Promise<BriefPayload>>();
  async function getText(url: string): Promise<string> {
    const response = await fetcher(url, { signal: AbortSignal.timeout(6500), redirect: "error", headers: { "User-Agent": "FirmEngineLocalBrief/1.0", Accept: "application/json, application/rss+xml, application/xml, text/xml" } });
    if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
    if (Number(response.headers.get("content-length") ?? 0) > 524288) throw new Error("RESPONSE_TOO_LARGE");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("EMPTY_RESPONSE");
    let size = 0, text = ""; const decoder = new TextDecoder();
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 524288) throw new Error("RESPONSE_TOO_LARGE"); text += decoder.decode(chunk.value, { stream: true }); } return text + decoder.decode(); }
    finally { await reader.cancel().catch(() => undefined); }
  }
  async function load(part: BriefPayload["part"], latitude: number, longitude: number): Promise<BriefPayload> {
    const base = { part, updatedAt: new Date().toISOString(), stale: false };
    if (part === "weather") {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: "temperature_2m,weather_code", timezone: "Asia/Seoul" }).toString();
      const data = JSON.parse(await getText(url.href)) as { current?: { temperature_2m?: number; weather_code?: number; time?: string } };
      if (typeof data.current?.temperature_2m !== "number" || !Number.isFinite(data.current.temperature_2m) || typeof data.current.weather_code !== "number" || !data.current.time) throw new Error("INVALID_WEATHER");
      return { ...base, source: "Open-Meteo", sourceUrl: "https://open-meteo.com/", weather: { temperature: data.current.temperature_2m, code: data.current.weather_code, asOf: `${data.current.time}+09:00`, latitude, longitude } };
    }
    if (part === "market") {
      const results = await Promise.allSettled(symbols.map(async item => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}?interval=1d&range=1d`;
        const data = JSON.parse(await getText(url));
        const meta = data.chart?.result?.[0]?.meta;
        if (!meta || typeof meta.regularMarketPrice !== "number" || !Number.isFinite(meta.regularMarketPrice) || meta.regularMarketPrice <= 0 || typeof meta.regularMarketTime !== "number") throw new Error("INVALID_QUOTE");
        const previous = meta.chartPreviousClose ?? meta.previousClose;
        return { ...item, price: meta.regularMarketPrice, currency: typeof meta.currency === "string" ? meta.currency : "", changePercent: typeof previous === "number" && previous > 0 ? (meta.regularMarketPrice / previous - 1) * 100 : null, asOf: new Date(meta.regularMarketTime * 1000).toISOString(), href: `https://finance.yahoo.com/quote/${encodeURIComponent(item.symbol)}/`, delayed: true as const };
      }));
      const quotes = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
      if (!quotes.length) throw new Error("MARKET_UNAVAILABLE");
      return { ...base, source: "Yahoo Finance", sourceUrl: "https://finance.yahoo.com/", quotes, ...(quotes.length < symbols.length ? { error: "일부 시세의 연결이 지연되고 있습니다." } : {}) };
    }
    for (const feed of feeds) {
      try { const headlines = parseBriefFeed(await getText(feed.url)); if (headlines.length) return { ...base, source: feed.name, sourceUrl: feed.page, headlines }; }
      catch { /* The only fallback is the second fixed official feed. */ }
    }
    throw new Error("NEWS_UNAVAILABLE");
  }
  return async (part: BriefPayload["part"], latitude = 37.57, longitude = 126.98): Promise<BriefPayload> => {
    const lat = Math.round(latitude * 100) / 100, lon = Math.round(longitude * 100) / 100;
    const key = part === "weather" ? `${part}:${lat}:${lon}` : part, old = cache.get(key);
    if (old && old.expires > Date.now()) return old.payload;
    if (pending.has(key)) return pending.get(key)!;
    const request = load(part, lat, lon).then(payload => { if (cache.size >= 128) cache.delete(cache.keys().next().value!); cache.set(key, { payload, expires: Date.now() + (part === "weather" ? 600000 : part === "news" ? 300000 : 60000) }); return payload; }).catch(() => {
      const payload: BriefPayload = old ? { ...old.payload, stale: true, error: "연결 지연 · 이전에 확인한 자료입니다." } : { part, source: part === "weather" ? "Open-Meteo" : part === "market" ? "Yahoo Finance" : "연합뉴스 / BBC News 코리아", sourceUrl: part === "weather" ? "https://open-meteo.com/" : part === "market" ? "https://finance.yahoo.com/" : "https://www.yna.co.kr/", updatedAt: new Date().toISOString(), stale: false, error: "제공처에 연결하지 못했습니다. 잠시 후 다시 확인하세요." };
      cache.set(key, { payload, expires: Date.now() + 30000 }); return payload;
    }).finally(() => pending.delete(key));
    pending.set(key, request); return request;
  };
}

export function dailyPlugin(): Plugin {
  const service = createBriefService();
  const middleware = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/daily-brief") { next(); return; }
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store"); response.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status: number, body: unknown) => { response.statusCode = status; response.end(JSON.stringify(body)); };
    const host = request.headers.host ?? "", remote = request.socket.remoteAddress ?? "";
    if (!hostAllowed(host) || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote) || request.headers["sec-fetch-site"] === "cross-site") { send(403, { error: "LOCAL_REQUEST_REQUIRED" }); return; }
    if (request.headers.origin) { try { if (new URL(request.headers.origin).host !== host) { send(403, { error: "SAME_ORIGIN_REQUIRED" }); return; } } catch { send(403, { error: "SAME_ORIGIN_REQUIRED" }); return; } }
    if (request.method !== "GET") { send(405, { error: "GET_REQUIRED" }); return; }
    if ([...url.searchParams.keys()].some(key => !["part", "lat", "lon"].includes(key)) || (request.url?.length ?? 0) > 512) { send(400, { error: "INVALID_QUERY" }); return; }
    const part = url.searchParams.get("part");
    if (part !== "weather" && part !== "market" && part !== "news") { send(400, { error: "INVALID_PART" }); return; }
    const coordinate = (key: string, fallback: number, max: number) => { const text = url.searchParams.get(key); if (text === null) return fallback; return /^-?\d{1,3}(?:\.\d{1,8})?$/.test(text) && Math.abs(Number(text)) <= max ? Number(text) : NaN; };
    const latitude = coordinate("lat", 37.57, 90), longitude = coordinate("lon", 126.98, 180);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { send(400, { error: "INVALID_COORDINATES" }); return; }
    send(200, await service(part, latitude, longitude));
  };
  return { name: "firmengine-local-daily-brief", configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } };
}
