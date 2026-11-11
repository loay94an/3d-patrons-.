import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, exportProjects, importProjects, loadProjects, persistProjects, saveProject, PROJECT_STORAGE_KEY } from './project-store';

describe('project workspace storage', () => {
  it('creates projects with independent measurement and ease profiles', () => {
    const project = createProject('اختبار', '2026-01-01T00:00:00.000Z');
    assert.equal(project.name, 'اختبار');
    assert.equal(project.version, 1);
    assert.equal(project.measurements.bust, 88);
  });
  it('creates immutable versions only when content changes', () => {
    const initial = createProject('نسخة', '2026-01-01T00:00:00.000Z');
    const unchanged = saveProject(initial, { notes: '' }, '2026-01-02T00:00:00.000Z');
    assert.equal(unchanged.version, 1);
    const changed = saveProject(initial, { notes: 'اختبار الملاءمة' }, '2026-01-03T00:00:00.000Z');
    assert.equal(changed.version, 2);
    assert.equal(changed.history.length, 1);
    assert.equal(changed.history[0].version, 1);
  });
  it('round trips project archives and rejects unsupported schemas', () => {
    const project = createProject();
    const restored = importProjects(exportProjects([project]));
    assert.equal(restored.length, 1);
    assert.equal(restored[0].id, project.id);
    assert.throws(() => importProjects(JSON.stringify({ schemaVersion: 99, projects: [] })));
  });
  it('loads and persists local storage safely', () => {
    let value: string | null = null;
    const storage = { getItem: (_key: string) => value, setItem: (_key: string, next: string) => { value = next; } };
    const project = createProject();
    assert.equal(persistProjects(storage, [project]), true);
    assert.equal(loadProjects(storage)[0].id, project.id);
    assert.equal(PROJECT_STORAGE_KEY, 'patron-studio.projects.v1');
    assert.equal(persistProjects(null, [project]), false);
  });
});
