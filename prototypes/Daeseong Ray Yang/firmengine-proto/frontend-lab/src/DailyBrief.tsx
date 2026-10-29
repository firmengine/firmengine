import { useEffect, useState } from "react";
import { CloudSun, MapPin, Newspaper, Pause, Play, RefreshCw, TrendingUp, Utensils } from "lucide-react";
import type { BriefPayload } from "../daily-plugin";
import "./DailyBrief.css";

const menus = ["따뜻한 쌀국수", "제철 비빔밥", "순두부찌개", "담백한 샌드위치", "들깨칼국수", "연어 포케", "메밀국수", "버섯 된장찌개", "닭곰탕", "수제 카레"];
const defaultLocation = { latitude: 37.57, longitude: 126.98, label: "서울 · 기본" };
const time = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "기준시각 미제공";
function weatherLabel(code: number) { return code === 0 ? "맑음" : code <= 3 ? "구름" : code <= 48 ? "안개" : code <= 67 ? "비" : code <= 77 ? "눈" : code <= 82 ? "소나기" : code <= 86 ? "눈" : "뇌우"; }

export default function DailyBrief() {
  const [location, setLocation] = useState(defaultLocation);
  const [weather, setWeather] = useState<BriefPayload | null>(null), [market, setMarket] = useState<BriefPayload | null>(null), [news, setNews] = useState<BriefPayload | null>(null);
  const [menu, setMenu] = useState(() => Math.floor(Math.random() * menus.length));
  const [rotation, setRotation] = useState(0), [paused, setPaused] = useState(false), [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [reduced, setReduced] = useState(false);
  const [refresh, setRefresh] = useState(0), [locating, setLocating] = useState(false), [locationMessage, setLocationMessage] = useState("");
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches); update(); preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (paused || hovered || focused || reduced) return; const timer = setInterval(() => setRotation(value => value + 1), 6000); return () => clearInterval(timer); }, [paused, hovered, focused, reduced]);
  useEffect(() => {
    const controller = new AbortController();
    async function load(part: BriefPayload["part"], setter: (value: BriefPayload) => void) {
      try {
        const query = new URLSearchParams({ part });
        if (part === "weather") { query.set("lat", String(location.latitude)); query.set("lon", String(location.longitude)); }
        const response = await fetch(`/api/daily-brief?${query}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(18000)]) });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("BRIEF_UNAVAILABLE");
        const payload = await response.json() as BriefPayload;
        if (payload.part !== part) throw new Error("INVALID_BRIEF");
        setter(payload);
      } catch { if (!controller.signal.aborted) setter({ part, source: part === "weather" ? "Open-Meteo" : part === "market" ? "Yahoo Finance" : "뉴스 RSS", sourceUrl: part === "weather" ? "https://open-meteo.com/" : part === "market" ? "https://finance.yahoo.com/" : "https://www.yna.co.kr/", updatedAt: new Date().toISOString(), stale: false, error: "지금 연결할 수 없습니다. 로컬 서버에서 다시 확인하세요." }); }
    }
    const loadAll = () => { void load("weather", setWeather); void load("market", setMarket); void load("news", setNews); };
    loadAll(); const timer = setInterval(loadAll, 300000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [location.latitude, location.longitude, refresh]);
  async function requestLocation() {
    if (locating) return;
    if (!navigator.geolocation || !window.isSecureContext) { setLocationMessage("위치 기능은 HTTPS 또는 localhost에서 사용할 수 있습니다."); return; }
    setLocating(true); setLocationMessage("");
    try {
      if (navigator.permissions) { const permission = await navigator.permissions.query({ name: "geolocation" }); if (permission.state === "denied") { setLocation(defaultLocation); setLocationMessage("브라우저 위치 권한이 꺼져 있습니다. 서울 기준으로 표시합니다."); setLocating(false); return; } }
    } catch { /* Browsers without Permissions API can show their own user-triggered prompt. */ }
    navigator.geolocation.getCurrentPosition(position => {
      setLocation({ latitude: Math.round(position.coords.latitude * 100) / 100, longitude: Math.round(position.coords.longitude * 100) / 100, label: "내 위치 주변" });
      setLocationMessage("대략적인 위치를 날씨 조회와 지도 검색에만 사용합니다."); setLocating(false);
    }, () => { setLocationMessage("위치를 확인하지 못했습니다. 현재 선택한 기준을 유지합니다."); setLocating(false); }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
  }
  const quote = market?.quotes?.length ? market.quotes[rotation % market.quotes.length] : undefined;
  const headline = news?.headlines?.length ? news.headlines[rotation % news.headlines.length] : undefined;
  const selectedMenu = menus[menu], place = location.label === "서울 · 기본" ? "서울" : "내 위치 주변";
  const mapHref = `https://www.google.com/maps/search/${encodeURIComponent(`${place} ${selectedMenu}`)}/@${location.latitude},${location.longitude},14z`;
  const quoteText = quote ? `${quote.name} ${quote.price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${quote.currency === "KRW" && !quote.symbol.startsWith("^") ? "원" : ""}${quote.changePercent === null ? "" : ` ${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`}` : market ? "시세 연결 대기" : "시세 불러오는 중";
  const detail = (payload: BriefPayload | null, asOf?: string) => payload ? `${payload.source} · ${time(asOf ?? payload.updatedAt)}${payload.stale ? " · 이전 조회" : ""}${payload.error ? ` · ${payload.error}` : ""}` : "공개 제공처에서 조회 중";
  return <section className="daily-brief" aria-label="오늘의 짧은 소식" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="daily-brief-heading"><span>오늘, 잠깐의 여유</span><div><button type="button" aria-pressed={paused} aria-label={paused ? "소식 순환 재개" : "소식 순환 일시정지"} title={reduced ? "움직임 줄이기 설정으로 자동 순환이 멈춰 있습니다." : "6초마다 시세·제목 순환"} onClick={() => setPaused(value => !value)}>{paused || reduced ? <Play /> : <Pause />}</button><button type="button" aria-label="소식 새로고침" onClick={() => setRefresh(value => value + 1)}><RefreshCw /></button></div></div>
    <div className="daily-brief-line"><Utensils aria-hidden="true" /><a href={mapHref} target="_blank" rel="noreferrer" title={`${place} ${selectedMenu} 지도 검색 · 무작위 메뉴 제안이며 실제 식당 순위가 아닙니다.`}>{selectedMenu} 어때요?</a><button type="button" className="daily-reroll" aria-label="다른 점심 메뉴 뽑기" onClick={() => setMenu(value => (value + 1 + Math.floor(Math.random() * (menus.length - 1))) % menus.length)}>↻</button></div>
    <div className="daily-brief-line"><TrendingUp aria-hidden="true" /><a className={quote && quote.changePercent !== null ? quote.changePercent >= 0 ? "daily-up" : "daily-down" : ""} href={quote?.href ?? market?.sourceUrl ?? "https://finance.yahoo.com/"} target="_blank" rel="noreferrer" title={`지연·참고 시세 · ${detail(market, quote?.asOf)}`}>{market?.stale ? "이전 " : ""}{quoteText}</a><span className="daily-tag">지연</span></div>
    <div className="daily-brief-line"><CloudSun aria-hidden="true" /><a href="https://open-meteo.com/" target="_blank" rel="noreferrer" title={`${location.label} · 모델 기반 현재 날씨 · ${detail(weather, weather?.weather?.asOf)}`}>{location.label} {weather?.weather ? `${weather.weather.temperature.toFixed(1)}° ${weatherLabel(weather.weather.code)}` : weather ? "날씨 연결 대기" : "날씨 조회 중"}{weather?.stale ? " · 이전" : ""}</a></div>
    <div className="daily-brief-line"><Newspaper aria-hidden="true" /><a key={headline?.href ?? "pending"} href={headline?.href ?? news?.sourceUrl ?? "https://www.yna.co.kr/"} target="_blank" rel="noreferrer" title={`${headline?.title ?? news?.error ?? "뉴스 조회 중"} · ${detail(news, headline?.publishedAt)}`}>{news?.stale ? "이전 · " : ""}{headline?.title ?? (news ? "뉴스 연결 대기" : "주요 뉴스 불러오는 중")}</a></div>
    <div className="daily-brief-footer"><button type="button" onClick={() => void requestLocation()} disabled={locating} title="클릭하면 브라우저 위치 권한을 확인합니다. 위치는 저장하지 않습니다."><MapPin />{locating ? "위치 확인 중" : "내 위치 사용"}</button>{location.label !== defaultLocation.label && <button type="button" onClick={() => { setLocation(defaultLocation); setLocationMessage(""); }}>서울로</button>}<span title={detail(news)}>{news?.source ?? "공개 소식"}</span></div>
    {locationMessage && <p className="daily-location-message" role="status">{locationMessage}</p>}
  </section>;
}
