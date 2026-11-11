import type { CadPiece, PieceSpecSummary } from './pattern-cad-engine';

export interface CadProjectDocument {
  schemaVersion: 1;
  projectId: string;
  updatedAt: string;
  pieces: CadPiece[];
  summaries: PieceSpecSummary[];
}

const STORAGE_PREFIX = 'patron-studio.cad.v1.';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function finitePoint(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const point = value as { x?: unknown; y?: unknown };
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function validateCadProjectDocument(value: unknown, expectedProjectId?: string): CadProjectDocument {
  if (!value || typeof value !== 'object') throw new Error('ملف هندسة CAD غير صالح.');
  const document = value as Partial<CadProjectDocument>;
  if (document.schemaVersion !== 1 || typeof document.projectId !== 'string' ||
      (expectedProjectId && document.projectId !== expectedProjectId) ||
      !Array.isArray(document.pieces) || !Array.isArray(document.summaries)) {
    throw new Error('بنية ملف هندسة CAD غير مدعومة أو لا تخص هذا المشروع.');
  }
  if (document.pieces.length > 500 || document.summaries.length > 500) {
    throw new Error('يتجاوز ملف CAD الحد المسموح به من القطع.');
  }
  const validPieces = document.pieces.every(piece =>
    piece && typeof piece.id === 'string' && typeof piece.name === 'string' &&
    typeof piece.nameAr === 'string' && Array.isArray(piece.segments) &&
    piece.segments.length <= 2000 && Array.isArray(piece.notches) &&
    Array.isArray(piece.grainlines) && Number.isFinite(piece.seamAllowanceCm) &&
    piece.segments.every(segment =>
      segment && typeof segment.id === 'string' &&
      ['line', 'quad', 'bezier'].includes(segment.type) &&
      finitePoint(segment.p1) && finitePoint(segment.p2) &&
      (segment.cp1 === undefined || finitePoint(segment.cp1)) &&
      (segment.cp2 === undefined || finitePoint(segment.cp2)) &&
      Number.isFinite(segment.lengthCm)
    ) &&
    piece.notches.every(notch => notch && finitePoint(notch.point) &&
      Number.isFinite(notch.angleDeg) && Number.isFinite(notch.depthCm)) &&
    piece.grainlines.every(line => line && finitePoint(line.p1) && finitePoint(line.p2))
  );
  const validSummaries = document.summaries.every(summary =>
    summary && typeof summary.pieceId === 'string' &&
    typeof summary.nameAr === 'string' && typeof summary.nameEn === 'string' &&
    Number.isFinite(summary.lengthCm) && Number.isFinite(summary.widthCm) &&
    Number.isFinite(summary.seamAllowanceCm) && Number.isFinite(summary.notchesCount) &&
    typeof summary.notesAr === 'string'
  );
  if (!validPieces || !validSummaries) throw new Error('تحتوي وثيقة CAD على عناصر هندسية غير صالحة.');
  return document as CadProjectDocument;
}

export function loadCadProjectDocument(
  storage: Pick<Storage, 'getItem'> | null,
  projectId: string
): CadProjectDocument | null {
  if (!storage || !projectId) return null;
  try {
    const raw = storage.getItem(STORAGE_PREFIX + projectId);
    if (!raw) return null;
    return clone(validateCadProjectDocument(JSON.parse(raw), projectId));
  } catch {
    return null;
  }
}

export function saveCadProjectDocument(
  storage: Pick<Storage, 'setItem'> | null,
  projectId: string,
  pieces: CadPiece[],
  summaries: PieceSpecSummary[],
  now = new Date().toISOString()
): boolean {
  if (!storage || !projectId) return false;
  const document: CadProjectDocument = {
    schemaVersion: 1,
    projectId,
    updatedAt: now,
    pieces: clone(pieces),
    summaries: clone(summaries)
  };
  try {
    validateCadProjectDocument(document, projectId);
    storage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(document));
    return true;
  } catch {
    return false;
  }
}

/** Removes the CAD document associated with a deleted project. */
export function deleteCadProjectDocument(
  storage: Pick<Storage, 'removeItem'> | null,
  projectId: string
): boolean {
  if (!storage || !projectId) return false;
  try {
    storage.removeItem(STORAGE_PREFIX + projectId);
    return true;
  } catch {
    return false;
  }
}
