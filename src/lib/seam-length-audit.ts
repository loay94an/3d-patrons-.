import type { CadPiece } from './pattern-cad-engine';

export interface SeamLengthCheck {
  id: string;
  labelAr: string;
  leftLabelAr: string;
  rightLabelAr: string;
  leftLengthCm: number;
  rightLengthCm: number;
  differenceCm: number;
  allowedDifferenceCm: number;
  status: 'within-tolerance' | 'review';
}

function sumSegments(piece: CadPiece | undefined, ids: string[]): number | null {
  if (!piece) return null;
  const segments = ids.map(id => piece.segments.find(segment => segment.id === id && segment.layer === 'cutting'));
  if (segments.some(segment => !segment || !Number.isFinite(segment.lengthCm))) return null;
  return segments.reduce((sum, segment) => sum + (segment?.lengthCm ?? 0), 0);
}

/**
 * Compares explicitly identified candidate sewing edges by drafted length.
 * This is a screening aid only: it does not simulate seam curvature, easing distribution,
 * notch alignment, fabric stretch, or certify a production-ready seam.
 */
export function auditPatternSeamLengths(pieces: CadPiece[]): SeamLengthCheck[] {
  const byId = new Map(pieces.map(piece => [piece.id, piece]));
  const checks: SeamLengthCheck[] = [];
  const add = (
    id: string, labelAr: string,
    leftPieceId: string, leftIds: string[], leftLabelAr: string,
    rightPieceId: string, rightIds: string[], rightLabelAr: string[],
    allowedDifferenceCm: number
  ) => {
    const leftLengthCm = sumSegments(byId.get(leftPieceId), leftIds);
    const rightLengthCm = sumSegments(byId.get(rightPieceId), rightIds);
    if (leftLengthCm === null || rightLengthCm === null) return;
    const differenceCm = Math.abs(leftLengthCm - rightLengthCm);
    checks.push({
      id, labelAr, leftLabelAr, rightLabelAr, leftLengthCm, rightLengthCm,
      differenceCm, allowedDifferenceCm,
      status: differenceCm <= allowedDifferenceCm ? 'within-tolerance' : 'review'
    });
  };

  add('bodice-shoulder', 'كتف الأمام مع كتف الظهر', 'piece_front_bodice', ['f_shoulder'], 'كتف الأمام', 'piece_back_bodice', ['b_shoulder'], 'كتف الظهر', 0.75);
  add('bodice-side', 'جنب الأمام مع جنب الظهر', 'piece_front_bodice', ['f_side'], 'جنب الأمام', 'piece_back_bodice', ['b_side'], 'جنب الظهر', 1.0);
  add('bodice-back-armhole-sleeve', 'حردة إبط الظهر مع رأس الكم', 'piece_back_bodice', ['b_armhole'], 'إبط الظهر', 'piece_sleeve', ['sl_cap_left'], 'جزء رأس الكم الأول', 2.5);
  add('bodice-front-armhole-sleeve', 'حردة إبط الأمام مع رأس الكم', 'piece_front_bodice', ['f_armhole'], 'إبط الأمام', 'piece_sleeve', ['sl_cap_right'], 'جزء رأس الكم الثاني', 2.5);

  add('pants-side', 'الجنب الخارجي الأمامي والخلفي', 'piece_pants_front', ['fp_side_hip', 'fp_side_low'], 'جنب الأمام', 'piece_pants_back', ['bp_side_hip', 'bp_side_low'], 'جنب الخلف', 1.5);
  add('pants-inseam', 'خطا الساق الداخلي الأمامي والخلفي', 'piece_pants_front', ['fp_inseam_crotch', 'fp_inseam_low'], 'داخل الأمام', 'piece_pants_back', ['bp_inseam_crotch', 'bp_inseam_low'], 'داخل الخلف', 1.5);
  add('pants-crotch', 'منحنى حجر الأمام والخلف', 'piece_pants_front', ['fp_crotch_curve'], 'حجر الأمام', 'piece_pants_back', ['bp_crotch_curve'], 'حجر الخلف', 3.0);

  add('skirt-side', 'جنب التنورة الأمامي والخلفي', 'piece_skirt_front', ['skf_side_hem'], 'جنب الأمام', 'piece_skirt_back', ['skb_side_hem'], 'جنب الخلف', 1.0);
  return checks;
}
