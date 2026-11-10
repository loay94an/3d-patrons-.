export interface GeometryPoint {
  x: number;
  y: number;
}

const lerpPoint = (a: GeometryPoint, b: GeometryPoint, t: number): GeometryPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
});

const evaluateBezier = (points: GeometryPoint[], t: number): GeometryPoint => {
  let row = points.map(point => ({ ...point }));
  while (row.length > 1) {
    row = row.slice(0, -1).map((point, index) => lerpPoint(point, row[index + 1], t));
  }
  return row[0];
};

const splitBezier = (points: GeometryPoint[]): [GeometryPoint[], GeometryPoint[]] => {
  const levels: GeometryPoint[][] = [points.map(point => ({ ...point }))];
  while (levels[levels.length - 1].length > 1) {
    const row = levels[levels.length - 1];
    levels.push(row.slice(0, -1).map((point, index) => lerpPoint(point, row[index + 1], 0.5)));
  }
  const left = levels.map(level => level[0]);
  const right = levels.map(level => level[level.length - 1]).reverse();
  return [left, right];
};

const pointDistance = (a: GeometryPoint, b: GeometryPoint): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

const controlPolygonLength = (points: GeometryPoint[]): number =>
  points.slice(1).reduce((sum, point, index) => sum + pointDistance(points[index], point), 0);

/**
 * Adaptive De Casteljau arc-length estimation. The error bound is driven by
 * the gap between the control polygon and its chord, not a fixed sample count.
 * Coordinates are in pattern units (normally centimetres).
 */
const adaptiveBezierLength = (
  points: GeometryPoint[],
  tolerance = 0.0001,
  depth = 0
): number => {
  const chord = pointDistance(points[0], points[points.length - 1]);
  const polygon = controlPolygonLength(points);
  if (depth >= 18 || polygon - chord <= tolerance) {
    return (polygon + chord) / 2;
  }
  const [left, right] = splitBezier(points);
  return adaptiveBezierLength(left, tolerance / 2, depth + 1)
    + adaptiveBezierLength(right, tolerance / 2, depth + 1);
};

export const quadraticBezierLength = (
  p0: GeometryPoint,
  p1: GeometryPoint,
  p2: GeometryPoint,
  tolerance = 0.0001
): number => adaptiveBezierLength([p0, p1, p2], tolerance);

export const cubicBezierLength = (
  p0: GeometryPoint,
  p1: GeometryPoint,
  p2: GeometryPoint,
  p3: GeometryPoint,
  tolerance = 0.0001
): number => adaptiveBezierLength([p0, p1, p2, p3], tolerance);

const derivativeControlPoints = (points: GeometryPoint[]): GeometryPoint[] => {
  const degree = points.length - 1;
  return points.slice(0, -1).map((point, index) => ({
    x: degree * (points[index + 1].x - point.x),
    y: degree * (points[index + 1].y - point.y)
  }));
};

const secondDerivativeControlPoints = (points: GeometryPoint[]): GeometryPoint[] => {
  const first = derivativeControlPoints(points);
  return first.length > 1 ? derivativeControlPoints(first) : [{ x: 0, y: 0 }];
};

/**
 * Finds the nearest parameter on a quadratic/cubic Bezier curve.
 * A coarse global scan chooses a safe starting basin; bounded Newton
 * iterations then refine the minimum using first and second derivatives.
 */
const closestBezierParameter = (query: GeometryPoint, points: GeometryPoint[]): number => {
  const firstDerivative = derivativeControlPoints(points);
  const secondDerivative = secondDerivativeControlPoints(points);
  const distanceSquared = (t: number): number => {
    const p = evaluateBezier(points, t);
    return (p.x - query.x) ** 2 + (p.y - query.y) ** 2;
  };

  let bestT = 0;
  let bestDistance = distanceSquared(0);
  const samples = 64;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const candidateDistance = distanceSquared(t);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestT = t;
    }
  }

  let t = bestT;
  for (let i = 0; i < 16; i++) {
    const p = evaluateBezier(points, t);
    const d1 = evaluateBezier(firstDerivative, t);
    const d2 = evaluateBezier(secondDerivative, t);
    const rx = p.x - query.x;
    const ry = p.y - query.y;
    const numerator = rx * d1.x + ry * d1.y;
    const denominator = d1.x * d1.x + d1.y * d1.y + rx * d2.x + ry * d2.y;
    if (Math.abs(denominator) < 1e-12) break;
    const next = Math.max(0, Math.min(1, t - numerator / denominator));
    if (Math.abs(next - t) < 1e-9) {
      t = next;
      break;
    }
    if (distanceSquared(next) > distanceSquared(t) && i > 0) break;
    t = next;
  }

  const startDistance = distanceSquared(0);
  const endDistance = distanceSquared(1);
  if (startDistance < distanceSquared(t)) return 0;
  if (endDistance < distanceSquared(t)) return 1;
  return t;
};

export const closestQuadraticParameter = (
  query: GeometryPoint,
  p0: GeometryPoint,
  p1: GeometryPoint,
  p2: GeometryPoint
): number => closestBezierParameter(query, [p0, p1, p2]);

export const closestCubicParameter = (
  query: GeometryPoint,
  p0: GeometryPoint,
  p1: GeometryPoint,
  p2: GeometryPoint,
  p3: GeometryPoint
): number => closestBezierParameter(query, [p0, p1, p2, p3]);
