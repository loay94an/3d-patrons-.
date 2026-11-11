import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAnnyHeightScale, resolveAnnyTargetHeightCm } from './anny-measurement-fit';
import type { Gender } from './pattern-logic';

const genders: Gender[] = ['women', 'men', 'kids', 'infant'];

describe('Anny stature calibration', () => {
  it('uses the entered stature for each body category', () => {
    for (const gender of genders) {
      assert.equal(resolveAnnyTargetHeightCm(gender, 181), 181);
    }
  });

  it('falls back to the category reference for missing or implausible heights', () => {
    assert.equal(resolveAnnyTargetHeightCm('women'), 168);
    assert.equal(resolveAnnyTargetHeightCm('men', Number.NaN), 178);
    assert.equal(resolveAnnyTargetHeightCm('kids', 249), 120);
    assert.equal(resolveAnnyTargetHeightCm('infant', 20), 70);
  });

  it('computes the exact scale needed to reach the requested stature', () => {
    assert.ok(Math.abs(getAnnyHeightScale(1.6252, 168) - 103.3725) < 0.001);
    assert.equal(getAnnyHeightScale(2, 180), 90);
  });

  it('rejects invalid native and target heights', () => {
    assert.throws(() => getAnnyHeightScale(0, 168), /native height/);
    assert.throws(() => getAnnyHeightScale(Number.NaN, 168), /native height/);
    assert.throws(() => getAnnyHeightScale(1.6, 0), /target height/);
  });
});
