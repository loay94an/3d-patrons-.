import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createStudioProject, exportProjects, importProjects, loadProjects, persistProjects, saveProject, PROJECT_STORAGE_KEY } from './project-store';

describe('project workspace storage', () => {
  it('creates projects with independent measurement and ease profiles', () => {
    const project = createProject('اختبار', '2026-01-01T00:00:00.000Z');
    assert.equal(project.name, 'اختبار');
    assert.equal(project.version, 1);
    assert.equal(project.measurements.bust, 88);
  });
  it('creates a saved studio project with its chosen garment, measurements, and ease', () => {
    const project = createStudioProject('بلوزة تجريبية', 'blouse',
      { bust: 96, waist: 78, hip: 102, backLength: 42, sleeveLength: 60, upperArm: 32 },
      { bust: 5, waist: 3, hip: 4, upperArm: 3.5 }, '2026-01-04T00:00:00.000Z');
    assert.equal(project.garment, 'blouse');
    assert.equal(project.family, 'bodice');
    assert.equal(project.measurements.bust, 96);
    assert.equal(project.ease.bust, 5);
    assert.equal(project.version, 1);
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

  it('rejects malformed project history and duplicate project identifiers in imported archives', () => {
    const project = createProject('آمن');
    const malformed = { ...project, history: [{ version: 1, savedAt: project.createdAt, measurements: null, ease: project.ease, notes: '' }] };
    assert.throws(() => importProjects(exportProjects([malformed as typeof project])));
    assert.throws(() => importProjects(exportProjects([project, project])));
  });
  it('ignores malformed and duplicate local projects instead of exposing unsafe records to the UI', () => {
    const valid = createProject('صالح');
    const value = JSON.stringify([valid, { ...valid, id: 'broken', history: null }, { ...valid }]);
    const storage = { getItem: (_key: string) => value };
    const loaded = loadProjects(storage);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, valid.id);
  });
});
