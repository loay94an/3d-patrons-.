import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FABRIC_STATE } from './fabric-engine';
import { deleteProjectFabric, loadProjectFabric, saveProjectFabric } from './project-fabric-store';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

describe('project fabric persistence', () => {
  it('round-trips the selected fabric for an individual project', () => {
    const storage = memoryStorage();
    const selected = { ...DEFAULT_FABRIC_STATE, presetId: 'linen', color: '#aabbcc', stiffness: 0.4 };
    assert.equal(saveProjectFabric(storage, 'project-a', selected), true);
    assert.deepEqual(loadProjectFabric(storage, 'project-a'), selected);
    assert.equal(loadProjectFabric(storage, 'project-b'), null);
  });

  it('rejects malformed stored data without throwing', () => {
    const storage = memoryStorage();
    storage.setItem('patron-studio.fabric.v1.project-a', JSON.stringify({ presetId: 'linen' }));
    assert.equal(loadProjectFabric(storage, 'project-a'), null);
  });

  it('deletes only the requested project fabric', () => {
    const storage = memoryStorage();
    saveProjectFabric(storage, 'project-a', DEFAULT_FABRIC_STATE);
    saveProjectFabric(storage, 'project-b', DEFAULT_FABRIC_STATE);
    assert.equal(deleteProjectFabric(storage, 'project-a'), true);
    assert.equal(loadProjectFabric(storage, 'project-a'), null);
    assert.deepEqual(loadProjectFabric(storage, 'project-b'), DEFAULT_FABRIC_STATE);
  });
});
