import type { CadPiece, CadSegment } from './pattern-cad-engine';

export interface CadEdgeReference {
  pieceId: string;
  segmentId: string;
}

export interface CadStitchPair {
  id: string;
  first: CadEdgeReference;
  second: CadEdgeReference;
  mode: 'plain' | 'ease' | 'gather';
  /** Expected length difference in centimetres, used only for an ease/gather seam. */
  expectedEaseCm?: number;
}

export interface CadSeamSuggestion {
  id: string;
  first: CadEdgeReference;
  second: CadEdgeReference;
  firstPieceName: string;
  secondPieceName: string;
  edgeType: NonNullable<CadSegment['edgeType']>;
  firstLengthCm: number;
  secondLengthCm: number;
  differenceCm: number;
  differencePercent: number;
  confidence: number;
}

export interface CadStitchAuditItem {
  pairId: string;
  first: CadEdgeReference;
  second: CadEdgeReference;
  firstPieceName: string;
  secondPieceName: string;
  edgeType: CadSegment['edgeType'];
  firstLengthCm: number;
  secondLengthCm: number;
  differenceCm: number;
  status: 'ready' | 'ease-required' | 'length-mismatch' | 'invalid';
  messageAr: string;
}

export interface CadSewingAudit {
  pairCount: number;
  readyCount: number;
  easeCount: number;
  mismatchCount: number;
  invalidCount: number;
  unpairedEdgeCount: number;
  items: CadStitchAuditItem[];
  suggestions: CadSeamSuggestion[];
}

export interface CadSeamSuggestionOptions {
  maxDifferenceCm?: number;
  maxDifferencePercent?: number;
  maxSuggestions?: number;
  excludedEdgeTypes?: CadSegment['edgeType'][];
}

interface ResolvedEdge {
  reference: CadEdgeReference;
  pieceName: string;
  segment: CadSegment;
  lengthCm: number;
}

const DEFAULT_SAMPLE_STEPS = 48;
const DEFAULT_TOLERANCE_CM = 0.35;

function pointAt(segment: CadSegment, t: number) {
  const oneMinus = 1 - t;
  if (segment.type === 'quad' && segment.cp1) {
    return {
      x: oneMinus * oneMinus * segment.p1.x +
        2 * oneMinus * t * segment.cp1.x + t * t * segment.p2.x,
      y: oneMinus * oneMinus * segment.p1.y +
        2 * oneMinus * t * segment.cp1.y + t * t * segment.p2.y
    };
  }
  if (segment.type === 'bezier' && segment.cp1 && segment.cp2) {
    return {
      x: oneMinus ** 3 * segment.p1.x +
        3 * oneMinus * oneMinus * t * segment.cp1.x +
        3 * oneMinus * t * t * segment.cp2.x + t ** 3 * segment.p2.x,
      y: oneMinus ** 3 * segment.p1.y +
        3 * oneMinus * oneMinus * t * segment.cp1.y +
        3 * oneMinus * t * t * segment.cp2.y + t ** 3 * segment.p2.y
    };
  }
  return {
    x: segment.p1.x + (segment.p2.x - segment.p1.x) * t,
    y: segment.p1.y + (segment.p2.y - segment.p1.y) * t
  };
}

/** Measures a CAD edge from its actual line/Bezier geometry, not its display label. */
export function measureCadSegmentLengthCm(
  segment: CadSegment,
  steps = DEFAULT_SAMPLE_STEPS
): number {
  if (!Number.isInteger(steps) || steps < 2 || steps > 2048) {
    throw new Error('عدد عينات قياس الحافة غير صالح.');
  }
  let length = 0;
  let previous = pointAt(segment, 0);
  for (let index = 1; index <= steps; index++) {
    const current = pointAt(segment, index / steps);
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
    previous = current;
  }
  if (!Number.isFinite(length)) throw new Error('تعذر قياس طول حافة CAD.');
  return length;
}

function edgeIndex(pieces: CadPiece[]): Map<string, ResolvedEdge> {
  const index = new Map<string, ResolvedEdge>();
  for (const piece of pieces) {
    for (const segment of piece.segments) {
      index.set(`${piece.id}\u0000${segment.id}`, {
        reference: { pieceId: piece.id, segmentId: segment.id },
        pieceName: piece.nameAr || piece.name,
        segment,
        lengthCm: measureCadSegmentLengthCm(segment)
      });
    }
  }
  return index;
}

function referenceKey(reference: CadEdgeReference) {
  return `${reference.pieceId}\u0000${reference.segmentId}`;
}

function edgeIsSewable(segment: CadSegment) {
  return (segment.layer === 'cutting' || segment.layer === 'seam') &&
    segment.edgeType !== undefined &&
    segment.edgeType !== 'center' &&
    segment.edgeType !== 'general';
}

/**
 * Suggests one-to-one seam matches using semantic edge type and measured curve length.
 * Suggestions are never applied automatically; a designer must confirm each connection.
 */
export function suggestCadStitchPairs(
  pieces: CadPiece[],
  existingPairs: CadStitchPair[] = [],
  options: CadSeamSuggestionOptions = {}
): CadSeamSuggestion[] {
  const maxDifferenceCm = options.maxDifferenceCm ?? 4;
  const maxDifferencePercent = options.maxDifferencePercent ?? 0.2;
  const maxSuggestions = options.maxSuggestions ?? 40;
  const excluded = new Set(options.excludedEdgeTypes ?? ['center', 'general']);
  const paired = new Set(existingPairs.flatMap(pair => [
    referenceKey(pair.first), referenceKey(pair.second)
  ]));
  const edges = [...edgeIndex(pieces).values()].filter(edge =>
    edgeIsSewable(edge.segment) &&
    !excluded.has(edge.segment.edgeType) &&
    !paired.has(referenceKey(edge.reference)) &&
    edge.lengthCm > 0.05
  );

  const candidates: Array<CadSeamSuggestion & { sortScore: number }> = [];
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const first = edges[i];
      const second = edges[j];
      if (first.reference.pieceId === second.reference.pieceId) continue;
      if (first.segment.edgeType !== second.segment.edgeType) continue;

      const differenceCm = Math.abs(first.lengthCm - second.lengthCm);
      const longest = Math.max(first.lengthCm, second.lengthCm);
      const differencePercent = differenceCm / longest;
      if (differenceCm > maxDifferenceCm || differencePercent > maxDifferencePercent) continue;

      const confidence = Math.max(0, 1 - Math.max(
        differenceCm / maxDifferenceCm,
        differencePercent / maxDifferencePercent
      ));
      const [a, b] = [first.reference, second.reference].sort((left, right) =>
        referenceKey(left).localeCompare(referenceKey(right))
      );
      const orderedFirst = a === first.reference ? first : second;
      const orderedSecond = a === first.reference ? second : first;
      const id = `${referenceKey(a)}::${referenceKey(b)}`;
      candidates.push({
        id,
        first: a,
        second: b,
        firstPieceName: orderedFirst.pieceName,
        secondPieceName: orderedSecond.pieceName,
        edgeType: first.segment.edgeType!,
        firstLengthCm: orderedFirst.lengthCm,
        secondLengthCm: orderedSecond.lengthCm,
        differenceCm,
        differencePercent,
        confidence,
        sortScore: differenceCm + differencePercent * 2
      });
    }
  }

  candidates.sort((a, b) => a.sortScore - b.sortScore || a.id.localeCompare(b.id));
  const used = new Set(paired);
  const suggestions: CadSeamSuggestion[] = [];
  for (const candidate of candidates) {
    const firstKey = referenceKey(candidate.first);
    const secondKey = referenceKey(candidate.second);
    if (used.has(firstKey) || used.has(secondKey)) continue;
    used.add(firstKey);
    used.add(secondKey);
    const { sortScore: _sortScore, ...suggestion } = candidate;
    suggestions.push(suggestion);
    if (suggestions.length >= maxSuggestions) break;
  }
  return suggestions;
}

/** Audits explicitly confirmed panel-edge connections and identifies remaining candidates. */
export function auditCadSewing(
  pieces: CadPiece[],
  stitchPairs: CadStitchPair[] = [],
  toleranceCm = DEFAULT_TOLERANCE_CM
): CadSewingAudit {
  if (!Number.isFinite(toleranceCm) || toleranceCm < 0) {
    throw new Error('هامش تدقيق الخياطة غير صالح.');
  }
  const index = edgeIndex(pieces);
  const used = new Set<string>();
  const seenPairIds = new Set<string>();
  const items: CadStitchAuditItem[] = [];

  for (const pair of stitchPairs) {
    const first = index.get(referenceKey(pair.first));
    const second = index.get(referenceKey(pair.second));
    const duplicateId = seenPairIds.has(pair.id);
    seenPairIds.add(pair.id);
    const firstKey = referenceKey(pair.first);
    const secondKey = referenceKey(pair.second);
    const duplicateEdge = used.has(firstKey) || used.has(secondKey);
    used.add(firstKey);
    used.add(secondKey);

    if (!pair.id || duplicateId || !first || !second ||
        first.reference.pieceId === second.reference.pieceId ||
        !edgeIsSewable(first.segment) || !edgeIsSewable(second.segment) ||
        !['plain', 'ease', 'gather'].includes(pair.mode) ||
        (pair.expectedEaseCm !== undefined &&
          (!Number.isFinite(pair.expectedEaseCm) || pair.expectedEaseCm < 0)) ||
        duplicateEdge) {
      items.push({
        pairId: pair.id || 'invalid-pair',
        first: pair.first,
        second: pair.second,
        firstPieceName: first?.pieceName ?? pair.first.pieceId,
        secondPieceName: second?.pieceName ?? pair.second.pieceId,
        edgeType: first?.segment.edgeType,
        firstLengthCm: first?.lengthCm ?? 0,
        secondLengthCm: second?.lengthCm ?? 0,
        differenceCm: 0,
        status: 'invalid',
        messageAr: 'وصلة الخياطة غير صالحة أو تعيد استخدام حافة مرتبطة بوصلة أخرى.'
      });
      continue;
    }

    const differenceCm = Math.abs(first.lengthCm - second.lengthCm);
    const expectedEase = pair.mode === 'plain' ? 0 : pair.expectedEaseCm ?? 0;
    const residual = Math.abs(differenceCm - expectedEase);
    const status = residual <= toleranceCm
      ? 'ready'
      : pair.mode === 'plain' ? 'ease-required' : 'length-mismatch';
    const messageAr = status === 'ready'
      ? pair.mode === 'plain' ? 'طولا الحافتين متوافقان ضمن هامش التدقيق.' : 'فرق الطول يتوافق مع مقدار التسهيل المحدد.'
      : status === 'ease-required'
        ? 'يوجد فرق طول؛ حدّد مقدار التسهيل أو راجع رسم الحافة.'
        : 'فرق الطول لا يطابق مقدار التسهيل المحفوظ؛ يلزم تعديل الباترون أو الوصلة.';

    items.push({
      pairId: pair.id,
      first: pair.first,
      second: pair.second,
      firstPieceName: first.pieceName,
      secondPieceName: second.pieceName,
      edgeType: first.segment.edgeType,
      firstLengthCm: first.lengthCm,
      secondLengthCm: second.lengthCm,
      differenceCm,
      status,
      messageAr
    });
  }

  const suggestions = suggestCadStitchPairs(pieces, stitchPairs);
  return {
    pairCount: stitchPairs.length,
    readyCount: items.filter(item => item.status === 'ready').length,
    easeCount: items.filter(item => item.status === 'ease-required').length,
    mismatchCount: items.filter(item => item.status === 'length-mismatch').length,
    invalidCount: items.filter(item => item.status === 'invalid').length,
    unpairedEdgeCount: Math.max(0,
      [...index.values()].filter(edge => edgeIsSewable(edge.segment)).length - used.size
    ),
    items,
    suggestions
  };
}

export function createCadStitchPairFromSuggestion(
  suggestion: CadSeamSuggestion,
  easeThresholdCm = DEFAULT_TOLERANCE_CM
): CadStitchPair {
  const differenceCm = Math.abs(suggestion.firstLengthCm - suggestion.secondLengthCm);
  const mode = differenceCm > easeThresholdCm ? 'ease' : 'plain';
  return {
    id: suggestion.id,
    first: { ...suggestion.first },
    second: { ...suggestion.second },
    mode,
    ...(mode === 'ease' ? { expectedEaseCm: differenceCm } : {})
  };
}
