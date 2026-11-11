import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMeasurementProfile } from './measurement-profile';
import { deleteSavedMeasurementProfile, loadSavedMeasurementProfiles, saveMeasurementProfile } from './measurement-profile-store';

const values = { bust: 88, waist: 70, hip: 96, backLength: 40, sleeveLength: 58, upperArm: 30 };
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) { return values.get(key) ?? null; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(key: string) { values.delete(key); },
    setItem(key: string, value: string) { values.set(key, value); }
  };
}

describe('saved measurement profiles', () => {
  it('persists, reloads, and updates a named profile without duplicates', () => {
    const storage = memoryStorage();
    const first = saveMeasurementProfile(storage, 'القياسات الأساسية', createMeasurementProfile(values), '2026-11-11T10:00:00.000Z');
    assert.equal(first?.length, 1);
    const updated = saveMeasurementProfile(storage, 'القياسات الأساسية', createMeasurementProfile({ ...values, bust: 92 }), '2026-11-11T11:00:00.000Z');
    assert.equal(updated?.length, 1);
    assert.equal(loadSavedMeasurementProfiles(storage)[0].profile.values.bust, 92);
  });

  it('deletes only the selected profile', () => {
    const storage = memoryStorage();
    const first = saveMeasurementProfile(storage, 'أول', createMeasurementProfile(values), '2026-11-11T10:00:00.000Z')!;
    saveMeasurementProfile(storage, 'ثان', createMeasurementProfile(values), '2026-11-11T11:00:00.000Z');
    const remaining = deleteSavedMeasurementProfile(storage, first[0].id);
    assert.equal(remaining?.length, 1);
    assert.equal(remaining?.[0].name, 'ثان');
  });

  it('handles corrupt or unavailable storage without throwing', () => {
    assert.deepEqual(loadSavedMeasurementProfiles(null), []);
    const broken = { getItem: () => '{broken' } as Pick<Storage, 'getItem'>;
    assert.deepEqual(loadSavedMeasurementProfiles(broken), []);
    assert.equal(saveMeasurementProfile(null, 'x', createMeasurementProfile(values)), null);
  });
});
