import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PATTERN_NUMBERS } from './pattern-cad-engine';
import { mapMeasurementsToPatternInput } from './pattern-measurement-mapper';

const profile = {
  bust: 94, chest: 93, waist: 76, hip: 102, backLength: 41,
  frontLength: 46, shoulder: 13, neckCirc: 39, armholeCirc: 44,
  armCirc: 32, sleeveLength: 61, thighCirc: 60, crotchHeight: 28,
  legLength: 104, sideLength: 103, skirtLength: 68, waistToHip: 20,
  waistToKnee: 55
};

describe('measurement to CAD input mapping', () => {
  it('maps family-specific body lengths and lower-body shaping measurements', () => {
    const pants = mapMeasurementsToPatternInput(DEFAULT_PATTERN_NUMBERS, profile, 'pants');
    assert.equal(pants.backLength, 104);
    assert.equal(pants.crotchDepth, 28);
    assert.equal(pants.thighCircumference, 60);
    assert.equal(pants.hipDepth, 20);
    assert.equal(pants.waistToKnee, 55);
    const skirt = mapMeasurementsToPatternInput(DEFAULT_PATTERN_NUMBERS, profile, 'skirt');
    assert.equal(skirt.backLength, 68);
  });

  it('maps explicit front waist length, upper arm, and sleeve inputs', () => {
    const bodice = mapMeasurementsToPatternInput(DEFAULT_PATTERN_NUMBERS, profile, 'bodice');
    assert.equal(bodice.frontLength, 46);
    assert.equal(bodice.upperArmCircumference, 32);
    assert.equal(bodice.sleeveLength, 61);
    assert.equal(bodice.bustCircumference, 94);
  });

  it('does not confuse bust-point height or torso back length with full front or trouser length', () => {
    const mapped = mapMeasurementsToPatternInput(DEFAULT_PATTERN_NUMBERS, {
      chestLength: 24, shoulderToBust: 25, backLength: 40
    }, 'pants');
    assert.equal(mapped.frontLength, DEFAULT_PATTERN_NUMBERS.frontLength);
    assert.equal(mapped.backLength, DEFAULT_PATTERN_NUMBERS.backLength);
  });

  it('preserves defaults when optional profile measurements are absent or invalid', () => {
    const mapped = mapMeasurementsToPatternInput(DEFAULT_PATTERN_NUMBERS, { bust: Number.NaN, waist: 0 }, 'pants');
    assert.equal(mapped.bustCircumference, DEFAULT_PATTERN_NUMBERS.bustCircumference);
    assert.equal(mapped.waistCircumference, DEFAULT_PATTERN_NUMBERS.waistCircumference);
    assert.equal(mapped.backLength, DEFAULT_PATTERN_NUMBERS.backLength);
  });
});
