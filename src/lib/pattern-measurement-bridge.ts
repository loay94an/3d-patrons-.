import type { PatternByNumbersInput } from './pattern-cad-engine';
import {
  measureGarmentLandmarkDistanceCm,
  type GarmentImageScaleCalibration,
  type GarmentScaleIssue
} from './garment-image-scale-calibration';
import type { GarmentVisionResult } from './garment-vision';

/**
 * Only direct linear dimensions are accepted here. Circumferences and
 * body girths must be measured independently; a flat garment width or a
 * single image-plane segment is not a body circumference.
 */
export type PatternLinearMeasurementField =
  | 'backLength'
  | 'frontLength'
  | 'shoulderLength'
  | 'neckDepthFront'
  | 'neckDepthBack'
  | 'sleeveLength'
  | 'crotchDepth'
  | 'rise';

export interface ReviewedPatternMeasurement {
  field: PatternLinearMeasurementField;
  landmarkA: string;
  landmarkB: string;
  /** Explicit human review is required before a value can enter the CAD input. */
  reviewed: boolean;
}

export interface PatternMeasurementEvidence {
  field: PatternLinearMeasurementField;
  valueCm: number;
  landmarkA: string;
  landmarkB: string;
  imageWidth: number;
  imageHeight: number;
  calibrationReferenceDistanceCm: number;
}

export interface PatternMeasurementBridgeIssue extends GarmentScaleIssue {
  field?: string;
}

export interface PatternMeasurementBridgeResult {
  /** Partial values only; never fills missing CAD inputs with guesses. */
  values: Partial<Pick<PatternByNumbersInput, PatternLinearMeasurementField>>;
  evidence: PatternMeasurementEvidence[];
  issues: PatternMeasurementBridgeIssue[];
  readyForReview: boolean;
}

/**
 * Converts explicitly reviewed, straight-line image measurements into
 * partial linear inputs for the existing CAD engine.
 *
 * The source is still a 2D image-plane measurement: it does not infer
 * circumferences, body dimensions, garment ease, fit, or sewing allowances.
 */
export function buildPatternMeasurementBridge(
  vision: GarmentVisionResult,
  calibration: GarmentImageScaleCalibration,
  measurements: readonly ReviewedPatternMeasurement[]
): PatternMeasurementBridgeResult {
  const values: PatternMeasurementBridgeResult['values'] = {};
  const evidence: PatternMeasurementEvidence[] = [];
  const issues: PatternMeasurementBridgeIssue[] = [];
  const seen = new Set<PatternLinearMeasurementField>();
  const allowedFields = new Set<PatternLinearMeasurementField>([
    'backLength', 'frontLength', 'shoulderLength', 'neckDepthFront',
    'neckDepthBack', 'sleeveLength', 'crotchDepth', 'rise'
  ]);

  if (measurements.length === 0) {
    return {
      values,
      evidence,
      issues: [{ path: 'measurements', message: 'Add at least one reviewed linear measurement' }],
      readyForReview: false
    };
  }

  for (const item of measurements) {
    if (!item || !item.field || !allowedFields.has(item.field)) {
      issues.push({ path: 'measurements.field', message: 'A supported CAD length field is required; circumferences are not derived from a 2D segment' });
      continue;
    }
    if (seen.has(item.field)) {
      issues.push({ path: 'measurements.' + item.field, field: item.field, message: 'Each CAD field can be mapped only once' });
      continue;
    }
    seen.add(item.field);

    if (item.reviewed !== true) {
      issues.push({ path: 'measurements.' + item.field + '.reviewed', field: item.field, message: 'Human review is required before applying this value' });
      continue;
    }

    const measured = measureGarmentLandmarkDistanceCm(
      vision,
      calibration,
      item.landmarkA,
      item.landmarkB
    );
    if (measured.value === null) {
      measured.issues.forEach(issue => issues.push({ ...issue, field: item.field }));
      continue;
    }

    values[item.field] = Math.round(measured.value * 10) / 10;
    evidence.push({
      field: item.field,
      valueCm: values[item.field]!,
      landmarkA: item.landmarkA,
      landmarkB: item.landmarkB,
      imageWidth: calibration.imageWidth,
      imageHeight: calibration.imageHeight,
      calibrationReferenceDistanceCm: calibration.referenceDistanceCm
    });
  }

  return {
    values,
    evidence,
    issues,
    readyForReview: evidence.length > 0 && issues.length === 0
  };
}
