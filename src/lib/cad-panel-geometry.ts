import * as THREE from 'three';
import { measureCadSegmentLengthCm } from './cad-sewing-engine';
import type { CadPiece, CadPoint, CadSegment } from './pattern-cad-engine';

export interface CadPanelBoundaryEdge {
  pieceId: string;
  segmentId: string;
  edgeType?: CadSegment['edgeType'];
  reversedFromSource: boolean;
  lengthCm: number;
  /** Ordered vertex indices along this edge, including both endpoints. */
  vertexIndices: number[];
}

export interface CadPanelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CadPanelGeometry {
  pieceId: string;
  name: string;
  garmentType: CadPiece['garmentType'];
  unit: 'cm';
  vertices: CadPoint[];
  /** Flat triangle-index list into vertices. */
  triangleIndices: number[];
  boundaryEdges: CadPanelBoundaryEdge[];
  bounds: CadPanelBounds;
  areaCm2: number;
  seamAllowanceCm: number;
  triangulation: 'three-earcut';
}

export interface CadPanelGeometryOptions {
  endpointToleranceCm?: number;
  curveSampleSpacingCm?: number;
  minCurveSamples?: number;
  maxCurveSamples?: number;
}

interface OrderedSegment {
  segment: CadSegment;
  reversed: boolean;
}

const DEFAULT_OPTIONS: Required<CadPanelGeometryOptions> = {
  endpointToleranceCm: 0.15,
  curveSampleSpacingCm: 0.75,
  minCurveSamples: 8,
  maxCurveSamples: 64
};

function distance(a: CadPoint, b: CadPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function reverseSegment(segment: CadSegment): CadSegment {
  return {
    ...segment,
    p1: segment.p2,
    p2: segment.p1,
    ...(segment.type === 'bezier'
      ? { cp1: segment.cp2, cp2: segment.cp1 }
      : { cp1: segment.cp1, cp2: segment.cp2 })
  };
}

function evaluateSegment(segment: CadSegment, t: number): CadPoint {
  const u = 1 - t;
  if (segment.type === 'quad') {
    if (!segment.cp1) throw new Error('قطعة CAD تربيعية بلا نقطة تحكم.');
    return {
      x: u * u * segment.p1.x + 2 * u * t * segment.cp1.x + t * t * segment.p2.x,
      y: u * u * segment.p1.y + 2 * u * t * segment.cp1.y + t * t * segment.p2.y
    };
  }
  if (segment.type === 'bezier') {
    if (!segment.cp1 || !segment.cp2) throw new Error('قطعة CAD تكعيبية بلا نقاط تحكم كاملة.');
    return {
      x: u ** 3 * segment.p1.x + 3 * u * u * t * segment.cp1.x +
        3 * u * t * t * segment.cp2.x + t ** 3 * segment.p2.x,
      y: u ** 3 * segment.p1.y + 3 * u * u * t * segment.cp1.y +
        3 * u * t * t * segment.cp2.y + t ** 3 * segment.p2.y
    };
  }
  return {
    x: segment.p1.x + (segment.p2.x - segment.p1.x) * t,
    y: segment.p1.y + (segment.p2.y - segment.p1.y) * t
  };
}

function orderCuttingSegments(piece: CadPiece, toleranceCm: number): OrderedSegment[] {
  const segments = piece.segments.filter(segment => segment.layer === 'cutting');
  if (segments.length < 3) throw new Error('قطعة الباترون تحتاج إلى ثلاث حواف قص أو أكثر.');

  const ids = segments.map(segment => segment.id);
  if (new Set(ids).size !== ids.length) throw new Error('معرّفات حواف القص مكررة داخل القطعة.');

  const first = segments[0];
  const ordered: OrderedSegment[] = [{ segment: first, reversed: false }];
  const remaining = segments.slice(1);
  let current = first.p2;
  const start = first.p1;

  while (remaining.length) {
    if (distance(current, start) <= toleranceCm) {
      throw new Error('تحتوي قطعة الباترون على أكثر من مسار قص أو على حواف منفصلة.');
    }

    const candidates = remaining.map((segment, index) => ({
      segment,
      index,
      forward: distance(current, segment.p1) <= toleranceCm,
      backward: distance(current, segment.p2) <= toleranceCm
    })).filter(candidate => candidate.forward || candidate.backward);

    if (candidates.length !== 1) {
      throw new Error(candidates.length === 0
        ? 'مسار قص قطعة الباترون مفتوح أو غير متصل.'
        : 'توجد وصلة متفرعة أو ملتبسة بين حواف القص.');
    }

    const candidate = candidates[0];
    const source = remaining.splice(candidate.index, 1)[0];
    const reversed = !candidate.forward && candidate.backward;
    const segment = reversed ? reverseSegment(source) : source;
    ordered.push({ segment, reversed });
    current = segment.p2;
  }

  if (distance(current, start) > toleranceCm) {
    throw new Error('مسار قص قطعة الباترون غير مغلق.');
  }
  return ordered;
}

function sampleCount(segment: CadSegment, options: Required<CadPanelGeometryOptions>) {
  if (segment.type === 'line') return 1;
  const estimatedLength = measureCadSegmentLengthCm(segment);
  return Math.max(
    options.minCurveSamples,
    Math.min(options.maxCurveSamples, Math.ceil(estimatedLength / options.curveSampleSpacingCm))
  );
}

function cross(a: CadPoint, b: CadPoint, c: CadPoint) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: CadPoint, b: CadPoint, p: CadPoint, epsilon = 1e-8) {
  return Math.abs(cross(a, b, p)) <= epsilon &&
    p.x >= Math.min(a.x, b.x) - epsilon && p.x <= Math.max(a.x, b.x) + epsilon &&
    p.y >= Math.min(a.y, b.y) - epsilon && p.y <= Math.max(a.y, b.y) + epsilon;
}

function segmentsIntersect(a: CadPoint, b: CadPoint, c: CadPoint, d: CadPoint) {
  const o1 = cross(a, b, c);
  const o2 = cross(a, b, d);
  const o3 = cross(c, d, a);
  const o4 = cross(c, d, b);
  if (((o1 > 1e-8 && o2 < -1e-8) || (o1 < -1e-8 && o2 > 1e-8)) &&
      ((o3 > 1e-8 && o4 < -1e-8) || (o3 < -1e-8 && o4 > 1e-8))) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) ||
    onSegment(c, d, a) || onSegment(c, d, b);
}

function assertSimpleContour(vertices: CadPoint[]) {
  const count = vertices.length;
  for (let i = 0; i < count; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % count];
    if (distance(a, b) <= 1e-8) throw new Error('تحتوي حدود القطعة على حافة قصيرة جداً أو مكررة.');
    for (let j = i + 1; j < count; j++) {
      if (j === i || j === i + 1 || (i === 0 && j === count - 1)) continue;
      const c = vertices[j];
      const d = vertices[(j + 1) % count];
      if (segmentsIntersect(a, b, c, d)) {
        throw new Error('حدود قطعة الباترون تتقاطع مع نفسها ولا يمكن تثليثها بأمان.');
      }
    }
  }
}

function polygonArea(vertices: CadPoint[]) {
  let twiceArea = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2;
}

/**
 * Converts one closed CAD cutting contour into an indexed triangulated panel.
 * Boundary vertex indices remain attached to their original CAD segment IDs
 * so sewing constraints can be built against the same sampled edge later.
 *
 * One simple outer contour is supported. Separate holes/inner cutouts are
 * deliberately rejected until the CAD document models them explicitly.
 */
export function buildCadPanelGeometry(
  piece: CadPiece,
  overrides: CadPanelGeometryOptions = {}
): CadPanelGeometry {
  const options = { ...DEFAULT_OPTIONS, ...overrides };
  if (!Number.isFinite(options.endpointToleranceCm) || options.endpointToleranceCm <= 0 ||
      !Number.isFinite(options.curveSampleSpacingCm) || options.curveSampleSpacingCm <= 0 ||
      !Number.isInteger(options.minCurveSamples) || options.minCurveSamples < 2 ||
      !Number.isInteger(options.maxCurveSamples) ||
      options.maxCurveSamples < options.minCurveSamples || options.maxCurveSamples > 256) {
    throw new Error('إعدادات تحويل قطعة CAD إلى شبكة ثلاثية الأبعاد غير صالحة.');
  }

  const ordered = orderCuttingSegments(piece, options.endpointToleranceCm);
  const vertices: CadPoint[] = [{ x: ordered[0].segment.p1.x, y: ordered[0].segment.p1.y }];
  const boundaryEdges: CadPanelBoundaryEdge[] = [];
  let currentIndex = 0;

  ordered.forEach((item, edgeIndex) => {
    const steps = sampleCount(item.segment, options);
    const vertexIndices = [currentIndex];
    for (let step = 1; step <= steps; step++) {
      if (edgeIndex === ordered.length - 1 && step === steps) {
        vertexIndices.push(0);
        continue;
      }
      const point = evaluateSegment(item.segment, step / steps);
      vertices.push({ x: point.x, y: point.y });
      currentIndex = vertices.length - 1;
      vertexIndices.push(currentIndex);
    }
    boundaryEdges.push({
      pieceId: piece.id,
      segmentId: item.segment.id,
      edgeType: item.segment.edgeType,
      reversedFromSource: item.reversed,
      lengthCm: measureCadSegmentLengthCm(item.segment),
      vertexIndices
    });
  });

  if (vertices.length < 3) throw new Error('نتج عدد غير كافٍ من نقاط قطعة CAD.');
  assertSimpleContour(vertices);
  const areaCm2 = polygonArea(vertices);
  if (!Number.isFinite(areaCm2) || areaCm2 <= 1e-6) {
    throw new Error('مساحة قطعة الباترون صفرية أو صغيرة جداً.');
  }

  const contour = vertices.map(point => new THREE.Vector2(point.x, point.y));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const triangleIndices = faces.flat();
  if (!triangleIndices.length || triangleIndices.length % 3 !== 0 ||
      triangleIndices.some(index => !Number.isInteger(index) || index < 0 || index >= vertices.length)) {
    throw new Error('فشل تثليث قطعة الباترون إلى شبكة صالحة.');
  }

  const bounds = vertices.reduce<CadPanelBounds>((result, point) => ({
    minX: Math.min(result.minX, point.x),
    minY: Math.min(result.minY, point.y),
    maxX: Math.max(result.maxX, point.x),
    maxY: Math.max(result.maxY, point.y)
  }), {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY
  });

  return {
    pieceId: piece.id,
    name: piece.nameAr || piece.name,
    garmentType: piece.garmentType,
    unit: 'cm',
    vertices,
    triangleIndices,
    boundaryEdges,
    bounds,
    areaCm2,
    seamAllowanceCm: piece.seamAllowanceCm,
    triangulation: 'three-earcut'
  };
}
