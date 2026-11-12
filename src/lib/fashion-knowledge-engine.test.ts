import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEaseScale,
  auditCadSewingWithKnowledge,
  isKnowledgeRecordProductionReady,
  summarizeEaseField,
  type ProductionKnowledgeRecord
} from './fashion-knowledge-engine';
import { resolvePatternEase } from './pattern-cad-engine';

const approvedSeamRule: ProductionKnowledgeRecord = {
  id: 'test-seam-rule',
  domain: 'sewing_construction',
  recordType: 'seam_rule',
  status: 'verified',
  confidence: 0.98,
  provenance: [{ sourceId: 'test-source', locator: 'page 1 / test fixture' }],
  licensing: { status: 'verified', allowedUses: ['commercial_runtime'] },
  review: { state: 'engineering_approved' }
};

test('ease scale 1.0 preserves reference length', () => {
  assert.equal(applyEaseScale(42, 1), 42);
});

test('ease scale above 1 adds allowance proportionally', () => {
  assert.equal(applyEaseScale(50, 1.08), 54);
});

test('ease scale below 1 produces a tighter target', () => {
  assert.equal(applyEaseScale(50, 0.92), 46);
});

test('ease scale rejects zero, negative and excessive values', () => {
  assert.throws(() => applyEaseScale(50, 0));
  assert.throws(() => applyEaseScale(50, -1));
  assert.throws(() => applyEaseScale(50, 5.1));
});

test('ease field reports local variation and warp baseline changes', () => {
  const summary = summarizeEaseField([
    { triangleId: 't1', warp: 1, weft: 1 },
    { triangleId: 't2', warp: 1.04, weft: 1.12 },
    { triangleId: 't3', warp: 1, weft: 0.96 }
  ]);
  assert.equal(summary.triangleCount, 3);
  assert.equal(summary.hasPositiveWeftEase, true);
  assert.equal(summary.hasNegativeWeftEase, true);
  assert.equal(summary.warpDiffersFromDesignBaseline, true);
});

test('ease field rejects duplicate triangle ids and invalid scales', () => {
  assert.throws(() => summarizeEaseField([
    { triangleId: 'same', warp: 1, weft: 1 },
    { triangleId: 'same', warp: 1, weft: 1 }
  ]));
  assert.throws(() => summarizeEaseField([
    { triangleId: 't1', warp: 0, weft: 1 }
  ]));
});

test('extracted or unlicensed knowledge cannot enter production', () => {
  const extracted = { ...approvedSeamRule, status: 'extracted' as const };
  assert.equal(isKnowledgeRecordProductionReady(extracted), false);
  const unlicensed = {
    ...approvedSeamRule,
    licensing: { status: 'unverified' as const, allowedUses: ['commercial_runtime' as const] }
  };
  assert.equal(isKnowledgeRecordProductionReady(unlicensed), false);
});

test('production sewing adapter blocks unapproved rules', () => {
  const result = auditCadSewingWithKnowledge([], [], {
    ...approvedSeamRule,
    status: 'extracted'
  });
  assert.equal(result.enabled, false);
  assert.equal(result.audit, null);
});

test('production sewing adapter delegates to the existing CAD audit after approval', () => {
  const result = auditCadSewingWithKnowledge([], [], approvedSeamRule);
  assert.equal(result.enabled, true);
  if (result.enabled) assert.equal(result.audit.pairCount, 0);
});

test('parametric pattern generator consumes dimensionless ease scales', () => {
  const resolved = resolvePatternEase({
    bustCircumference: 88,
    waistCircumference: 70,
    hipCircumference: 96,
    upperArmCircumference: 32,
    additionalEase: 1.5,
    easeScaleProfile: { bust: 1.1, waist: 0.9, hip: 1.05, upperArm: 1.2 }
  });
  assert.equal(resolved.bust, 2.2);
  assert.equal(resolved.waist, -1.75);
  assert.equal(resolved.hip, 1.2);
  assert.equal(resolved.upperArm, 1.6);
});

test('explicit centimetre ease overrides the corresponding scale only', () => {
  const resolved = resolvePatternEase({
    bustCircumference: 88,
    waistCircumference: 70,
    hipCircumference: 96,
    additionalEase: 1.5,
    easeProfile: { bust: 3 },
    easeScaleProfile: { bust: 1.1, waist: 1.1 }
  });
  assert.equal(resolved.bust, 3);
  assert.equal(resolved.waist, 1.75);
  assert.equal(resolved.hip, 1.5);
});

test('scale-based pattern ease requires the matching body measurement', () => {
  assert.throws(() => resolvePatternEase({
    additionalEase: 1.5,
    easeScaleProfile: { bust: 1.1 }
  } as never));
});
