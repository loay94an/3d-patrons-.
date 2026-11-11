import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PATTERN_NUMBERS, generatePatternByNumbers, resolvePatternEase } from './pattern-cad-engine';

describe('parametric ease integration', () => {
  it('keeps regional ease values independent with a legacy fallback', () => {
    assert.deepEqual(
      resolvePatternEase({ additionalEase: 1.5, easeProfile: { bust: 4, waist: 2, hip: 5, upperArm: 3 } }),
      { bust: 4, waist: 2, hip: 5, upperArm: 3 }
    );
    assert.deepEqual(
      resolvePatternEase({ additionalEase: 1.5 }),
      { bust: 1.5, waist: 1.5, hip: 1.5, upperArm: 1.5 }
    );
  });

  it('changes generated bodice geometry when bust ease changes', () => {
    const frame = { widthCm: 110, heightCm: 85, unit: 'cm' as const };
    const base = generatePatternByNumbers({
      ...DEFAULT_PATTERN_NUMBERS,
      easeProfile: { bust: 1, waist: 1, hip: 1, upperArm: 1 }
    }, frame, 'bodice');
    const roomier = generatePatternByNumbers({
      ...DEFAULT_PATTERN_NUMBERS,
      easeProfile: { bust: 6, waist: 1, hip: 1, upperArm: 1 }
    }, frame, 'bodice');
    assert.notDeepEqual(base.pieces, roomier.pieces);
  });

  it('uses upper-arm circumference for sleeve bicep width, not armhole depth ease', () => {
    const frame = { widthCm: 110, heightCm: 85, unit: 'cm' as const };
    const narrowArm = generatePatternByNumbers({
      ...DEFAULT_PATTERN_NUMBERS,
      upperArmCircumference: 28,
      easeProfile: { bust: 2, waist: 2, hip: 2, upperArm: 1 }
    }, frame, 'sleeve');
    const widerArm = generatePatternByNumbers({
      ...DEFAULT_PATTERN_NUMBERS,
      upperArmCircumference: 36,
      easeProfile: { bust: 2, waist: 2, hip: 2, upperArm: 1 }
    }, frame, 'sleeve');
    assert.notDeepEqual(narrowArm.pieces, widerArm.pieces);
  });
});
