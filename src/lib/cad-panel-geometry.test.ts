import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCadPanelGeometry } from './cad-panel-geometry';
import type { CadPiece, CadSegment } from './pattern-cad-engine';

function segment(
  id: string,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  extra: Partial<CadSegment> = {}
): CadSegment {
  return {
    id, type: 'line', p1, p2, layer: 'cutting',
    edgeType: 'side',
    lengthCm: Math.hypot(p2.x - p1.x, p2.y - p1.y),
    ...extra
  };
}

function piece(segments: CadSegment[]): CadPiece {
  return {
    id: 'panel-1', name: 'Front panel', nameAr: 'الأمام',
    garmentType: 'bodice', segments,
    notches: [], grainlines: [], seamAllowanceCm: 1.5, notes: ''
  };
}

describe('CAD panel mesh geometry', () => {
  it('orders shuffled and reversed cutting edges into one closed indexed panel', () => {
    const panel = buildCadPanelGeometry(piece([
      segment('right', { x: 10, y: 0 }, { x: 10, y: 5 }),
      segment('top', { x: 0, y: 5 }, { x: 10, y: 5 }),
      segment('left', { x: 0, y: 5 }, { x: 0, y: 0 }),
      segment('bottom', { x: 10, y: 0 }, { x: 0, y: 0 })
    ]));

    assert.equal(panel.unit, 'cm');
    assert.equal(panel.vertices.length, 4);
    assert.equal(panel.triangleIndices.length, 6);
    assert.ok(Math.abs(panel.areaCm2 - 50) < 1e-8);
    assert.equal(panel.boundaryEdges.length, 4);
    assert.ok(panel.boundaryEdges.find(edge => edge.segmentId === 'top')?.reversedFromSource);
    assert.ok(panel.boundaryEdges.find(edge => edge.segmentId === 'bottom')?.reversedFromSource);
    assert.ok(panel.boundaryEdges.every(edge => edge.vertexIndices.length === 2));
    assert.deepEqual(panel.bounds, { minX: 0, minY: 0, maxX: 10, maxY: 5 });
    assert.equal(panel.seamAllowanceCm, 1.5);
  });

  it('samples quadratic and cubic cutting curves and maps each boundary back to its CAD edge', () => {
    const panel = buildCadPanelGeometry(piece([
      segment('bottom', { x: 0, y: 0 }, { x: 10, y: 0 }),
      segment('right', { x: 10, y: 0 }, { x: 10, y: 10 }),
      segment('top-curve', { x: 10, y: 10 }, { x: 5, y: 13 }, {
        type: 'quad', cp1: { x: 7, y: 15 }
      }),
      segment('top-right', { x: 5, y: 13 }, { x: 0, y: 10 }, {
        type: 'bezier', cp1: { x: 3, y: 14 }, cp2: { x: 1, y: 12 }
      }),
      segment('left', { x: 0, y: 10 }, { x: 0, y: 0 })
    ]));
    const quad = panel.boundaryEdges.find(edge => edge.segmentId === 'top-curve')!;
    const cubic = panel.boundaryEdges.find(edge => edge.segmentId === 'top-right')!;
    assert.ok(quad.vertexIndices.length >= 9);
    assert.ok(cubic.vertexIndices.length >= 9);
    assert.ok(quad.lengthCm > 0 && cubic.lengthCm > 0);
    assert.ok(panel.triangleIndices.length >= (panel.vertices.length - 2) * 3);
    assert.ok(panel.vertices.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  });

  it('rejects open, disconnected, branching and self-intersecting cutting contours', () => {
    assert.throws(() => buildCadPanelGeometry(piece([
      segment('a', { x: 0, y: 0 }, { x: 10, y: 0 }),
      segment('b', { x: 10, y: 0 }, { x: 10, y: 10 }),
      segment('c', { x: 10, y: 10 }, { x: 0, y: 10 })
    ])), /مغلق/);

    assert.throws(() => buildCadPanelGeometry(piece([
      segment('a', { x: 0, y: 0 }, { x: 10, y: 0 }),
      segment('b', { x: 20, y: 0 }, { x: 20, y: 10 }),
      segment('c', { x: 20, y: 10 }, { x: 0, y: 10 }),
      segment('d', { x: 0, y: 10 }, { x: 0, y: 0 })
    ])), /غير متصل|ملتبسة/);

    assert.throws(() => buildCadPanelGeometry(piece([
      segment('a', { x: 0, y: 0 }, { x: 10, y: 10 }),
      segment('b', { x: 10, y: 10 }, { x: 0, y: 10 }),
      segment('c', { x: 0, y: 10 }, { x: 10, y: 0 }),
      segment('d', { x: 10, y: 0 }, { x: 0, y: 0 })
    ])), /تتقاطع/);
  });

  it('does not include stitch annotations in the cut contour and rejects malformed options', () => {
    const panel = piece([
      segment('a', { x: 0, y: 0 }, { x: 10, y: 0 }),
      segment('b', { x: 10, y: 0 }, { x: 10, y: 10 }),
      segment('c', { x: 10, y: 10 }, { x: 0, y: 10 }),
      segment('d', { x: 0, y: 10 }, { x: 0, y: 0 }),
      segment('dart', { x: 3, y: 6 }, { x: 5, y: 4 }, { layer: 'stitch' })
    ]);
    assert.equal(buildCadPanelGeometry(panel).boundaryEdges.length, 4);
    assert.throws(() => buildCadPanelGeometry(panel, { endpointToleranceCm: 0 }));
    assert.throws(() => buildCadPanelGeometry(panel, { maxCurveSamples: 300 }));
  });
});
