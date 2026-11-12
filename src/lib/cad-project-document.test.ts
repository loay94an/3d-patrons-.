import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deleteCadProjectDocument, loadCadProjectDocument, saveCadProjectDocument, validateCadProjectDocument } from './cad-project-document';
import type { CadPiece, PieceSpecSummary } from './pattern-cad-engine';
import type { CadStitchPair } from './cad-sewing-engine';

const pieces: CadPiece[] = [{
  id: 'piece-1', name: 'Front', nameAr: 'الأمام', garmentType: 'custom',
  segments: [{ id: 's1', type: 'line', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, layer: 'cutting', lengthCm: 10 }],
  notches: [], grainlines: [], seamAllowanceCm: 1.5, notes: 'اختبار'
}];
const backPieces: CadPiece[] = [{
  ...pieces[0], id: 'piece-2', name: 'Back', nameAr: 'الخلف',
  segments: [{ id: 's2', type: 'line', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, layer: 'cutting', lengthCm: 10 }]
}];
const stitchPairs: CadStitchPair[] = [{
  id: 'shoulder-link', first: { pieceId: 'piece-1', segmentId: 's1' },
  second: { pieceId: 'piece-2', segmentId: 's2' }, mode: 'plain'
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
    assert.equal(saveCadProjectDocument(storage, 'project-a', [...pieces, ...backPieces], summaries, '2026-01-01T00:00:00.000Z', stitchPairs), true);
    const loaded = loadCadProjectDocument(storage, 'project-a');
    assert.deepEqual(loaded?.pieces, [...pieces, ...backPieces]);
    assert.deepEqual(loaded?.summaries, summaries);
    assert.deepEqual(loaded?.stitchPairs, stitchPairs);
    assert.equal(loaded?.schemaVersion, 2);
    assert.equal(loadCadProjectDocument(storage, 'project-b'), null);
  });

  it('removes the CAD document when its project is deleted', () => {
    let stored: string | null = null;
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); }
    };
    saveCadProjectDocument(storage, 'project-a', pieces, summaries);
    assert.ok(loadCadProjectDocument(storage, 'project-a'));
    values.set('patron-studio.cad.v1.project-a', JSON.stringify({ schemaVersion: 1, projectId: 'project-a', updatedAt: 'now', pieces, summaries }));
    assert.equal(deleteCadProjectDocument(storage, 'project-a'), true);
    assert.equal(values.has('patron-studio.cad.v1.project-a'), false);
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

  it('migrates legacy version-1 CAD documents without losing their pattern geometry', () => {
    const legacy = JSON.stringify({ schemaVersion: 1, projectId: 'legacy', updatedAt: 'now', pieces, summaries });
    const storage = {
      getItem: (key: string) => key === 'patron-studio.cad.v1.legacy' ? legacy : null
    };
    const loaded = loadCadProjectDocument(storage, 'legacy');
    assert.equal(loaded?.schemaVersion, 2);
    assert.deepEqual(loaded?.pieces, pieces);
    assert.deepEqual(loaded?.stitchPairs, []);
  });

  it('rejects seam links whose panel or segment references do not exist', () => {
    const malformed = {
      schemaVersion: 2, projectId: 'a', updatedAt: 'now',
      pieces: [...pieces, ...backPieces], summaries,
      stitchPairs: [{
        id: 'bad-link',
        first: { pieceId: 'piece-1', segmentId: 'missing' },
        second: { pieceId: 'piece-2', segmentId: 's2' },
        mode: 'plain'
      }]
    };
    assert.throws(() => validateCadProjectDocument(malformed));
  });

  it('preserves confirmed stitch connections when older callers only update CAD pieces', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }
    };
    assert.equal(saveCadProjectDocument(storage, 'project-a', [...pieces, ...backPieces], summaries, 'first', stitchPairs), true);
    assert.equal(saveCadProjectDocument(storage, 'project-a', [...pieces, ...backPieces], summaries, 'second'), true);
    assert.deepEqual(loadCadProjectDocument(storage, 'project-a')?.stitchPairs, stitchPairs);
  });

});
