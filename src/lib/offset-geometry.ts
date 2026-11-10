import type { CadPoint, CadSegment } from './pattern-cad-engine';

export interface OffsetContourOptions {
  toleranceCm?: number;
  miterLimit?: number;
  closeToleranceCm?: number;
  edgeAllowances?: Record<string, number>;
}

export interface OffsetContourResult {
  segments: CadSegment[];
  closed: boolean;
  valid: boolean;
  warnings: string[];
}

const distance = (a: CadPoint, b: CadPoint): number => Math.hypot(b.x - a.x, b.y - a.y);
const midpoint = (a: CadPoint, b: CadPoint): CadPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

function splitBezier(points: CadPoint[]): [CadPoint[], CadPoint[]] {
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

function curveFlatness(points: CadPoint[]): number {
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
  if (points.length <= 2 || depth >= 16 || curveFlatness(points) <= tolerance) {
    return [{ ...points[0] }, { ...points[points.length - 1] }];
  }
  const [left, right] = splitBezier(points);
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
 * Creates a constant-distance contour from an ordered CAD boundary.
 * Curves are adaptively flattened; adjacent offset lines are intersected to
 * create exact miter joins. Acute corners are bevelled at the miter limit.
 * Optional edge allowances let neckline, hem, side, etc. use distinct values.
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
  if (!input.length) {
    return { segments: [], closed: false, valid: false, warnings: ['لا توجد حواف للإزاحة'] };
  }

  const points: CadPoint[] = [];
  const edgeOffsets: number[] = [];
  const edgeTypes: Array<CadSegment['edgeType']> = [];

  for (const segment of input) {
    const allowance = options.edgeAllowances?.[segment.edgeType ?? 'general'] ?? offsetCm;
    if (!Number.isFinite(allowance) || allowance < 0) {
      return { segments: [], closed: false, valid: false, warnings: ['إحدى سماحات الحواف غير صالحة'] };
    }
    const flattened = flattenSegment(segment, tolerance);
    if (points.length && distance(points[points.length - 1], flattened[0]) > closeTolerance) {
      return {
        segments: [], closed: false, valid: false,
        warnings: ['حدود القطعة غير متصلة؛ يجب وصل الحواف قبل إنشاء سماحة الخياطة']
      };
    }
    if (!points.length) points.push(flattened[0]);
    for (let i = 1; i < flattened.length; i++) {
      edgeOffsets.push(allowance);
      edgeTypes.push(segment.edgeType);
      points.push(flattened[i]);
    }
  }

  const closed = points.length > 2 && distance(points[0], points[points.length - 1]) <= closeTolerance;
  if (closed) points.pop();
  if (points.length < (closed ? 3 : 2)) {
    return { segments: [], closed, valid: false, warnings: ['عدد النقاط غير كافٍ لإنشاء الإزاحة'] };
  }
  const expectedEdges = closed ? points.length : points.length - 1;
  if (edgeOffsets.length !== expectedEdges) {
    return { segments: [], closed, valid: false, warnings: ['تعذر مطابقة سماحات الحواف مع حدود القطعة'] };
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
  const edgeVectors: CadPoint[] = [];
  for (let i = 0; i < expectedEdges; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const length = distance(a, b);
    if (length < 1e-8) {
      return { segments: [], closed, valid: false, warnings: ['توجد حافة بطول صفري في حدود القطعة'] };
    }
    const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
    edgeVectors.push({ x: b.x - a.x, y: b.y - a.y });
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
      const n = edgeNormals[0], d = edgeOffsets[0];
      output.push({ x: point.x + n.x * d, y: point.y + n.y * d });
      continue;
    }
    if (!hasNext) {
      const n = edgeNormals[edgeNormals.length - 1], d = edgeOffsets[edgeOffsets.length - 1];
      output.push({ x: point.x + n.x * d, y: point.y + n.y * d });
      continue;
    }

    const prevIndex = (i - 1 + expectedEdges) % expectedEdges;
    const nextIndex = i % expectedEdges;
    const n1 = edgeNormals[prevIndex], n2 = edgeNormals[nextIndex];
    const d1 = edgeOffsets[prevIndex], d2 = edgeOffsets[nextIndex];
    const previousOffset = { x: point.x + n1.x * d1, y: point.y + n1.y * d1 };
    const nextOffset = { x: point.x + n2.x * d2, y: point.y + n2.y * d2 };
    const intersection = lineIntersection(previousOffset, edgeVectors[prevIndex], nextOffset, edgeVectors[nextIndex]);
    const maxMiter = Math.max(d1, d2, 0.001) * miterLimit;

    if (intersection && distance(point, intersection) <= maxMiter) {
      output.push(intersection);
    } else {
      if (distance(previousOffset, nextOffset) > 1e-7) {
        output.push(previousOffset, nextOffset);
      } else {
        output.push(previousOffset);
      }
      if (intersection) warnings.push('استُخدم وصل مشطوف عند زاوية حادة لتجنب امتداد غير مستقر');
    }
  }

  if (closed && output.length > 2) output.push({ ...output[0] });
  const result: CadSegment[] = [];
  for (let i = 0; i < output.length - 1; i++) {
    const p1 = output[i], p2 = output[i + 1];
    if (distance(p1, p2) < 1e-7) continue;
    result.push({
      id: `offset_${i}_${input[0].id}`,
      type: 'line',
      p1: { ...p1 },
      p2: { ...p2 },
      layer: 'seam',
      edgeType: edgeTypes[Math.min(i, edgeTypes.length - 1)] ?? input[0].edgeType,
      lengthCm: distance(p1, p2),
      label: `إزاحة هندسية ${offsetCm} سم`
    });
  }

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
  if (!closed) warnings.push('المسار مفتوح؛ الناتج خط إزاحة أحادي الجانب وليس محيط قص مغلقاً');
  return { segments: result, closed, valid: true, warnings };
}
