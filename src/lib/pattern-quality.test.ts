import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CadPiece } from './pattern-cad-engine';
import { validatePatternPieces } from './pattern-quality';

const piece = (): CadPiece => ({
  id: 'front', name: 'Front', nameAr: 'الأمام', garmentType: 'bodice',
  notes: 'Fixture used for geometry validation tests',
  segments: [
    { id: 'a', type: 'line', p1: {x:0,y:0}, p2: {x:10,y:0}, layer: 'cutting', edgeType: 'waist', lengthCm: 10 },
    { id: 'b', type: 'line', p1: {x:10,y:0}, p2: {x:10,y:20}, layer: 'cutting', edgeType: 'side', lengthCm: 20 },
    { id: 'c', type: 'line', p1: {x:10,y:20}, p2: {x:0,y:20}, layer: 'cutting', edgeType: 'hem', lengthCm: 10 },
    { id: 'd', type: 'line', p1: {x:0,y:20}, p2: {x:0,y:0}, layer: 'cutting', edgeType: 'center', lengthCm: 20 }
  ],
  notches: [{ id: 'n1', point: {x:10,y:10}, angleDeg: 0, type: 'v_notch', depthCm: 0.5 }],
  grainlines: [{ id: 'g1', p1: {x:5,y:3}, p2: {x:5,y:17}, label: 'grain' }],
  seamAllowanceCm: 1
});

describe('pattern quality report', () => {
  it('rejects an empty pattern instead of marking it export-safe', () => {
    const report = validatePatternPieces([]);
    assert.equal(report.valid, false);
    assert.equal(report.exportSafe, false);
    assert.equal(report.checkedPieces, 0);
    assert.ok(report.issues.some(issue => issue.code === 'no-pattern-pieces'));
  });
  it('rejects invalid connection tolerances', () => {
    const report = validatePatternPieces([piece()], Number.NaN);
    assert.equal(report.exportSafe, false);
    assert.ok(report.issues.some(issue => issue.code === 'invalid-tolerance'));
  });
  it('accepts a closed, connected piece with valid construction metadata', () => {
    const report = validatePatternPieces([piece()]);
    assert.equal(report.valid, true);
    assert.equal(report.exportSafe, true);
    assert.equal(report.checkedCuttingEdges, 4);
    assert.equal(report.errors, 0);
    assert.equal(report.warnings, 0);
  });
  it('blocks an open contour and reports the broken joint', () => {
    const broken = piece();
    broken.segments[1] = { ...broken.segments[1], p1: {x:11,y:0} };
    const report = validatePatternPieces([broken]);
    assert.equal(report.exportSafe, false);
    assert.ok(report.issues.some(issue => issue.code === 'open-contour-joint'));
  });
  it('blocks invalid allowances and zero-length grainlines', () => {
    const broken = piece();
    broken.edgeSeamAllowances = { hem: -1 };
    broken.grainlines[0] = { ...broken.grainlines[0], p2: {x:5,y:3} };
    const report = validatePatternPieces([broken]);
    assert.ok(report.issues.some(issue => issue.code === 'invalid-seam-allowance'));
    assert.ok(report.issues.some(issue => issue.code === 'invalid-grainline'));
  });
  it('warns when grainlines or notches are missing without blocking the contour', () => {
    const basic = piece();
    basic.grainlines = [];
    basic.notches = [];
    const report = validatePatternPieces([basic]);
    assert.equal(report.exportSafe, true);
    assert.equal(report.warnings, 2);
  });
});
