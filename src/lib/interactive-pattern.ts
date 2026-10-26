// Interactive CAD Pattern Points & Vector Curve Engine
// Designed for precise tailoring, Marlene Mukai drafting rules, and manual CAD manipulation.

export interface PatternNode {
  id: string;
  piece: 'back' | 'front' | 'sleeve' | 'lower' | 'collar' | 'custom';
  name: string;
  nameAr: string;
  x: number; // current absolute x in piece coords
  y: number; // current absolute y in piece coords
  baseX: number; // original reference x
  baseY: number; // original reference y
  type: 'node' | 'control' | 'notch' | 'dart' | 'custom';
  description?: string;
  connectedTo?: string[];
  isCustom?: boolean;
}

export interface CustomPoint {
  id: string;
  piece: 'back' | 'front' | 'sleeve' | 'lower' | 'collar';
  nameAr: string;
  x: number;
  y: number;
  type: 'point' | 'notch' | 'anchor' | 'measurement';
  createdAt: number;
  connectedToId?: string;
}

export interface FreehandStroke {
  id: string;
  pieceKey: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
  createdAt: number;
}

export interface VectorLine {
  id: string;
  fromId: string;
  toId: string;
  color?: string;
}

export type InteractivityTool = 
  | 'select_drag'
  | 'pan'
  | 'add_point'
  | 'add_line'
  | 'add_curve'
  | 'measure'
  | 'snap_toggle'
  | 'mirror'
  | 'offset_seam'
  | 'divide'
  | 'parallel_line'
  | 'rotate'
  | 'duplicate'
  | 'notch'
  | 'grainline'
  | 'dart'
  | 'pleat'
  | 'fold_line'
  | 'blend_smooth'
  | 'trueing_match'
  | 'grading'
  | 'validate_audit'
  | 'layers_toggle'
  | 'symbols'
  | 'fabric_layout'
  | 'preview_3d'
  | 'templates';

export interface NotchElement {
  id: string;
  piece: 'back' | 'front' | 'sleeve' | 'lower' | 'collar';
  x: number;
  y: number;
  type: 'v_notch' | 't_mark' | 'slit';
  depthCm: number;
  angleDeg: number;
  label?: string;
}

export interface GrainlineElement {
  id: string;
  piece: 'back' | 'front' | 'sleeve' | 'lower' | 'collar';
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  isBias: boolean;
  labelAr: string;
}

export interface DartElement {
  id: string;
  piece: 'back' | 'front' | 'sleeve' | 'lower' | 'collar';
  apex: { x: number; y: number };
  leg1: { x: number; y: number };
  leg2: { x: number; y: number };
  widthCm: number;
  type: 'single' | 'double' | 'curved';
  labelAr: string;
}

export interface PleatElement {
  id: string;
  piece: 'back' | 'front' | 'sleeve' | 'lower' | 'collar';
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  type: 'knife' | 'box' | 'inverted';
  depthCm: number;
  count: number;
}

export interface FoldLineElement {
  id: string;
  piece: 'back' | 'front' | 'sleeve' | 'lower' | 'collar';
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  labelAr: string;
}

export interface SymbolElement {
  id: string;
  piece: 'back' | 'front' | 'sleeve' | 'lower' | 'collar';
  x: number;
  y: number;
  type: 'button' | 'buttonhole' | 'pocket' | 'center_front' | 'center_back' | 'cross';
  labelAr?: string;
}

export interface PatternLayerConfig {
  baseOutline: boolean;
  seamAllowance: boolean;
  grainlineNotches: boolean;
  dartsPleats: boolean;
  annotationsSymbols: boolean;
  gradingSizes: boolean;
}

export interface PatternValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  titleAr: string;
  descriptionAr: string;
  locationPx?: { x: number; y: number };
}

export interface BezierCurveElement {
  id: string;
  piece: 'back' | 'front' | 'sleeve' | 'lower' | 'collar';
  p0: { x: number; y: number; id?: string };
  cp1: { x: number; y: number; id?: string };
  cp2: { x: number; y: number; id?: string };
  p1: { x: number; y: number; id?: string };
  color?: string;
  label?: string;
}

export interface SeamAllowanceElement {
  id: string;
  sourceId: string;
  allowanceCm: number;
  offsetPx: number;
  pathD: string;
  color?: string;
}

export interface DragState {
  nodeId: string;
  piece: string;
  startX: number;
  startY: number;
  originalNodeX: number;
  originalNodeY: number;
}

export interface MeasureProbe {
  active: boolean;
  points: Array<{ x: number; y: number; label?: string }>;
  distanceCm?: number;
  angleDeg?: number;
}

// Distance and angle helpers
export function calcDistanceCm(x1: number, y1: number, x2: number, y2: number, pxPerCm: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy) / pxPerCm;
}

export function calcAngleDeg(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Snap to nearest existing point helper
export function snapToNearestPoint(
  target: { x: number; y: number },
  allPoints: Array<{ id: string; x: number; y: number }>,
  thresholdPx: number = 15
): { x: number; y: number; snappedPointId?: string } {
  let nearest: { id: string; x: number; y: number } | null = null;
  let minDist = thresholdPx;

  for (const p of allPoints) {
    const dist = Math.hypot(p.x - target.x, p.y - target.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  }

  if (nearest) {
    const n = nearest as { id: string; x: number; y: number };
    return { x: n.x, y: n.y, snappedPointId: n.id };
  }
  return { x: target.x, y: target.y };
}

// Divide a straight line segment into N equal divisions
export function divideLineSegment(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  divisions: number
): Array<{ x: number; y: number; fraction: number }> {
  if (divisions <= 1) return [];
  const points: Array<{ x: number; y: number; fraction: number }> = [];
  for (let i = 1; i < divisions; i++) {
    const t = i / divisions;
    points.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
      fraction: t
    });
  }
  return points;
}

// Mirror a set of points across a vertical or horizontal axis
export function mirrorPoints(
  points: Array<{ x: number; y: number; [key: string]: any }>,
  axisType: 'vertical' | 'horizontal',
  axisValue: number
): Array<{ x: number; y: number; [key: string]: any }> {
  return points.map(pt => ({
    ...pt,
    x: axisType === 'vertical' ? axisValue + (axisValue - pt.x) : pt.x,
    y: axisType === 'horizontal' ? axisValue + (axisValue - pt.y) : pt.y
  }));
}

// Generate parallel line segment given an offset distance
export function createParallelLine(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  offsetPx: number
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { start: { ...p1 }, end: { ...p2 } };

  // Normal vector (perpendicular)
  const nx = -dy / len;
  const ny = dx / len;

  return {
    start: { x: p1.x + nx * offsetPx, y: p1.y + ny * offsetPx },
    end: { x: p2.x + nx * offsetPx, y: p2.y + ny * offsetPx }
  };
}

// Rotate point around pivot
export function rotatePoint(
  p: { x: number; y: number },
  pivot: { x: number; y: number },
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;

  return {
    x: pivot.x + (dx * cos - dy * sin),
    y: pivot.y + (dx * sin + dy * cos)
  };
}

// Bezier curve string generators
export function getSmoothCubicCurve(
  p0: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  p1: { x: number; y: number }
): string {
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

export function getSmoothQuadCurve(
  p0: { x: number; y: number },
  cp: { x: number; y: number },
  p1: { x: number; y: number }
): string {
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} Q ${cp.x.toFixed(2)} ${cp.y.toFixed(2)} ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}
