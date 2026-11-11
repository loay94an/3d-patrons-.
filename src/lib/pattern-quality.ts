import type { CadPiece, CadSegment } from './pattern-cad-engine';

export type QualitySeverity = 'error' | 'warning';
export interface PatternQualityIssue {
  severity: QualitySeverity;
  code: string;
  pieceId: string;
  pieceName: string;
  message: string;
}
export interface PatternQualityReport {
  valid: boolean;
  exportSafe: boolean;
  checkedPieces: number;
  checkedCuttingEdges: number;
  errors: number;
  warnings: number;
  issues: PatternQualityIssue[];
}
const DEFAULT_TOLERANCE_CM = 0.05;
const finitePoint = (point: { x: number; y: number }) => Number.isFinite(point.x) && Number.isFinite(point.y);
const pointDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const segmentPoints = (segment: CadSegment) => [segment.p1, ...(segment.cp1 ? [segment.cp1] : []), ...(segment.cp2 ? [segment.cp2] : []), segment.p2];

/**
 * Performs structural CAD checks only. It does not certify fit, drafting method,
 * seam matching between separate pieces, grading, fabric behaviour, or production readiness.
 */
export function validatePatternPieces(pieces: CadPiece[], toleranceCm = DEFAULT_TOLERANCE_CM): PatternQualityReport {
  const issues: PatternQualityIssue[] = [];
  let checkedCuttingEdges = 0;
  const add = (piece: CadPiece, severity: QualitySeverity, code: string, message: string) =>
    issues.push({ severity, code, pieceId: piece.id, pieceName: piece.nameAr || piece.name, message });

  pieces.forEach(piece => {
    const cutting = piece.segments.filter(segment => segment.layer === 'cutting');
    checkedCuttingEdges += cutting.length;
    if (!piece.id || !piece.name) add(piece, 'error', 'piece-metadata', 'بيانات تعريف القطعة ناقصة.');
    if (cutting.length < 3) add(piece, 'error', 'contour-too-short', 'تحتاج القطعة إلى ثلاثة أضلاع قص على الأقل.');

    const ids = new Set<string>();
    cutting.forEach((segment, index) => {
      if (ids.has(segment.id)) add(piece, 'error', 'duplicate-segment-id', 'يوجد معرّف ضلع قص مكرر.');
      ids.add(segment.id);
      const points = segmentPoints(segment);
      if (points.some(point => !finitePoint(point))) {
        add(piece, 'error', 'non-finite-coordinate', 'يوجد إحداثي غير صالح في أحد أضلاع القص.');
      }
      if (!Number.isFinite(segment.lengthCm) || segment.lengthCm <= 1e-6) {
        add(piece, 'error', 'invalid-edge-length', 'طول أحد أضلاع القص صفري أو غير صالح.');
      }
      if (segment.type === 'quad' && !segment.cp1) add(piece, 'error', 'missing-control-point', 'منحنى تربيعي يفتقد نقطة التحكم.');
      if (segment.type === 'bezier' && (!segment.cp1 || !segment.cp2)) add(piece, 'error', 'missing-control-point', 'منحنى بيزيه يفتقد نقاط التحكم.');
      const next = cutting[(index + 1) % cutting.length];
      if (next && finitePoint(segment.p2) && finitePoint(next.p1) && pointDistance(segment.p2, next.p1) > toleranceCm) {
        add(piece, 'error', 'open-contour-joint', 'يوجد انقطاع بين ضلعين متتاليين في محيط القص.');
      }
    });

    Object.entries(piece.edgeSeamAllowances ?? {}).forEach(([edge, allowance]) => {
      if (!Number.isFinite(allowance) || allowance < 0) add(piece, 'error', 'invalid-seam-allowance', `بدل الخياطة للحافة «${edge}» سالب أو غير صالح.`);
    });
    if (!Number.isFinite(piece.seamAllowanceCm) || piece.seamAllowanceCm < 0) {
      add(piece, 'error', 'invalid-default-allowance', 'بدل الخياطة الافتراضي سالب أو غير صالح.');
    }
    piece.grainlines.forEach(grainline => {
      if (!finitePoint(grainline.p1) || !finitePoint(grainline.p2) || pointDistance(grainline.p1, grainline.p2) <= 1e-6) {
        add(piece, 'error', 'invalid-grainline', 'خط النسيج إحداثياته غير صالحة أو طوله صفري.');
      }
    });
    piece.notches.forEach(notch => {
      if (!finitePoint(notch.point) || !Number.isFinite(notch.angleDeg) || !Number.isFinite(notch.depthCm) || notch.depthCm <= 0) {
        add(piece, 'error', 'invalid-notch', 'إحدى علامات المطابقة غير صالحة.');
      }
    });
    if (cutting.length >= 3 && cutting.every(segment => finitePoint(segment.p1) && finitePoint(segment.p2))) {
      const first = cutting[0].p1;
      const last = cutting[cutting.length - 1].p2;
      if (pointDistance(last, first) > toleranceCm) add(piece, 'error', 'open-contour', 'محيط القطعة غير مغلق؛ لا تعتمدها للقص أو التصدير.');
    }
    if (!piece.grainlines.length) add(piece, 'warning', 'missing-grainline', 'لم يُحدد خط نسيج للقطعة.');
    if (!piece.notches.length) add(piece, 'warning', 'missing-notches', 'لا توجد علامات مطابقة؛ راجع مواضعها قبل الإنتاج.');
  });

  const errors = issues.filter(issue => issue.severity === 'error').length;
  const warnings = issues.filter(issue => issue.severity === 'warning').length;
  return {
    valid: errors === 0,
    exportSafe: errors === 0,
    checkedPieces: pieces.length,
    checkedCuttingEdges,
    errors,
    warnings,
    issues
  };
}
