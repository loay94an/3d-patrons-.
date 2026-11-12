import type { FabricCustomState } from './fabric-engine';

const STORAGE_PREFIX = 'patron-studio.fabric.v1.';

function isFabricState(value: unknown): value is FabricCustomState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<FabricCustomState>;
  return typeof state.presetId === 'string' &&
    typeof state.color === 'string' &&
    typeof state.pattern === 'string' &&
    Number.isFinite(state.patternScale) &&
    Number.isFinite(state.roughness) &&
    Number.isFinite(state.sheen) &&
    Number.isFinite(state.opacity) &&
    Number.isFinite(state.stiffness);
}

export function loadProjectFabric(
  storage: Pick<Storage, 'getItem'> | null,
  projectId: string
): FabricCustomState | null {
  if (!storage || !projectId) return null;
  try {
    const raw = storage.getItem(STORAGE_PREFIX + projectId);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isFabricState(parsed) ? { ...parsed } : null;
  } catch {
    return null;
  }
}

export function saveProjectFabric(
  storage: Pick<Storage, 'setItem'> | null,
  projectId: string,
  fabric: FabricCustomState
): boolean {
  if (!storage || !projectId || !isFabricState(fabric)) return false;
  try {
    storage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(fabric));
    return true;
  } catch {
    return false;
  }
}

export function deleteProjectFabric(
  storage: Pick<Storage, 'removeItem'> | null,
  projectId: string
): boolean {
  if (!storage || !projectId) return false;
  try {
    storage.removeItem(STORAGE_PREFIX + projectId);
    return true;
  } catch {
    return false;
  }
}
