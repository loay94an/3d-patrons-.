import assert from 'node:assert/strict';
import test from 'node:test';
import { calibrateGarmentImageScale } from './garment-image-scale-calibration';
import { buildPatternMeasurementBridge } from './pattern-measurement-bridge';
import {
  GARMENT_VISION_SCHEMA_VERSION,
  type GarmentVisionResult
} from './garment-vision';

const vision: GarmentVisionResult = {
  schemaVersion: GARMENT_VISION_SCHEMA_VERSION,
  category: 'blouse',
  boundingBox: { x: 0, y: 0, width: 1, height: 1 },
  mask: null,
  landmarks: [
    { name: 'shoulder_left', point: { x: 0.1, y: 0.1 }, visibility: 'visible', confidence: 1 },
    { name: 'shoulder_right', point: { x: 0.3, y: 0.1 }, visibility: 'visible', confidence: 1 },
    { name: 'waist_left', point: { x: 0.1, y: 0.3 }, visibility: 'visible', confidence: 1 },
    { name: 'waist_right', point: { x: 0.3, y: 0.3 }, visibility: 'visible', confidence: 1 },
    { name: 'hem_left', point: null, visibility: 'occluded', confidence: null }
  ],
  confidence: 1,
  image: {
    originalWidth: 1000, originalHeight: 1000,
    processedWidth: 1000, processedHeight: 1000,
    model: 'manual-annotation', modelVersion: '1', landmarkSchema: 'canonical-v1'
  }
};

const calibration = calibrateGarmentImageScale(vision, {
  landmarkA: 'shoulder_left', landmarkB: 'shoulder_right', distanceCm: 10
}).value!;

test('maps only explicitly reviewed linear measurements to CAD fields', () => {
  const result = buildPatternMeasurementBridge(vision, calibration, [
    { field: 'shoulderLength', landmarkA: 'shoulder_left', landmarkB: 'shoulder_right', reviewed: true },
    { field: 'backLength', landmarkA: 'shoulder_left', landmarkB: 'waist_left', reviewed: true }
  ]);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.values, { shoulderLength: 10, backLength: 10 });
  assert.equal(result.evidence.length, 2);
  assert.equal(result.readyForReview, true);
});

test('does not apply an unreviewed measurement', () => {
  const result = buildPatternMeasurementBridge(vision, calibration, [
    { field: 'shoulderLength', landmarkA: 'shoulder_left', landmarkB: 'shoulder_right', reviewed: false }
  ]);
  assert.deepEqual(result.values, {});
  assert.equal(result.readyForReview, false);
  assert.ok(result.issues.some(issue => issue.path.endsWith('.reviewed')));
});

test('does not infer missing or occluded landmarks', () => {
  const result = buildPatternMeasurementBridge(vision, calibration, [
    { field: 'backLength', landmarkA: 'shoulder_left', landmarkB: 'hem_left', reviewed: true }
  ]);
  assert.deepEqual(result.values, {});
  assert.ok(result.issues.some(issue => issue.field === 'backLength'));
});

test('rejects duplicate target fields rather than silently overwriting', () => {
  const result = buildPatternMeasurementBridge(vision, calibration, [
    { field: 'shoulderLength', landmarkA: 'shoulder_left', landmarkB: 'shoulder_right', reviewed: true },
    { field: 'shoulderLength', landmarkA: 'waist_left', landmarkB: 'waist_right', reviewed: true }
  ]);
  assert.equal(result.evidence.length, 1);
  assert.ok(result.issues.some(issue => issue.message.includes('only once')));
  assert.equal(result.readyForReview, false);
});

test('does not accept circumference fields as image-plane segment measurements', () => {
  const invalid = buildPatternMeasurementBridge(vision, calibration, [
    { field: 'bustCircumference', landmarkA: 'shoulder_left', landmarkB: 'shoulder_right', reviewed: true }
  ] as never);
  assert.deepEqual(invalid.values, {});
  assert.ok(invalid.issues.length > 0);
});

test('requires at least one measurement row', () => {
  const result = buildPatternMeasurementBridge(vision, calibration, []);
  assert.equal(result.readyForReview, false);
  assert.ok(result.issues.some(issue => issue.path === 'measurements'));
});
