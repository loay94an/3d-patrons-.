export type ProjectGarment = 'blouse' | 'dress' | 'shirt' | 'skirt' | 'pants' | 'tshirt' | 'abaya' | 'coat' | 'hoodie' | 'blazer';
export type ProjectFamily = 'bodice' | 'skirt' | 'trousers' | 'jacket';
export interface ProjectMeasurements {
  bust: number; waist: number; hip: number; backLength: number; sleeveLength: number; upperArm: number;
}
export interface ProjectEase { bust: number; waist: number; hip: number; upperArm: number; }
export interface ProjectSnapshot {
  id: string; name: string; garment: ProjectGarment; family: ProjectFamily;
  measurements: ProjectMeasurements; ease: ProjectEase; notes: string;
  createdAt: string; updatedAt: string; version: number;
  history: Array<{ version: number; savedAt: string; measurements: ProjectMeasurements; ease: ProjectEase; notes: string }>;
}
export interface ProjectArchive { schemaVersion: 1; projects: ProjectSnapshot[]; exportedAt: string; }
export const PROJECT_STORAGE_KEY = 'patron-studio.projects.v1';
export const DEFAULT_PROJECT_MEASUREMENTS: ProjectMeasurements = { bust: 88, waist: 70, hip: 96, backLength: 40, sleeveLength: 58, upperArm: 30 };
export const DEFAULT_PROJECT_EASE: ProjectEase = { bust: 4, waist: 2, hip: 4, upperArm: 3 };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function createProject(name = 'مشروع جديد', now = new Date().toISOString()): ProjectSnapshot {
  return { id: createId(), name: name.trim() || 'مشروع جديد', garment: 'blouse', family: 'bodice',
    measurements: { ...DEFAULT_PROJECT_MEASUREMENTS }, ease: { ...DEFAULT_PROJECT_EASE }, notes: '',
    createdAt: now, updatedAt: now, version: 1, history: [] };
}
function createId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
export function saveProject(project: ProjectSnapshot, patch: Partial<Pick<ProjectSnapshot, 'name' | 'garment' | 'family' | 'measurements' | 'ease' | 'notes'>>, now = new Date().toISOString()): ProjectSnapshot {
  const changed = { ...project, ...patch };
  const snapshot = { version: project.version, savedAt: now, measurements: clone(project.measurements), ease: clone(project.ease), notes: project.notes };
  const contentChanged = JSON.stringify({ name: project.name, garment: project.garment, family: project.family, measurements: project.measurements, ease: project.ease, notes: project.notes }) !==
    JSON.stringify({ name: changed.name, garment: changed.garment, family: changed.family, measurements: changed.measurements, ease: changed.ease, notes: changed.notes });
  if (!contentChanged) return project;
  return { ...changed, updatedAt: now, version: project.version + 1, history: [...project.history, snapshot].slice(-20) };
}
export function validateProjectArchive(value: unknown): ProjectArchive {
  if (!value || typeof value !== 'object') throw new Error('ملف المشروع غير صالح.');
  const archive = value as Partial<ProjectArchive>;
  if (archive.schemaVersion !== 1 || !Array.isArray(archive.projects)) throw new Error('إصدار ملف المشاريع غير مدعوم.');
  const valid = archive.projects.every(project => project && typeof project.id === 'string' && typeof project.name === 'string' &&
    project.measurements && ['bust','waist','hip','backLength','sleeveLength','upperArm'].every(key => Number.isFinite(project.measurements[key as keyof ProjectMeasurements])) &&
    project.ease && ['bust','waist','hip','upperArm'].every(key => Number.isFinite(project.ease[key as keyof ProjectEase])));
  if (!valid) throw new Error('توجد بيانات قياسات أو راحة غير مكتملة في الملف.');
  return archive as ProjectArchive;
}
export function exportProjects(projects: ProjectSnapshot[], now = new Date().toISOString()): string {
  return JSON.stringify({ schemaVersion: 1, exportedAt: now, projects } satisfies ProjectArchive, null, 2);
}
export function importProjects(json: string): ProjectSnapshot[] {
  const archive = validateProjectArchive(JSON.parse(json));
  return archive.projects.map(project => clone(project));
}
export function loadProjects(storage: Pick<Storage, 'getItem'> | null): ProjectSnapshot[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(project => project && typeof project.id === 'string' && project.measurements && project.ease);
  } catch { return []; }
}
export function persistProjects(storage: Pick<Storage, 'setItem'> | null, projects: ProjectSnapshot[]): boolean {
  if (!storage) return false;
  try { storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects)); return true; }
  catch { return false; }
}
