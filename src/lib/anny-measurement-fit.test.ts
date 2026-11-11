import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertAnnyCircumferenceToCm,
  getAnnyHeightScale,
  interpolateRadialScale,
  resolveAnnyTargetHeightCm
} from './anny-measurement-fit';
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
    assert.equal(resolveAnnyTargetHeightCm('kids', 251), 120);
    assert.equal(resolveAnnyTargetHeightCm('infant', 20), 70);
  });

  it('computes the exact scale needed to reach the requested stature', () => {
    assert.ok(Math.abs(getAnnyHeightScale(1.6252, 168) - 103.3725) < 0.001);
    assert.equal(getAnnyHeightScale(2, 180), 90);
  });

  it('converts native mesh circumference using the same uniform stature scale', () => {
    assert.equal(convertAnnyCircumferenceToCm(2, 2, 180), 180);
    assert.equal(convertAnnyCircumferenceToCm(0.5, 1, 160), 80);
    assert.ok(Math.abs(convertAnnyCircumferenceToCm(1.2, 2, 180) - 108) < 1e-9);
  });

  it('rejects invalid native and target heights', () => {
    assert.throws(() => getAnnyHeightScale(0, 168), /native height/);
    assert.throws(() => getAnnyHeightScale(Number.NaN, 168), /native height/);
    assert.throws(() => getAnnyHeightScale(1.6, 0), /target height/);
  });

  it('rejects invalid circumference values', () => {
    assert.throws(() => convertAnnyCircumferenceToCm(0, 1.6, 168), /circumference/);
    assert.throws(() => convertAnnyCircumferenceToCm(Number.NaN, 1.6, 168), /circumference/);
  });
});


describe('safe radial profile interpolation', () => {
  const anchors = [
    { coordinate: 0, radialScale: 1 },
    { coordinate: 10, radialScale: 1.2 },
    { coordinate: 20, radialScale: 0.8 }
  ];

  it('sorts anchors and interpolates smoothly between them', () => {
    assert.equal(interpolateRadialScale(0, [...anchors].reverse()), 1);
    assert.equal(interpolateRadialScale(10, anchors), 1.15);
    assert.equal(interpolateRadialScale(20, anchors), 0.85);
    assert.ok(interpolateRadialScale(5, anchors) > 1);
    assert.ok(interpolateRadialScale(15, anchors) < 1.15);
  });

  it('clamps extreme scale requests to conservative defaults', () => {
    assert.equal(interpolateRadialScale(10, [
      { coordinate: 0, radialScale: 0.1 },
      { coordinate: 20, radialScale: 4 }
    ]), 1);
    assert.equal(interpolateRadialScale(20, [
      { coordinate: 0, radialScale: 0.1 },
      { coordinate: 20, radialScale: 4 }
    ]), 1.15);
  });

  it('rejects insufficient, duplicate, or invalid anchors', () => {
    assert.throws(() => interpolateRadialScale(0, [{ coordinate: 0, radialScale: 1 }]), /at least two/i);
    assert.throws(() => interpolateRadialScale(0, [
      { coordinate: 0, radialScale: 1 },
      { coordinate: 0, radialScale: 1.1 }
    ]), /distinct/i);
    assert.throws(() => interpolateRadialScale(0, [
      { coordinate: 0, radialScale: 0 },
      { coordinate: 1, radialScale: 1 }
    ]), /positive scales/i);
    assert.throws(() => interpolateRadialScale(Number.NaN, anchors), /coordinate/);
    assert.throws(() => interpolateRadialScale(0, anchors, 1.2, 1.1), /bounds/);
  });
});
