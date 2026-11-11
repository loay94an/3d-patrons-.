import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateBasicSkirtDraft } from './basic-skirt-pattern';

const sample = {
  waistCircumferenceCm: 72,
  hipCircumferenceCm: 96,
  waistToHipCm: 20,
  skirtLengthCm: 60,
  waistEaseCm: 2,
  hipEaseCm: 2
};

describe('basic skirt drafting', () => {
  it('creates front-on-fold and back-seam panels with matched side seams', () => {
    const result = generateBasicSkirtDraft(sample);
    assert.equal(result.validation.valid, true);
    assert.equal(result.pieces.length, 2);
    assert.equal(result.summaries.length, 2);
    assert.equal(result.pieces[0].edgeSeamAllowances?.center, 0);
    assert.equal(result.pieces[1].edgeSeamAllowances?.center, 1);
    assert.ok(Math.abs(result.validation.measurements.sideSeamDifferenceCm) <= 0.05);
  });

  it('reconciles finished waist and hip circumferences after dart intake is sewn', () => {
    const result = generateBasicSkirtDraft(sample);
    assert.equal(result.validation.measurements.finishedWaistCm, 74);
    assert.equal(result.validation.measurements.finishedHipCm, 98);
  });

  it('changes waist shaping when dart intake changes without changing finished waist', () => {
    const standard = generateBasicSkirtDraft(sample);
    const largerDart = generateBasicSkirtDraft({ ...sample, backDartIntakeCm: 4.5 });
    assert.equal(standard.validation.valid, true);
    assert.equal(largerDart.validation.valid, true);
    assert.notDeepEqual(standard.pieces[1].segments, largerDart.pieces[1].segments);
    assert.equal(largerDart.validation.measurements.finishedWaistCm, 74);
  });

  it('rejects invalid dimensions and negative allowances', () => {
    const invalidLength = generateBasicSkirtDraft({ ...sample, skirtLengthCm: 0 });
    assert.equal(invalidLength.validation.valid, false);
    assert.ok(invalidLength.validation.errors.length > 0);
    const negativeAllowance = generateBasicSkirtDraft({ ...sample, seamAllowanceCm: -1 });
    assert.equal(negativeAllowance.validation.valid, false);
  });

  it('rejects a hip quarter that cannot be wider than the waist quarter', () => {
    const result = generateBasicSkirtDraft({
      ...sample, waistCircumferenceCm: 110, hipCircumferenceCm: 100
    });
    assert.equal(result.validation.valid, false);
  });
});
