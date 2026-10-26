// CAD Geometry & Pattern-by-Numbers Engine
// Computes parametric clothing patterns, layers, notches, seam allowances, and numeric specs.

export type CadLayerType = 'cutting' | 'stitch' | 'seam' | 'notches' | 'notes' | 'dimensions' | 'guideline';

export interface CadPoint {
  x: number; // in cm relative to Work Frame origin
  y: number; // in cm
  id?: string;
  name?: string;
  nameAr?: string;
  isHandle?: boolean;
  isCorner?: boolean; // corner vs smooth vertex
}

export interface CadSegment {
  id: string;
  type: 'line' | 'quad' | 'bezier';
  p1: CadPoint;
  p2: CadPoint;
  cp1?: CadPoint; // Control point 1 for quad or bezier
  cp2?: CadPoint; // Control point 2 for bezier
  layer: CadLayerType;
  label?: string;
  edgeType?: 'neckline' | 'shoulder' | 'armhole' | 'side' | 'waist' | 'hem' | 'crotch' | 'inseam' | 'center' | 'general';
  lengthCm: number;
  badgePos?: CadPoint; // custom position for draggable measurement badge
}

export interface CadNotch {
  id: string;
  point: CadPoint;
  angleDeg: number;
  type: 'v_notch' | 't_notch' | 'slit';
  depthCm: number;
  label?: string;
}

export interface CadGrainline {
  id: string;
  p1: CadPoint;
  p2: CadPoint;
  label: string;
}

export interface CadConstraint {
  id: string;
  sourceField: string;
  targetField: string;
  ratio: number;
  offset: number;
  descriptionAr: string;
}

export interface CadPiece {
  id: string;
  name: string;
  nameAr: string;
  garmentType: 'bodice' | 'shirt' | 'dress' | 'pants' | 'sleeve' | 'skirt' | 'custom';
  segments: CadSegment[];
  notches: CadNotch[];
  grainlines: CadGrainline[];
  seamAllowanceCm: number;
  edgeSeamAllowances?: Record<string, number>; // edgeType -> cm
  isMirrored?: boolean;
  mirrorSynced?: boolean;
  notes: string;
  color?: string;
}

export interface WorkFrameConfig {
  widthCm: number;
  heightCm: number;
  unit: 'cm' | 'in';
}

export interface PatternByNumbersInput {
  backLength: number;            // طول الظهر (سم)
  frontLength: number;           // طول الصدر/الأمام (سم)
  shoulderLength: number;        // طول الكتف (سم)
  neckCircumference: number;     // محيط الرقبة (سم)
  neckDepthFront: number;        // عمق حردة الرقبة الأمامية (سم)
  neckDepthBack: number;         // عمق حردة الرقبة الخلفية (سم)
  bustCircumference: number;     // محيط الصدر (سم)
  waistCircumference: number;    // محيط الخصر (سم)
  hipCircumference: number;      // محيط الورك/الأرداف (سم)
  armholeCircumference: number;  // محيط حفرة الإبط (سم)
  sleeveLength: number;          // طول الكم (سم)
  crotchDepth: number;           // عمق الحجر / الصدرية للبنطلون (سم)
  rise: number;                  // ارتفاع الخصر (سم)
  thighCircumference: number;    // محيط الفخذ (سم)
  additionalEase: number;        // سماحة الراحة الإضافية (Ease cm)
  seamAllowanceDefault: number;  // سماحة الخياطة الافتراضية (سم)
}

export interface DraftingRulesConfig {
  neckWidthFormula: string;      // e.g. "neckCirc / 6"
  frontNeckDepthFormula: string; // e.g. "neckCirc / 10 + 2"
  backNeckDepthFormula: string;  // e.g. "2.5"
  shoulderDropFormula: string;   // e.g. "shoulderLength * 0.1"
  chestQuarterFormula: string;   // e.g. "bustCirc / 4 + ease"
  waistQuarterFormula: string;   // e.g. "waistCirc / 4 + ease + 1.5"
  hipQuarterFormula: string;     // e.g. "hipCirc / 4 + ease"
  armholeDepthFormula: string;   // e.g. "armholeCirc * 0.45 + ease"
  crotchDepthFormula: string;    // e.g. "backLength * 0.25 + 2"
}

export const DEFAULT_DRAFTING_RULES: DraftingRulesConfig = {
  neckWidthFormula: 'neckCirc / 6',
  frontNeckDepthFormula: 'neckCirc / 10 + 2',
  backNeckDepthFormula: '2.5',
  shoulderDropFormula: 'shoulderLength * 0.1 + 2.8',
  chestQuarterFormula: 'bustCirc / 4 + ease',
  waistQuarterFormula: 'waistCirc / 4 + ease + 1.5',
  hipQuarterFormula: 'hipCirc / 4 + ease',
  armholeDepthFormula: 'armholeCirc * 0.45 + ease',
  crotchDepthFormula: 'backLength * 0.25 + 2'
};

export const DEFAULT_PATTERN_NUMBERS: PatternByNumbersInput = {
  backLength: 60,
  frontLength: 62,
  shoulderLength: 12,
  neckCircumference: 36,
  neckDepthFront: 7.5,
  neckDepthBack: 2.5,
  bustCircumference: 88,
  waistCircumference: 70,
  hipCircumference: 92,
  armholeCircumference: 40,
  sleeveLength: 58,
  crotchDepth: 26,
  rise: 24,
  thighCircumference: 56,
  additionalEase: 1.5,
  seamAllowanceDefault: 1.5
};

export interface ReferencePointInfo {
  id: string;
  name: string;
  nameAr: string;
  x: number;
  y: number;
  pieceNameAr: string;
  descriptionAr: string;
}

export interface PieceSpecSummary {
  pieceId: string;
  nameAr: string;
  nameEn: string;
  lengthCm: number;
  widthCm: number;
  seamAllowanceCm: number;
  notchesCount: number;
  notesAr: string;
}

// Distance between 2 points
export function distance(p1: CadPoint, p2: CadPoint): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Angle in degrees between p1 and p2
export function angleBetween(p1: CadPoint, p2: CadPoint): number {
  const rad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

// Midpoint calculation
export function midPoint(p1: CadPoint, p2: CadPoint): CadPoint {
  return {
    x: +((p1.x + p2.x) / 2).toFixed(2),
    y: +((p1.y + p2.y) / 2).toFixed(2)
  };
}

// Approximate length of quadratic bezier curve
export function quadLength(p1: CadPoint, cp: CadPoint, p2: CadPoint): number {
  const steps = 16;
  let len = 0;
  let prev = p1;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.pow(1 - t, 2) * p1.x + 2 * (1 - t) * t * cp.x + Math.pow(t, 2) * p2.x;
    const y = Math.pow(1 - t, 2) * p1.y + 2 * (1 - t) * t * cp.y + Math.pow(t, 2) * p2.y;
    const curr = { x, y };
    len += distance(prev, curr);
    prev = curr;
  }
  return len;
}

// Approximate length of cubic bezier curve
export function bezierLength(p1: CadPoint, cp1: CadPoint, cp2: CadPoint, p2: CadPoint): number {
  const steps = 20;
  let len = 0;
  let prev = p1;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    const x = it * it * it * p1.x + 3 * it * it * t * cp1.x + 3 * it * t * t * cp2.x + t * t * t * p2.x;
    const y = it * it * it * p1.y + 3 * it * it * t * cp1.y + 3 * it * t * t * cp2.y + t * t * t * p2.y;
    const curr = { x, y };
    len += distance(prev, curr);
    prev = curr;
  }
  return len;
}

// Evaluate Drafting Rule formulas safely
export function evaluateDraftingRule(
  formula: string,
  vars: {
    backLength: number;
    frontLength: number;
    shoulderLength: number;
    neckCirc: number;
    bustCirc: number;
    waistCirc: number;
    hipCirc: number;
    armholeCirc: number;
    sleeveLength: number;
    ease: number;
  },
  defaultVal: number
): number {
  try {
    const sanitized = formula
      .replace(/backLength/g, `${vars.backLength}`)
      .replace(/frontLength/g, `${vars.frontLength}`)
      .replace(/shoulderLength/g, `${vars.shoulderLength}`)
      .replace(/neckCirc/g, `${vars.neckCirc}`)
      .replace(/bustCirc/g, `${vars.bustCirc}`)
      .replace(/waistCirc/g, `${vars.waistCirc}`)
      .replace(/hipCirc/g, `${vars.hipCirc}`)
      .replace(/armholeCirc/g, `${vars.armholeCirc}`)
      .replace(/sleeveLength/g, `${vars.sleeveLength}`)
      .replace(/ease/g, `${vars.ease}`)
      .replace(/π/g, `${Math.PI}`)
      .replace(/PI/g, `${Math.PI}`);

    // Safe mathematical evaluation (basic arithmetic only)
    if (/^[0-9+\-*/().\sMathPI]+$/.test(sanitized)) {
      // eslint-disable-next-line no-new-func
      const result = Function(`'use strict'; return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.max(0.1, +result.toFixed(2));
      }
    }
  } catch {
    // fallback
  }
  return defaultVal;
}

// Generate Reference Points (P1, P2... with coordinates and descriptions)
export function computeReferencePoints(
  input: PatternByNumbersInput,
  rules: DraftingRulesConfig = DEFAULT_DRAFTING_RULES
): ReferencePointInfo[] {
  const vars = {
    backLength: input.backLength,
    frontLength: input.frontLength,
    shoulderLength: input.shoulderLength,
    neckCirc: input.neckCircumference,
    bustCirc: input.bustCircumference,
    waistCirc: input.waistCircumference,
    hipCirc: input.hipCircumference,
    armholeCirc: input.armholeCircumference,
    sleeveLength: input.sleeveLength,
    ease: input.additionalEase
  };

  const neckWidth = evaluateDraftingRule(rules.neckWidthFormula, vars, input.neckCircumference / 6);
  const backNeckDepth = evaluateDraftingRule(rules.backNeckDepthFormula, vars, 2.5);
  const frontNeckDepth = evaluateDraftingRule(rules.frontNeckDepthFormula, vars, input.neckDepthFront || (input.neckCircumference / 10 + 2));
  const shoulderDrop = evaluateDraftingRule(rules.shoulderDropFormula, vars, input.shoulderLength * 0.1 + 3);
  const quarterChest = evaluateDraftingRule(rules.chestQuarterFormula, vars, input.bustCircumference / 4 + input.additionalEase);
  const quarterWaist = evaluateDraftingRule(rules.waistQuarterFormula, vars, input.waistCircumference / 4 + input.additionalEase + 1.5);
  const armholeDepth = evaluateDraftingRule(rules.armholeDepthFormula, vars, input.armholeCircumference * 0.45 + input.additionalEase);

  const refPoints: ReferencePointInfo[] = [
    // Back Bodice
    {
      id: 'B0',
      name: 'B0 (Center Back Neck)',
      nameAr: 'B0: منتصف حردة الرقبة الخلفية',
      x: 5,
      y: 5 + backNeckDepth,
      pieceNameAr: 'الظهر (Back)',
      descriptionAr: 'نقطة البداية الخلفية للرقبة على خط المنتصف'
    },
    {
      id: 'B1',
      name: 'B1 (Neck Shoulder Point)',
      nameAr: 'B1: نقطة التقاء الرقبة بالكتف',
      x: 5 + neckWidth,
      y: 5,
      pieceNameAr: 'الظهر (Back)',
      descriptionAr: 'عرض حردة الرقبة = محيط الرقبة / 6'
    },
    {
      id: 'B2',
      name: 'B2 (Shoulder Tip)',
      nameAr: 'B2: رأس الكتف الخلفي',
      x: +(5 + neckWidth + input.shoulderLength).toFixed(1),
      y: +(5 + shoulderDrop).toFixed(1),
      pieceNameAr: 'الظهر (Back)',
      descriptionAr: 'نهاية خط الكتف مع ميل الكتف الطبيعي'
    },
    {
      id: 'B3',
      name: 'B3 (Underarm Chest)',
      nameAr: 'B3: زاوية تحت الإبط (الصدر)',
      x: +(5 + quarterChest).toFixed(1),
      y: +(5 + armholeDepth).toFixed(1),
      pieceNameAr: 'الظهر (Back)',
      descriptionAr: 'تقاطع خط عمق الإبط مع ربع محيط الصدر'
    },
    {
      id: 'B4',
      name: 'B4 (Waist Side)',
      nameAr: 'B4: خصر الجنب الخلفي',
      x: +(5 + quarterWaist).toFixed(1),
      y: +(5 + input.backLength).toFixed(1),
      pieceNameAr: 'الظهر (Back)',
      descriptionAr: 'تقاطع خط الخصر مع ربع محيط الخصر + البنسة'
    },
    {
      id: 'B5',
      name: 'B5 (Center Back Waist)',
      nameAr: 'B5: منتصف خصر الظهر',
      x: 5,
      y: +(5 + input.backLength).toFixed(1),
      pieceNameAr: 'الظهر (Back)',
      descriptionAr: 'نقطة نهاية طول الظهر على خط الطي'
    },
    // Front Bodice
    {
      id: 'F0',
      name: 'F0 (Center Front Neck)',
      nameAr: 'F0: منتصف حردة الرقبة الأمامية',
      x: 45,
      y: +(5 + frontNeckDepth).toFixed(1),
      pieceNameAr: 'الأمام (Front)',
      descriptionAr: 'عمق حردة الرقبة الأمامية = محيط الرقبة / 10 + 2'
    },
    {
      id: 'F1',
      name: 'F1 (Front Neck Shoulder)',
      nameAr: 'F1: نقطة التقاء الرقبة بالكتف الأمامي',
      x: +(45 + neckWidth).toFixed(1),
      y: 5,
      pieceNameAr: 'الأمام (Front)',
      descriptionAr: 'نقطة أعلى الكتف للأمام'
    },
    {
      id: 'F2',
      name: 'F2 (Front Shoulder Tip)',
      nameAr: 'F2: رأس الكتف الأمامي',
      x: +(45 + neckWidth + input.shoulderLength).toFixed(1),
      y: +(5 + shoulderDrop + 0.5).toFixed(1),
      pieceNameAr: 'الأمام (Front)',
      descriptionAr: 'رأس الكتف الأمامي مائلاً بنصف سم إضافي'
    },
    {
      id: 'F3',
      name: 'F3 (Front Underarm)',
      nameAr: 'F3: تحت الإبط الأمامي',
      x: +(45 + quarterChest + 0.5).toFixed(1),
      y: +(5 + armholeDepth).toFixed(1),
      pieceNameAr: 'الأمام (Front)',
      descriptionAr: 'زاوية الإبط الأمامي مع راحة إضافية للصدر'
    },
    {
      id: 'F4',
      name: 'F4 (Front Waist Side)',
      nameAr: 'F4: خصر الجنب الأمامي',
      x: +(45 + quarterWaist).toFixed(1),
      y: +(5 + input.frontLength).toFixed(1),
      pieceNameAr: 'الأمام (Front)',
      descriptionAr: 'تقاطع خط الجنب مع طول الأمام'
    },
    {
      id: 'F5',
      name: 'F5 (Center Front Waist)',
      nameAr: 'F5: منتصف خصر الأمام',
      x: 45,
      y: +(5 + input.frontLength).toFixed(1),
      pieceNameAr: 'الأمام (Front)',
      descriptionAr: 'نقطة نهاية طول الصدر على خط المنتصف'
    }
  ];

  return refPoints;
}

// Full Parametric Pattern Generator supporting Bodice, Dress, Shirt, Pants, and Skirt
export function generatePatternByNumbers(
  input: PatternByNumbersInput,
  workFrame: WorkFrameConfig,
  garmentType: 'bodice' | 'shirt' | 'dress' | 'pants' | 'sleeve' | 'skirt' = 'bodice',
  rules: DraftingRulesConfig = DEFAULT_DRAFTING_RULES
): { pieces: CadPiece[]; summaries: PieceSpecSummary[] } {
  const vars = {
    backLength: input.backLength,
    frontLength: input.frontLength,
    shoulderLength: input.shoulderLength,
    neckCirc: input.neckCircumference,
    bustCirc: input.bustCircumference,
    waistCirc: input.waistCircumference,
    hipCirc: input.hipCircumference,
    armholeCirc: input.armholeCircumference,
    sleeveLength: input.sleeveLength,
    ease: input.additionalEase
  };

  const neckWidth = evaluateDraftingRule(rules.neckWidthFormula, vars, input.neckCircumference / 6);
  const backNeckDepth = evaluateDraftingRule(rules.backNeckDepthFormula, vars, 2.5);
  const frontNeckDepth = evaluateDraftingRule(rules.frontNeckDepthFormula, vars, input.neckDepthFront || (input.neckCircumference / 10 + 2));
  const shoulderDrop = evaluateDraftingRule(rules.shoulderDropFormula, vars, input.shoulderLength * 0.1 + 3);
  const quarterChest = evaluateDraftingRule(rules.chestQuarterFormula, vars, input.bustCircumference / 4 + input.additionalEase);
  const quarterWaist = evaluateDraftingRule(rules.waistQuarterFormula, vars, input.waistCircumference / 4 + input.additionalEase + 1.5);
  const quarterHip = evaluateDraftingRule(rules.hipQuarterFormula, vars, input.hipCircumference / 4 + input.additionalEase);
  const armholeDepth = evaluateDraftingRule(rules.armholeDepthFormula, vars, input.armholeCircumference * 0.45 + input.additionalEase);

  const backWidth = +(quarterChest * 0.85).toFixed(1);
  const frontWidth = +(quarterChest * 0.82).toFixed(1);
  const seamDefault = input.seamAllowanceDefault || 1.5;

  const pieces: CadPiece[] = [];
  const summaries: PieceSpecSummary[] = [];

  // ==========================================
  // TYPE 1: PANTS / TROUSERS PATTERN (بنطال)
  // ==========================================
  if (garmentType === 'pants') {
    const pantLength = input.backLength > 70 ? input.backLength : 100;
    const crotchDepth = input.crotchDepth || 26;
    const kneeLevel = +(crotchDepth + (pantLength - crotchDepth) * 0.5).toFixed(1);
    const halfThigh = +(input.thighCircumference ? input.thighCircumference / 2 : (quarterHip + 4)).toFixed(1);
    const halfKnee = +(halfThigh * 0.75).toFixed(1);
    const halfBottom = 19; // اسفل الرجل

    // 1. FRONT PANTS LEG (رجل البنطلون الأمامية)
    const fpOrig = { x: 5, y: 5 };
    const fpSegments: CadSegment[] = [];

    const fp_wLeft: CadPoint = { x: fpOrig.x, y: fpOrig.y }; // خط الخصر يسار
    const fp_wRight: CadPoint = { x: fpOrig.x + quarterWaist, y: fpOrig.y }; // خط الخصر يمين
    const fp_hipRight: CadPoint = { x: fpOrig.x + quarterHip, y: fpOrig.y + 18 }; // خط الورك
    const fp_crotchRight: CadPoint = { x: fpOrig.x + quarterHip + 4.5, y: fpOrig.y + crotchDepth }; // رأس الحجر للأمام
    const fp_kneeRight: CadPoint = { x: fpOrig.x + halfThigh * 0.5 + halfKnee * 0.5, y: fpOrig.y + kneeLevel };
    const fp_hemRight: CadPoint = { x: fpOrig.x + halfThigh * 0.5 + halfBottom * 0.5, y: fpOrig.y + pantLength };
    const fp_hemLeft: CadPoint = { x: fpOrig.x + halfThigh * 0.5 - halfBottom * 0.5, y: fpOrig.y + pantLength };
    const fp_kneeLeft: CadPoint = { x: fpOrig.x + halfThigh * 0.5 - halfKnee * 0.5, y: fpOrig.y + kneeLevel };

    // Waist
    fpSegments.push({
      id: 'fp_waist',
      type: 'line',
      p1: fp_wLeft,
      p2: fp_wRight,
      layer: 'cutting',
      edgeType: 'waist',
      label: `خصر الأمام: ${quarterWaist} سم`,
      lengthCm: +distance(fp_wLeft, fp_wRight).toFixed(1)
    });

    // Side Hip Curve
    fpSegments.push({
      id: 'fp_side_hip',
      type: 'quad',
      p1: fp_wLeft,
      p2: fp_kneeLeft,
      cp1: { x: fpOrig.x - 1.5, y: fpOrig.y + 18 },
      layer: 'cutting',
      edgeType: 'side',
      label: `جنب البنطال للأمام: ${kneeLevel} سم`,
      lengthCm: +quadLength(fp_wLeft, { x: fpOrig.x - 1.5, y: fpOrig.y + 18 }, fp_kneeLeft).toFixed(1)
    });

    // Side Inseam down to hem
    fpSegments.push({
      id: 'fp_side_low',
      type: 'line',
      p1: fp_kneeLeft,
      p2: fp_hemLeft,
      layer: 'cutting',
      edgeType: 'side',
      label: `خارج الساق: ${(pantLength - kneeLevel).toFixed(1)} سم`,
      lengthCm: +distance(fp_kneeLeft, fp_hemLeft).toFixed(1)
    });

    // Hem
    fpSegments.push({
      id: 'fp_hem',
      type: 'line',
      p1: fp_hemLeft,
      p2: fp_hemRight,
      layer: 'cutting',
      edgeType: 'hem',
      label: `فتحة الرجل: ${halfBottom} سم`,
      lengthCm: +distance(fp_hemLeft, fp_hemRight).toFixed(1)
    });

    // Inseam low
    fpSegments.push({
      id: 'fp_inseam_low',
      type: 'line',
      p1: fp_hemRight,
      p2: fp_kneeRight,
      layer: 'cutting',
      edgeType: 'inseam',
      label: `داخل الساق: ${(pantLength - kneeLevel).toFixed(1)} سم`,
      lengthCm: +distance(fp_hemRight, fp_kneeRight).toFixed(1)
    });

    // Inseam up to crotch
    fpSegments.push({
      id: 'fp_inseam_crotch',
      type: 'quad',
      p1: fp_kneeRight,
      p2: fp_crotchRight,
      cp1: { x: fp_kneeRight.x + 1, y: fpOrig.y + (crotchDepth + kneeLevel) * 0.5 },
      layer: 'cutting',
      edgeType: 'inseam',
      label: `داخل الفخذ: ${(kneeLevel - crotchDepth).toFixed(1)} سم`,
      lengthCm: +quadLength(fp_kneeRight, { x: fp_kneeRight.x + 1, y: fpOrig.y + (crotchDepth + kneeLevel) * 0.5 }, fp_crotchRight).toFixed(1)
    });

    // Crotch Curve Front (حجر الأمام)
    fpSegments.push({
      id: 'fp_crotch_curve',
      type: 'quad',
      p1: fp_crotchRight,
      p2: fp_wRight,
      cp1: { x: fp_wRight.x + 0.5, y: fpOrig.y + crotchDepth * 0.85 },
      layer: 'cutting',
      edgeType: 'crotch',
      label: `حجر الأمام: ${crotchDepth} سم`,
      lengthCm: +quadLength(fp_crotchRight, { x: fp_wRight.x + 0.5, y: fpOrig.y + crotchDepth * 0.85 }, fp_wRight).toFixed(1)
    });

    const fpNotches: CadNotch[] = [
      { id: 'notch_fp_knee', point: fp_kneeLeft, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش الركبة' },
      { id: 'notch_fp_crotch', point: fp_crotchRight, angleDeg: 45, type: 'v_notch', depthCm: 0.6, label: 'نوتش الحجر' }
    ];

    const fpGrainlines: CadGrainline[] = [
      { id: 'grain_fp', p1: { x: fpOrig.x + halfThigh * 0.5, y: fpOrig.y + 10 }, p2: { x: fpOrig.x + halfThigh * 0.5, y: fpOrig.y + pantLength - 10 }, label: 'كسرة البنطلون / اتجاه النسيج' }
    ];

    pieces.push({
      id: 'piece_pants_front',
      name: 'Pants Front Leg',
      nameAr: 'رجل البنطلون الأمامية (Front Leg)',
      garmentType: 'pants',
      segments: fpSegments,
      notches: fpNotches,
      grainlines: fpGrainlines,
      seamAllowanceCm: seamDefault,
      color: '#3b82f6',
      notes: 'قص 2 قطعة متقابلتين (يسار ويمين)'
    });

    summaries.push({
      pieceId: 'piece_pants_front',
      nameAr: 'رجل البنطلون الأمامية',
      nameEn: 'Pants Front Leg',
      lengthCm: pantLength,
      widthCm: +(quarterHip + 4.5).toFixed(1),
      seamAllowanceCm: seamDefault,
      notchesCount: fpNotches.length,
      notesAr: 'قص قطعتين متطابقتين بالمرآة مع عمل سرفلة للجوانب'
    });

    // 2. BACK PANTS LEG (رجل البنطلون الخلفية - حجر أعمق وارتفاع خلفي)
    const bpOrig = { x: 55, y: 5 };
    const bpSegments: CadSegment[] = [];

    const bp_wLeft: CadPoint = { x: bpOrig.x, y: bpOrig.y };
    const bp_wRight: CadPoint = { x: bpOrig.x + quarterWaist + 2, y: bpOrig.y - 3 }; // خصر خلفي مرتفع
    const bp_crotchRight: CadPoint = { x: bpOrig.x + quarterHip + 9.5, y: bpOrig.y + crotchDepth + 1.5 }; // حجر خلفي ممتد
    const bp_kneeRight: CadPoint = { x: bpOrig.x + halfThigh * 0.5 + halfKnee * 0.5 + 2, y: bpOrig.y + kneeLevel };
    const bp_hemRight: CadPoint = { x: bpOrig.x + halfThigh * 0.5 + halfBottom * 0.5 + 1.5, y: bpOrig.y + pantLength };
    const bp_hemLeft: CadPoint = { x: bpOrig.x + halfThigh * 0.5 - halfBottom * 0.5 - 1.5, y: bpOrig.y + pantLength };
    const bp_kneeLeft: CadPoint = { x: bpOrig.x + halfThigh * 0.5 - halfKnee * 0.5 - 2, y: bpOrig.y + kneeLevel };

    // Back Waist
    bpSegments.push({
      id: 'bp_waist',
      type: 'line',
      p1: bp_wLeft,
      p2: bp_wRight,
      layer: 'cutting',
      edgeType: 'waist',
      label: `خصر الظهر مع بنسة: ${(quarterWaist + 2).toFixed(1)} سم`,
      lengthCm: +distance(bp_wLeft, bp_wRight).toFixed(1)
    });

    // Back Side Hip
    bpSegments.push({
      id: 'bp_side_hip',
      type: 'quad',
      p1: bp_wLeft,
      p2: bp_kneeLeft,
      cp1: { x: bpOrig.x - 2.5, y: bpOrig.y + 18 },
      layer: 'cutting',
      edgeType: 'side',
      label: `جنب البنطال للخلف: ${kneeLevel} سم`,
      lengthCm: +quadLength(bp_wLeft, { x: bpOrig.x - 2.5, y: bpOrig.y + 18 }, bp_kneeLeft).toFixed(1)
    });

    // Back Side Inseam down
    bpSegments.push({
      id: 'bp_side_low',
      type: 'line',
      p1: bp_kneeLeft,
      p2: bp_hemLeft,
      layer: 'cutting',
      edgeType: 'side',
      label: `خارج الساق الخلفي: ${(pantLength - kneeLevel).toFixed(1)} سم`,
      lengthCm: +distance(bp_kneeLeft, bp_hemLeft).toFixed(1)
    });

    // Back Hem
    bpSegments.push({
      id: 'bp_hem',
      type: 'line',
      p1: bp_hemLeft,
      p2: bp_hemRight,
      layer: 'cutting',
      edgeType: 'hem',
      label: `ثنية رجل الظهر: ${(halfBottom + 3).toFixed(1)} سم`,
      lengthCm: +distance(bp_hemLeft, bp_hemRight).toFixed(1)
    });

    // Back Inseam low
    bpSegments.push({
      id: 'bp_inseam_low',
      type: 'line',
      p1: bp_hemRight,
      p2: bp_kneeRight,
      layer: 'cutting',
      edgeType: 'inseam',
      label: `داخل الساق الخلفي: ${(pantLength - kneeLevel).toFixed(1)} سم`,
      lengthCm: +distance(bp_hemRight, bp_kneeRight).toFixed(1)
    });

    // Back Inseam up to crotch
    bpSegments.push({
      id: 'bp_inseam_crotch',
      type: 'quad',
      p1: bp_kneeRight,
      p2: bp_crotchRight,
      cp1: { x: bp_kneeRight.x + 2, y: bpOrig.y + (crotchDepth + kneeLevel) * 0.5 },
      layer: 'cutting',
      edgeType: 'inseam',
      label: `فخذ الظهر الداخلي: ${(kneeLevel - crotchDepth).toFixed(1)} سم`,
      lengthCm: +quadLength(bp_kneeRight, { x: bp_kneeRight.x + 2, y: bpOrig.y + (crotchDepth + kneeLevel) * 0.5 }, bp_crotchRight).toFixed(1)
    });

    // Deep Back Crotch Curve (حجر الخلف العميق)
    bpSegments.push({
      id: 'bp_crotch_curve',
      type: 'bezier',
      p1: bp_crotchRight,
      p2: bp_wRight,
      cp1: { x: bpOrig.x + quarterHip * 0.8, y: bpOrig.y + crotchDepth + 2 },
      cp2: { x: bpOrig.x + quarterWaist * 0.7, y: bpOrig.y + 8 },
      layer: 'cutting',
      edgeType: 'crotch',
      label: `حجر الظهر العميق: ${(crotchDepth + 8).toFixed(1)} سم`,
      lengthCm: +bezierLength(bp_crotchRight, { x: bpOrig.x + quarterHip * 0.8, y: bpOrig.y + crotchDepth + 2 }, { x: bpOrig.x + quarterWaist * 0.7, y: bpOrig.y + 8 }, bp_wRight).toFixed(1)
    });

    const bpNotches: CadNotch[] = [
      { id: 'notch_bp_knee', point: bp_kneeLeft, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش ركبة الظهر' },
      { id: 'notch_bp_crotch', point: bp_crotchRight, angleDeg: 45, type: 'v_notch', depthCm: 0.6, label: 'نوتش حجر الظهر' }
    ];

    const bpGrainlines: CadGrainline[] = [
      { id: 'grain_bp', p1: { x: bpOrig.x + halfThigh * 0.5, y: bpOrig.y + 10 }, p2: { x: bpOrig.x + halfThigh * 0.5, y: bpOrig.y + pantLength - 10 }, label: 'كسرة الظهر / اتجاه النسيج' }
    ];

    pieces.push({
      id: 'piece_pants_back',
      name: 'Pants Back Leg',
      nameAr: 'رجل البنطلون الخلفية (Back Leg)',
      garmentType: 'pants',
      segments: bpSegments,
      notches: bpNotches,
      grainlines: bpGrainlines,
      seamAllowanceCm: seamDefault,
      color: '#0284c7',
      notes: 'قص 2 قطعة متقابلتين (يسار ويمين)'
    });

    summaries.push({
      pieceId: 'piece_pants_back',
      nameAr: 'رجل البنطلون الخلفية',
      nameEn: 'Pants Back Leg',
      lengthCm: +(pantLength + 3).toFixed(1),
      widthCm: +(quarterHip + 9.5).toFixed(1),
      seamAllowanceCm: seamDefault,
      notchesCount: bpNotches.length,
      notesAr: 'قص قطعتين متطابقتين بالمرآة مع مراعاة ميل الحجر الخلفي'
    });

    // 3. WAISTBAND PIECE (كمر البنطال)
    const wbOrig = { x: 105, y: 5 };
    const wbSegments: CadSegment[] = [];
    const wbLength = +(input.waistCircumference + 6).toFixed(1);
    const wbWidth = 8; // عرض الكمر مطوي

    const wbP1: CadPoint = { x: wbOrig.x, y: wbOrig.y };
    const wbP2: CadPoint = { x: wbOrig.x + wbLength, y: wbOrig.y };
    const wbP3: CadPoint = { x: wbOrig.x + wbLength, y: wbOrig.y + wbWidth };
    const wbP4: CadPoint = { x: wbOrig.x, y: wbOrig.y + wbWidth };

    wbSegments.push({ id: 'wb_top', type: 'line', p1: wbP1, p2: wbP2, layer: 'cutting', label: `طول الكمر: ${wbLength} سم`, lengthCm: wbLength });
    wbSegments.push({ id: 'wb_right', type: 'line', p1: wbP2, p2: wbP3, layer: 'cutting', label: `عرض: ${wbWidth} سم`, lengthCm: wbWidth });
    wbSegments.push({ id: 'wb_bottom', type: 'line', p1: wbP3, p2: wbP4, layer: 'cutting', label: `طول الكمر: ${wbLength} سم`, lengthCm: wbLength });
    wbSegments.push({ id: 'wb_left', type: 'line', p1: wbP4, p2: wbP1, layer: 'cutting', label: `عرض: ${wbWidth} سم`, lengthCm: wbWidth });

    pieces.push({
      id: 'piece_pants_waistband',
      name: 'Waistband',
      nameAr: 'كمر الخصر (Waistband)',
      garmentType: 'pants',
      segments: wbSegments,
      notches: [{ id: 'notch_wb_center', point: { x: wbOrig.x + wbLength / 2, y: wbOrig.y }, angleDeg: 90, type: 'v_notch', depthCm: 0.5, label: 'منتصف الظهر' }],
      grainlines: [{ id: 'grain_wb', p1: { x: wbOrig.x + 10, y: wbOrig.y + 4 }, p2: { x: wbOrig.x + wbLength - 10, y: wbOrig.y + 4 }, label: 'اتجاه النسيج الطولي للكمر' }],
      seamAllowanceCm: 1.0,
      color: '#10b981',
      notes: 'يقص 1 قطعة مع حشو فازلين لاصق'
    });

    summaries.push({
      pieceId: 'piece_pants_waistband',
      nameAr: 'كمر الخصر للبنطال',
      nameEn: 'Pants Waistband',
      lengthCm: wbLength,
      widthCm: wbWidth,
      seamAllowanceCm: 1.0,
      notchesCount: 1,
      notesAr: 'قص قطعة واحدة مع زيادة لسان الزرار 3 سم'
    });

    return { pieces, summaries };
  }

  // ==========================================
  // TYPE 2: SKIRT PATTERN (تنورة كلوش / مستقيمة)
  // ==========================================
  if (garmentType === 'skirt') {
    const skirtLen = input.backLength > 40 ? input.backLength : 65;
    const hipDepth = 19;
    const flareEase = 8; // اتساع الذيل

    // 1. FRONT SKIRT (تنورة الأمام)
    const skfOrig = { x: 5, y: 5 };
    const skfSegments: CadSegment[] = [];

    const skf0: CadPoint = { x: skfOrig.x, y: skfOrig.y }; // منتصف خصر الأمام
    const skf1: CadPoint = { x: skfOrig.x + quarterWaist, y: skfOrig.y }; // جنب الخصر
    const skf2: CadPoint = { x: skfOrig.x + quarterHip, y: skfOrig.y + hipDepth }; // دوران الورك
    const skf3: CadPoint = { x: skfOrig.x + quarterHip + flareEase, y: skfOrig.y + skirtLen }; // زاوية الذيل
    const skf4: CadPoint = { x: skfOrig.x, y: skfOrig.y + skirtLen }; // منتصف الذيل (طي)

    skfSegments.push({
      id: 'skf_waist',
      type: 'quad',
      p1: skf0,
      p2: skf1,
      cp1: { x: skfOrig.x + quarterWaist * 0.5, y: skfOrig.y + 0.8 },
      layer: 'cutting',
      edgeType: 'waist',
      label: `خصر التنورة: ${quarterWaist} سم`,
      lengthCm: +quadLength(skf0, { x: skfOrig.x + quarterWaist * 0.5, y: skfOrig.y + 0.8 }, skf1).toFixed(1)
    });

    skfSegments.push({
      id: 'skf_hip_side',
      type: 'quad',
      p1: skf1,
      p2: skf2,
      cp1: { x: skfOrig.x + quarterHip + 0.8, y: skfOrig.y + hipDepth * 0.6 },
      layer: 'cutting',
      edgeType: 'side',
      label: `انحناء الورك: ${hipDepth} سم`,
      lengthCm: +quadLength(skf1, { x: skfOrig.x + quarterHip + 0.8, y: skfOrig.y + hipDepth * 0.6 }, skf2).toFixed(1)
    });

    skfSegments.push({
      id: 'skf_side_hem',
      type: 'line',
      p1: skf2,
      p2: skf3,
      layer: 'cutting',
      edgeType: 'side',
      label: `جنب التنورة: ${(skirtLen - hipDepth).toFixed(1)} سم`,
      lengthCm: +distance(skf2, skf3).toFixed(1)
    });

    skfSegments.push({
      id: 'skf_hem',
      type: 'quad',
      p1: skf3,
      p2: skf4,
      cp1: { x: skfOrig.x + (quarterHip + flareEase) * 0.5, y: skfOrig.y + skirtLen - 1.2 },
      layer: 'cutting',
      edgeType: 'hem',
      label: `اتساع الذيل: ${(quarterHip + flareEase).toFixed(1)} سم`,
      lengthCm: +quadLength(skf3, { x: skfOrig.x + (quarterHip + flareEase) * 0.5, y: skfOrig.y + skirtLen - 1.2 }, skf4).toFixed(1)
    });

    skfSegments.push({
      id: 'skf_center_fold',
      type: 'line',
      p1: skf4,
      p2: skf0,
      layer: 'cutting',
      edgeType: 'center',
      label: `منتصف الأمام (طي): ${skirtLen} سم`,
      lengthCm: skirtLen
    });

    pieces.push({
      id: 'piece_skirt_front',
      name: 'Skirt Front',
      nameAr: 'تنورة الأمام (Front Skirt)',
      garmentType: 'skirt',
      segments: skfSegments,
      notches: [{ id: 'notch_skf_hip', point: skf2, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش الورك' }],
      grainlines: [{ id: 'grain_skf', p1: { x: skfOrig.x + 8, y: skfOrig.y + 10 }, p2: { x: skfOrig.x + 8, y: skfOrig.y + skirtLen - 10 }, label: 'اتجاه النسيج الطولي (طي)' }],
      seamAllowanceCm: seamDefault,
      color: '#3b82f6',
      notes: 'يقص 1 قطعة على قماش مطوي من المنتصف (Fold)'
    });

    summaries.push({
      pieceId: 'piece_skirt_front',
      nameAr: 'تنورة الأمام على المطوي',
      nameEn: 'Skirt Front',
      lengthCm: skirtLen,
      widthCm: +(quarterHip + flareEase).toFixed(1),
      seamAllowanceCm: seamDefault,
      notchesCount: 1,
      notesAr: 'قص قطعة واحدة على القماش المطوي بدون خياطة منتصف'
    });

    // 2. BACK SKIRT (تنورة الظهر مع بنسة وسحاب)
    const skbOrig = { x: 50, y: 5 };
    const skbSegments: CadSegment[] = [];

    const skb0: CadPoint = { x: skbOrig.x, y: skbOrig.y };
    const skb1: CadPoint = { x: skbOrig.x + quarterWaist + 1.5, y: skbOrig.y }; // خصر مع بنسة
    const skb2: CadPoint = { x: skbOrig.x + quarterHip, y: skbOrig.y + hipDepth };
    const skb3: CadPoint = { x: skbOrig.x + quarterHip + flareEase, y: skbOrig.y + skirtLen };
    const skb4: CadPoint = { x: skbOrig.x, y: skbOrig.y + skirtLen };

    skbSegments.push({
      id: 'skb_waist',
      type: 'quad',
      p1: skb0,
      p2: skb1,
      cp1: { x: skbOrig.x + (quarterWaist + 1.5) * 0.5, y: skbOrig.y + 0.8 },
      layer: 'cutting',
      edgeType: 'waist',
      label: `خصر الظهر مع بنسة: ${(quarterWaist + 1.5).toFixed(1)} سم`,
      lengthCm: +quadLength(skb0, { x: skbOrig.x + (quarterWaist + 1.5) * 0.5, y: skbOrig.y + 0.8 }, skb1).toFixed(1)
    });

    skbSegments.push({
      id: 'skb_hip_side',
      type: 'quad',
      p1: skb1,
      p2: skb2,
      cp1: { x: skbOrig.x + quarterHip + 0.8, y: skbOrig.y + hipDepth * 0.6 },
      layer: 'cutting',
      edgeType: 'side',
      label: `انحناء الورك الخلفي: ${hipDepth} سم`,
      lengthCm: +quadLength(skb1, { x: skbOrig.x + quarterHip + 0.8, y: skbOrig.y + hipDepth * 0.6 }, skb2).toFixed(1)
    });

    skbSegments.push({
      id: 'skb_side_hem',
      type: 'line',
      p1: skb2,
      p2: skb3,
      layer: 'cutting',
      edgeType: 'side',
      label: `جنب الظهر: ${(skirtLen - hipDepth).toFixed(1)} سم`,
      lengthCm: +distance(skb2, skb3).toFixed(1)
    });

    skbSegments.push({
      id: 'skb_hem',
      type: 'quad',
      p1: skb3,
      p2: skb4,
      cp1: { x: skbOrig.x + (quarterHip + flareEase) * 0.5, y: skbOrig.y + skirtLen - 1.2 },
      layer: 'cutting',
      edgeType: 'hem',
      label: `ذيل الظهر: ${(quarterHip + flareEase).toFixed(1)} سم`,
      lengthCm: +quadLength(skb3, { x: skbOrig.x + (quarterHip + flareEase) * 0.5, y: skbOrig.y + skirtLen - 1.2 }, skb4).toFixed(1)
    });

    skbSegments.push({
      id: 'skb_center_zip',
      type: 'line',
      p1: skb4,
      p2: skb0,
      layer: 'cutting',
      edgeType: 'center',
      label: `سحاب وخياطة منتصف الظهر: ${skirtLen} سم`,
      lengthCm: skirtLen
    });

    pieces.push({
      id: 'piece_skirt_back',
      name: 'Skirt Back',
      nameAr: 'تنورة الظهر (Back Skirt)',
      garmentType: 'skirt',
      segments: skbSegments,
      notches: [
        { id: 'notch_skb_hip', point: skb2, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش الورك' },
        { id: 'notch_skb_zip', point: { x: skbOrig.x, y: skbOrig.y + 18 }, angleDeg: 180, type: 'v_notch', depthCm: 0.5, label: 'نهاية السحاب' }
      ],
      grainlines: [{ id: 'grain_skb', p1: { x: skbOrig.x + 8, y: skbOrig.y + 10 }, p2: { x: skbOrig.x + 8, y: skbOrig.y + skirtLen - 10 }, label: 'اتجاه النسيج الطولي (الظهر)' }],
      seamAllowanceCm: seamDefault,
      color: '#0284c7',
      notes: 'قص 2 قطعة (يمين ويسار) مع إضافة سحاب خلفي 18 سم'
    });

    summaries.push({
      pieceId: 'piece_skirt_back',
      nameAr: 'تنورة الظهر مع سحاب',
      nameEn: 'Skirt Back',
      lengthCm: skirtLen,
      widthCm: +(quarterHip + flareEase).toFixed(1),
      seamAllowanceCm: seamDefault,
      notchesCount: 2,
      notesAr: 'قص قطعتين مع بدل خياطة 2 سم للسحاب الخلفي'
    });

    return { pieces, summaries };
  }

  // ==========================================
  // TYPE 3: DRESS PATTERN (فستان كامل مخصر مع اتساع)
  // ==========================================
  if (garmentType === 'dress') {
    const dressLen = input.backLength > 80 ? input.backLength : 105;
    const waistLevel = input.backLength < 80 ? input.backLength : 42;
    const hipLevel = +(waistLevel + 19).toFixed(1);
    const hemFlare = 14; // اتساع كلوش للفستان

    // 1. BACK DRESS (فستان الظهر)
    const dbOrig = { x: 5, y: 5 };
    const dbSegments: CadSegment[] = [];

    const db0: CadPoint = { x: dbOrig.x, y: dbOrig.y + backNeckDepth };
    const db1: CadPoint = { x: dbOrig.x + neckWidth, y: dbOrig.y };
    const db2: CadPoint = { x: dbOrig.x + neckWidth + input.shoulderLength, y: dbOrig.y + shoulderDrop };
    const dbMid: CadPoint = { x: dbOrig.x + backWidth, y: dbOrig.y + armholeDepth * 0.65 };
    const db3: CadPoint = { x: dbOrig.x + quarterChest, y: dbOrig.y + armholeDepth };
    const db4: CadPoint = { x: dbOrig.x + quarterWaist, y: dbOrig.y + waistLevel }; // تجسيم الخصر
    const db5: CadPoint = { x: dbOrig.x + quarterHip, y: dbOrig.y + hipLevel }; // دوران الأرداف
    const db6: CadPoint = { x: dbOrig.x + quarterHip + hemFlare, y: dbOrig.y + dressLen }; // ذيل الفستان
    const db7: CadPoint = { x: dbOrig.x, y: dbOrig.y + dressLen }; // منتصف الذيل

    dbSegments.push({ id: 'db_neck', type: 'quad', p1: db0, p2: db1, cp1: { x: (db0.x + db1.x) * 0.45, y: db0.y * 0.95 }, layer: 'cutting', edgeType: 'neckline', label: `رقبة الظهر: ${backNeckDepth} سم`, lengthCm: +quadLength(db0, { x: (db0.x + db1.x) * 0.45, y: db0.y * 0.95 }, db1).toFixed(1) });
    dbSegments.push({ id: 'db_shoulder', type: 'line', p1: db1, p2: db2, layer: 'cutting', edgeType: 'shoulder', label: `كتف الظهر: ${input.shoulderLength} سم`, lengthCm: input.shoulderLength });
    dbSegments.push({ id: 'db_armhole', type: 'quad', p1: db2, p2: db3, cp1: dbMid, layer: 'cutting', edgeType: 'armhole', label: `إبط الظهر: ${armholeDepth} سم`, lengthCm: +quadLength(db2, dbMid, db3).toFixed(1) });
    dbSegments.push({ id: 'db_side_waist', type: 'line', p1: db3, p2: db4, layer: 'cutting', edgeType: 'side', label: `تجسيم الخصر: ${(waistLevel - armholeDepth).toFixed(1)} سم`, lengthCm: +distance(db3, db4).toFixed(1) });
    dbSegments.push({ id: 'db_side_hip', type: 'quad', p1: db4, p2: db5, cp1: { x: dbOrig.x + quarterHip + 0.8, y: dbOrig.y + (waistLevel + hipLevel) * 0.5 }, layer: 'cutting', edgeType: 'side', label: `تقويس الورك: ${(hipLevel - waistLevel).toFixed(1)} سم`, lengthCm: +quadLength(db4, { x: dbOrig.x + quarterHip + 0.8, y: dbOrig.y + (waistLevel + hipLevel) * 0.5 }, db5).toFixed(1) });
    dbSegments.push({ id: 'db_side_flare', type: 'line', p1: db5, p2: db6, layer: 'cutting', edgeType: 'side', label: `اتساع ذيل الفستان: ${(dressLen - hipLevel).toFixed(1)} سم`, lengthCm: +distance(db5, db6).toFixed(1) });
    dbSegments.push({ id: 'db_hem', type: 'quad', p1: db6, p2: db7, cp1: { x: dbOrig.x + (quarterHip + hemFlare) * 0.5, y: dbOrig.y + dressLen - 1.5 }, layer: 'cutting', edgeType: 'hem', label: `دوران الذيل: ${(quarterHip + hemFlare).toFixed(1)} سم`, lengthCm: +quadLength(db6, { x: dbOrig.x + (quarterHip + hemFlare) * 0.5, y: dbOrig.y + dressLen - 1.5 }, db7).toFixed(1) });
    dbSegments.push({ id: 'db_center', type: 'line', p1: db7, p2: db0, layer: 'cutting', edgeType: 'center', label: `منتصف فستان الظهر: ${dressLen} سم`, lengthCm: dressLen });

    pieces.push({
      id: 'piece_dress_back',
      name: 'Dress Back',
      nameAr: 'فستان الظهر (Dress Back)',
      garmentType: 'dress',
      segments: dbSegments,
      notches: [
        { id: 'notch_db_waist', point: db4, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش الخصر' },
        { id: 'notch_db_hip', point: db5, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش الورك' }
      ],
      grainlines: [{ id: 'grain_db', p1: { x: dbOrig.x + 8, y: dbOrig.y + 15 }, p2: { x: dbOrig.x + 8, y: dbOrig.y + dressLen - 15 }, label: 'اتجاه النسيج الطولي' }],
      seamAllowanceCm: seamDefault,
      color: '#3b82f6',
      notes: 'قص 2 قطعة مع سحاب خلفي طويل'
    });

    summaries.push({
      pieceId: 'piece_dress_back',
      nameAr: 'فستان الظهر مخصر',
      nameEn: 'Dress Back',
      lengthCm: dressLen,
      widthCm: +(quarterHip + hemFlare).toFixed(1),
      seamAllowanceCm: seamDefault,
      notchesCount: 2,
      notesAr: 'قص قطعتين مع سحاب مخفي في الظهر بطول 55 سم'
    });

    // 2. FRONT DRESS (فستان الأمام)
    const dfOrig = { x: 52, y: 5 };
    const dfSegments: CadSegment[] = [];

    const df0: CadPoint = { x: dfOrig.x, y: dfOrig.y + frontNeckDepth };
    const df1: CadPoint = { x: dfOrig.x + neckWidth, y: dfOrig.y };
    const df2: CadPoint = { x: dfOrig.x + neckWidth + input.shoulderLength, y: dfOrig.y + shoulderDrop + 0.5 };
    const dfMid: CadPoint = { x: dfOrig.x + frontWidth, y: dfOrig.y + armholeDepth * 0.7 };
    const df3: CadPoint = { x: dfOrig.x + quarterChest + 0.5, y: dfOrig.y + armholeDepth };
    const df4: CadPoint = { x: dfOrig.x + quarterWaist, y: dfOrig.y + (input.frontLength < 80 ? input.frontLength : waistLevel + 2) };
    const df5: CadPoint = { x: dfOrig.x + quarterHip + 0.5, y: dfOrig.y + hipLevel };
    const df6: CadPoint = { x: dfOrig.x + quarterHip + hemFlare, y: dfOrig.y + dressLen };
    const df7: CadPoint = { x: dfOrig.x, y: dfOrig.y + dressLen };

    dfSegments.push({ id: 'df_neck', type: 'quad', p1: df0, p2: df1, cp1: { x: dfOrig.x + neckWidth * 0.3, y: dfOrig.y + frontNeckDepth * 0.9 }, layer: 'cutting', edgeType: 'neckline', label: `رقبة الأمام: ${frontNeckDepth} سم`, lengthCm: +quadLength(df0, { x: dfOrig.x + neckWidth * 0.3, y: dfOrig.y + frontNeckDepth * 0.9 }, df1).toFixed(1) });
    dfSegments.push({ id: 'df_shoulder', type: 'line', p1: df1, p2: df2, layer: 'cutting', edgeType: 'shoulder', label: `كتف الأمام: ${input.shoulderLength} سم`, lengthCm: input.shoulderLength });
    dfSegments.push({ id: 'df_armhole', type: 'quad', p1: df2, p2: df3, cp1: dfMid, layer: 'cutting', edgeType: 'armhole', label: `إبط الأمام: ${armholeDepth} سم`, lengthCm: +quadLength(df2, dfMid, df3).toFixed(1) });
    dfSegments.push({ id: 'df_side_waist', type: 'line', p1: df3, p2: df4, layer: 'cutting', edgeType: 'side', label: `تجسيم خصر الأمام: ${(waistLevel - armholeDepth).toFixed(1)} سم`, lengthCm: +distance(df3, df4).toFixed(1) });
    dfSegments.push({ id: 'df_side_hip', type: 'quad', p1: df4, p2: df5, cp1: { x: dfOrig.x + quarterHip + 1.2, y: dfOrig.y + (waistLevel + hipLevel) * 0.5 }, layer: 'cutting', edgeType: 'side', label: `تقويس الورك الأمامي: ${(hipLevel - waistLevel).toFixed(1)} سم`, lengthCm: +quadLength(df4, { x: dfOrig.x + quarterHip + 1.2, y: dfOrig.y + (waistLevel + hipLevel) * 0.5 }, df5).toFixed(1) });
    dfSegments.push({ id: 'df_side_flare', type: 'line', p1: df5, p2: df6, layer: 'cutting', edgeType: 'side', label: `اتساع الأمام: ${(dressLen - hipLevel).toFixed(1)} سم`, lengthCm: +distance(df5, df6).toFixed(1) });
    dfSegments.push({ id: 'df_hem', type: 'quad', p1: df6, p2: df7, cp1: { x: dfOrig.x + (quarterHip + hemFlare) * 0.5, y: dfOrig.y + dressLen - 1.5 }, layer: 'cutting', edgeType: 'hem', label: `دوران الذيل: ${(quarterHip + hemFlare).toFixed(1)} سم`, lengthCm: +quadLength(df6, { x: dfOrig.x + (quarterHip + hemFlare) * 0.5, y: dfOrig.y + dressLen - 1.5 }, df7).toFixed(1) });
    dfSegments.push({ id: 'df_center', type: 'line', p1: df7, p2: df0, layer: 'cutting', edgeType: 'center', label: `منتصف فستان الأمام (طي): ${dressLen} سم`, lengthCm: dressLen });

    pieces.push({
      id: 'piece_dress_front',
      name: 'Dress Front',
      nameAr: 'فستان الأمام (Dress Front)',
      garmentType: 'dress',
      segments: dfSegments,
      notches: [
        { id: 'notch_df_waist', point: df4, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش خصر الأمام' },
        { id: 'notch_df_hip', point: df5, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش ورك الأمام' }
      ],
      grainlines: [{ id: 'grain_df', p1: { x: dfOrig.x + 8, y: dfOrig.y + 15 }, p2: { x: dfOrig.x + 8, y: dfOrig.y + dressLen - 15 }, label: 'اتجاه النسيج الطولي (طي)' }],
      seamAllowanceCm: seamDefault,
      color: '#0284c7',
      notes: 'يقص 1 قطعة على قماش مطوي من منتصف الأمام (Fold)'
    });

    summaries.push({
      pieceId: 'piece_dress_front',
      nameAr: 'فستان الأمام على المطوي',
      nameEn: 'Dress Front',
      lengthCm: dressLen,
      widthCm: +(quarterHip + hemFlare).toFixed(1),
      seamAllowanceCm: seamDefault,
      notchesCount: 2,
      notesAr: 'قص قطعة واحدة على القماش المطوي بدون خياطة صدرية'
    });

    // 3. FITTED DRESS SLEEVE (كم الفستان)
    const dsOrig = { x: 98, y: 5 };
    const dsSegments: CadSegment[] = [];
    const sleeveCapHeight = +(armholeDepth * 0.72).toFixed(1);
    const halfBicep = +(input.armholeCircumference * 0.42 + input.additionalEase).toFixed(1);
    const halfWrist = 9.5;

    const dsl_top: CadPoint = { x: dsOrig.x + halfBicep, y: dsOrig.y };
    const dsl_leftArm: CadPoint = { x: dsOrig.x, y: dsOrig.y + sleeveCapHeight };
    const dsl_rightArm: CadPoint = { x: dsOrig.x + halfBicep * 2, y: dsOrig.y + sleeveCapHeight };
    const dsl_leftWrist: CadPoint = { x: dsOrig.x + (halfBicep - halfWrist), y: dsOrig.y + input.sleeveLength };
    const dsl_rightWrist: CadPoint = { x: dsOrig.x + (halfBicep + halfWrist), y: dsOrig.y + input.sleeveLength };

    dsSegments.push({ id: 'dsl_cap_l', type: 'quad', p1: dsl_leftArm, p2: dsl_top, cp1: { x: dsOrig.x + halfBicep * 0.35, y: dsOrig.y + sleeveCapHeight * 0.2 }, layer: 'cutting', edgeType: 'armhole', label: `رأس الكم: ${sleeveCapHeight} سم`, lengthCm: +quadLength(dsl_leftArm, { x: dsOrig.x + halfBicep * 0.35, y: dsOrig.y + sleeveCapHeight * 0.2 }, dsl_top).toFixed(1) });
    dsSegments.push({ id: 'dsl_cap_r', type: 'quad', p1: dsl_top, p2: dsl_rightArm, cp1: { x: dsOrig.x + halfBicep * 1.65, y: dsOrig.y + sleeveCapHeight * 0.2 }, layer: 'cutting', edgeType: 'armhole', label: `رأس الكم: ${sleeveCapHeight} سم`, lengthCm: +quadLength(dsl_top, { x: dsOrig.x + halfBicep * 1.65, y: dsOrig.y + sleeveCapHeight * 0.2 }, dsl_rightArm).toFixed(1) });
    dsSegments.push({ id: 'dsl_side_r', type: 'line', p1: dsl_rightArm, p2: dsl_rightWrist, layer: 'cutting', edgeType: 'side', label: `خياطة الكم: ${(input.sleeveLength - sleeveCapHeight).toFixed(1)} سم`, lengthCm: +distance(dsl_rightArm, dsl_rightWrist).toFixed(1) });
    dsSegments.push({ id: 'dsl_hem', type: 'line', p1: dsl_rightWrist, p2: dsl_leftWrist, layer: 'cutting', edgeType: 'hem', label: `معصم الكم: ${halfWrist * 2} سم`, lengthCm: halfWrist * 2 });
    dsSegments.push({ id: 'dsl_side_l', type: 'line', p1: dsl_leftWrist, p2: dsl_leftArm, layer: 'cutting', edgeType: 'side', label: `خياطة الكم: ${(input.sleeveLength - sleeveCapHeight).toFixed(1)} سم`, lengthCm: +distance(dsl_leftWrist, dsl_leftArm).toFixed(1) });

    pieces.push({
      id: 'piece_dress_sleeve',
      name: 'Dress Sleeve',
      nameAr: 'كم الفستان (Dress Sleeve)',
      garmentType: 'dress',
      segments: dsSegments,
      notches: [{ id: 'notch_dsl_top', point: dsl_top, angleDeg: 90, type: 'v_notch', depthCm: 0.6, label: 'نوتش الكتف' }],
      grainlines: [{ id: 'grain_dsl', p1: { x: dsl_top.x, y: dsl_top.y + 5 }, p2: { x: dsl_top.x, y: dsOrig.y + input.sleeveLength - 5 }, label: 'خط المنتصف واتجاه النسيج' }],
      seamAllowanceCm: seamDefault,
      color: '#10b981',
      notes: 'قص 2 قطعة (كم أيمن وأيسر)'
    });

    summaries.push({
      pieceId: 'piece_dress_sleeve',
      nameAr: 'كم الفستان الأنيق',
      nameEn: 'Dress Sleeve',
      lengthCm: input.sleeveLength,
      widthCm: +(halfBicep * 2).toFixed(1),
      seamAllowanceCm: seamDefault,
      notchesCount: 1,
      notesAr: 'قص زوج أكمام مع مراعاة اتجاه النسيج المستقيم'
    });

    return { pieces, summaries };
  }

  // ==========================================
  // TYPE 4: SHIRT PATTERN (قميص رجالي / بلوزة مع مرد أزرار وياقة)
  // ==========================================
  if (garmentType === 'shirt') {
    const shirtLen = input.backLength || 72;
    const placketWidth = 3.0; // مرد الأزرار
    const yokeDepth = 9.0; // سفرة الظهر

    // 1. BACK SHIRT (ظهر القميص مع السفرة)
    const sbOrig = { x: 5, y: 5 };
    const sbSegments: CadSegment[] = [];

    const sb0: CadPoint = { x: sbOrig.x, y: sbOrig.y + backNeckDepth };
    const sb1: CadPoint = { x: sbOrig.x + neckWidth, y: sbOrig.y };
    const sb2: CadPoint = { x: sbOrig.x + neckWidth + input.shoulderLength, y: sbOrig.y + shoulderDrop };
    const sbMid: CadPoint = { x: sbOrig.x + backWidth, y: sbOrig.y + armholeDepth * 0.65 };
    const sb3: CadPoint = { x: sbOrig.x + quarterChest + 2, y: sbOrig.y + armholeDepth };
    const sb4: CadPoint = { x: sbOrig.x + quarterChest + 1.5, y: sbOrig.y + shirtLen };
    const sb5: CadPoint = { x: sbOrig.x, y: sbOrig.y + shirtLen };

    sbSegments.push({ id: 'sb_neck', type: 'quad', p1: sb0, p2: sb1, cp1: { x: (sb0.x + sb1.x) * 0.45, y: sb0.y * 0.95 }, layer: 'cutting', edgeType: 'neckline', label: `رقبة الظهر: ${backNeckDepth} سم`, lengthCm: +quadLength(sb0, { x: (sb0.x + sb1.x) * 0.45, y: sb0.y * 0.95 }, sb1).toFixed(1) });
    sbSegments.push({ id: 'sb_shoulder', type: 'line', p1: sb1, p2: sb2, layer: 'cutting', edgeType: 'shoulder', label: `كتف السفرة: ${input.shoulderLength} سم`, lengthCm: input.shoulderLength });
    sbSegments.push({ id: 'sb_armhole', type: 'quad', p1: sb2, p2: sb3, cp1: sbMid, layer: 'cutting', edgeType: 'armhole', label: `إبط القميص: ${armholeDepth} سم`, lengthCm: +quadLength(sb2, sbMid, sb3).toFixed(1) });
    sbSegments.push({ id: 'sb_side', type: 'line', p1: sb3, p2: sb4, layer: 'cutting', edgeType: 'side', label: `جنب القميص: ${(shirtLen - armholeDepth).toFixed(1)} سم`, lengthCm: +distance(sb3, sb4).toFixed(1) });
    sbSegments.push({ id: 'sb_hem', type: 'quad', p1: sb4, p2: sb5, cp1: { x: sbOrig.x + (quarterChest + 1.5) * 0.5, y: sbOrig.y + shirtLen - 2 }, layer: 'cutting', edgeType: 'hem', label: `تقويس ذيل القميص: ${(quarterChest + 1.5).toFixed(1)} سم`, lengthCm: +quadLength(sb4, { x: sbOrig.x + (quarterChest + 1.5) * 0.5, y: sbOrig.y + shirtLen - 2 }, sb5).toFixed(1) });
    sbSegments.push({ id: 'sb_center', type: 'line', p1: sb5, p2: sb0, layer: 'cutting', edgeType: 'center', label: `منتصف الظهر (طي): ${shirtLen} سم`, lengthCm: shirtLen });

    pieces.push({
      id: 'piece_shirt_back',
      name: 'Shirt Back',
      nameAr: 'ظهر القميص (Shirt Back)',
      garmentType: 'shirt',
      segments: sbSegments,
      notches: [{ id: 'notch_sb_yoke', point: { x: sbOrig.x, y: sbOrig.y + yokeDepth }, angleDeg: 180, type: 'v_notch', depthCm: 0.5, label: 'خط السفرة' }],
      grainlines: [{ id: 'grain_sb', p1: { x: sbOrig.x + 8, y: sbOrig.y + 15 }, p2: { x: sbOrig.x + 8, y: sbOrig.y + shirtLen - 15 }, label: 'اتجاه النسيج (طي)' }],
      seamAllowanceCm: seamDefault,
      color: '#3b82f6',
      notes: 'يقص 1 قطعة على قماش مطوي من منتصف الظهر (Fold)'
    });

    summaries.push({
      pieceId: 'piece_shirt_back',
      nameAr: 'ظهر القميص الرجالي',
      nameEn: 'Shirt Back',
      lengthCm: shirtLen,
      widthCm: +(quarterChest + 2).toFixed(1),
      seamAllowanceCm: seamDefault,
      notchesCount: 1,
      notesAr: 'قص قطعة واحدة على المطوي مع عمل كسرة ظهر اختيارية'
    });

    // 2. FRONT SHIRT (أمام القميص مع مرد الأزرار)
    const sfOrig = { x: 45, y: 5 };
    const sfSegments: CadSegment[] = [];

    const sf0: CadPoint = { x: sfOrig.x, y: sfOrig.y + frontNeckDepth };
    const sf1: CadPoint = { x: sfOrig.x + neckWidth, y: sfOrig.y };
    const sf2: CadPoint = { x: sfOrig.x + neckWidth + input.shoulderLength, y: sfOrig.y + shoulderDrop + 0.5 };
    const sfMid: CadPoint = { x: sfOrig.x + frontWidth, y: sfOrig.y + armholeDepth * 0.7 };
    const sf3: CadPoint = { x: sfOrig.x + quarterChest + 2.5, y: sfOrig.y + armholeDepth };
    const sf4: CadPoint = { x: sfOrig.x + quarterChest + 2, y: sfOrig.y + shirtLen };
    const sf5: CadPoint = { x: sfOrig.x, y: sfOrig.y + shirtLen };
    const sfPlacketTop: CadPoint = { x: sfOrig.x - placketWidth, y: sfOrig.y + frontNeckDepth };
    const sfPlacketBottom: CadPoint = { x: sfOrig.x - placketWidth, y: sfOrig.y + shirtLen };

    sfSegments.push({ id: 'sf_neck', type: 'quad', p1: sf0, p2: sf1, cp1: { x: sfOrig.x + neckWidth * 0.3, y: sfOrig.y + frontNeckDepth * 0.9 }, layer: 'cutting', edgeType: 'neckline', label: `رقبة الأمام: ${frontNeckDepth} سم`, lengthCm: +quadLength(sf0, { x: sfOrig.x + neckWidth * 0.3, y: sfOrig.y + frontNeckDepth * 0.9 }, sf1).toFixed(1) });
    sfSegments.push({ id: 'sf_shoulder', type: 'line', p1: sf1, p2: sf2, layer: 'cutting', edgeType: 'shoulder', label: `كتف الأمام: ${input.shoulderLength} سم`, lengthCm: input.shoulderLength });
    sfSegments.push({ id: 'sf_armhole', type: 'quad', p1: sf2, p2: sf3, cp1: sfMid, layer: 'cutting', edgeType: 'armhole', label: `إبط الأمام: ${armholeDepth} سم`, lengthCm: +quadLength(sf2, sfMid, sf3).toFixed(1) });
    sfSegments.push({ id: 'sf_side', type: 'line', p1: sf3, p2: sf4, layer: 'cutting', edgeType: 'side', label: `جنب الأمام: ${(shirtLen - armholeDepth).toFixed(1)} سم`, lengthCm: +distance(sf3, sf4).toFixed(1) });
    sfSegments.push({ id: 'sf_hem', type: 'quad', p1: sf4, p2: sf5, cp1: { x: sfOrig.x + (quarterChest + 2) * 0.5, y: sfOrig.y + shirtLen - 2 }, layer: 'cutting', edgeType: 'hem', label: `ذيل الأمام: ${(quarterChest + 2).toFixed(1)} سم`, lengthCm: +quadLength(sf4, { x: sfOrig.x + (quarterChest + 2) * 0.5, y: sfOrig.y + shirtLen - 2 }, sf5).toFixed(1) });
    sfSegments.push({ id: 'sf_placket_bottom', type: 'line', p1: sf5, p2: sfPlacketBottom, layer: 'cutting', label: `مرد الأزرار: ${placketWidth} سم`, lengthCm: placketWidth });
    sfSegments.push({ id: 'sf_placket_front', type: 'line', p1: sfPlacketBottom, p2: sfPlacketTop, layer: 'cutting', edgeType: 'center', label: `خط الأزرار والعراوي: ${shirtLen} سم`, lengthCm: shirtLen });
    sfSegments.push({ id: 'sf_placket_top', type: 'line', p1: sfPlacketTop, p2: sf0, layer: 'cutting', label: `ثنية المرد`, lengthCm: placketWidth });

    pieces.push({
      id: 'piece_shirt_front',
      name: 'Shirt Front',
      nameAr: 'أمام القميص مع المرد (Shirt Front)',
      garmentType: 'shirt',
      segments: sfSegments,
      notches: [{ id: 'notch_sf_button', point: { x: sfOrig.x, y: sfOrig.y + frontNeckDepth + 7 }, angleDeg: 180, type: 'v_notch', depthCm: 0.5, label: 'أول زرار' }],
      grainlines: [{ id: 'grain_sf', p1: { x: sfOrig.x + 8, y: sfOrig.y + 15 }, p2: { x: sfOrig.x + 8, y: sfOrig.y + shirtLen - 15 }, label: 'اتجاه النسيج الطولي' }],
      seamAllowanceCm: seamDefault,
      color: '#0284c7',
      notes: 'قص 2 قطعة (أمام أيمن وأمام أيسر)'
    });

    summaries.push({
      pieceId: 'piece_shirt_front',
      nameAr: 'أمام القميص مع مرد الأزرار',
      nameEn: 'Shirt Front',
      lengthCm: shirtLen,
      widthCm: +(quarterChest + 2.5 + placketWidth).toFixed(1),
      seamAllowanceCm: seamDefault,
      notchesCount: 1,
      notesAr: 'قص قطعتين متطابقتين مع عمل مرد أزرار 3 سم'
    });

    // 3. SHIRT COLLAR & STAND (ياقة القميص ورجل الياقة)
    const colOrig = { x: 88, y: 5 };
    const colSegments: CadSegment[] = [];
    const halfCollarLen = +(input.neckCircumference * 0.5 + 1.5).toFixed(1);
    const colStandHeight = 3.5;
    const colLeafHeight = 5.0;

    const colP1: CadPoint = { x: colOrig.x, y: colOrig.y };
    const colP2: CadPoint = { x: colOrig.x + halfCollarLen + 1.5, y: colOrig.y - 0.5 };
    const colP3: CadPoint = { x: colOrig.x + halfCollarLen + 3, y: colOrig.y + colLeafHeight + 1.5 };
    const colP4: CadPoint = { x: colOrig.x, y: colOrig.y + colLeafHeight };

    colSegments.push({ id: 'col_top', type: 'line', p1: colP1, p2: colP2, layer: 'cutting', label: `دوران الياقة: ${halfCollarLen} سم`, lengthCm: halfCollarLen });
    colSegments.push({ id: 'col_point', type: 'line', p1: colP2, p2: colP3, layer: 'cutting', label: `رأس بوز الياقة`, lengthCm: 5.5 });
    colSegments.push({ id: 'col_base', type: 'quad', p1: colP3, p2: colP4, cp1: { x: colOrig.x + halfCollarLen * 0.6, y: colOrig.y + colLeafHeight + 0.5 }, layer: 'cutting', label: `تركيب الياقة: ${halfCollarLen} سم`, lengthCm: halfCollarLen });
    colSegments.push({ id: 'col_center', type: 'line', p1: colP4, p2: colP1, layer: 'cutting', edgeType: 'center', label: `منتصف الياقة (طي): ${colLeafHeight} سم`, lengthCm: colLeafHeight });

    pieces.push({
      id: 'piece_shirt_collar',
      name: 'Shirt Collar',
      nameAr: 'ياقة القميص الكلاسيكية (Collar)',
      garmentType: 'shirt',
      segments: colSegments,
      notches: [{ id: 'notch_col_center', point: colP1, angleDeg: 90, type: 'v_notch', depthCm: 0.4, label: 'منتصف الياقة' }],
      grainlines: [{ id: 'grain_col', p1: { x: colOrig.x + 5, y: colOrig.y + 2.5 }, p2: { x: colOrig.x + halfCollarLen - 2, y: colOrig.y + 2.5 }, label: 'اتجاه النسيج' }],
      seamAllowanceCm: 1.0,
      color: '#10b981',
      notes: 'قص 2 قطعة على المطوي مع حشو ياقة مقوى'
    });

    summaries.push({
      pieceId: 'piece_shirt_collar',
      nameAr: 'ياقة القميص الكلاسيكية',
      nameEn: 'Shirt Collar',
      lengthCm: +(halfCollarLen * 2).toFixed(1),
      widthCm: colLeafHeight,
      seamAllowanceCm: 1.0,
      notchesCount: 1,
      notesAr: 'قص قطعتين مع حشو ياقة صلب (Collar Interfacing)'
    });

    return { pieces, summaries };
  }

  // ==========================================
  // TYPE 5: DEFAULT FITTED BODICE (كورساج أساسي)
  // ==========================================
  const backSegments: CadSegment[] = [];
  const bOrig = { x: 5, y: 5 };

  const b0: CadPoint = { x: bOrig.x, y: bOrig.y + backNeckDepth };
  const b1: CadPoint = { x: bOrig.x + neckWidth, y: bOrig.y };
  const b2: CadPoint = { x: bOrig.x + neckWidth + input.shoulderLength, y: bOrig.y + shoulderDrop };
  const bMid: CadPoint = { x: bOrig.x + backWidth, y: bOrig.y + armholeDepth * 0.65 };
  const b3: CadPoint = { x: bOrig.x + quarterChest, y: bOrig.y + armholeDepth };
  const b4: CadPoint = { x: bOrig.x + quarterWaist, y: bOrig.y + input.backLength };
  const b5: CadPoint = { x: bOrig.x, y: bOrig.y + input.backLength };

  backSegments.push({
    id: 'b_neck',
    type: 'quad',
    p1: b0,
    p2: b1,
    cp1: { x: (b0.x + b1.x) * 0.45, y: b0.y * 0.95 },
    layer: 'cutting',
    edgeType: 'neckline',
    label: `حردة الرقبة الخلفية: ${backNeckDepth} سم`,
    lengthCm: +quadLength(b0, { x: (b0.x + b1.x) * 0.45, y: b0.y * 0.95 }, b1).toFixed(1)
  });

  backSegments.push({
    id: 'b_shoulder',
    type: 'line',
    p1: b1,
    p2: b2,
    layer: 'cutting',
    edgeType: 'shoulder',
    label: `كتف الظهر: ${input.shoulderLength} سم`,
    lengthCm: +distance(b1, b2).toFixed(1)
  });

  backSegments.push({
    id: 'b_armhole',
    type: 'quad',
    p1: b2,
    p2: b3,
    cp1: bMid,
    layer: 'cutting',
    edgeType: 'armhole',
    label: `إبط الظهر: ${armholeDepth} سم`,
    lengthCm: +quadLength(b2, bMid, b3).toFixed(1)
  });

  backSegments.push({
    id: 'b_side',
    type: 'line',
    p1: b3,
    p2: b4,
    layer: 'cutting',
    edgeType: 'side',
    label: `جنب الظهر: ${(input.backLength - armholeDepth).toFixed(1)} سم`,
    lengthCm: +distance(b3, b4).toFixed(1)
  });

  backSegments.push({
    id: 'b_waist',
    type: 'line',
    p1: b4,
    p2: b5,
    layer: 'cutting',
    edgeType: 'waist',
    label: `خصر الظهر: ${quarterWaist} سم`,
    lengthCm: +distance(b4, b5).toFixed(1)
  });

  backSegments.push({
    id: 'b_center',
    type: 'line',
    p1: b5,
    p2: b0,
    layer: 'cutting',
    edgeType: 'center',
    label: `منتصف الظهر (طي): ${input.backLength} سم`,
    lengthCm: +distance(b5, b0).toFixed(1)
  });

  // Internal Stitch line
  const bStitchOffset = seamDefault;
  const s_b1: CadPoint = { x: b1.x + bStitchOffset * 0.2, y: b1.y + bStitchOffset };
  const s_b2: CadPoint = { x: b2.x - bStitchOffset * 0.5, y: b2.y + bStitchOffset };
  const s_b3: CadPoint = { x: b3.x - bStitchOffset, y: b3.y - bStitchOffset * 0.3 };
  const s_b4: CadPoint = { x: b4.x - bStitchOffset, y: b4.y - bStitchOffset };

  backSegments.push({
    id: 'b_stitch_shoulder',
    type: 'line',
    p1: s_b1,
    p2: s_b2,
    layer: 'stitch',
    edgeType: 'shoulder',
    label: 'خط خياطة الكتف',
    lengthCm: +distance(s_b1, s_b2).toFixed(1)
  });
  backSegments.push({
    id: 'b_stitch_side',
    type: 'line',
    p1: s_b3,
    p2: s_b4,
    layer: 'stitch',
    edgeType: 'side',
    label: 'خط خياطة الجنب',
    lengthCm: +distance(s_b3, s_b4).toFixed(1)
  });

  const backNotches: CadNotch[] = [
    { id: 'notch_b_armhole', point: { x: bMid.x, y: bMid.y }, angleDeg: 40, type: 'v_notch', depthCm: 0.6, label: 'نوتش إبط الظهر (مزدوج)' },
    { id: 'notch_b_waist', point: { x: b4.x, y: b4.y }, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش الخصر' }
  ];

  const backGrainlines: CadGrainline[] = [
    { id: 'grain_back', p1: { x: bOrig.x + 8, y: bOrig.y + 12 }, p2: { x: bOrig.x + 8, y: bOrig.y + input.backLength - 10 }, label: 'اتجاه النسيج الطولي (الظهر)' }
  ];

  pieces.push({
    id: 'piece_back_bodice',
    name: 'Back Bodice',
    nameAr: 'كورساج الظهر (Back Bodice)',
    garmentType: 'bodice',
    segments: backSegments,
    notches: backNotches,
    grainlines: backGrainlines,
    seamAllowanceCm: seamDefault,
    edgeSeamAllowances: { neckline: 1.0, shoulder: seamDefault, armhole: 1.0, side: seamDefault, waist: 2.0, center: 0 },
    notes: 'يقص على قماش مطوي من منتصف الظهر (Fold)',
    color: '#3b82f6'
  });

  summaries.push({
    pieceId: 'piece_back_bodice',
    nameAr: 'كورساج الظهر',
    nameEn: 'Back Bodice',
    lengthCm: input.backLength,
    widthCm: quarterChest,
    seamAllowanceCm: seamDefault,
    notchesCount: backNotches.length,
    notesAr: 'قص 1 على القماش المطوي (Fold) - خط المنتصف بدون خياطة'
  });

  // FRONT BODICE
  const frontSegments: CadSegment[] = [];
  const fOrig = { x: 42, y: 5 };

  const f0: CadPoint = { x: fOrig.x, y: fOrig.y + frontNeckDepth };
  const f1: CadPoint = { x: fOrig.x + neckWidth, y: fOrig.y };
  const f2: CadPoint = { x: fOrig.x + neckWidth + input.shoulderLength, y: fOrig.y + shoulderDrop + 0.5 };
  const fMid: CadPoint = { x: fOrig.x + frontWidth, y: fOrig.y + armholeDepth * 0.7 };
  const f3: CadPoint = { x: fOrig.x + quarterChest + 0.5, y: fOrig.y + armholeDepth };
  const f4: CadPoint = { x: fOrig.x + quarterWaist, y: fOrig.y + input.frontLength };
  const f5: CadPoint = { x: fOrig.x, y: fOrig.y + input.frontLength };

  frontSegments.push({
    id: 'f_neck',
    type: 'quad',
    p1: f0,
    p2: f1,
    cp1: { x: fOrig.x + neckWidth * 0.3, y: fOrig.y + frontNeckDepth * 0.9 },
    layer: 'cutting',
    edgeType: 'neckline',
    label: `حردة الرقبة الأمامية: ${frontNeckDepth} سم`,
    lengthCm: +quadLength(f0, { x: fOrig.x + neckWidth * 0.3, y: fOrig.y + frontNeckDepth * 0.9 }, f1).toFixed(1)
  });

  frontSegments.push({
    id: 'f_shoulder',
    type: 'line',
    p1: f1,
    p2: f2,
    layer: 'cutting',
    edgeType: 'shoulder',
    label: `كتف الأمام: ${input.shoulderLength} سم`,
    lengthCm: +distance(f1, f2).toFixed(1)
  });

  frontSegments.push({
    id: 'f_armhole',
    type: 'quad',
    p1: f2,
    p2: f3,
    cp1: fMid,
    layer: 'cutting',
    edgeType: 'armhole',
    label: `إبط الأمام: ${armholeDepth} سم`,
    lengthCm: +quadLength(f2, fMid, f3).toFixed(1)
  });

  frontSegments.push({
    id: 'f_side',
    type: 'line',
    p1: f3,
    p2: f4,
    layer: 'cutting',
    edgeType: 'side',
    label: `جنب الأمام: ${(input.frontLength - armholeDepth).toFixed(1)} سم`,
    lengthCm: +distance(f3, f4).toFixed(1)
  });

  frontSegments.push({
    id: 'f_waist',
    type: 'line',
    p1: f4,
    p2: f5,
    layer: 'cutting',
    edgeType: 'waist',
    label: `خصر الأمام: ${quarterWaist} سم`,
    lengthCm: +distance(f4, f5).toFixed(1)
  });

  frontSegments.push({
    id: 'f_center',
    type: 'line',
    p1: f5,
    p2: f0,
    layer: 'cutting',
    edgeType: 'center',
    label: `منتصف الأمام: ${input.frontLength} سم`,
    lengthCm: +distance(f5, f0).toFixed(1)
  });

  // Front Stitching
  const s_f1: CadPoint = { x: f1.x + bStitchOffset * 0.2, y: f1.y + bStitchOffset };
  const s_f2: CadPoint = { x: f2.x - bStitchOffset * 0.5, y: f2.y + bStitchOffset };
  const s_f3: CadPoint = { x: f3.x - bStitchOffset, y: f3.y - bStitchOffset * 0.3 };
  const s_f4: CadPoint = { x: f4.x - bStitchOffset, y: f4.y - bStitchOffset };

  frontSegments.push({
    id: 'f_stitch_shoulder',
    type: 'line',
    p1: s_f1,
    p2: s_f2,
    layer: 'stitch',
    edgeType: 'shoulder',
    label: 'خط خياطة كتف الأمام',
    lengthCm: +distance(s_f1, s_f2).toFixed(1)
  });
  frontSegments.push({
    id: 'f_stitch_side',
    type: 'line',
    p1: s_f3,
    p2: s_f4,
    layer: 'stitch',
    edgeType: 'side',
    label: 'خط خياطة جنب الأمام',
    lengthCm: +distance(s_f3, s_f4).toFixed(1)
  });

  const frontNotches: CadNotch[] = [
    { id: 'notch_f_armhole_1', point: { x: fMid.x, y: fMid.y - 1 }, angleDeg: 35, type: 'v_notch', depthCm: 0.6, label: 'نوتش مفرد للأمام' },
    { id: 'notch_f_waist', point: { x: f4.x, y: f4.y }, angleDeg: 0, type: 'v_notch', depthCm: 0.6, label: 'نوتش خصر الأمام' }
  ];

  const frontGrainlines: CadGrainline[] = [
    { id: 'grain_front', p1: { x: fOrig.x + 8, y: fOrig.y + 15 }, p2: { x: fOrig.x + 8, y: fOrig.y + input.frontLength - 10 }, label: 'اتجاه النسيج الطولي (الأمام)' }
  ];

  pieces.push({
    id: 'piece_front_bodice',
    name: 'Front Bodice',
    nameAr: 'كورساج الأمام (Front Bodice)',
    garmentType: 'bodice',
    segments: frontSegments,
    notches: frontNotches,
    grainlines: frontGrainlines,
    seamAllowanceCm: seamDefault,
    edgeSeamAllowances: { neckline: 1.0, shoulder: seamDefault, armhole: 1.0, side: seamDefault, waist: 2.0, center: 1.5 },
    notes: 'قص 2 قطعة مفتوحة أو 1 على المطوي حسب الموديل',
    color: '#0284c7'
  });

  summaries.push({
    pieceId: 'piece_front_bodice',
    nameAr: 'كورساج الأمام',
    nameEn: 'Front Bodice',
    lengthCm: input.frontLength,
    widthCm: +(quarterChest + 0.5).toFixed(1),
    seamAllowanceCm: seamDefault,
    notchesCount: frontNotches.length,
    notesAr: 'قص 2 قطعة متطابقتين بالمرآة مع مراعاة راحة الصدر'
  });

  // SLEEVE PIECE
  const sleeveSegments: CadSegment[] = [];
  const sOrig = { x: 78, y: 5 };

  const sleeveCapHeight = +(armholeDepth * 0.72).toFixed(1);
  const halfBicep = +(input.armholeCircumference * 0.42 + input.additionalEase).toFixed(1);
  const halfWrist = 10;

  const sl_top: CadPoint = { x: sOrig.x + halfBicep, y: sOrig.y };
  const sl_leftArm: CadPoint = { x: sOrig.x, y: sOrig.y + sleeveCapHeight };
  const sl_rightArm: CadPoint = { x: sOrig.x + halfBicep * 2, y: sOrig.y + sleeveCapHeight };
  const sl_leftWrist: CadPoint = { x: sOrig.x + (halfBicep - halfWrist), y: sOrig.y + input.sleeveLength };
  const sl_rightWrist: CadPoint = { x: sOrig.x + (halfBicep + halfWrist), y: sOrig.y + input.sleeveLength };

  sleeveSegments.push({
    id: 'sl_cap_left',
    type: 'quad',
    p1: sl_leftArm,
    p2: sl_top,
    cp1: { x: sOrig.x + halfBicep * 0.35, y: sOrig.y + sleeveCapHeight * 0.2 },
    layer: 'cutting',
    edgeType: 'armhole',
    label: `حردة رأس الكم (أمام): ${sleeveCapHeight} سم`,
    lengthCm: +quadLength(sl_leftArm, { x: sOrig.x + halfBicep * 0.35, y: sOrig.y + sleeveCapHeight * 0.2 }, sl_top).toFixed(1)
  });

  sleeveSegments.push({
    id: 'sl_cap_right',
    type: 'quad',
    p1: sl_top,
    p2: sl_rightArm,
    cp1: { x: sOrig.x + halfBicep * 1.65, y: sOrig.y + sleeveCapHeight * 0.2 },
    layer: 'cutting',
    edgeType: 'armhole',
    label: `حردة رأس الكم (خلف): ${sleeveCapHeight} سم`,
    lengthCm: +quadLength(sl_top, { x: sOrig.x + halfBicep * 1.65, y: sOrig.y + sleeveCapHeight * 0.2 }, sl_rightArm).toFixed(1)
  });

  sleeveSegments.push({
    id: 'sl_side_right',
    type: 'line',
    p1: sl_rightArm,
    p2: sl_rightWrist,
    layer: 'cutting',
    edgeType: 'side',
    label: `خياطة الكم الداخلية: ${(input.sleeveLength - sleeveCapHeight).toFixed(1)} سم`,
    lengthCm: +distance(sl_rightArm, sl_rightWrist).toFixed(1)
  });

  sleeveSegments.push({
    id: 'sl_hem',
    type: 'line',
    p1: sl_rightWrist,
    p2: sl_leftWrist,
    layer: 'cutting',
    edgeType: 'hem',
    label: `محيط الإسورة/المعصم: ${halfWrist * 2} سم`,
    lengthCm: +distance(sl_rightWrist, sl_leftWrist).toFixed(1)
  });

  sleeveSegments.push({
    id: 'sl_side_left',
    type: 'line',
    p1: sl_leftWrist,
    p2: sl_leftArm,
    layer: 'cutting',
    edgeType: 'side',
    label: `خياطة الكم اليسار: ${(input.sleeveLength - sleeveCapHeight).toFixed(1)} سم`,
    lengthCm: +distance(sl_leftWrist, sl_leftArm).toFixed(1)
  });

  const sleeveNotches: CadNotch[] = [
    { id: 'notch_sleeve_top', point: { x: sl_top.x, y: sl_top.y }, angleDeg: 90, type: 'v_notch', depthCm: 0.6, label: 'نوتش التقاء الكتف' },
    { id: 'notch_sleeve_front', point: { x: sOrig.x + halfBicep * 0.35, y: sOrig.y + sleeveCapHeight * 0.5 }, angleDeg: 45, type: 'v_notch', depthCm: 0.6, label: 'نوتش الأمام (مفرد)' }
  ];

  const sleeveGrainlines: CadGrainline[] = [
    { id: 'grain_sleeve', p1: { x: sl_top.x, y: sl_top.y + 5 }, p2: { x: sl_top.x, y: sOrig.y + input.sleeveLength - 5 }, label: 'خط منتصف الكم واتجاه النسيج' }
  ];

  pieces.push({
    id: 'piece_sleeve',
    name: 'Sleeve',
    nameAr: 'كم الملابس (Sleeve Pattern)',
    garmentType: 'sleeve',
    segments: sleeveSegments,
    notches: sleeveNotches,
    grainlines: sleeveGrainlines,
    seamAllowanceCm: seamDefault,
    edgeSeamAllowances: { armhole: 1.0, side: seamDefault, hem: 2.5 },
    notes: 'قص 2 قطعة (كم أيمن وأيسر) مع مراعاة اتجاه النسيج',
    color: '#10b981'
  });

  summaries.push({
    pieceId: 'piece_sleeve',
    nameAr: 'كم الملابس الأساسي',
    nameEn: 'Sleeve Pattern',
    lengthCm: input.sleeveLength,
    widthCm: +(halfBicep * 2).toFixed(1),
    seamAllowanceCm: seamDefault,
    notchesCount: sleeveNotches.length,
    notesAr: 'قص قطعتين (زوج) مع ثنية كف 2.5 سم'
  });

  return { pieces, summaries };
}

// Helper to convert CAD piece segments into a continuous closed SVG polygon path for subtle silhouette fill
export function pieceToClosedSvgPath(piece: CadPiece, pxPerCm: number): string {
  const cuttingSegs = piece.segments.filter(s => s.layer === 'cutting');
  if (cuttingSegs.length === 0) return '';

  let path = '';
  cuttingSegs.forEach((seg, idx) => {
    const p1x = seg.p1.x * pxPerCm;
    const p1y = seg.p1.y * pxPerCm;
    const p2x = seg.p2.x * pxPerCm;
    const p2y = seg.p2.y * pxPerCm;

    if (idx === 0) {
      path += `M ${p1x} ${p1y} `;
    }

    if (seg.type === 'line') {
      path += `L ${p2x} ${p2y} `;
    } else if (seg.type === 'quad' && seg.cp1) {
      const cp1x = seg.cp1.x * pxPerCm;
      const cp1y = seg.cp1.y * pxPerCm;
      path += `Q ${cp1x} ${cp1y} ${p2x} ${p2y} `;
    } else if (seg.type === 'bezier' && seg.cp1 && seg.cp2) {
      const cp1x = seg.cp1.x * pxPerCm;
      const cp1y = seg.cp1.y * pxPerCm;
      const cp2x = seg.cp2.x * pxPerCm;
      const cp2y = seg.cp2.y * pxPerCm;
      path += `C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2x} ${p2y} `;
    } else {
      path += `L ${p2x} ${p2y} `;
    }
  });

  return path + 'Z';
}

// Helper to convert CAD segment to SVG path string
export function segmentToSvgPath(seg: CadSegment, pxPerCm: number): string {
  const p1x = seg.p1.x * pxPerCm;
  const p1y = seg.p1.y * pxPerCm;
  const p2x = seg.p2.x * pxPerCm;
  const p2y = seg.p2.y * pxPerCm;

  if (seg.type === 'line') {
    return `M ${p1x} ${p1y} L ${p2x} ${p2y}`;
  }

  if (seg.type === 'quad' && seg.cp1) {
    const cp1x = seg.cp1.x * pxPerCm;
    const cp1y = seg.cp1.y * pxPerCm;
    return `M ${p1x} ${p1y} Q ${cp1x} ${cp1y} ${p2x} ${p2y}`;
  }

  if (seg.type === 'bezier' && seg.cp1 && seg.cp2) {
    const cp1x = seg.cp1.x * pxPerCm;
    const cp1y = seg.cp1.y * pxPerCm;
    const cp2x = seg.cp2.x * pxPerCm;
    const cp2y = seg.cp2.y * pxPerCm;
    return `M ${p1x} ${p1y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2x} ${p2y}`;
  }

  return `M ${p1x} ${p1y} L ${p2x} ${p2y}`;
}
