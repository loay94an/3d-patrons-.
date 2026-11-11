import type { EaseProfile } from './ktr-bridge';

export type StudioMeasurementValues = {
  bust: number;
  waist: number;
  hip: number;
  backLength: number;
  sleeveLength: number;
  upperArm: number;
};

export type MeasurementSource = 'manual' | 'standard-size' | 'imported';

export interface MeasurementProfile {
  schemaVersion: 1;
  unit: 'cm';
  source: MeasurementSource;
  values: StudioMeasurementValues;
}

export const STUDIO_MEASUREMENT_FIELDS: {
  key: keyof StudioMeasurementValues;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: 'bust', label: 'محيط الصدر', min: 60, max: 160 },
  { key: 'waist', label: 'محيط الخصر', min: 45, max: 150 },
  { key: 'hip', label: 'محيط الورك', min: 65, max: 175 },
  { key: 'backLength', label: 'طول الظهر', min: 25, max: 60 },
  { key: 'sleeveLength', label: 'طول الكم', min: 20, max: 85 },
  { key: 'upperArm', label: 'محيط أعلى الذراع', min: 18, max: 65 }
];

const EASE_MIN = -3;
const EASE_MAX = 12;

export interface ProfileValidationIssue {
  field: string;
  label: string;
  message: string;
}

export interface StudioProfileValidation {
  errors: ProfileValidationIssue[];
}

export function validateStudioProfile(
  values: StudioMeasurementValues,
  ease: EaseProfile
): StudioProfileValidation {
  const errors: ProfileValidationIssue[] = [];

  for (const field of STUDIO_MEASUREMENT_FIELDS) {
    const value = values[field.key];
    if (!Number.isFinite(value)) {
      errors.push({ field: field.key, label: field.label, message: 'أدخل قيمة رقمية صالحة.' });
    } else if (value < field.min || value > field.max) {
      errors.push({
        field: field.key,
        label: field.label,
        message: 'يجب أن تكون القيمة بين ' + field.min + ' و' + field.max + ' سم.'
      });
    }
  }

  for (const key of Object.keys(ease) as Array<keyof EaseProfile>) {
    const value = ease[key];
    if (!Number.isFinite(value)) {
      errors.push({ field: 'ease.' + key, label: 'راحة ' + key, message: 'أدخل قيمة رقمية صالحة.' });
    } else if (value < EASE_MIN || value > EASE_MAX) {
      errors.push({
        field: 'ease.' + key,
        label: 'راحة ' + key,
        message: 'يجب أن تكون القيمة بين ' + EASE_MIN + ' و' + EASE_MAX + ' سم.'
      });
    }
  }

  return { errors };
}

export function createMeasurementProfile(
  values: StudioMeasurementValues,
  source: MeasurementSource = 'manual'
): MeasurementProfile {
  return {
    schemaVersion: 1,
    unit: 'cm',
    source,
    values: {
      bust: roundToTenth(values.bust),
      waist: roundToTenth(values.waist),
      hip: roundToTenth(values.hip),
      backLength: roundToTenth(values.backLength),
      sleeveLength: roundToTenth(values.sleeveLength),
      upperArm: roundToTenth(values.upperArm)
    }
  };
}

export function convertLength(value: number, from: 'cm' | 'in', to: 'cm' | 'in'): number {
  if (!Number.isFinite(value)) return Number.NaN;
  if (from === to) return value;
  return roundToHundredth(from === 'in' ? value * 2.54 : value / 2.54);
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}
