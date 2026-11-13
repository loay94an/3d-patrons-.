/**
 * Shared contract for the optional server-side pattern guidance workflow.
 *
 * The browser only sends the pattern numbers it already computed; the Respan
 * gateway call and its API key stay in `server/index.ts`.
 */

export const PATTERN_GUIDANCE_PATH = '/api/pattern-guidance';

export interface PatternGuidanceMeasure {
  label: string;
  value: number;
}

export interface PatternGuidanceRequest {
  garment: string;
  gender: string;
  school: string;
  fabric: string;
  size: string;
  unit: 'cm' | 'in';
  measurements: PatternGuidanceMeasure[];
  patternValues: PatternGuidanceMeasure[];
  seam: PatternGuidanceMeasure[];
}

export interface PatternGuidanceSuccess {
  guidance: string;
  model: string;
}

export interface PatternGuidanceFailure {
  error: string;
  message: string;
}

const MAX_MEASURES = 60;
const MAX_LABEL_LENGTH = 80;
const MAX_TEXT_LENGTH = 120;

export const PATTERN_GUIDANCE_SYSTEM_INSTRUCTION = [
  'أنت مساعد هندسة باترونات وخياطة داخل استوديو باترونات عربي.',
  'اعتمد فقط على الأرقام الواردة في الطلب، ولا تخترع قياسات أو قيماً غير موجودة.',
  'لا تدّعِ ضمان ملاءمة نهائي؛ هذه ملاحظات تنفيذ أولية تحتاج فحص عينة.',
  'أعد من 4 إلى 6 نقاط عملية قصيرة بالعربية الفصحى، كل نقطة في سطر مستقل يبدأ بـ "-".',
].join(' ');

function formatMeasure(measure: PatternGuidanceMeasure): string {
  return `- ${measure.label}: ${Math.round(measure.value * 10) / 10}`;
}

export function buildPatternGuidancePrompt(request: PatternGuidanceRequest): string {
  const unit = request.unit === 'in' ? 'إنش' : 'سم';
  const section = (title: string, measures: PatternGuidanceMeasure[]) =>
    measures.length ? [`${title}:`, ...measures.map(formatMeasure)].join('\n') : '';

  return [
    `الموديل: ${request.garment} | الفئة: ${request.gender} | المدرسة: ${request.school} | القماش: ${request.fabric} | المقاس: ${request.size}`,
    `وحدة القياس: ${unit}`,
    section('القياسات التفصيلية', request.measurements),
    section('قيم الباترون المحسوبة', request.patternValues),
    section('بدلات الخياطة', request.seam),
    'اكتب ملاحظات تنفيذ لهذا الباترون.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function isMeasure(value: unknown): value is PatternGuidanceMeasure {
  if (!value || typeof value !== 'object') return false;
  const measure = value as PatternGuidanceMeasure;
  return (
    typeof measure.label === 'string' &&
    measure.label.length > 0 &&
    measure.label.length <= MAX_LABEL_LENGTH &&
    typeof measure.value === 'number' &&
    Number.isFinite(measure.value)
  );
}

function readText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TEXT_LENGTH
    ? value.trim()
    : fallback;
}

/**
 * Validates an untrusted request body. Returns null when the payload does not
 * match the shared contract, so the server can answer with a clear error.
 */
export function parsePatternGuidanceRequest(input: unknown): PatternGuidanceRequest | null {
  if (!input || typeof input !== 'object') return null;
  const body = input as Partial<PatternGuidanceRequest>;
  const measurements = Array.isArray(body.measurements) ? body.measurements : [];
  const patternValues = Array.isArray(body.patternValues) ? body.patternValues : [];
  const seam = Array.isArray(body.seam) ? body.seam : [];

  if (!measurements.length && !patternValues.length) return null;
  if (measurements.length > MAX_MEASURES || patternValues.length > MAX_MEASURES || seam.length > MAX_MEASURES) {
    return null;
  }
  if (![...measurements, ...patternValues, ...seam].every(isMeasure)) return null;

  return {
    garment: readText(body.garment, 'قطعة غير محددة'),
    gender: readText(body.gender, 'غير محدد'),
    school: readText(body.school, 'غير محددة'),
    fabric: readText(body.fabric, 'غير محدد'),
    size: readText(body.size, '—'),
    unit: body.unit === 'in' ? 'in' : 'cm',
    measurements,
    patternValues,
    seam,
  };
}
