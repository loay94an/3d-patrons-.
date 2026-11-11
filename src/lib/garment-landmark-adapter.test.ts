import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptGarmentLandmarks } from './garment-landmark-adapter';

const base = {
  sourceSchema: 'example-v1',
  knownSourceSchemas: ['example-v1'],
  category: 'blouse' as const,
  processedWidth: 200,
  processedHeight: 100,
  coordinateSpace: 'pixel' as const,
  keypoints: [
    { x: 20, y: 10, visibility: 'visible' as const, confidence: 0.9 },
    { x: 180, y: 90, visibility: 'occluded' as const }
  ],
  keypointMap: { shoulder_left: 0, shoulder_right: 1 },
  confidence: 0.75
};

test('uses an explicit source index map and normalizes pixel coordinates', () => {
  const result = adaptGarmentLandmarks(base);
  const left = result.landmarks.find(point => point.name === 'shoulder_left');
  const right = result.landmarks.find(point => point.name === 'shoulder_right');
  assert.deepEqual(left?.point, { x: 0.1, y: 0.1 });
  assert.equal(left?.confidence, 0.9);
  assert.deepEqual(right?.point, { x: 0.9, y: 0.9 });
  assert.equal(right?.visibility, 'occluded');
  assert.ok(result.issues.length > 0); // unmapped canonical landmarks are explicit
});

test('supports exact source keys and normalized coordinates without rescaling', () => {
  const result = adaptGarmentLandmarks({
    ...base,
    coordinateSpace: 'normalized',
    keypoints: [{ key: 'left-shoulder', x: 0.25, y: 0.4, visibility: 'visible' }],
    keypointMap: { shoulder_left: 'left-shoulder' }
  });
  assert.deepEqual(result.landmarks[2].point, { x: 0.25, y: 0.4 });
});

test('keeps missing and invisible landmarks null', () => {
  const result = adaptGarmentLandmarks({
    ...base,
    keypoints: [{ x: 20, y: 10, visibility: 'not_present' }],
    keypointMap: { shoulder_left: 0, shoulder_right: 1 }
  });
  assert.equal(result.landmarks[2].point, null);
  assert.equal(result.landmarks[2].visibility, 'not_present');
  assert.ok(result.issues.some(issue => issue.message.includes('missing')));
});

test('rejects unknown schemas and numeric visibility without a mapping', () => {
  const result = adaptGarmentLandmarks({
    ...base,
    sourceSchema: 'unregistered-dataset',
    keypoints: [{ x: 20, y: 10, visibility: 2 }],
    keypointMap: { shoulder_left: 0 }
  });
  assert.ok(result.issues.some(issue => issue.path === 'sourceSchema'));
  assert.ok(result.issues.some(issue => issue.path.endsWith('.visibility')));
});

test('rejects out-of-range coordinates and invalid confidence', () => {
  const result = adaptGarmentLandmarks({
    ...base,
    keypoints: [{ x: 250, y: 10, visibility: 'visible', confidence: 2 }],
    keypointMap: { shoulder_left: 0 }
  });
  assert.equal(result.landmarks[2].point, null);
  assert.ok(result.issues.some(issue => issue.message.includes('outside normalized')));
  assert.ok(result.issues.some(issue => issue.path.endsWith('.confidence')));
});

test('rejects invalid dimensions and does not guess source ordering', () => {
  const result = adaptGarmentLandmarks({
    ...base,
    processedWidth: 0,
    keypoints: [{ x: 10, y: 10 }],
    keypointMap: {}
  });
  assert.ok(result.issues.some(issue => issue.path === 'image'));
  assert.ok(result.issues.some(issue => issue.path === 'keypointMap.shoulder_left'));
});
