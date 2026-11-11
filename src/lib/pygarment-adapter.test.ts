import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adaptPyGarmentPattern } from './pygarment-adapter';

const fixture = () => ({
  schemaVersion: '1.0.0',
  units: 'cm',
  engine: { name: 'PyGarment', version: '2.0.2' },
  patternName: 'Test skirt',
  pieces: [{
    id: 'front', name: 'Front', nameAr: 'الأمام', garmentType: 'skirt',
    segments: [
      { id: 'a', type: 'line', p1: {x:0,y:0}, p2: {x:10,y:0}, layer: 'cutting', edgeType: 'waist', lengthCm: 10 },
      { id: 'b', type: 'line', p1: {x:10,y:0}, p2: {x:10,y:20}, layer: 'cutting', edgeType: 'side', lengthCm: 20 },
      { id: 'c', type: 'line', p1: {x:10,y:20}, p2: {x:0,y:20}, layer: 'cutting', edgeType: 'hem', lengthCm: 10 },
      { id: 'd', type: 'line', p1: {x:0,y:20}, p2: {x:0,y:0}, layer: 'cutting', edgeType: 'center', lengthCm: 20 },
      { id: 'dart', type: 'line', p1: {x:4,y:0}, p2: {x:5,y:8}, layer: 'guideline', edgeType: 'waist', lengthCm: 8.06 }
    ],
    notches: [{ id: 'n1', point: {x:10,y:0}, angleDeg: 90, type: 'v_notch', depthCm: 0.5 }],
    grainlines: [{ id: 'g1', p1: {x:5,y:3}, p2: {x:5,y:17}, label: 'grain' }],
    seamAllowanceCm: 1,
    edgeSeamAllowances: { waist: 1, side: 1, hem: 3, center: 0 },
    notes: 'Test notes'
  }],
  validation: { valid: true, warnings: ['prototype'] }
});

describe('PyGarment CAD adapter', () => {
  it('converts PyGarment pieces, construction guides and metadata to editable CAD', () => {
    const result = adaptPyGarmentPattern(fixture());
    assert.equal(result.engineVersion, '2.0.2');
    assert.equal(result.pieces.length, 1);
    assert.equal(result.pieces[0].segments.length, 5);
    assert.equal(result.pieces[0].segments[4].layer, 'guideline');
    assert.equal(result.pieces[0].notches.length, 1);
    assert.equal(result.pieces[0].grainlines.length, 1);
    assert.equal(result.pieces[0].edgeSeamAllowances?.hem, 3);
    assert.equal(result.summaries[0].widthCm, 10);
    assert.equal(result.summaries[0].lengthCm, 20);
    assert.deepEqual(result.warnings, ['prototype']);
  });

  it('rejects unsupported schemas and invalid engine validation results', () => {
    const unsupported = fixture();
    unsupported.schemaVersion = '2.0.0';
    assert.throws(() => adaptPyGarmentPattern(unsupported), /غير مدعوم/);
    const invalid = fixture();
    invalid.validation.valid = false;
    assert.throws(() => adaptPyGarmentPattern(invalid), /غير صالحة/);
  });

  it('rejects invalid coordinates and unsupported CAD layers', () => {
    const badCoordinates = fixture();
    badCoordinates.pieces[0].segments[0].p1.x = Number.NaN;
    assert.throws(() => adaptPyGarmentPattern(badCoordinates), /إحداثيات غير صالحة/);
    const badLayer = fixture();
    badLayer.pieces[0].segments[0].layer = 'unknown';
    assert.throws(() => adaptPyGarmentPattern(badLayer), /طبقة غير مدعومة/);
  });
});
