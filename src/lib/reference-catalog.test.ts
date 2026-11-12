import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type Catalog = {
  totalRecords: number;
  summary: Record<string, number>;
  records: Array<{
    id: string;
    contentGroup: string;
    evidenceLevel: string;
    requiresPageReview: boolean;
    isEditablePattern: boolean;
    familyShape: string;
    featureTagsAr: string[];
    sourceUrl: string;
  }>;
};

const catalog = JSON.parse(
  readFileSync(new URL('../../public/data/reference-garment-catalog.json', import.meta.url), 'utf8')
) as Catalog;

describe('original reference catalog governance', () => {
  it('preserves all indexed records and source classification counts', () => {
    assert.equal(catalog.totalRecords, 687);
    assert.deepEqual(catalog.summary, {
      design_candidate: 542,
      pattern_reference: 27,
      tutorial_pattern: 27,
      technique: 91
    });
    assert.equal(catalog.records.length, catalog.totalRecords);
  });

  it('keeps all source-derived features explicitly provisional', () => {
    assert.ok(catalog.records.every(record => record.evidenceLevel === 'filename_metadata_only'));
    assert.ok(catalog.records.every(record => record.requiresPageReview));
  });

  it('never promotes a reference candidate to an editable pattern automatically', () => {
    const candidates = catalog.records.filter(record =>
      record.contentGroup === 'pattern_reference' || record.contentGroup === 'tutorial_pattern'
    );
    assert.equal(candidates.length, 54);
    assert.ok(candidates.every(record => record.isEditablePattern === false));
  });

  it('uses unique identifiers and only supported original illustration families', () => {
    const ids = catalog.records.map(record => record.id);
    assert.equal(new Set(ids).size, ids.length);
    const families = new Set(['dress','trousers','skirt','shorts','outerwear','jumpsuit','intimates','varied','top']);
    assert.ok(catalog.records.every(record => families.has(record.familyShape)));
    assert.ok(catalog.records.every(record => Array.isArray(record.featureTagsAr)));
    assert.ok(catalog.records.every(record => record.sourceUrl.startsWith('https://github.com/')));
  });
});
