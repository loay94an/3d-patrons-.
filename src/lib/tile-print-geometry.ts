import type { CadPiece, CadSegment, CadPoint } from './pattern-cad-engine';

const JOIN_TOLERANCE_CM = 0.15;

function reverseSegment(segment: CadSegment): CadSegment {
  return {
    ...segment,
    p1: segment.p2,
    p2: segment.p1,
    cp1: segment.type === 'bezier' ? segment.cp2 : segment.cp1,
    cp2: segment.type === 'bezier' ? segment.cp1 : segment.cp2
  };
}

function closeEnough(a: CadPoint, b: CadPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= JOIN_TOLERANCE_CM;
}

/** Returns an ordered, closed cutting contour; disconnected/open CAD paths are rejected. */
export function getCadPieceContourPoints(piece: CadPiece, curveSteps = 16): CadPoint[] | null {
  const segments = piece.segments.filter(segment => segment.layer === 'cutting');
  if (segments.length < 3 || !Number.isInteger(curveSteps) || curveSteps < 2 || curveSteps > 128) return null;
  const first = segments[0];
  const ordered: CadSegment[] = [first];
  const remaining = segments.slice(1);
  let current = first.p2;

  while (remaining.length) {
    const index = remaining.findIndex(segment => closeEnough(current, segment.p1) || closeEnough(current, segment.p2));
    if (index < 0) return null;
    const candidate = remaining.splice(index, 1)[0];
    const next = closeEnough(current, candidate.p2) ? reverseSegment(candidate) : candidate;
    ordered.push(next);
    current = next.p2;
  }
  if (!closeEnough(current, first.p1)) return null;

  const points: CadPoint[] = [{ ...first.p1 }];
  for (const segment of ordered) {
    if (segment.type === 'quad' && segment.cp1) {
      for (let step = 1; step <= curveSteps; step++) {
        const t = step / curveSteps;
        const u = 1 - t;
        points.push({
          x: u * u * segment.p1.x + 2 * u * t * segment.cp1.x + t * t * segment.p2.x,
          y: u * u * segment.p1.y + 2 * u * t * segment.cp1.y + t * t * segment.p2.y
        });
      }
    } else if (segment.type === 'bezier' && segment.cp1 && segment.cp2) {
      for (let step = 1; step <= curveSteps; step++) {
        const t = step / curveSteps;
        const u = 1 - t;
        points.push({
          x: u ** 3 * segment.p1.x + 3 * u * u * t * segment.cp1.x + 3 * u * t * t * segment.cp2.x + t ** 3 * segment.p2.x,
          y: u ** 3 * segment.p1.y + 3 * u * u * t * segment.cp1.y + 3 * u * t * t * segment.cp2.y + t ** 3 * segment.p2.y
        });
      }
    } else {
      points.push({ ...segment.p2 });
    }
  }
  if (closeEnough(points[points.length - 1], points[0])) points[points.length - 1] = { ...points[0] };
  else points.push({ ...points[0] });
  return points;
}
