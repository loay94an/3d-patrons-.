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
const garments: ProjectGarment[] = ['blouse', 'dress', 'shirt', 'skirt', 'pants', 'tshirt', 'abaya', 'coat', 'hoodie', 'blazer'];
const families: ProjectFamily[] = ['bodice', 'skirt', 'trousers', 'jacket'];
const measurementKeys: (keyof ProjectMeasurements)[] = ['bust', 'waist', 'hip', 'backLength', 'sleeveLength', 'upperArm'];
const easeKeys: (keyof ProjectEase)[] = ['bust', 'waist', 'hip', 'upperArm'];
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
function validMeasurements(value: unknown): value is ProjectMeasurements {
  return isRecord(value) && measurementKeys.every(key => Number.isFinite(value[key]) && Number(value[key]) > 0 && Number(value[key]) <= 1000);
}
function validEase(value: unknown): value is ProjectEase {
  return isRecord(value) && easeKeys.every(key => Number.isFinite(value[key]) && Math.abs(Number(value[key])) <= 100);
}
function validHistoryEntry(value: unknown, currentVersion: number): value is ProjectSnapshot['history'][number] {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.version) && Number(value.version) > 0 && Number(value.version) <= currentVersion &&
    validDate(value.savedAt) && validMeasurements(value.measurements) && validEase(value.ease) &&
    typeof value.notes === 'string';
}
export function isValidProjectSnapshot(value: unknown): value is ProjectSnapshot {
  if (!isRecord(value)) return false;
  const version = value.version;
  if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 160 ||
      typeof value.name !== 'string' || !value.name.trim() || value.name.length > 160 ||
      !garments.includes(value.garment as ProjectGarment) || !families.includes(value.family as ProjectFamily) ||
      !validMeasurements(value.measurements) || !validEase(value.ease) ||
      typeof value.notes !== 'string' || !validDate(value.createdAt) || !validDate(value.updatedAt) ||
      !Number.isInteger(version) || Number(version) < 1 || !Array.isArray(value.history) || value.history.length > 20) return false;
  return value.history.every(item => validHistoryEntry(item, Number(version)));
}
export function createProject(name = 'مشروع جديد', now = new Date().toISOString()): ProjectSnapshot {
  return { id: createId(), name: name.trim() || 'مشروع جديد', garment: 'blouse', family: 'bodice',
    measurements: { ...DEFAULT_PROJECT_MEASUREMENTS }, ease: { ...DEFAULT_PROJECT_EASE }, notes: '',
    createdAt: now, updatedAt: now, version: 1, history: [] };
}
function createId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
export function createStudioProject(
  name: string,
  garment: ProjectGarment,
  measurements: ProjectMeasurements,
  ease: ProjectEase,
  now = new Date().toISOString()
): ProjectSnapshot {
  const base = createProject(name, now);
  const family: ProjectFamily = garment === 'pants' ? 'trousers'
    : garment === 'skirt' ? 'skirt'
    : garment === 'coat' || garment === 'blazer' ? 'jacket'
    : 'bodice';
  return { ...base, garment, family, measurements: { ...measurements }, ease: { ...ease } };
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
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.projects) ||
      value.projects.length > 1000 || !validDate(value.exportedAt)) {
    throw new Error('ملف المشروع غير صالح أو أن إصدار ملف المشاريع غير مدعوم.');
  }
  const ids = new Set<string>();
  for (const project of value.projects) {
    if (!isValidProjectSnapshot(project) || ids.has(project.id)) {
      throw new Error('توجد بيانات مشروع ناقصة أو معرّفات مكررة أو سجل نسخ غير صالح في الملف.');
    }
    ids.add(project.id);
  }
  return value as unknown as ProjectArchive;
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
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((project): project is ProjectSnapshot => {
      if (!isValidProjectSnapshot(project) || seen.has(project.id)) return false;
      seen.add(project.id);
      return true;
    });
  } catch { return []; }
}
export function persistProjects(storage: Pick<Storage, 'setItem'> | null, projects: ProjectSnapshot[]): boolean {
  if (!storage) return false;
  try { storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects)); return true; }
  catch { return false; }
}
