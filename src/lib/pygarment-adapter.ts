import type {
  CadGrainline, CadNotch, CadPiece, CadPoint, CadSegment, PieceSpecSummary
} from './pattern-cad-engine';

export interface AdaptedPyGarmentPattern {
  patternName: string;
  engineVersion: string;
  pieces: CadPiece[];
  summaries: PieceSpecSummary[];
  warnings: string[];
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

function point(value: unknown, label: string): CadPoint {
  if (!isRecord(value) || !finite(value.x) || !finite(value.y)) {
    throw new Error(`إحداثيات غير صالحة في ${label}`);
  }
  return { x: value.x, y: value.y };
}

function parseSegment(value: unknown, pieceId: string): CadSegment {
  if (!isRecord(value)) throw new Error(`ضلع غير صالح في القطعة ${pieceId}`);
  const id = text(value.id);
  const type = value.type;
  const layer = value.layer;
  const edgeTypes = ['neckline', 'shoulder', 'armhole', 'side', 'waist', 'hem', 'crotch', 'inseam', 'center', 'general'];
  const layers = ['cutting', 'stitch', 'seam', 'notches', 'notes', 'dimensions', 'guideline'];
  if (!id || !['line', 'quad', 'bezier'].includes(String(type))) {
    throw new Error(`تعريف الضلع غير مكتمل في القطعة ${pieceId}`);
  }
  if (!layers.includes(String(layer))) throw new Error(`طبقة غير مدعومة للضلع ${id}`);
  if (value.edgeType !== undefined && !edgeTypes.includes(String(value.edgeType))) {
    throw new Error(`نوع حافة غير مدعوم للضلع ${id}`);
  }
  const p1 = point(value.p1, id + '.p1');
  const p2 = point(value.p2, id + '.p2');
  const cp1 = value.cp1 === undefined ? undefined : point(value.cp1, id + '.cp1');
  const cp2 = value.cp2 === undefined ? undefined : point(value.cp2, id + '.cp2');
  if (type === 'quad' && !cp1) throw new Error(`نقطة التحكم مفقودة للضلع ${id}`);
  if (type === 'bezier' && (!cp1 || !cp2)) throw new Error(`نقاط التحكم مفقودة للضلع ${id}`);
  const straightLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const lengthCm = finite(value.lengthCm) ? value.lengthCm : straightLength;
  if (lengthCm <= 0) throw new Error(`طول غير صالح للضلع ${id}`);
  return {
    id, type: type as CadSegment['type'], p1, p2, cp1, cp2,
    layer: layer as CadSegment['layer'],
    edgeType: value.edgeType as CadSegment['edgeType'],
    label: text(value.label), lengthCm
  };
}

function parseNotch(value: unknown, pieceId: string): CadNotch {
  if (!isRecord(value) || !text(value.id) || !finite(value.angleDeg) || !finite(value.depthCm) || value.depthCm <= 0) {
    throw new Error(`علامة مطابقة غير صالحة في القطعة ${pieceId}`);
  }
  if (!['v_notch', 't_notch', 'slit'].includes(String(value.type))) {
    throw new Error(`نوع علامة غير مدعوم في القطعة ${pieceId}`);
  }
  return {
    id: text(value.id), point: point(value.point, pieceId + '.notch'),
    angleDeg: value.angleDeg, type: value.type as CadNotch['type'],
    depthCm: value.depthCm, label: text(value.label)
  };
}

function parseGrainline(value: unknown, pieceId: string): CadGrainline {
  if (!isRecord(value) || !text(value.id)) throw new Error(`خط نسيج غير صالح في القطعة ${pieceId}`);
  return {
    id: text(value.id), p1: point(value.p1, pieceId + '.grainline.p1'),
    p2: point(value.p2, pieceId + '.grainline.p2'),
    label: text(value.label, 'اتجاه النسيج')
  };
}

/** Converts the versioned PyGarment adapter JSON into the site's editable CAD model. */
export function adaptPyGarmentPattern(input: unknown): AdaptedPyGarmentPattern {
  if (!isRecord(input) || input.schemaVersion !== '1.0.0' || input.units !== 'cm' || !Array.isArray(input.pieces)) {
    throw new Error('ملف PyGarment غير مدعوم أو لا يستخدم مخطط 1.0.0 بالسنتيمتر');
  }
  if (isRecord(input.validation) && input.validation.valid === false) {
    throw new Error('رفض الاستيراد: ملف PyGarment يحمل نتيجة تحقق هندسي غير صالحة');
  }
  if (input.pieces.length === 0) throw new Error('لا يحتوي الملف على قطع باترون');
  const pieces: CadPiece[] = input.pieces.map((rawPiece, index) => {
    if (!isRecord(rawPiece)) throw new Error(`بيانات القطعة رقم ${index + 1} غير صالحة`);
    const id = text(rawPiece.id);
    if (!id || !Array.isArray(rawPiece.segments)) throw new Error(`القطعة رقم ${index + 1} تفتقد المعرف أو المسارات`);
    const garmentType = rawPiece.garmentType;
    if (!['bodice', 'shirt', 'dress', 'pants', 'sleeve', 'skirt', 'custom'].includes(String(garmentType))) {
      throw new Error(`نوع ملابس غير مدعوم في القطعة ${id}`);
    }
    const seamAllowanceCm = finite(rawPiece.seamAllowanceCm) ? rawPiece.seamAllowanceCm : 0;
    if (seamAllowanceCm < 0) throw new Error(`بدل خياطة غير صالح في القطعة ${id}`);
    const edgeSeamAllowances: Record<string, number> = {};
    if (isRecord(rawPiece.edgeSeamAllowances)) {
      for (const [edge, allowance] of Object.entries(rawPiece.edgeSeamAllowances)) {
        if (!finite(allowance) || allowance < 0) throw new Error(`بدل خياطة غير صالح للحافة ${edge}`);
        edgeSeamAllowances[edge] = allowance;
      }
    }
    const segments = rawPiece.segments.map(segment => parseSegment(segment, id));
    const cutting = segments.filter(segment => segment.layer === 'cutting');
    if (cutting.length < 3) throw new Error(`القطعة ${id} لا تحتوي محيط قص كافياً`);
    const notches = Array.isArray(rawPiece.notches) ? rawPiece.notches.map(notch => parseNotch(notch, id)) : [];
    const grainlines = Array.isArray(rawPiece.grainlines) ? rawPiece.grainlines.map(line => parseGrainline(line, id)) : [];
    return {
      id, name: text(rawPiece.name, id), nameAr: text(rawPiece.nameAr, text(rawPiece.name, id)),
      garmentType: garmentType as CadPiece['garmentType'], segments, notches, grainlines,
      seamAllowanceCm, edgeSeamAllowances,
      isMirrored: rawPiece.isMirrored === true, mirrorSynced: rawPiece.mirrorSynced === true,
      notes: text(rawPiece.notes), color: '#38bdf8'
    };
  });
  const summaries: PieceSpecSummary[] = pieces.map(piece => {
    const cutting = piece.segments.filter(segment => segment.layer === 'cutting');
    const points = cutting.flatMap(segment => [segment.p1, segment.p2]);
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      pieceId: piece.id, nameAr: piece.nameAr, nameEn: piece.name,
      lengthCm: Number((Math.max(...ys) - Math.min(...ys)).toFixed(2)),
      widthCm: Number((Math.max(...xs) - Math.min(...xs)).toFixed(2)),
      seamAllowanceCm: piece.seamAllowanceCm, notchesCount: piece.notches.length,
      notesAr: piece.notes
    };
  });
  const warnings = isRecord(input.validation) && Array.isArray(input.validation.warnings)
    ? input.validation.warnings.filter((warning): warning is string => typeof warning === 'string')
    : [];
  return {
    patternName: text(input.patternName, 'PyGarment Pattern'),
    engineVersion: isRecord(input.engine) ? text(input.engine.version, 'unknown') : 'unknown',
    pieces, summaries, warnings
  };
}
