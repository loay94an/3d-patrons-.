import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepareFashionPipeline, disposeFashionPipelineSession } from './fashion-pipeline';
import type { CadPiece } from './pattern-cad-engine';
import { DEFAULT_FABRIC_STATE } from './fabric-engine';

const squarePiece: CadPiece = {
  id: 'front-panel',
  name: 'Front panel',
  nameAr: 'القطعة الأمامية',
  garmentType: 'skirt',
  seamAllowanceCm: 1,
  segments: [
    { id: 'e1', type: 'line', p1: { x: 0, y: 0 }, p2: { x: 20, y: 0 }, layer: 'cutting', edgeType: 'waist', lengthCm: 20 },
    { id: 'e2', type: 'line', p1: { x: 20, y: 0 }, p2: { x: 20, y: 30 }, layer: 'cutting', edgeType: 'side', lengthCm: 30 },
    { id: 'e3', type: 'line', p1: { x: 20, y: 30 }, p2: { x: 0, y: 30 }, layer: 'cutting', edgeType: 'hem', lengthCm: 20 },
    { id: 'e4', type: 'line', p1: { x: 0, y: 30 }, p2: { x: 0, y: 0 }, layer: 'cutting', edgeType: 'side', lengthCm: 30 }
  ],
  notches: [],
  grainlines: [],
  notes: 'Test panel'
};

describe('unified fashion pipeline', () => {
  it('prepares the parametric body, CAD panel and fabric through one session', () => {
    const session = prepareFashionPipeline({
      body: {
        gender: 'women',
        size: 38,
        measurements: { bust: 88, waist: 70, hip: 94, shoulder: 12, backLength: 40, height: 168 }
      },
      pattern: { pieces: [squarePiece] },
      fabric: DEFAULT_FABRIC_STATE
    });

    assert.equal(session.schemaVersion, '1.0.0');
    assert.equal(session.readiness.body, true);
    assert.equal(session.readiness.pattern, true);
    assert.equal(session.readiness.fabric, true);
    assert.equal(session.readiness.threePreview, true);
    assert.equal(session.panels.length, 1);
    assert.equal(session.panels[0].pieceId, 'front-panel');
    assert.equal(session.fabric.id, DEFAULT_FABRIC_STATE.presetId);
    assert.equal(session.readiness.physicalClothSimulation, 'adapter-required');
    assert.equal(session.readiness.virtualTryOn, 'fit-analysis-required');
    disposeFashionPipelineSession(session);
  });

  it('reports invalid CAD pieces and unknown fabrics without hiding the failure', () => {
    const session = prepareFashionPipeline({
      body: { gender: 'women', size: 38, measurements: {} },
      pattern: { pieces: [{ ...squarePiece, segments: [] }] },
      fabric: { ...DEFAULT_FABRIC_STATE, presetId: 'missing-fabric' }
    });

    assert.equal(session.readiness.pattern, false);
    assert.equal(session.readiness.fabric, false);
    assert.equal(session.readiness.threePreview, false);
    assert.ok(session.issues.some(issue => issue.code === 'invalid-cad-piece'));
    assert.ok(session.issues.some(issue => issue.code === 'unknown-fabric'));
    disposeFashionPipelineSession(session);
  });
});
