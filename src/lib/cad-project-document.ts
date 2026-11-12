import type { CadStitchPair } from './cad-sewing-engine';
import type { CadPiece, PieceSpecSummary } from './pattern-cad-engine';

export interface CadProjectDocument {
  schemaVersion: 2;
  projectId: string;
  updatedAt: string;
  pieces: CadPiece[];
  summaries: PieceSpecSummary[];
  stitchPairs: CadStitchPair[];
}

const STORAGE_PREFIX = 'patron-studio.cad.v2.';
const LEGACY_STORAGE_PREFIX = 'patron-studio.cad.v1.';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function notifyCadDocumentChanged(projectId: string) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
  window.dispatchEvent(new CustomEvent('patron-studio:cad-document-updated', {
    detail: { projectId }
  }));
}

function finitePoint(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const point = value as { x?: unknown; y?: unknown };
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function validStitchPairs(value: unknown, pieces: CadPiece[]): value is CadStitchPair[] {
  if (!Array.isArray(value) || value.length > 5000) return false;
  const pieceMap = new Map(pieces.map(piece => [piece.id, piece]));
  const pairIds = new Set<string>();
  const usedEdges = new Set<string>();
  return value.every(pair => {
    if (!pair || typeof pair !== 'object' || typeof pair.id !== 'string' || !pair.id.trim()) return false;
    const item = pair as Partial<CadStitchPair>;
    const first = item.first;
    const second = item.second;
    if (!first || !second || typeof first.pieceId !== 'string' || typeof first.segmentId !== 'string' ||
        typeof second.pieceId !== 'string' || typeof second.segmentId !== 'string' ||
        first.pieceId === second.pieceId ||
        !['plain', 'ease', 'gather'].includes(item.mode ?? '') ||
        pairIds.has(item.id)) return false;
    if (item.expectedEaseCm !== undefined &&
        (!Number.isFinite(item.expectedEaseCm) || item.expectedEaseCm < 0)) return false;
    const firstPiece = pieceMap.get(first.pieceId);
    const secondPiece = pieceMap.get(second.pieceId);
    const firstSegment = firstPiece?.segments.find(segment => segment.id === first.segmentId);
    const secondSegment = secondPiece?.segments.find(segment => segment.id === second.segmentId);
    const firstKey = first.pieceId + '\\u0000' + first.segmentId;
    const secondKey = second.pieceId + '\\u0000' + second.segmentId;
    if (!firstSegment || !secondSegment ||
        !['cutting', 'seam'].includes(firstSegment.layer) ||
        !['cutting', 'seam'].includes(secondSegment.layer) ||
        !firstSegment.edgeType || firstSegment.edgeType === 'center' || firstSegment.edgeType === 'general' ||
        firstSegment.edgeType !== secondSegment.edgeType ||
        usedEdges.has(firstKey) || usedEdges.has(secondKey)) return false;
    pairIds.add(item.id);
    usedEdges.add(firstKey);
    usedEdges.add(secondKey);
    return true;
  });
}

/** Validates CAD documents and migrates legacy version-1 documents in memory. */
export function validateCadProjectDocument(value: unknown, expectedProjectId?: string): CadProjectDocument {
  if (!value || typeof value !== 'object') throw new Error('ملف هندسة CAD غير صالح.');
  const document = value as Record<string, unknown>;
  const schemaVersion = document.schemaVersion;
  if ((schemaVersion !== 1 && schemaVersion !== 2) || typeof document.projectId !== 'string' ||
      (expectedProjectId && document.projectId !== expectedProjectId) ||
      !Array.isArray(document.pieces) || !Array.isArray(document.summaries)) {
    throw new Error('بنية ملف هندسة CAD غير مدعومة أو لا تخص هذا المشروع.');
  }
  const pieces = document.pieces as CadPiece[];
  const summaries = document.summaries as PieceSpecSummary[];
  if (pieces.length > 500 || summaries.length > 500) {
    throw new Error('يتجاوز ملف CAD الحد المسموح به من القطع.');
  }
  const pieceIds = pieces.map(piece => piece?.id);
  const validPieces = pieces.every(piece =>
    piece && typeof piece.id === 'string' && typeof piece.name === 'string' &&
    typeof piece.nameAr === 'string' && Array.isArray(piece.segments) &&
    piece.segments.length <= 2000 &&
    new Set(piece.segments.map(segment => segment?.id)).size === piece.segments.length &&
    Array.isArray(piece.notches) &&
    Array.isArray(piece.grainlines) && Number.isFinite(piece.seamAllowanceCm) &&
    piece.segments.every(segment =>
      segment && typeof segment.id === 'string' &&
      ['line', 'quad', 'bezier'].includes(segment.type) &&
      finitePoint(segment.p1) && finitePoint(segment.p2) &&
      (segment.cp1 === undefined || finitePoint(segment.cp1)) &&
      (segment.cp2 === undefined || finitePoint(segment.cp2)) &&
      (segment.type !== 'quad' || finitePoint(segment.cp1)) &&
      (segment.type !== 'bezier' || (finitePoint(segment.cp1) && finitePoint(segment.cp2))) &&
      Number.isFinite(segment.lengthCm)
    ) &&
    piece.notches.every(notch => notch && finitePoint(notch.point) &&
      Number.isFinite(notch.angleDeg) && Number.isFinite(notch.depthCm)) &&
    piece.grainlines.every(line => line && finitePoint(line.p1) && finitePoint(line.p2))
  );
  const validSummaries = summaries.every(summary =>
    summary && typeof summary.pieceId === 'string' &&
    typeof summary.nameAr === 'string' && typeof summary.nameEn === 'string' &&
    Number.isFinite(summary.lengthCm) && Number.isFinite(summary.widthCm) &&
    Number.isFinite(summary.seamAllowanceCm) && Number.isFinite(summary.notchesCount) &&
    typeof summary.notesAr === 'string'
  );
  if (!validPieces || !validSummaries || new Set(pieceIds).size !== pieceIds.length) {
    throw new Error('تحتوي وثيقة CAD على عناصر هندسية أو معرّفات قطع غير صالحة أو مكررة.');
  }

  const stitchPairs = schemaVersion === 1 ? [] : document.stitchPairs;
  if (!validStitchPairs(stitchPairs, pieces)) {
    throw new Error('تحتوي وثيقة CAD على وصلات خياطة غير صالحة أو على مراجع حواف غير موجودة.');
  }

  return {
    schemaVersion: 2,
    projectId: document.projectId,
    updatedAt: typeof document.updatedAt === 'string' ? document.updatedAt : new Date(0).toISOString(),
    pieces,
    summaries,
    stitchPairs
  };
}

export function loadCadProjectDocument(
  storage: Pick<Storage, 'getItem'> | null,
  projectId: string
): CadProjectDocument | null {
  if (!storage || !projectId) return null;
  try {
    const raw = storage.getItem(STORAGE_PREFIX + projectId) ??
      storage.getItem(LEGACY_STORAGE_PREFIX + projectId);
    if (!raw) return null;
    return clone(validateCadProjectDocument(JSON.parse(raw), projectId));
  } catch {
    return null;
  }
}

export function saveCadProjectDocument(
  storage: (Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'getItem' | 'removeItem'>>) | null,
  projectId: string,
  pieces: CadPiece[],
  summaries: PieceSpecSummary[],
  now = new Date().toISOString(),
  stitchPairs?: CadStitchPair[]
): boolean {
  if (!storage || !projectId) return false;
  const previous = stitchPairs === undefined && storage.getItem
    ? loadCadProjectDocument(storage as Pick<Storage, 'getItem'>, projectId)
    : null;
  const document: CadProjectDocument = {
    schemaVersion: 2,
    projectId,
    updatedAt: now,
    pieces: clone(pieces),
    summaries: clone(summaries),
    stitchPairs: clone(stitchPairs ?? previous?.stitchPairs ?? [])
  };
  try {
    validateCadProjectDocument(document, projectId);
    storage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(document));
    storage.removeItem?.(LEGACY_STORAGE_PREFIX + projectId);
    notifyCadDocumentChanged(projectId);
    return true;
  } catch {
    return false;
  }
}

/** Removes both current and legacy CAD documents when their project is deleted. */
export function deleteCadProjectDocument(
  storage: Pick<Storage, 'removeItem'> | null,
  projectId: string
): boolean {
  if (!storage || !projectId) return false;
  try {
    storage.removeItem(STORAGE_PREFIX + projectId);
    storage.removeItem(LEGACY_STORAGE_PREFIX + projectId);
    notifyCadDocumentChanged(projectId);
    return true;
  } catch {
    return false;
  }
}
