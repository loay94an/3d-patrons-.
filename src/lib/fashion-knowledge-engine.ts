import {
  auditCadSewing,
  type CadPiece,
  type CadStitchPair,
  type CadSewingAudit
} from './cad-sewing-engine';
export { applyEaseScale } from './pattern-cad-engine';

export type KnowledgeUse = 'internal_analysis' | 'derived_facts' | 'commercial_runtime' | 'redistribution' | 'model_training';

export interface ProductionKnowledgeRecord {
  id: string;
  domain: string;
  recordType: string;
  status: 'draft' | 'extracted' | 'reviewed' | 'verified' | 'deprecated';
  confidence?: number;
  provenance?: Array<{ sourceId: string; locator: string }>;
  licensing: {
    status: 'verified' | 'restricted' | 'permission_required' | 'unverified' | 'public_domain';
    allowedUses: KnowledgeUse[];
  };
  review: {
    state: 'not_reviewed' | 'machine_checked' | 'human_reviewed' | 'engineering_approved' | 'rejected';
  };
}

export interface DirectionalEaseScale {
  warp: number;
  weft: number;
}

export interface EaseFieldSample extends DirectionalEaseScale {
  triangleId: string;
}

export interface EaseFieldSummary {
  triangleCount: number;
  minWarp: number;
  maxWarp: number;
  minWeft: number;
  maxWeft: number;
  hasPositiveWeftEase: boolean;
  hasNegativeWeftEase: boolean;
  warpDiffersFromDesignBaseline: boolean;
}

export type KnowledgeBackedSewingResult =
  | { enabled: false; reason: 'rule-not-production-approved'; audit: null }
  | { enabled: true; reason: null; audit: CadSewingAudit };

/**
 * Production use requires an approved record, an engineering sign-off,
 * a verified/public-domain license, an explicit usage grant and traceable provenance.
 */
export function isKnowledgeRecordProductionReady(
  record: ProductionKnowledgeRecord,
  usage: KnowledgeUse = 'commercial_runtime',
  minimumConfidence = 0.9
): boolean {
  if (!record || record.status !== 'verified' || record.review?.state !== 'engineering_approved') return false;
  if (!record.licensing || !['verified', 'public_domain'].includes(record.licensing.status)) return false;
  if (!record.licensing.allowedUses?.includes(usage)) return false;
  if (!Number.isFinite(record.confidence) || (record.confidence ?? 0) < minimumConfidence) return false;
  if (!Array.isArray(record.provenance) || record.provenance.length === 0) return false;
  return record.provenance.every(item =>
    Boolean(item && item.sourceId?.trim() && item.locator?.trim())
  );
}

export function summarizeEaseField(samples: EaseFieldSample[]): EaseFieldSummary {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('حقل سهولة الباترون يحتاج إلى عينة مثلثية واحدة على الأقل.');
  }
  const ids = new Set<string>();
  for (const sample of samples) {
    if (!sample || !sample.triangleId?.trim() || ids.has(sample.triangleId) ||
        !Number.isFinite(sample.warp) || !Number.isFinite(sample.weft) ||
        sample.warp <= 0 || sample.weft <= 0 || sample.warp > 5 || sample.weft > 5) {
      throw new Error('حقل سهولة الباترون يحتوي على معرّف مكرر أو معامل غير صالح.');
    }
    ids.add(sample.triangleId);
  }
  const warp = samples.map(sample => sample.warp);
  const weft = samples.map(sample => sample.weft);
  return {
    triangleCount: samples.length,
    minWarp: Math.min(...warp),
    maxWarp: Math.max(...warp),
    minWeft: Math.min(...weft),
    maxWeft: Math.max(...weft),
    hasPositiveWeftEase: weft.some(value => value > 1),
    hasNegativeWeftEase: weft.some(value => value < 1),
    warpDiffersFromDesignBaseline: warp.some(value => Math.abs(value - 1) > 1e-6)
  };
}

/**
 * Adapter to the existing CAD sewing audit. It deliberately refuses to activate
 * extracted or unlicensed knowledge records in production.
 */
export function auditCadSewingWithKnowledge(
  pieces: CadPiece[],
  stitchPairs: CadStitchPair[],
  sewingRule: ProductionKnowledgeRecord,
  toleranceCm = 0.35
): KnowledgeBackedSewingResult {
  if (sewingRule.domain !== 'sewing_construction' ||
      sewingRule.recordType !== 'seam_rule' ||
      !isKnowledgeRecordProductionReady(sewingRule, 'commercial_runtime')) {
    return { enabled: false, reason: 'rule-not-production-approved', audit: null };
  }
  return {
    enabled: true,
    reason: null,
    audit: auditCadSewing(pieces, stitchPairs, toleranceCm)
  };
}
