import type * as THREE from 'three';
import type { Gender } from './pattern-logic';
import type { CadPiece } from './pattern-cad-engine';
import type { CadStitchPair, CadSewingAudit } from './cad-sewing-engine';
import type { CadPanelGeometry } from './cad-panel-geometry';
import type { FabricCustomState, FabricDefinition } from './fabric-engine';
import {
  resolve3DMeasurements,
  buildParametricMannequin,
  type MannequinMeasurements,
  type Resolved3DMeasurements
} from './mannequin-builder';
import { buildCadPanelGeometry } from './cad-panel-geometry';
import { auditCadSewing } from './cad-sewing-engine';
import { FABRIC_PRESETS } from './fabric-engine';

/**
 * One versioned hand-off between anthropometry, 2D pattern CAD, sewing,
 * fabric selection and the Three.js presentation layer.
 *
 * All body and pattern dimensions are centimetres. Geometry stays in the
 * existing CAD coordinate system; renderers must apply an explicit unit scale.
 */
export interface FashionPipelineInput {
  body: {
    gender: Gender;
    size: number | string;
    measurements: Record<string, number>;
  };
  pattern: {
    pieces: CadPiece[];
    stitchPairs?: CadStitchPair[];
    seamToleranceCm?: number;
  };
  fabric: FabricCustomState;
}

export interface FashionPipelineIssue {
  stage: 'body' | 'pattern' | 'sewing' | 'fabric';
  code: string;
  messageAr: string;
  pieceId?: string;
}

export interface PreparedFashionPanel {
  pieceId: string;
  geometry: CadPanelGeometry;
}

export interface FashionPipelineSession {
  schemaVersion: '1.0.0';
  body: Resolved3DMeasurements;
  mannequin: THREE.Group;
  panels: PreparedFashionPanel[];
  sewing: CadSewingAudit;
  fabric: FabricDefinition;
  fabricState: FabricCustomState;
  issues: FashionPipelineIssue[];
  readiness: {
    body: boolean;
    pattern: boolean;
    sewing: boolean;
    fabric: boolean;
    threePreview: boolean;
    physicalClothSimulation: 'adapter-required';
    virtualTryOn: 'fit-analysis-required';
  };
}

/**
 * Prepares all currently implemented engines as one deterministic pipeline.
 * It deliberately does not claim to run physical cloth dynamics: a solver
 * adapter must be supplied by a later integration (e.g. GPU/WASM/service).
 */
export function prepareFashionPipeline(input: FashionPipelineInput): FashionPipelineSession {
  const issues: FashionPipelineIssue[] = [];
  const body = resolve3DMeasurements(
    input.body.gender,
    input.body.size,
    input.body.measurements
  );
  const mannequin = buildParametricMannequin(input.body.gender, body.body);

  const panels: PreparedFashionPanel[] = [];
  for (const piece of input.pattern.pieces) {
    try {
      panels.push({ pieceId: piece.id, geometry: buildCadPanelGeometry(piece) });
    } catch (error) {
      issues.push({
        stage: 'pattern',
        code: 'invalid-cad-piece',
        pieceId: piece.id,
        messageAr: error instanceof Error ? error.message : 'تعذر تحويل قطعة الباترون إلى شبكة.'
      });
    }
  }

  if (input.pattern.pieces.length === 0) {
    issues.push({
      stage: 'pattern',
      code: 'empty-pattern',
      messageAr: 'أضف قطعة باترون واحدة على الأقل قبل تجهيز العرض ثلاثي الأبعاد.'
    });
  }

  const sewing = auditCadSewing(
    input.pattern.pieces,
    input.pattern.stitchPairs ?? [],
    input.pattern.seamToleranceCm ?? 0.35
  );
  if (sewing.invalidCount > 0 || sewing.mismatchCount > 0 || sewing.easeCount > 0) {
    issues.push({
      stage: 'sewing',
      code: 'sewing-review-required',
      messageAr: 'توجد وصلات خياطة تحتاج إلى مراجعة قبل اعتماد التجميع.'
    });
  }

  const fabric = FABRIC_PRESETS.find(item => item.id === input.fabric.presetId);
  if (!fabric) {
    issues.push({
      stage: 'fabric',
      code: 'unknown-fabric',
      messageAr: 'نوع القماش المحدد غير موجود في مكتبة الخامات.'
    });
  }

  const patternReady = input.pattern.pieces.length > 0 &&
    panels.length === input.pattern.pieces.length;
  const sewingReady = sewing.invalidCount === 0 &&
    sewing.mismatchCount === 0 &&
    sewing.easeCount === 0;
  const fabricReady = Boolean(fabric);

  return {
    schemaVersion: '1.0.0',
    body,
    mannequin,
    panels,
    sewing,
    fabric: fabric ?? FABRIC_PRESETS[0],
    fabricState: input.fabric,
    issues,
    readiness: {
      body: true,
      pattern: patternReady,
      sewing: sewingReady,
      fabric: fabricReady,
      threePreview: patternReady && fabricReady,
      physicalClothSimulation: 'adapter-required',
      virtualTryOn: 'fit-analysis-required'
    }
  };
}

/** Releases the generated body geometry and materials when a session is replaced. */
export function disposeFashionPipelineSession(session: FashionPipelineSession): void {
  session.mannequin.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh && !mesh.isLine) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => material?.dispose());
  });
}

/** Extracts the body-only measurements shared by pattern and garment engines. */
export function getFashionBodyMeasurements(session: FashionPipelineSession): MannequinMeasurements {
  return { ...session.body.body };
}
