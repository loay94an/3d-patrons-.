import {
  distance,
  quadLength,
  type CadPiece,
  type CadPoint,
  type CadSegment,
  type CadGrainline,
  type CadNotch,
  type PieceSpecSummary
} from './pattern-cad-engine';

export interface BasicSkirtDraftInput {
  waistCircumferenceCm: number;
  hipCircumferenceCm: number;
  waistToHipCm: number;
  skirtLengthCm: number;
  waistEaseCm?: number;
  hipEaseCm?: number;
  frontDartIntakeCm?: number;
  backDartIntakeCm?: number;
  frontDartLengthCm?: number;
  backDartLengthCm?: number;
  seamAllowanceCm?: number;
  hemAllowanceCm?: number;
  centerBackAllowanceCm?: number;
}

export interface SkirtDraftValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  measurements: {
    finishedWaistCm: number;
    finishedHipCm: number;
    frontSideSeamCm: number;
    backSideSeamCm: number;
    sideSeamDifferenceCm: number;
  };
}

export interface BasicSkirtDraftResult {
  pieces: CadPiece[];
  summaries: PieceSpecSummary[];
  validation: SkirtDraftValidation;
}

const round = (value: number): number => Number(value.toFixed(3));
const point = (x: number, y: number): CadPoint => ({ x: round(x), y: round(y) });

function line(
  id: string,
  p1: CadPoint,
  p2: CadPoint,
  edgeType: CadSegment['edgeType'],
  label: string
): CadSegment {
  return {
    id, type: 'line', p1, p2, layer: 'cutting', edgeType,
    label, lengthCm: round(distance(p1, p2))
  };
}

function dartGuides(
  id: string,
  centerX: number,
  waistY: number,
  intake: number,
  length: number,
  label: string
): CadSegment[] {
  const half = intake / 2;
  const apex = point(centerX, waistY + length);
  return [
    {
      id: id + '_left', type: 'line',
      p1: point(centerX - half, waistY), p2: apex,
      layer: 'guideline', edgeType: 'waist',
      label: label + ' - الرجل الأولى',
      lengthCm: round(distance(point(centerX - half, waistY), apex))
    },
    {
      id: id + '_right', type: 'line',
      p1: point(centerX + half, waistY), p2: apex,
      layer: 'guideline', edgeType: 'waist',
      label: label + ' - الرجل الثانية',
      lengthCm: round(distance(point(centerX + half, waistY), apex))
    }
  ];
}

/**
 * Drafts a first, measurable straight-skirt block as quarter-body panels:
 * one front panel placed on fold and one back panel with a center seam.
 * Dart intake is added to the drafted waist edge and removed when sewn.
 * This is a base block, not a fitted/production-validated garment.
 */
export function generateBasicSkirtDraft(input: BasicSkirtDraftInput): BasicSkirtDraftResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const positiveFields: Array<[keyof BasicSkirtDraftInput, string]> = [
    ['waistCircumferenceCm', 'محيط الخصر'],
    ['hipCircumferenceCm', 'محيط الورك'],
    ['waistToHipCm', 'عمق الورك'],
    ['skirtLengthCm', 'طول التنورة']
  ];

  for (const [key, label] of positiveFields) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      errors.push(label + ': يجب إدخال قيمة موجبة وصحيحة');
    }
  }

  const optionalNonNegative: Array<[keyof BasicSkirtDraftInput, string]> = [
    ['waistEaseCm', 'راحة الخصر'],
    ['hipEaseCm', 'راحة الورك'],
    ['frontDartIntakeCm', 'بنسة الأمام'],
    ['backDartIntakeCm', 'بنسة الخلف'],
    ['frontDartLengthCm', 'طول بنسة الأمام'],
    ['backDartLengthCm', 'طول بنسة الخلف'],
    ['seamAllowanceCm', 'بدل الخياطة'],
    ['hemAllowanceCm', 'ثنية الذيل'],
    ['centerBackAllowanceCm', 'بدل منتصف الخلف']
  ];
  for (const [key, label] of optionalNonNegative) {
    const value = input[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      errors.push(label + ': لا يمكن أن تكون القيمة سالبة أو غير صالحة');
    }
  }

  const empty: BasicSkirtDraftResult = {
    pieces: [],
    summaries: [],
    validation: {
      valid: false, errors, warnings,
      measurements: {
        finishedWaistCm: 0, finishedHipCm: 0,
        frontSideSeamCm: 0, backSideSeamCm: 0, sideSeamDifferenceCm: 0
      }
    }
  };
  if (errors.length) return empty;

  const waistEase = input.waistEaseCm ?? 0;
  const hipEase = input.hipEaseCm ?? 2;
  const frontDart = input.frontDartIntakeCm ?? 2;
  const backDart = input.backDartIntakeCm ?? 3;
  const frontDartLength = input.frontDartLengthCm ?? Math.min(11, input.waistToHipCm * 0.65);
  const backDartLength = input.backDartLengthCm ?? Math.min(13, input.waistToHipCm * 0.75);
  const seam = input.seamAllowanceCm ?? 1;
  const hem = input.hemAllowanceCm ?? 3;
  const centerBack = input.centerBackAllowanceCm ?? seam;
  const waistQuarter = (input.waistCircumferenceCm + waistEase) / 4;
  const hipQuarter = (input.hipCircumferenceCm + hipEase) / 4;
  const hipDepth = input.waistToHipCm;
  const length = input.skirtLengthCm;

  if (hipQuarter <= waistQuarter) {
    errors.push('ربع الورك مع الراحة يجب أن يكون أكبر من ربع الخصر مع الراحة؛ راجع القياسات');
  }
  if (frontDart >= waistQuarter || backDart >= waistQuarter) {
    errors.push('مقدار البنسة كبير مقارنة بعرض ربع الخصر');
  }
  if (frontDartLength >= length || backDartLength >= length) {
    errors.push('طول البنسة يجب أن يكون أقصر من طول التنورة');
  }
  if (hipDepth >= length) {
    errors.push('عمق الورك يجب أن يكون أقصر من طول التنورة');
  }
  if (errors.length) {
    return { ...empty, validation: { ...empty.validation, errors } };
  }

  const frontOrigin = point(5, 5);
  const backOrigin = point(48, 5);
  const makePanel = (
    id: 'front' | 'back',
    origin: CadPoint,
    dartIntake: number,
    dartLength: number,
    targetHipCurveLength?: number
  ): { piece: CadPiece; sideSeam: number; summary: PieceSpecSummary } => {
    const centerWaist = origin;
    const sideWaist = point(origin.x + waistQuarter + dartIntake, origin.y);
    const sideHip = point(origin.x + hipQuarter, origin.y + hipDepth);
    const sideHem = point(origin.x + hipQuarter, origin.y + length);
    const centerHem = point(origin.x, origin.y + length);
    let curveControl = point(
      origin.x + Math.max(waistQuarter + dartIntake, hipQuarter) + 0.25,
      origin.y + hipDepth * 0.58
    );
    // Walk the shorter side curve to the same sewn length as the longer panel.
    // Only the control point moves; the waist, hip and hem landmarks stay fixed.
    if (targetHipCurveLength !== undefined) {
      const baseLength = quadLength(sideWaist, curveControl, sideHip);
      if (baseLength < targetHipCurveLength - 0.001) {
        let low = curveControl.x;
        let high = curveControl.x + Math.max(hipDepth * 3, 20);
        const highPoint = point(high, curveControl.y);
        if (quadLength(sideWaist, highPoint, sideHip) >= targetHipCurveLength) {
          for (let i = 0; i < 48; i += 1) {
            const mid = (low + high) / 2;
            const candidate = point(mid, curveControl.y);
            if (quadLength(sideWaist, candidate, sideHip) < targetHipCurveLength) low = mid;
            else high = mid;
          }
          curveControl = point((low + high) / 2, curveControl.y);
        } else {
          // If horizontal walking cannot reach the target, adjust curvature vertically.
          let lowY = curveControl.y;
          let highY = curveControl.y + Math.max(hipDepth * 3, 20);
          for (let i = 0; i < 48; i += 1) {
            const midY = (lowY + highY) / 2;
            const candidate = point(curveControl.x, midY);
            if (quadLength(sideWaist, candidate, sideHip) < targetHipCurveLength) lowY = midY;
            else highY = midY;
          }
          curveControl = point(curveControl.x, (lowY + highY) / 2);
        }
      }
    }

    const waist = line(id + '_waist', centerWaist, sideWaist, 'waist', 'خط الخصر قبل إغلاق البنسة');
    const hipCurve: CadSegment = {
      id: id + '_hip_curve', type: 'quad',
      p1: sideWaist, p2: sideHip, cp1: curveControl,
      layer: 'cutting', edgeType: 'side',
      label: 'تشكيل جنب الورك',
      lengthCm: round(quadLength(sideWaist, curveControl, sideHip))
    };
    const side = line(id + '_side_lower', sideHip, sideHem, 'side', 'الجنب من خط الورك إلى الذيل');
    const hemLine = line(id + '_hem', sideHem, centerHem, 'hem', 'خط ذيل التنورة');
    const center = line(
      id + '_center', centerHem, centerWaist,
      id === 'front' ? 'center' : 'center',
      id === 'front' ? 'منتصف الأمام - على الثنية' : 'منتصف الخلف - خياطة وسحاب'
    );

    const dartCenterX = origin.x + waistQuarter * (id === 'front' ? 0.48 : 0.56) + dartIntake / 2;
    const dart = dartGuides(
      id + '_dart', dartCenterX, origin.y, dartIntake, dartLength,
      id === 'front' ? 'بنسة الأمام' : 'بنسة الخلف'
    );

    const notches: CadNotch[] = [
      { id: id + '_notch_hip', point: sideHip, angleDeg: 180, type: 'v_notch', depthCm: 0.5, label: 'علامة خط الورك' },
      { id: id + '_notch_waist', point: sideWaist, angleDeg: 90, type: 'v_notch', depthCm: 0.5, label: 'علامة الجنب عند الخصر' }
    ];
    const grainlines: CadGrainline[] = [{
      id: id + '_grainline',
      p1: point(origin.x + hipQuarter * 0.5, origin.y + hipDepth + 5),
      p2: point(origin.x + hipQuarter * 0.5, origin.y + length - 5),
      label: 'خط النسيج الطولي الموازي لمنتصف القطعة'
    }];

    const piece: CadPiece = {
      id: 'basic_skirt_' + id,
      name: id === 'front' ? 'Basic Skirt Front' : 'Basic Skirt Back',
      nameAr: id === 'front' ? 'بلوك التنورة الأساسي - الأمام' : 'بلوك التنورة الأساسي - الخلف',
      garmentType: 'skirt',
      segments: [waist, hipCurve, side, hemLine, center, ...dart],
      notches, grainlines,
      seamAllowanceCm: seam,
      edgeSeamAllowances: {
        waist: seam, side: seam, hem,
        center: id === 'front' ? 0 : centerBack
      },
      notes: id === 'front'
        ? 'نصف الأمام؛ يوضع خط المنتصف على ثنية القماش. تُغلق البنسة عند الخياطة.'
        : 'نصف الخلف؛ تقص قطعتان مع خياطة منتصف الخلف وإمكانية تركيب سحاب. تُغلق البنسة عند الخياطة.',
      color: id === 'front' ? '#3b82f6' : '#0ea5e9'
    };

    const sideSeam = hipCurve.lengthCm + side.lengthCm;
    const summary: PieceSpecSummary = {
      pieceId: piece.id,
      nameAr: piece.nameAr,
      nameEn: piece.name,
      lengthCm: length,
      widthCm: hipQuarter,
      seamAllowanceCm: seam,
      notchesCount: notches.length,
      notesAr: id === 'front'
        ? 'قص قطعة واحدة على الثنية؛ بدل منتصف الأمام صفر.'
        : 'قص قطعتين؛ بدل منتصف الخلف منفصل عن بدل الجنب.'
    };
    return { piece, sideSeam, summary };
  };

  const frontBase = makePanel('front', frontOrigin, frontDart, frontDartLength);
  const backBase = makePanel('back', backOrigin, backDart, backDartLength);
  const targetHipCurveLength = Math.max(
    frontBase.piece.segments.find(segment => segment.id === 'front_hip_curve')?.lengthCm ?? 0,
    backBase.piece.segments.find(segment => segment.id === 'back_hip_curve')?.lengthCm ?? 0
  );
  const front = makePanel('front', frontOrigin, frontDart, frontDartLength, targetHipCurveLength);
  const back = makePanel('back', backOrigin, backDart, backDartLength, targetHipCurveLength);
  const sideDifference = Math.abs(front.sideSeam - back.sideSeam);
  const finishedWaist = (waistQuarter * 4);
  const finishedHip = hipQuarter * 4;

  if (sideDifference > 0.05) {
    errors.push('طول جنب الأمام والخلف غير متطابق؛ يجب ضبط المنحنيات قبل الخياطة');
  }
  if (Math.abs(finishedWaist - (input.waistCircumferenceCm + waistEase)) > 0.01) {
    errors.push('محيط الخصر النهائي لا يطابق القياسات والراحة');
  }
  if (Math.abs(finishedHip - (input.hipCircumferenceCm + hipEase)) > 0.01) {
    errors.push('محيط الورك النهائي لا يطابق القياسات والراحة');
  }
  if (Math.abs(front.sideSeam - back.sideSeam) <= 0.05) {
    warnings.push('التحقق الهندسي يغطي تطابق طول الجنب والحسابات المحيطية فقط؛ يلزم اختبار عينة وملاءمة على الجسم قبل اعتماد الباترون للإنتاج.');
  }

  return {
    pieces: [front.piece, back.piece],
    summaries: [front.summary, back.summary],
    validation: {
      valid: errors.length === 0,
      errors, warnings,
      measurements: {
        finishedWaistCm: round(finishedWaist),
        finishedHipCm: round(finishedHip),
        frontSideSeamCm: round(front.sideSeam),
        backSideSeamCm: round(back.sideSeam),
        sideSeamDifferenceCm: round(sideDifference)
      }
    }
  };
}
