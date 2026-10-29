export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
const finitePoint = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function clientToViewportPoint(client: Point, bounds: Rect, viewport: { width: number; height: number }): Point | null {
  if (!finitePoint(client) || !finitePoint(bounds) || ![bounds.width, bounds.height, viewport.width, viewport.height].every(value => Number.isFinite(value) && value > 0)) return null;
  return { x: clamp((client.x - bounds.x) / bounds.width, 0, 1) * viewport.width, y: clamp((client.y - bounds.y) / bounds.height, 0, 1) * viewport.height };
}
export function rectangleFromPoints(a: Point, b: Point, bounds: Rect): Rect | null {
  if (!finitePoint(a) || !finitePoint(b) || !finitePoint(bounds) || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) return null;
  const x1 = clamp(a.x, bounds.x, bounds.x + bounds.width), x2 = clamp(b.x, bounds.x, bounds.x + bounds.width);
  const y1 = clamp(a.y, bounds.y, bounds.y + bounds.height), y2 = clamp(b.y, bounds.y, bounds.y + bounds.height);
  const width = Math.abs(x2 - x1), height = Math.abs(y2 - y1);
  return width && height ? { x: Math.min(x1, x2), y: Math.min(y1, y2), width, height } : null;
}
export function transformRectangle(rect: Rect, convert: (point: Point) => Point): Rect {
  const points = [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y }, { x: rect.x, y: rect.y + rect.height }, { x: rect.x + rect.width, y: rect.y + rect.height }].map(convert);
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
