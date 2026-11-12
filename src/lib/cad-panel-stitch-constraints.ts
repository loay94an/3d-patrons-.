import type { CadPanelGeometry, CadPanelBoundaryEdge } from './cad-panel-geometry';
import type { CadStitchPair } from './cad-sewing-engine';

export interface CadWeightedVertex {
  /** Index into the owning panel's vertex array. */
  vertexIndex: number;
  /** Linear interpolation weight for this vertex. */
  weight: number;
}

export interface CadStitchSample {
  normalizedT: number;
  first: [CadWeightedVertex, CadWeightedVertex];
  second: [CadWeightedVertex, CadWeightedVertex];
}

export interface CadPanelStitchConstraint {
  id: string;
  pairId: string;
  firstPieceId: string;
  secondPieceId: string;
  firstSegmentId: string;
  secondSegmentId: string;
  mode: CadStitchPair['mode'];
  /** XPBD target distance after panel placement; sewn boundary points coincide. */
  restLengthCm: 0;
  /** Positive ease/gather is retained as metadata; it is never silently discarded. */
  expectedEaseCm: number;
  firstEdgeLengthCm: number;
  secondEdgeLengthCm: number;
  samples: CadStitchSample[];
}

export interface CadPanelStitchOptions {
  sampleSpacingCm?: number;
  maxSamplesPerPair?: number;
  /** Stitch edges normally face in opposite directions around their panel contours. */
  reverseSecondEdge?: boolean;
}

function edgeFor(panel: CadPanelGeometry, segmentId: string): CadPanelBoundaryEdge {
  const matches = panel.boundaryEdges.filter(edge => edge.segmentId === segmentId);
  if (matches.length !== 1) {
    throw new Error(`حافة الخياطة "${segmentId}" غير موجودة أو مكررة في القطعة "${panel.pieceId}".`);
  }
  const edge = matches[0];
  if (edge.vertexIndices.length < 2 || edge.lengthCm <= 0 ||
      !Number.isFinite(edge.lengthCm)) {
    throw new Error(`حافة الخياطة "${segmentId}" لا تحتوي عينات هندسية صالحة.`);
  }
  for (const index of edge.vertexIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= panel.vertices.length) {
      throw new Error(`حافة الخياطة "${segmentId}" تشير إلى رأس خارج شبكة القطعة.`);
    }
  }
  return edge;
}

function sampleEdge(panel: CadPanelGeometry, edge: CadPanelBoundaryEdge, t: number): [CadWeightedVertex, CadWeightedVertex] {
  const points = edge.vertexIndices.map(index => panel.vertices[index]);
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    ));
  }
  const total = cumulative[cumulative.length - 1];
  if (!Number.isFinite(total) || total <= 1e-8) {
    throw new Error(`تعذر حساب طول عينات حافة الخياطة "${edge.segmentId}".`);
  }
  const target = Math.max(0, Math.min(1, t)) * total;
  let segment = 0;
  while (segment < cumulative.length - 2 && cumulative[segment + 1] < target) segment++;
  const span = cumulative[segment + 1] - cumulative[segment];
  const local = span <= 1e-8 ? 0 : (target - cumulative[segment]) / span;
  return [
    { vertexIndex: edge.vertexIndices[segment], weight: 1 - local },
    { vertexIndex: edge.vertexIndices[segment + 1], weight: local }
  ];
}

/**
 * Converts designer-approved seam pairs into weighted boundary samples for an XPBD solver.
 * This creates sewing constraints only; it does not position panels, simulate cloth, or
 * claim a finished 3D garment. Panel placement and collision remain separate solver stages.
 */
export function buildCadPanelStitchConstraints(
  panels: CadPanelGeometry[],
  pairs: CadStitchPair[],
  overrides: CadPanelStitchOptions = {}
): CadPanelStitchConstraint[] {
  const sampleSpacingCm = overrides.sampleSpacingCm ?? 1.5;
  const maxSamplesPerPair = overrides.maxSamplesPerPair ?? 128;
  const reverseSecondEdge = overrides.reverseSecondEdge ?? true;
  if (!Number.isFinite(sampleSpacingCm) || sampleSpacingCm <= 0 ||
      !Number.isInteger(maxSamplesPerPair) || maxSamplesPerPair < 2 || maxSamplesPerPair > 512) {
    throw new Error('إعدادات عينات وصلات الخياطة غير صالحة.');
  }

  const panelIndex = new Map<string, CadPanelGeometry>();
  for (const panel of panels) {
    if (!panel.pieceId || panelIndex.has(panel.pieceId)) {
      throw new Error('معرّفات قطع شبكة الباترون مفقودة أو مكررة.');
    }
    panelIndex.set(panel.pieceId, panel);
  }

  const usedEdges = new Set<string>();
  const pairIds = new Set<string>();
  return pairs.map(pair => {
    if (!pair.id || pairIds.has(pair.id)) throw new Error('معرّف وصلة الخياطة مفقود أو مكرر.');
    pairIds.add(pair.id);
    const firstPanel = panelIndex.get(pair.first.pieceId);
    const secondPanel = panelIndex.get(pair.second.pieceId);
    if (!firstPanel || !secondPanel || firstPanel.pieceId === secondPanel.pieceId) {
      throw new Error(`قطع وصلة الخياطة "${pair.id}" غير موجودة أو غير صالحة.`);
    }
    const firstKey = `${pair.first.pieceId}\u0000${pair.first.segmentId}`;
    const secondKey = `${pair.second.pieceId}\u0000${pair.second.segmentId}`;
    if (usedEdges.has(firstKey) || usedEdges.has(secondKey)) {
      throw new Error('لا يمكن استخدام حافة واحدة في أكثر من وصلة خياطة.');
    }
    usedEdges.add(firstKey);
    usedEdges.add(secondKey);

    const firstEdge = edgeFor(firstPanel, pair.first.segmentId);
    const secondEdge = edgeFor(secondPanel, pair.second.segmentId);
    if (!['plain', 'ease', 'gather'].includes(pair.mode) ||
        (pair.expectedEaseCm !== undefined &&
          (!Number.isFinite(pair.expectedEaseCm) || pair.expectedEaseCm < 0))) {
      throw new Error(`بيانات التسهيل في وصلة الخياطة "${pair.id}" غير صالحة.`);
    }
    const expectedEaseCm = pair.mode === 'plain' ? 0 : pair.expectedEaseCm ?? 0;
    const sampleCount = Math.max(2, Math.min(
      maxSamplesPerPair,
      Math.ceil(Math.max(firstEdge.lengthCm, secondEdge.lengthCm) / sampleSpacingCm) + 1
    ));
    const samples = Array.from({ length: sampleCount }, (_, index) => {
      const t = index / (sampleCount - 1);
      return {
        normalizedT: t,
        first: sampleEdge(firstPanel, firstEdge, t),
        second: sampleEdge(secondPanel, secondEdge, reverseSecondEdge ? 1 - t : t)
      };
    });
    return {
      id: `${pair.id}:xpbd`,
      pairId: pair.id,
      firstPieceId: pair.first.pieceId,
      secondPieceId: pair.second.pieceId,
      firstSegmentId: pair.first.segmentId,
      secondSegmentId: pair.second.segmentId,
      mode: pair.mode,
      restLengthCm: 0 as const,
      expectedEaseCm,
      firstEdgeLengthCm: firstEdge.lengthCm,
      secondEdgeLengthCm: secondEdge.lengthCm,
      samples
    };
  });
}
