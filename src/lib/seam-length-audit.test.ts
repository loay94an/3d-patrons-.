import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PATTERN_NUMBERS, generatePatternByNumbers } from './pattern-cad-engine';
import { auditPatternSeamLengths } from './seam-length-audit';

describe('candidate seam length audit', () => {
  const frame = { widthCm: 240, heightCm: 180, unit: 'cm' as const };
  const input = { ...DEFAULT_PATTERN_NUMBERS, backLength: 42, frontLength: 44, bustCircumference: 92, waistCircumference: 72 };

  it('reports explicit bodice and sleeve seam candidates with finite lengths', () => {
    const pieces = generatePatternByNumbers(input, frame, 'bodice').pieces;
    const checks = auditPatternSeamLengths(pieces);
    assert.ok(checks.some(check => check.id === 'bodice-shoulder'));
    assert.ok(checks.some(check => check.id === 'bodice-side'));
    assert.ok(checks.some(check => check.id === 'bodice-armhole-sleeve'));
    assert.ok(checks.every(check => Number.isFinite(check.differenceCm) && check.differenceCm >= 0));
  });

  it('reports trouser and skirt candidate edge pairs only when both sides exist', () => {
    const pants = auditPatternSeamLengths(generatePatternByNumbers(input, frame, 'pants').pieces);
    assert.ok(pants.some(check => check.id === 'pants-side'));
    assert.ok(pants.some(check => check.id === 'pants-inseam'));
    const skirt = auditPatternSeamLengths(generatePatternByNumbers(input, frame, 'skirt').pieces);
    assert.ok(skirt.some(check => check.id === 'skirt-side'));
  });

  it('returns no seam checks for incomplete or unrelated custom geometry', () => {
    assert.deepEqual(auditPatternSeamLengths([]), []);
  });
});
