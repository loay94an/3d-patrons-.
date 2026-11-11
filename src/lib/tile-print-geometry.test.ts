import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCadPieceContourPoints } from './tile-print-geometry';
import type { CadPiece, CadSegment } from './pattern-cad-engine';

const segment = (id: string, p1: [number, number], p2: [number, number], extra: Partial<CadSegment> = {}): CadSegment => ({
  id, type: 'line', p1: { x: p1[0], y: p1[1] }, p2: { x: p2[0], y: p2[1] },
  layer: 'cutting', lengthCm: 1, ...extra
});
const piece = (segments: CadSegment[]): CadPiece => ({
  id: 'piece-1', name: 'Test', nameAr: 'قطعة اختبار', garmentType: 'custom',
  segments, notches: [], grainlines: [], seamAllowanceCm: 1, notes: ''
});

describe('CAD tiled-print contour geometry', () => {
  it('orders shuffled and reversed edges into a closed contour', () => {
    const result = getCadPieceContourPoints(piece([
      segment('top', [0, 0], [10, 0]),
      segment('right', [10, 10], [10, 0]),
      segment('bottom', [10, 10], [0, 10]),
      segment('left', [0, 10], [0, 0])
    ]));
    assert.ok(result);
    assert.deepEqual(result[0], result[result.length - 1]);
    assert.equal(result.length, 5);
  });

  it('samples quadratic curves into printable points', () => {
    const result = getCadPieceContourPoints(piece([
      segment('curve', [0, 0], [10, 0], { type: 'quad', cp1: { x: 5, y: 5 } }),
      segment('right', [10, 0], [10, 10]),
      segment('bottom', [10, 10], [0, 10]),
      segment('left', [0, 10], [0, 0])
    ]), 8);
    assert.ok(result);
    assert.equal(result.length, 12);
    assert.deepEqual(result[0], result[result.length - 1]);
  });

  it('rejects open or disconnected cutting paths', () => {
    assert.equal(getCadPieceContourPoints(piece([
      segment('a', [0, 0], [10, 0]), segment('b', [10, 0], [10, 10]),
      segment('c', [20, 20], [0, 0])
    ])), null);
  });

  it('ignores non-cutting annotation segments', () => {
    const result = getCadPieceContourPoints(piece([
      segment('top', [0, 0], [10, 0]), segment('right', [10, 0], [10, 10]),
      segment('bottom', [10, 10], [0, 10]), segment('left', [0, 10], [0, 0]),
      segment('guide', [2, 2], [8, 2], { layer: 'guideline' })
    ]));
    assert.ok(result);
    assert.equal(result.length, 5);
  });
});
