import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertLength, createMeasurementProfile, validateStudioProfile } from './measurement-profile';

const values = { bust: 88, waist: 70, hip: 96, backLength: 40, sleeveLength: 58, upperArm: 30 };
const ease = { bust: 4, waist: 2, hip: 4, upperArm: 3 };

describe('measurement profile', () => {
  it('creates a versioned canonical centimetre profile', () => {
    assert.deepEqual(createMeasurementProfile({ ...values, bust: 88.26 }), {
      schemaVersion: 1,
      unit: 'cm',
      source: 'manual',
      values: { ...values, bust: 88.3 }
    });
  });

  it('validates each measurement against its documented input range', () => {
    const result = validateStudioProfile({ ...values, bust: 0, sleeveLength: 90 }, ease);
    assert.deepEqual(result.errors.map(issue => issue.field), ['bust', 'sleeveLength']);
  });

  it('rejects non-finite measurements and ease values', () => {
    const result = validateStudioProfile({ ...values, hip: Number.NaN }, { ...ease, waist: Number.POSITIVE_INFINITY });
    assert.deepEqual(result.errors.map(issue => issue.field), ['hip', 'ease.waist']);
  });

  it('accepts negative ease only within the UI-supported range', () => {
    assert.equal(validateStudioProfile(values, { ...ease, bust: -3 }).errors.length, 0);
    assert.equal(validateStudioProfile(values, { ...ease, bust: -3.5 }).errors.length, 1);
  });

  it('converts centimetres and inches without changing same-unit values', () => {
    assert.equal(convertLength(1, 'in', 'cm'), 2.54);
    assert.equal(convertLength(2.54, 'cm', 'in'), 1);
    assert.equal(convertLength(10, 'cm', 'cm'), 10);
  });
});
