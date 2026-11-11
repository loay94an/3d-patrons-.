import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PATTERN_NUMBERS } from './pattern-cad-engine';
import { mapMeasurementsToPatternInput } from './pattern-measurement-mapper';

const profile = {
  bust: 94, chest: 93, waist: 76, hip: 102, backLength: 41,
  chestLength: 27, shoulder: 13, neckCirc: 39, armholeCirc: 44,
  armCirc: 32, sleeveLength: 61, thighCirc: 60, crotchHeight: 28,
  legLength: 104, sideLength: 103, skirtLength: 68
};

describe('measurement to CAD input mapping', () => {
  it('maps family-specific lengths and lower-body measurements', () => {
    const pants = mapMeasurementsToPatternInput(DEFAULT_PATTERN_NUMBERS, profile, 'pants');
    assert.equal(pants.backLength, 104);
    assert.equal(pants.crotchDepth, 28);
    assert.equal(pants.rise, 28);
    assert.equal(pants.thighCircumference, 60);
    const skirt = mapMeasurementsToPatternInput(DEFAULT_PATTERN_NUMBERS, profile, 'skirt');
    assert.equal(skirt.backLength, 68);
  });

  it('maps front torso length, upper arm, and sleeve inputs', () => {
    const bodice = mapMeasurementsToPatternInput(DEFAULT_PATTERN_NUMBERS, profile, 'bodice');
    assert.equal(bodice.frontLength, 27);
    assert.equal(bodice.upperArmCircumference, 32);
    assert.equal(bodice.sleeveLength, 61);
    assert.equal(bodice.bustCircumference, 94);
  });

  it('preserves defaults when optional profile measurements are absent or invalid', () => {
    const mapped = mapMeasurementsToPatternInput(DEFAULT_PATTERN_NUMBERS, { bust: Number.NaN, waist: 0 }, 'pants');
    assert.equal(mapped.bustCircumference, DEFAULT_PATTERN_NUMBERS.bustCircumference);
    assert.equal(mapped.waistCircumference, DEFAULT_PATTERN_NUMBERS.waistCircumference);
    assert.equal(mapped.backLength, DEFAULT_PATTERN_NUMBERS.backLength);
  });
});
