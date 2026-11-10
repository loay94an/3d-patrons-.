import type { CadPoint, CadSegment } from './pattern-cad-engine';

export interface OffsetContourOptions {
  toleranceCm?: number;
  miterLimit?: number;
  closeToleranceCm?: number;
}

export interface OffsetContourResult {
  segments: CadSegment[];
  closed: boolean;
  valid: boolean;
  warnings: string[];
}

const distance = (a: CadPoint, b: CadPoint): number => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: CadPoint, b: CadPoint, t: number): CadPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
});
const midpoint = (a: CadPoint, b: CadPoint): CadPoint => lerp(a, b, 0.5);
const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

function split(points: CadPoint[]): [CadPoint[], CadPoint[]] {
  const levels: CadPoint[][] = [points.map(p => ({ x: p.x, y: p.y }))];
  while (levels[levels.length - 1].length > 1) {
    const row = levels[levels.length - 1];
    levels.push(row.slice(0, -1).map((p, i) => midpoint(p, row[i + 1])));
  }
  return [
    levels.map(level => level[0]),
    levels.map(level => level[level.length - 1]).reverse()
  ];
}

function flatness(points: CadPoint[]): number {
  const start = points[0], end = points[points.length - 1];
  const dx = end.x - start.x, dy = end.y - start.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-10) {
    return Math.max(...points.slice(1, -1).map(p => distance(start, p)), 0);
  }
  return Math.max(...points.slice(1, -1).map(p =>
    Math.abs(cross(dx, dy, p.x - start.x, p.y - start.y)) / chord
  ), 0);
}

function flattenBezier(points: CadPoint[], tolerance: number, depth = 0): CadPoint[] {
  if (points.length <= 2 || depth >= 16 || flatness(points) <= tolerance) {
    return [{ ...points[0] }, { ...points[points.length - 1] }];
  }
  const [left, right] = split(points);
  const a = flattenBezier(left, tolerance, depth + 1);
  const b = flattenBezier(right, tolerance, depth + 1);
  return [...a.slice(0, -1), ...b];
}

function flattenSegment(segment: CadSegment, tolerance: number): CadPoint[] {
  if (segment.type === 'quad' && segment.cp1) {
    return flattenBezier([segment.p1, segment.cp1, segment.p2], tolerance);
  }
  if (segment.type === 'bezier' && segment.cp1 && segment.cp2) {
    return flattenBezier([segment.p1, segment.cp1, segment.cp2, segment.p2], tolerance);
  }
  return [{ ...segment.p1 }, { ...segment.p2 }];
}

function lineIntersection(
  p: CadPoint, r: CadPoint, q: CadPoint, s: CadPoint
): CadPoint | null {
  const denominator = cross(r.x, r.y, s.x, s.y);
  if (Math.abs(denominator) < 1e-10) return null;
  const t = cross(q.x - p.x, q.y - p.y, s.x, s.y) / denominator;
  return { x: p.x + t * r.x, y: p.y + t * r.y };
}

function segmentsIntersect(a: CadPoint, b: CadPoint, c: CadPoint, d: CadPoint): boolean {
  const orient = (p: CadPoint, q: CadPoint, r: CadPoint) =>
    cross(q.x - p.x, q.y - p.y, r.x - p.x, r.y - p.y);
  const o1 = orient(a, b, c), o2 = orient(a, b, d);
  const o3 = orient(c, d, a), o4 = orient(c, d, b);
  return ((o1 > 1e-8 && o2 < -1e-8) || (o1 < -1e-8 && o2 > 1e-8))
    && ((o3 > 1e-8 && o4 < -1e-8) || (o3 < -1e-8 && o4 > 1e-8));
}

/**
 * Builds a true constant-distance contour from an ordered chain of CAD edges.
 * Curves are adaptively flattened in centimetres, then offset as a joined
 * polyline. Miter joins are limited to avoid spikes at acute corners; bevel
 * joins are emitted when that limit is exceeded. Input geometry is immutable.
 */
export function offsetCadContour(
  input: CadSegment[],
  offsetCm: number,
  options: OffsetContourOptions = {}
): OffsetContourResult {
  const warnings: string[] = [];
  const tolerance = Math.max(0.001, options.toleranceCm ?? 0.02);
  const miterLimit = Math.max(1, options.miterLimit ?? 4);
  const closeTolerance = options.closeToleranceCm ?? 0.05;

  if (!Number.isFinite(offsetCm) || offsetCm < 0) {
    return { segments: [], closed: false, valid: false, warnings: ['قيمة الإزاحة غير صالحة'] };
  }
  if (input.length === 0) {
    return { segments: [], closed: false, valid: false, warnings: ['لا توجد حواف للإزاحة'] };
  }

  const ordered = [...input].sort((a, b) => {
    // Preserve source order; sort is intentionally stable and does not mutate input.
    return input.indexOf(a) - input.indexOf(b);
  });
  const points: CadPoint[] = [];
  for (const segment of ordered) {
    const flattened = flattenSegment(segment, tolerance);
    if (points.length && distance(points[points.length - 1], flattened[0]) > closeTolerance) {
      return {
        segments: [], closed: false, valid: false,
        warnings: ['حدود القطعة غير متصلة؛ يجب وصل الحواف قبل إنشاء سماحة الخياطة']
      };
    }
    points.push(...(points.length ? flattened.slice(1) : flattened));
  }

  const closed = points.length > 2 && distance(points[0], points[points.length - 1]) <= closeTolerance;
  if (closed) points.pop();
  if (points.length < (closed ? 3 : 2)) {
    return { segments: [], closed, valid: false, warnings: ['عدد النقاط غير كافٍ لإنشاء الإزاحة'] };
  }

  let orientation = 0;
  if (closed) {
    const area2 = points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.y - q.x * p.y;
    }, 0);
    if (Math.abs(area2) < 1e-8) {
      return { segments: [], closed, valid: false, warnings: ['مساحة حدود القطعة قريبة من الصفر'] };
    }
    orientation = area2 > 0 ? 1 : -1;
  }

  const edgeNormals: CadPoint[] = [];
  const edgeCount = closed ? points.length : points.length - 1;
  for (let i = 0; i < edgeCount; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const length = distance(a, b);
    if (length < 1e-8) {
      edgeNormals.push({ x: 0, y: 0 });
      continue;
    }
    const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
    edgeNormals.push(closed
      ? { x: orientation * dy, y: -orientation * dx }
      : { x: -dy, y: dx });
  }

  const output: CadPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < points.length - 1;
    if (!hasPrev) {
      const n = edgeNormals[0];
      output.push({ x: point.x + n.x * offsetCm, y: point.y + n.y * offsetCm });
      continue;
    }
    if (!hasNext) {
      const n = edgeNormals[edgeNormals.length - 1];
      output.push({ x: point.x + n.x * offsetCm, y: point.y + n.y * offsetCm });
      continue;
    }

    const prevIndex = (i - 1 + edgeNormals.length) % edgeNormals.length;
    const nextIndex = i % edgeNormals.length;
    const n1 = edgeNormals[prevIndex], n2 = edgeNormals[nextIndex];
    const sum = { x: n1.x + n2.x, y: n1.y + n2.y };
    const sumLength = Math.hypot(sum.x, sum.y);
    if (sumLength < 1e-8) {
      output.push(
        { x: point.x + n1.x * offsetCm, y: point.y + n1.y * offsetCm },
        { x: point.x + n2.x * offsetCm, y: point.y + n2.y * offsetCm }
      );
      continue;
    }
    const miter = { x: sum.x / sumLength, y: sum.y / sumLength };
    const denominator = miter.x * n2.x + miter.y * n2.y;
    const miterLength = Math.abs(denominator) > 1e-8 ? offsetCm / denominator : Infinity;
    if (!Number.isFinite(miterLength) || Math.abs(miterLength) > offsetCm * miterLimit) {
      output.push(
        { x: point.x + n1.x * offsetCm, y: point.y + n1.y * offsetCm },
        { x: point.x + n2.x * offsetCm, y: point.y + n2.y * offsetCm }
      );
      warnings.push('استُخدم وصل مشطوف عند زاوية حادة لتجنب امتداد غير مستقر');
    } else {
      output.push({ x: point.x + miter.x * miterLength, y: point.y + miter.y * miterLength });
    }
  }

  if (closed && output.length > 2) output.push({ ...output[0] });
  const segmentCount = closed ? output.length - 1 : output.length - 1;
  const result: CadSegment[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const p1 = output[i], p2 = output[i + 1];
    if (distance(p1, p2) < 1e-7) continue;
    result.push({
      id: `offset_${i}_${ordered[0].id}`,
      type: 'line',
      p1: { ...p1 },
      p2: { ...p2 },
      layer: 'seam',
      edgeType: ordered[Math.min(i, ordered.length - 1)].edgeType,
      lengthCm: distance(p1, p2),
      label: `إزاحة هندسية ${offsetCm} سم`
    });
  }

  // Detect self-crossings in the resulting contour. A self-intersecting
  // offset is unsafe to present as a valid cutting boundary.
  const count = result.length;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      if (j === i + 1 || (closed && i === 0 && j === count - 1)) continue;
      if (segmentsIntersect(result[i].p1, result[i].p2, result[j].p1, result[j].p2)) {
        return {
          segments: [], closed, valid: false,
          warnings: ['الإزاحة أدت إلى تقاطع ذاتي؛ قلّل سماحة الخياطة أو راجع شكل القطعة']
        };
      }
    }
  }

  if (result.length < (closed ? 3 : 1)) {
    return { segments: [], closed, valid: false, warnings: ['تعذر تكوين محيط إزاحة صالح'] };
  }
  return { segments: result, closed, valid: true, warnings };
}
