import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GARMENT_VISION_SCHEMA_VERSION,
  transformPointToOriginal,
  transformPointToProcessed,
  validateGarmentVisionResult,
  type GarmentVisionResult,
  type ImageCoordinateTransform
} from './garment-vision';

const validResult: GarmentVisionResult = {
  schemaVersion: GARMENT_VISION_SCHEMA_VERSION,
  category: 'blouse',
  boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  mask: null,
  landmarks: [
    { name: 'shoulder_left', point: { x: 0.2, y: 0.3 },
      visibility: 'visible', confidence: 0.98 },
    { name: 'cuff_left', point: null, visibility: 'occluded', confidence: null }
  ],
  confidence: 0.95,
  image: {
    originalWidth: 1200,
    originalHeight: 1600,
    processedWidth: 640,
    processedHeight: 640,
    model: 'manual-review',
    modelVersion: 'none',
    landmarkSchema: 'canonical-v1'
  }
};

test('coordinate transform round-trips resize and crop offsets', () => {
  const transform: ImageCoordinateTransform = {
    scaleX: 0.8, scaleY: 0.8, offsetX: -0.12, offsetY: -0.05,
    flipX: false, flipY: false
  };
  const original = { x: 0.4, y: 0.6 };
  const processed = transformPointToProcessed(original, transform);
  const restored = transformPointToOriginal(processed, transform);
  assert.ok(Math.abs(restored.x - original.x) < 1e-12);
  assert.ok(Math.abs(restored.y - original.y) < 1e-12);
});

test('coordinate transform round-trips horizontal and vertical flips', () => {
  const transform: ImageCoordinateTransform = {
    scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0,
    flipX: true, flipY: true
  };
  const original = { x: 0.17, y: 0.82 };
  const processed = transformPointToProcessed(original, transform);
  assert.deepEqual(processed, { x: 0.83, y: 0.18000000000000005 });
  const restored = transformPointToOriginal(processed, transform);
  assert.ok(Math.abs(restored.x - original.x) < 1e-12);
  assert.ok(Math.abs(restored.y - original.y) < 1e-12);
});

test('rejects non-finite and out-of-range source points', () => {
  const transform = {
    scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, flipX: false, flipY: false
  };
  assert.throws(() => transformPointToProcessed({ x: Number.NaN, y: 0.5 }, transform));
  assert.throws(() => transformPointToProcessed({ x: 1.2, y: 0.5 }, transform));
});

test('validates a well-formed vision result and accepts hidden landmarks', () => {
  assert.deepEqual(validateGarmentVisionResult(validResult), []);
});

test('reports unknown schema, invalid box, duplicate names and invalid confidence', () => {
  const invalid = structuredClone(validResult);
  invalid.schemaVersion = 2 as 1;
  invalid.boundingBox.width = 1.2;
  invalid.landmarks.push({
    name: 'shoulder_left', point: { x: 0.2, y: 0.2 },
    visibility: 'visible', confidence: 1.5
  });
  const issues = validateGarmentVisionResult(invalid);
  assert.ok(issues.some(issue => issue.path === 'schemaVersion'));
  assert.ok(issues.some(issue => issue.path === 'boundingBox'));
  assert.ok(issues.some(issue => issue.path.endsWith('.name')));
  assert.ok(issues.some(issue => issue.path.endsWith('.confidence')));
});

test('rejects unknown category and malformed polygon masks', () => {
  const invalid = structuredClone(validResult) as GarmentVisionResult;
  invalid.category = 'coat' as GarmentVisionResult['category'];
  invalid.mask = {
    width: 100, height: 100, encoding: 'polygon',
    polygons: [[{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }]]
  };
  const issues = validateGarmentVisionResult(invalid);
  assert.ok(issues.some(issue => issue.path === 'category'));
  assert.ok(issues.some(issue => issue.path === 'mask.polygons[0]'));
});
