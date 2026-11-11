import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calibrateGarmentImageScale,
  measureGarmentLandmarkDistanceCm
} from './garment-image-scale-calibration';
import {
  GARMENT_VISION_SCHEMA_VERSION,
  type GarmentVisionResult
} from './garment-vision';

const result: GarmentVisionResult = {
  schemaVersion: GARMENT_VISION_SCHEMA_VERSION,
  category: 'blouse',
  boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  mask: null,
  landmarks: [
    { name: 'shoulder_left', point: { x: 0.1, y: 0.1 }, visibility: 'visible', confidence: null },
    { name: 'shoulder_right', point: { x: 0.3, y: 0.1 }, visibility: 'visible', confidence: null },
    { name: 'waist_left', point: { x: 0.1, y: 0.2 }, visibility: 'visible', confidence: null },
    { name: 'hem_left', point: null, visibility: 'occluded', confidence: null }
  ],
  confidence: 1,
  image: {
    originalWidth: 1000,
    originalHeight: 2000,
    processedWidth: 1000,
    processedHeight: 2000,
    model: 'manual-annotation',
    modelVersion: '1',
    landmarkSchema: 'canonical-v1'
  }
};

test('calibrates scale using the true image aspect ratio', () => {
  const calibrated = calibrateGarmentImageScale(result, {
    landmarkA: 'shoulder_left',
    landmarkB: 'shoulder_right',
    distanceCm: 10
  });
  assert.deepEqual(calibrated.issues, []);
  assert.equal(calibrated.value?.pixelsPerCm, 20);
  const vertical = measureGarmentLandmarkDistanceCm(result, calibrated.value!, 'shoulder_left', 'waist_left');
  assert.deepEqual(vertical.issues, []);
  assert.equal(vertical.value, 10);
});

test('rejects non-positive physical reference distances', () => {
  const calibrated = calibrateGarmentImageScale(result, {
    landmarkA: 'shoulder_left',
    landmarkB: 'shoulder_right',
    distanceCm: 0
  });
  assert.equal(calibrated.value, null);
  assert.ok(calibrated.issues.some(issue => issue.path === 'distanceCm'));
});

test('rejects missing or occluded reference landmarks', () => {
  const calibrated = calibrateGarmentImageScale(result, {
    landmarkA: 'shoulder_left',
    landmarkB: 'hem_left',
    distanceCm: 10
  });
  assert.equal(calibrated.value, null);
  assert.ok(calibrated.issues.some(issue => issue.path === 'landmarkB'));
});

test('rejects calibration reused with different image dimensions', () => {
  const calibrated = calibrateGarmentImageScale(result, {
    landmarkA: 'shoulder_left',
    landmarkB: 'shoulder_right',
    distanceCm: 10
  });
  const changed = structuredClone(result);
  changed.image.processedWidth = 500;
  const measured = measureGarmentLandmarkDistanceCm(changed, calibrated.value!, 'shoulder_left', 'waist_left');
  assert.equal(measured.value, null);
  assert.ok(measured.issues.some(issue => issue.path === 'calibration'));
});

test('rejects identical or unknown landmark names', () => {
  const calibrated = calibrateGarmentImageScale(result, {
    landmarkA: 'shoulder_left',
    landmarkB: 'shoulder_left',
    distanceCm: 10
  });
  assert.equal(calibrated.value, null);
  assert.ok(calibrated.issues.some(issue => issue.path === 'referenceLandmarks'));
});
