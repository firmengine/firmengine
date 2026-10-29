import { useEffect, useRef, useState, type PointerEvent } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import { clientToViewportPoint, rectangleFromPoints, transformRectangle, type Point, type Rect } from "./pdf-geometry";
import "./PdfWorkbench.css";

GlobalWorkerOptions.workerSrc = workerUrl;
export interface PdfWorkbenchProps {
  url: string; name: string; initialPage?: number; featureLabel?: string; onLinkPage?: (page: number) => void;
}
interface Geometry { width: number; height: number; bounds: Rect; toPdf: (point: Point) => Point; toViewport: (point: Point) => Point }
interface Highlight extends Rect { id: number }
const message = (error: unknown) => error instanceof Error ? error.message : "파일 내용을 읽지 못했습니다.";
const fileStem = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_") || "검토자료";

export default function PdfWorkbench({ url, name, initialPage = 1, featureLabel, onLinkPage }: PdfWorkbenchProps) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [pageInput, setPageInput] = useState(String(Math.max(1, initialPage)));
  const [zoom, setZoom] = useState(1);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [highlights, setHighlights] = useState<Record<number, Highlight[]>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [drawing, setDrawing] = useState(false);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [renderRetry, setRenderRetry] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const renderRef = useRef<RenderTask | null>(null);
  const dragRef = useRef<Point | null>(null);
  const annotationId = useRef(0);
  const downloadUrls = useRef(new Set<string>());
  const initialPageRef = useRef(initialPage);
  initialPageRef.current = initialPage;
  const pageCount = document?.numPages ?? (imageUrl ? 1 : 0);
  const rotation = rotations[page] ?? 0;

  useEffect(() => {
    setHighlights({}); setNotes({}); setRotations({}); setZoom(1); setNotice(""); setDrawing(false);
  }, [url]);
  useEffect(() => {
    let stopped = false, imageObjectUrl: string | null = null;
    let task: ReturnType<typeof getDocument> | undefined;
    const controller = new AbortController();
    setDocument(null); setImageUrl(null); setGeometry(null); setLoadError(null); setRenderError(null); setLoading(true); bytesRef.current = null;
    void (async () => {
      try {
        const source = new URL(url, window.location.href);
        if (source.origin !== window.location.origin && source.protocol !== "data:") throw new Error("이 화면에서는 선택한 로컬 파일과 같은 사이트의 자료만 열 수 있습니다.");
        const response = await fetch(source.href, { signal: controller.signal });
        if (!response.ok) throw new Error(`자료를 불러오지 못했습니다. HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (stopped) return;
        bytesRef.current = bytes;
        if (/\.(png|jpe?g)$/i.test(name) || /^image\/(png|jpeg)/i.test(response.headers.get("content-type") ?? "")) {
          imageObjectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer]));
          setImageUrl(imageObjectUrl); setPage(1); setPageInput("1");
        } else {
          task = getDocument({ data: bytes.slice() });
          const parsed = await task.promise;
          if (stopped) return;
          const selected = Math.min(parsed.numPages, Math.max(1, initialPageRef.current));
          setDocument(parsed); setPage(selected); setPageInput(String(selected));
        }
      } catch (error) { if (!stopped) setLoadError(message(error)); }
      finally { if (!stopped) setLoading(false); }
    })();
    return () => {
      stopped = true; controller.abort(); renderRef.current?.cancel();
      if (task) void task.destroy().catch(() => undefined);
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [url, name, retry]);

  useEffect(() => {
    if (!pageCount) return;
    const selected = Math.max(1, Math.min(pageCount, initialPage));
    setPage(selected); setPageInput(String(selected));
  }, [initialPage, pageCount]);
  useEffect(() => { setPageInput(String(page)); dragRef.current = null; setPreview(null); }, [page]);

  useEffect(() => {
    if (!document || !canvasRef.current) return;
    let stopped = false, owned: RenderTask | undefined;
    const canvas = canvasRef.current;
    setRendering(true); setGeometry(null); setRenderError(null); dragRef.current = null; setPreview(null);
    void (async () => {
      try {
        const previous = renderRef.current;
        if (previous) { previous.cancel(); await previous.promise.catch(() => undefined); }
        const sourcePage = await document.getPage(page);
        if (stopped) return;
        const viewport = sourcePage.getViewport({ scale: zoom, rotation: (sourcePage.rotate + rotation) % 360 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil(viewport.width * ratio); canvas.height = Math.ceil(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
        const [left, bottom, right, top] = sourcePage.view;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("브라우저의 PDF 그리기 기능을 사용할 수 없습니다.");
        setGeometry({ width: viewport.width, height: viewport.height, bounds: { x: left, y: bottom, width: right - left, height: top - bottom },
          toPdf: point => { const [x, y] = viewport.convertToPdfPoint(point.x, point.y); return { x, y }; },
          toViewport: point => { const [x, y] = viewport.convertToViewportPoint(point.x, point.y); return { x, y }; } });
        owned = sourcePage.render({ canvas, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        renderRef.current = owned;
        await owned.promise;
      } catch (error) { if (!stopped && !(error instanceof Error && error.name === "RenderingCancelledException")) setRenderError(message(error)); }
      finally { if (!stopped) setRendering(false); }
    })();
    return () => { stopped = true; owned?.cancel(); };
  }, [document, page, zoom, rotation, renderRetry]);

  useEffect(() => () => { for (const objectUrl of downloadUrls.current) URL.revokeObjectURL(objectUrl); }, []);

  function download(bytes: Uint8Array, filename: string, type: string) {
    const objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type }));
    downloadUrls.current.add(objectUrl);
    const anchor = window.document.createElement("a"); anchor.href = objectUrl; anchor.download = filename;
    window.document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => { URL.revokeObjectURL(objectUrl); downloadUrls.current.delete(objectUrl); }, 1000);
  }
  async function exportPdf() {
    const source = bytesRef.current;
    if (!source || !document || exporting) return;
    setExporting(true); setNotice("");
    try {
      const edited = await PDFDocument.load(source.slice());
      edited.getPages().forEach((pdfPage, index) => {
        const delta = rotations[index + 1] ?? 0;
        if (delta) pdfPage.setRotation(degrees((pdfPage.getRotation().angle + delta) % 360));
        for (const rect of highlights[index + 1] ?? []) pdfPage.drawRectangle({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, color: rgb(1, .77, .12), opacity: .24, borderColor: rgb(.89, .55, .03), borderWidth: 1 });
      });
      download(await edited.save(), `${fileStem(name)}_검토표시.pdf`, "application/pdf");
      setNotice("형광 표시와 회전을 반영한 PDF 사본을 내려받았습니다. 메모는 별도 JSON으로 저장할 수 있습니다.");
    } catch (error) { setNotice(`PDF 사본을 만들지 못했습니다: ${message(error)}`); }
    finally { setExporting(false); }
  }
  function pointFor(event: PointerEvent<SVGSVGElement>): Point | null {
    if (!geometry) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = clientToViewportPoint({ x: event.clientX, y: event.clientY }, { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }, geometry);
    return point ? geometry.toPdf(point) : null;
  }
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!drawing || rendering || event.button !== 0) return;
    const point = pointFor(event); if (!point) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = point;
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const point = pointFor(event);
    if (point && dragRef.current && geometry) setPreview(rectangleFromPoints(dragRef.current, point, geometry.bounds));
  }
  function pointerUp(event: PointerEvent<SVGSVGElement>) {
    const point = pointFor(event), start = dragRef.current;
    dragRef.current = null; setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!point || !start || !geometry) return;
    const rect = rectangleFromPoints(start, point, geometry.bounds);
    if (rect && rect.width > .5 && rect.height > .5) setHighlights(current => ({ ...current, [page]: [...(current[page] ?? []), { ...rect, id: ++annotationId.current }] }));
  }
  function goTo(next: number) { if (Number.isInteger(next) && next >= 1 && next <= pageCount) setPage(next); else setPageInput(String(page)); }
  const error = loadError || renderError;
  return <section className="pdf-workbench" aria-label={`${name} 원문 검토`}>
    <header className="pdf-workbench-heading"><div><strong>{name}</strong><span>{featureLabel ? `${featureLabel} · 원문 페이지 확인` : "원문 보기 · 검토 표시"}</span></div><span className="pdf-local-badge">내 기기에서 처리</span></header>
    <div className="pdf-workbench-toolbar" aria-label="PDF 도구">
      <button type="button" disabled={page <= 1 || loading} onClick={() => goTo(page - 1)} aria-label="이전 페이지">←</button>
      <form onSubmit={event => { event.preventDefault(); goTo(Number(pageInput)); }}><input aria-label="이동할 페이지" inputMode="numeric" value={pageInput} onChange={event => setPageInput(event.target.value)} disabled={!pageCount} /><span>/ {pageCount || "—"}</span><button type="submit" disabled={!pageCount}>이동</button></form>
      <button type="button" disabled={!pageCount || page >= pageCount} onClick={() => goTo(page + 1)} aria-label="다음 페이지">→</button>
      <span className="pdf-toolbar-divider" />
      <button type="button" disabled={zoom <= .5 || !pageCount} onClick={() => setZoom(value => Math.max(.5, value - .25))} aria-label="축소">−</button><span className="pdf-zoom">{Math.round(zoom * 100)}%</span><button type="button" disabled={zoom >= 2 || !pageCount} onClick={() => setZoom(value => Math.min(2, value + .25))} aria-label="확대">+</button>
      <button type="button" disabled={!document || rendering} onClick={() => setRotations(current => ({ ...current, [page]: ((current[page] ?? 0) + 90) % 360 }))}>쪽 회전 ↻</button>
      <button type="button" disabled={!document || rendering} aria-pressed={drawing} className={drawing ? "is-active" : ""} onClick={() => setDrawing(value => !value)}>형광 표시</button>
      <button type="button" disabled={!(highlights[page]?.length)} onClick={() => setHighlights(current => ({ ...current, [page]: (current[page] ?? []).slice(0, -1) }))}>표시 취소</button>
    </div>
    <div className="pdf-canvas-container" aria-busy={loading || rendering}>
      {loading && <div className="pdf-file-status" role="status">파일을 열고 있습니다…</div>}
      {error && <div className="pdf-file-error" role="alert"><strong>원문을 표시하지 못했습니다</strong><p>{error}</p><button type="button" onClick={() => loadError ? setRetry(value => value + 1) : setRenderRetry(value => value + 1)}>다시 열기</button></div>}
      {!loadError && !imageUrl && <div className="pdf-page-surface" style={geometry ? { width: geometry.width, height: geometry.height } : undefined}>
        <canvas ref={canvasRef} aria-label={`${page}쪽 PDF 원문`} />
        {geometry && !renderError && <svg className={`pdf-annotation-layer ${drawing ? "is-drawing" : ""}`} width={geometry.width} height={geometry.height} viewBox={`0 0 ${geometry.width} ${geometry.height}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { dragRef.current = null; setPreview(null); }} aria-label="드래그하여 원문 영역 표시">
          {[...(highlights[page] ?? []), ...(preview ? [{ ...preview, id: -1 }] : [])].map(rect => { const display = transformRectangle(rect, geometry.toViewport); return <rect key={rect.id} {...display} className={rect.id === -1 ? "pdf-highlight is-preview" : "pdf-highlight"} />; })}
        </svg>}
      </div>}
      {imageUrl && !loadError && <img className="pdf-fallback-image" src={imageUrl} alt={`${name} 원본 이미지`} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} onError={() => setLoadError("선택한 이미지 내용을 읽지 못했습니다.")} />}
      {rendering && !loading && <span className="pdf-render-status" role="status">{page}쪽 표시 중…</span>}
    </div>
    <div className="pdf-workbench-bottom">
      <div className="pdf-page-link"><div><strong>{pageCount ? `${page}쪽` : "페이지 확인"}{featureLabel ? ` · ${featureLabel}` : ""}</strong><span>원문은 보존하고 검토 표시만 사본에 반영합니다.</span></div>{onLinkPage && <button type="button" className="pdf-primary" disabled={!pageCount || !!error || loading || rendering} onClick={() => { onLinkPage(page); setNotice(`${page}쪽을 항목의 근거 페이지로 선택했습니다.`); }}>이 페이지를 근거로 연결</button>}</div>
      <label className="pdf-note-label">이 페이지 검토 메모<textarea value={notes[page] ?? ""} maxLength={4000} disabled={!pageCount} onChange={event => setNotes(current => ({ ...current, [page]: event.target.value }))} placeholder="확인한 항목이나 추가로 볼 내용을 적으세요." /></label>
      <div className="pdf-export-actions">{document && <button type="button" className="pdf-primary" disabled={exporting || loading || !!error} onClick={() => void exportPdf()}>{exporting ? "사본 만드는 중…" : "표시한 PDF 내려받기"}</button>}{imageUrl && <button type="button" onClick={() => { if (bytesRef.current) download(bytesRef.current, name, /\.png$/i.test(name) ? "image/png" : "image/jpeg"); }}>이미지 원본 내려받기</button>}<button type="button" disabled={!pageCount} onClick={() => download(new TextEncoder().encode(JSON.stringify({ sourceName: name, featureLabel: featureLabel ?? null, notes, highlights, rotations }, null, 2)), `${fileStem(name)}_검토메모.json`, "application/json")}>메모·표시 JSON 저장</button><span>{imageUrl ? "이미지 자료는 페이지 연결과 메모를 지원합니다." : drawing ? "원문 위를 드래그하여 표시하세요. 회전·확대 후에도 같은 영역에 저장됩니다." : "형광 표시를 켜고 원문 위를 드래그하세요."}</span></div>
      {notice && <p className="pdf-workbench-notice" role="status">{notice}</p>}
    </div>
  </section>;
}
