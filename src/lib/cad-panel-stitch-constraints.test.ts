import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCadPanelStitchConstraints } from './cad-panel-stitch-constraints';
import type { CadPanelGeometry } from './cad-panel-geometry';
import type { CadStitchPair } from './cad-sewing-engine';

function panel(pieceId: string, segmentId: string): CadPanelGeometry {
  return {
    pieceId, name: pieceId, garmentType: 'bodice', unit: 'cm',
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }],
    triangleIndices: [0, 1, 2, 0, 2, 3],
    boundaryEdges: [{
      pieceId, segmentId, reversedFromSource: false, lengthCm: 10,
      vertexIndices: [0, 1]
    }],
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 5 },
    areaCm2: 50, seamAllowanceCm: 1, triangulation: 'three-earcut'
  };
}

const pair: CadStitchPair = {
  id: 'shoulder-seam',
  first: { pieceId: 'front', segmentId: 'front-shoulder' },
  second: { pieceId: 'back', segmentId: 'back-shoulder' },
  mode: 'plain'
};

describe('CAD panel stitch constraint adapter', () => {
  it('creates weighted samples and reverses the second edge direction', () => {
    const result = buildCadPanelStitchConstraints([
      panel('front', 'front-shoulder'), panel('back', 'back-shoulder')
    ], [pair]);
    assert.equal(result.length, 1);
    assert.equal(result[0].restLengthCm, 0);
    assert.equal(result[0].samples.length, 8);
    assert.equal(result[0].samples[0].first[0].vertexIndex, 0);
    assert.equal(result[0].samples[0].second[1].vertexIndex, 1);
    assert.equal(result[0].samples[0].second[1].weight, 1);
    assert.equal(result[0].samples.at(-1)?.second[0].vertexIndex, 0);
    assert.equal(result[0].samples.at(-1)?.second[0].weight, 1);
  });

  it('preserves explicitly selected ease metadata', () => {
    const eased = { ...pair, mode: 'ease' as const, expectedEaseCm: 1.25 };
    const result = buildCadPanelStitchConstraints([
      panel('front', 'front-shoulder'), panel('back', 'back-shoulder')
    ], [eased]);
    assert.equal(result[0].expectedEaseCm, 1.25);
    assert.equal(result[0].mode, 'ease');
  });

  it('rejects missing panels, missing edges, and duplicate edge use', () => {
    assert.throws(() => buildCadPanelStitchConstraints([panel('front', 'front-shoulder')], [pair]));
    assert.throws(() => buildCadPanelStitchConstraints([
      panel('front', 'front-shoulder'), panel('back', 'other-edge')
    ], [pair]));
    const duplicate = { ...pair, id: 'duplicate', first: { ...pair.first } };
    assert.throws(() => buildCadPanelStitchConstraints([
      panel('front', 'front-shoulder'), panel('back', 'back-shoulder')
    ], [pair, duplicate]));
  });

  it('rejects invalid options and malformed vertex indices', () => {
    assert.throws(() => buildCadPanelStitchConstraints([], [], { sampleSpacingCm: 0 }));
    const malformed = panel('front', 'front-shoulder');
    malformed.boundaryEdges[0].vertexIndices = [0, 99];
    assert.throws(() => buildCadPanelStitchConstraints([
      malformed, panel('back', 'back-shoulder')
    ], [pair]));
  });
});
