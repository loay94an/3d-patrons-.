import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deleteCadProjectDocument, loadCadProjectDocument, saveCadProjectDocument, validateCadProjectDocument } from './cad-project-document';
import type { CadPiece, PieceSpecSummary } from './pattern-cad-engine';

const pieces: CadPiece[] = [{
  id: 'piece-1', name: 'Front', nameAr: 'الأمام', garmentType: 'custom',
  segments: [{ id: 's1', type: 'line', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, layer: 'cutting', lengthCm: 10 }],
  notches: [], grainlines: [], seamAllowanceCm: 1.5, notes: 'اختبار'
}];
const summaries: PieceSpecSummary[] = [{
  pieceId: 'piece-1', nameAr: 'الأمام', nameEn: 'Front', lengthCm: 10,
  widthCm: 5, seamAllowanceCm: 1.5, notchesCount: 0, notesAr: 'اختبار'
}];

describe('per-project CAD document storage', () => {
  it('round trips CAD pieces and summaries for the matching project', () => {
    let stored: string | null = null;
    const storage = {
      getItem: (_key: string) => stored,
      setItem: (_key: string, value: string) => { stored = value; }
    };
    assert.equal(saveCadProjectDocument(storage, 'project-a', pieces, summaries, '2026-01-01T00:00:00.000Z'), true);
    const loaded = loadCadProjectDocument(storage, 'project-a');
    assert.deepEqual(loaded?.pieces, pieces);
    assert.deepEqual(loaded?.summaries, summaries);
    assert.equal(loadCadProjectDocument(storage, 'project-b'), null);
  });

  it('removes the CAD document when its project is deleted', () => {
    let stored: string | null = null;
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => { stored = value; },
      removeItem: (_key: string) => { stored = null; }
    };
    saveCadProjectDocument(storage, 'project-a', pieces, summaries);
    assert.ok(loadCadProjectDocument(storage, 'project-a'));
    assert.equal(deleteCadProjectDocument(storage, 'project-a'), true);
    assert.equal(loadCadProjectDocument(storage, 'project-a'), null);
  });

  it('rejects documents belonging to a different project', () => {
    const document = { schemaVersion: 1, projectId: 'a', updatedAt: 'now', pieces, summaries };
    assert.throws(() => validateCadProjectDocument(document, 'b'));
  });

  it('rejects malformed geometry and safely ignores corrupted local storage', () => {
    const malformed = { schemaVersion: 1, projectId: 'a', updatedAt: 'now',
      pieces: [{ ...pieces[0], segments: [{ ...pieces[0].segments[0], p1: { x: Number.NaN, y: 0 } }] }],
      summaries };
    assert.throws(() => validateCadProjectDocument(malformed));
    const storage = { getItem: () => '{broken json' };
    assert.equal(loadCadProjectDocument(storage, 'a'), null);
  });
});
