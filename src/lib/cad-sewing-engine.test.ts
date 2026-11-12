import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditCadSewing,
  createCadStitchPairFromSuggestion,
  measureCadSegmentLengthCm,
  suggestCadStitchPairs
} from './cad-sewing-engine';
import type { CadPiece, CadSegment } from './pattern-cad-engine';

function segment(
  id: string,
  edgeType: CadSegment['edgeType'],
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  extra: Partial<CadSegment> = {}
): CadSegment {
  return {
    id, type: 'line', p1, p2, layer: 'cutting', edgeType,
    lengthCm: Math.hypot(p2.x - p1.x, p2.y - p1.y),
    ...extra
  };
}

function piece(id: string, segments: CadSegment[], garmentType: CadPiece['garmentType'] = 'custom'): CadPiece {
  return {
    id, name: id, nameAr: id, garmentType,
    segments, notches: [], grainlines: [], seamAllowanceCm: 1, notes: ''
  };
}

describe('CAD sewing topology engine', () => {
  it('measures line, quadratic and cubic CAD edges from their control points', () => {
    const line = segment('line', 'shoulder', { x: 0, y: 0 }, { x: 3, y: 4 });
    const quad = segment('quad', 'shoulder', { x: 0, y: 0 }, { x: 10, y: 0 }, {
      type: 'quad', cp1: { x: 5, y: 10 }, lengthCm: 10
    });
    const cubic = segment('cubic', 'shoulder', { x: 0, y: 0 }, { x: 10, y: 0 }, {
      type: 'bezier', cp1: { x: 0, y: 10 }, cp2: { x: 10, y: 10 }, lengthCm: 10
    });
    assert.ok(Math.abs(measureCadSegmentLengthCm(line) - 5) < 1e-9);
    assert.ok(measureCadSegmentLengthCm(quad) > 14.5);
    assert.ok(measureCadSegmentLengthCm(cubic) > 19.5);
    assert.throws(() => measureCadSegmentLengthCm(line, 1));
    assert.throws(() => measureCadSegmentLengthCm({
      ...quad, cp1: undefined
    }));
  });

  it('suggests cross-piece sewing edges with matching types and close measured lengths', () => {
    const pieces = [
      piece('front', [
        segment('front-shoulder', 'shoulder', { x: 0, y: 0 }, { x: 12, y: 0 }),
        segment('front-center', 'center', { x: 0, y: 0 }, { x: 40, y: 0 }),
        segment('front-side', 'side', { x: 0, y: 0 }, { x: 10, y: 0 })
      ]),
      piece('back', [
        segment('back-shoulder', 'shoulder', { x: 0, y: 0 }, { x: 12.2, y: 0 }),
        segment('back-side', 'side', { x: 0, y: 0 }, { x: 10.2, y: 0 })
      ]),
      piece('sleeve', [
        segment('sleeve-cap', 'armhole', { x: 0, y: 0 }, { x: 28, y: 0 })
      ], 'sleeve')
    ];
    const suggestions = suggestCadStitchPairs(pieces);
    assert.equal(suggestions.length, 2);
    assert.ok(suggestions.some(item =>
      new Set([item.first.segmentId, item.second.segmentId]).has('front-shoulder') &&
      new Set([item.first.segmentId, item.second.segmentId]).has('back-shoulder')
    ));
    assert.ok(suggestions.every(item => item.first.pieceId !== item.second.pieceId));
    assert.ok(suggestions.every(item => item.confidence >= 0 && item.confidence <= 1));
  });

  it('matches a bodice armhole only to a sleeve cap, not to another bodice panel', () => {
    const pieces = [
      piece('front', [segment('front-armhole', 'armhole', { x: 0, y: 0 }, { x: 14, y: 0 })], 'bodice'),
      piece('back', [segment('back-armhole', 'armhole', { x: 0, y: 0 }, { x: 14.1, y: 0 })], 'bodice'),
      piece('sleeve', [segment('sleeve-cap', 'armhole', { x: 0, y: 0 }, { x: 14.05, y: 0 })], 'sleeve')
    ];
    const suggestions = suggestCadStitchPairs(pieces);
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].edgeType, 'armhole');
    assert.ok([suggestions[0].first.pieceId, suggestions[0].second.pieceId].includes('sleeve'));
  });

  it('does not suggest already-used edges or duplicate edge assignments', () => {
    const pieces = [
      piece('a', [segment('a-shoulder', 'shoulder', { x: 0, y: 0 }, { x: 10, y: 0 })]),
      piece('b', [segment('b-shoulder', 'shoulder', { x: 0, y: 0 }, { x: 10, y: 0 })]),
      piece('c', [segment('c-shoulder', 'shoulder', { x: 0, y: 0 }, { x: 10.1, y: 0 })])
    ];
    const first = suggestCadStitchPairs(pieces);
    assert.equal(first.length, 1);
    const accepted = createCadStitchPairFromSuggestion(first[0]);
    assert.equal(suggestCadStitchPairs(pieces, [accepted]).length, 0);
  });

  it('classifies matching edges and seams that need easing', () => {
    const pieces = [
      piece('front', [segment('shoulder-front', 'shoulder', { x: 0, y: 0 }, { x: 10, y: 0 })]),
      piece('back', [
        segment('shoulder-back', 'shoulder', { x: 0, y: 0 }, { x: 10.1, y: 0 }),
        segment('armhole-back', 'armhole', { x: 0, y: 0 }, { x: 11, y: 0 })
      ]),
      piece('sleeve', [segment('sleeve-cap', 'armhole', { x: 0, y: 0 }, { x: 12, y: 0 })])
    ];
    const pair = {
      id: 'shoulder-link',
      first: { pieceId: 'front', segmentId: 'shoulder-front' },
      second: { pieceId: 'back', segmentId: 'shoulder-back' },
      mode: 'plain' as const
    };
    const audit = auditCadSewing(pieces, [pair]);
    assert.equal(audit.pairCount, 1);
    assert.equal(audit.readyCount, 1);
    assert.equal(audit.unpairedEdgeCount, 2);

    const easePair = {
      id: 'sleeve-link',
      first: { pieceId: 'back', segmentId: 'armhole-back' },
      second: { pieceId: 'sleeve', segmentId: 'sleeve-cap' },
      mode: 'plain' as const
    };
    const easeAudit = auditCadSewing(pieces, [easePair]);
    assert.equal(easeAudit.easeCount, 1);
    assert.equal(easeAudit.items[0].status, 'ease-required');
  });

  it('flags missing, same-piece, duplicate and stale seam references', () => {
    const pieces = [piece('front', [
      segment('a', 'shoulder', { x: 0, y: 0 }, { x: 10, y: 0 }),
      segment('b', 'side', { x: 0, y: 0 }, { x: 8, y: 0 })
    ])];
    const badPairs = [
      { id: 'same-piece', first: { pieceId: 'front', segmentId: 'a' }, second: { pieceId: 'front', segmentId: 'b' }, mode: 'plain' as const },
      { id: 'missing', first: { pieceId: 'front', segmentId: 'a' }, second: { pieceId: 'back', segmentId: 'x' }, mode: 'plain' as const },
      { id: 'duplicate-a', first: { pieceId: 'front', segmentId: 'a' }, second: { pieceId: 'front', segmentId: 'b' }, mode: 'plain' as const },
      { id: 'duplicate-a', first: { pieceId: 'front', segmentId: 'a' }, second: { pieceId: 'back', segmentId: 'x' }, mode: 'plain' as const }
    ];
    const audit = auditCadSewing(pieces, badPairs);
    assert.equal(audit.invalidCount, 4);
  });

  it('rejects suggestion limits that could create invalid confidence calculations', () => {
    const pieces = [
      piece('a', [segment('a-side', 'side', { x: 0, y: 0 }, { x: 10, y: 0 })]),
      piece('b', [segment('b-side', 'side', { x: 0, y: 0 }, { x: 10, y: 0 })])
    ];
    assert.deepEqual(suggestCadStitchPairs(pieces, [], { maxSuggestions: 0 }), []);
    assert.throws(() => suggestCadStitchPairs(pieces, [], { maxDifferencePercent: 0 }));
    assert.throws(() => suggestCadStitchPairs(pieces, [], { maxSuggestions: 501 }));
  });

  it('rejects confirmed seam links with different semantic edge types', () => {
    const pieces = [
      piece('bodice', [segment('bodice-shoulder', 'shoulder', { x: 0, y: 0 }, { x: 10, y: 0 })]),
      piece('sleeve', [segment('sleeve-cap', 'armhole', { x: 0, y: 0 }, { x: 10, y: 0 })])
    ];
    const audit = auditCadSewing(pieces, [{
      id: 'wrong-types',
      first: { pieceId: 'bodice', segmentId: 'bodice-shoulder' },
      second: { pieceId: 'sleeve', segmentId: 'sleeve-cap' },
      mode: 'plain'
    }]);
    assert.equal(audit.invalidCount, 1);
  });

  it('accepts a suggested eased seam with its measured ease allowance', () => {
    const pieces = [
      piece('a', [segment('a-side', 'side', { x: 0, y: 0 }, { x: 10, y: 0 })]),
      piece('b', [segment('b-side', 'side', { x: 0, y: 0 }, { x: 11, y: 0 })])
    ];
    const suggestion = suggestCadStitchPairs(pieces)[0];
    const plainPair = createCadStitchPairFromSuggestion(suggestion);
    assert.equal(plainPair.mode, 'plain');
    assert.equal(auditCadSewing(pieces, [plainPair]).easeCount, 1);

    const easedPair = createCadStitchPairFromSuggestion(suggestion, 'ease');
    assert.equal(easedPair.mode, 'ease');
    assert.equal(easedPair.expectedEaseCm, 1);
    const audit = auditCadSewing(pieces, [easedPair]);
    assert.equal(audit.readyCount, 1);
  });
});
