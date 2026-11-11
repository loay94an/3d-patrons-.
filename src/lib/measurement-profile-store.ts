import type { MeasurementProfile } from './measurement-profile';

export interface SavedMeasurementProfile {
  id: string;
  name: string;
  profile: MeasurementProfile;
  updatedAt: string;
}

const STORAGE_KEY = '3d-patrons.measurement-profiles.v1';

function isProfile(value: unknown): value is MeasurementProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MeasurementProfile>;
  if (candidate.schemaVersion !== 1 || candidate.unit !== 'cm') return false;
  if (!['manual', 'standard-size', 'imported'].includes(String(candidate.source))) return false;
  const values = candidate.values;
  return Boolean(values && ['bust', 'waist', 'hip', 'backLength', 'sleeveLength', 'upperArm']
    .every(key => Number.isFinite(values[key as keyof typeof values])));
}

function isRecord(value: unknown): value is SavedMeasurementProfile {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<SavedMeasurementProfile>;
  return typeof record.id === 'string' && record.id.length > 0 &&
    typeof record.name === 'string' && record.name.trim().length > 0 &&
    typeof record.updatedAt === 'string' && isProfile(record.profile);
}

export function loadSavedMeasurementProfiles(storage: Pick<Storage, 'getItem'> | null): SavedMeasurementProfile[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveMeasurementProfile(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  name: string,
  profile: MeasurementProfile,
  now = new Date().toISOString()
): SavedMeasurementProfile[] | null {
  const cleanName = name.trim().slice(0, 60);
  if (!storage || !cleanName || !isProfile(profile)) return null;
  try {
    const current = loadSavedMeasurementProfiles(storage);
    const existing = current.find(item => item.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
    const record: SavedMeasurementProfile = {
      id: existing?.id ?? `measurement-${Date.parse(now) || Date.now()}`,
      name: cleanName,
      profile: { ...profile, values: { ...profile.values } },
      updatedAt: now
    };
    const next = [record, ...current.filter(item => item.id !== record.id)];
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function deleteSavedMeasurementProfile(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  id: string
): SavedMeasurementProfile[] | null {
  if (!storage || !id) return null;
  try {
    const next = loadSavedMeasurementProfiles(storage).filter(item => item.id !== id);
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}
