import * as THREE from 'three';

export interface AnnyBodyProfileSection {
  y: number;
  fraction: number;
  centerX: number;
  centerZ: number;
  circumference: number;
  radii: number[];
}

export interface AnnyBodyProfile {
  minY: number;
  maxY: number;
  height: number;
  hipY: number;
  waistY: number;
  neckY: number;
  bustY: number;
  sections: AnnyBodyProfileSection[];
}

export interface AnnyBodyProfileOptions {
  sectionCount?: number;
  radialSamples?: number;
  startFraction?: number;
  endFraction?: number;
  landmarks?: ReadonlyArray<{ zone: 'hip' | 'waist' | 'bust'; heightFraction: number }>;
}

interface SectionPoint {
  x: number;
  z: number;
}

interface ClosedContour {
  points: SectionPoint[];
  perimeter: number;
}

const EPSILON = 1e-8;
const KEY_SCALE = 1e5;

function pointKey(point: SectionPoint): string {
  return `${Math.round(point.x * KEY_SCALE)},${Math.round(point.z * KEY_SCALE)}`;
}

function findLargestClosedContour(
  worldPositions: Float64Array,
  triangleIndices: Uint32Array | Uint16Array | Uint8Array | null,
  triangleCount: number,
  y: number
): ClosedContour | null {
  const nodePositions = new Map<string, SectionPoint>();
  const adjacency = new Map<string, Set<string>>();
  const uniqueEdges = new Set<string>();

  const vertexY = (index: number) => worldPositions[index * 3 + 1];
  const vertexPoint = (index: number): SectionPoint => ({
    x: worldPositions[index * 3],
    z: worldPositions[index * 3 + 2]
  });

  for (let face = 0; face < triangleCount; face++) {
    const ids = [0, 1, 2].map(corner =>
      triangleIndices ? triangleIndices[face * 3 + corner] : face * 3 + corner
    );
    const intersections: SectionPoint[] = [];

    for (let edge = 0; edge < 3; edge++) {
      const a = ids[edge];
      const b = ids[(edge + 1) % 3];
      const da = vertexY(a) - y;
      const db = vertexY(b) - y;
      if (!((da < -EPSILON && db > EPSILON) || (da > EPSILON && db < -EPSILON))) continue;
      const t = da / (da - db);
      const pa = vertexPoint(a);
      const pb = vertexPoint(b);
      intersections.push({
        x: THREE.MathUtils.lerp(pa.x, pb.x, t),
        z: THREE.MathUtils.lerp(pa.z, pb.z, t)
      });
    }

    if (intersections.length !== 2) continue;
    const [a, b] = intersections;
    const keyA = pointKey(a);
    const keyB = pointKey(b);
    if (keyA === keyB) continue;
    const edgeKey = keyA < keyB ? keyA + '|' + keyB : keyB + '|' + keyA;
    if (uniqueEdges.has(edgeKey)) continue;
    uniqueEdges.add(edgeKey);
    nodePositions.set(keyA, a);
    nodePositions.set(keyB, b);
    if (!adjacency.has(keyA)) adjacency.set(keyA, new Set());
    if (!adjacency.has(keyB)) adjacency.set(keyB, new Set());
    adjacency.get(keyA)!.add(keyB);
    adjacency.get(keyB)!.add(keyA);
  }

  const visited = new Set<string>();
  let largest: ClosedContour | null = null;

  for (const seed of adjacency.keys()) {
    if (visited.has(seed)) continue;
    const stack = [seed];
    const component: string[] = [];
    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }

    if (component.length < 3 || component.some(key => adjacency.get(key)?.size !== 2)) continue;

    const start = component[0];
    const orderedKeys: string[] = [];
    let previous: string | null = null;
    let current = start;
    for (let step = 0; step <= component.length; step++) {
      if (current === start && orderedKeys.length > 0) break;
      orderedKeys.push(current);
      const neighbors = [...(adjacency.get(current) ?? [])];
      const next = neighbors[0] === previous ? neighbors[1] : neighbors[0];
      if (!next) break;
      previous = current;
      current = next;
    }
    if (current !== start || orderedKeys.length !== component.length) continue;

    const points = orderedKeys.map(key => nodePositions.get(key)!);
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      perimeter += Math.hypot(
        points[(i + 1) % points.length].x - points[i].x,
        points[(i + 1) % points.length].z - points[i].z
      );
    }
    if (!largest || perimeter > largest.perimeter) largest = { points, perimeter };
  }

  return largest;
}

function polygonCentroid(points: SectionPoint[]): SectionPoint {
  let twiceArea = 0;
  let weightedX = 0;
  let weightedZ = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.z - b.x * a.z;
    twiceArea += cross;
    weightedX += (a.x + b.x) * cross;
    weightedZ += (a.z + b.z) * cross;
  }
  if (Math.abs(twiceArea) > EPSILON) {
    return { x: weightedX / (3 * twiceArea), z: weightedZ / (3 * twiceArea) };
  }
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length
  };
}

function sampleContourRadii(
  points: SectionPoint[],
  center: SectionPoint,
  sampleCount: number
): number[] {
  const radii: number[] = [];
  for (let sample = 0; sample < sampleCount; sample++) {
    const angle = (sample / sampleCount) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    let radius = 0;

    for (let edge = 0; edge < points.length; edge++) {
      const a = points[edge];
      const b = points[(edge + 1) % points.length];
      const ax = a.x - center.x;
      const az = a.z - center.z;
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const denominator = dx * ez - dz * ex;
      if (Math.abs(denominator) < EPSILON) continue;
      const t = (ax * ez - az * ex) / denominator;
      const u = (ax * dz - az * dx) / denominator;
      if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) radius = Math.max(radius, t);
    }
    radii.push(radius);
  }

  if (radii.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('تعذر استخراج مقطع شعاعي مغلق من سطح Anny');
  }

  return radii.map((value, index) =>
    (radii[(index + radii.length - 1) % radii.length] +
      value * 2 +
      radii[(index + 1) % radii.length]) / 4
  );
}

function findLandmarkSection(
  sections: AnnyBodyProfileSection[],
  startFraction: number,
  endFraction: number,
  mode: 'min' | 'max'
): AnnyBodyProfileSection {
  const candidates = sections.filter(section =>
    section.fraction >= startFraction && section.fraction <= endFraction
  );
  if (!candidates.length) throw new Error('لا توجد مقاطع Anny كافية لتحديد مستوى القياس التشريحي');
  return candidates.reduce((best, section) =>
    mode === 'max'
      ? section.circumference > best.circumference ? section : best
      : section.circumference < best.circumference ? section : best
  );
}

/**
 * Extracts horizontal body sections from the actual Anny mesh in world space.
 * Measurements are geometric only; landmark locations still require anatomical
 * validation before they can be treated as certified sewing measurements.
 */
export function buildAnnyBodyProfile(
  bodyMesh: THREE.Mesh,
  options: AnnyBodyProfileOptions = {}
): AnnyBodyProfile {
  const sectionCount = options.sectionCount ?? 48;
  const radialSamples = options.radialSamples ?? 96;
  const startFraction = options.startFraction ?? 0.22;
  const endFraction = options.endFraction ?? 0.94;
  if (!Number.isInteger(sectionCount) || sectionCount < 12 || sectionCount > 160) {
    throw new Error('عدد مقاطع Anny يجب أن يكون بين 12 و160');
  }
  if (!Number.isInteger(radialSamples) || radialSamples < 24 || radialSamples > 256) {
    throw new Error('عدد العينات الشعاعية يجب أن يكون بين 24 و256');
  }
  if (!(startFraction >= 0 && endFraction <= 1 && endFraction > startFraction)) {
    throw new Error('نطاق ارتفاع مقاطع Anny غير صالح');
  }

  bodyMesh.updateWorldMatrix(true, false);
  const geometry = bodyMesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  if (!position || position.count < 3) throw new Error('شبكة Anny لا تحتوي رؤوساً كافية');
  const triangleCount = index ? index.count / 3 : position.count / 3;
  if (!Number.isInteger(triangleCount) || triangleCount < 1) {
    throw new Error('شبكة Anny لا تحتوي وجوهاً مثلثة صالحة');
  }

  const worldPositions = new Float64Array(position.count * 3);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(bodyMesh.matrixWorld);
    worldPositions[i * 3] = vertex.x;
    worldPositions[i * 3 + 1] = vertex.y;
    worldPositions[i * 3 + 2] = vertex.z;
  }
  const indices = index ? Uint32Array.from(index.array as ArrayLike<number>) : null;

  const bounds = new THREE.Box3().setFromObject(bodyMesh);
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height <= 0) throw new Error('محور ارتفاع جسم Anny غير صالح');

  const sections: AnnyBodyProfileSection[] = [];
  for (let i = 0; i < sectionCount; i++) {
    // Offset samples away from regular mesh rings to avoid planes through vertices.
    const fraction = startFraction + (endFraction - startFraction) * ((i + 0.371) / sectionCount);
    const y = bounds.min.y + height * fraction + height * 0.000173;
    const contour = findLargestClosedContour(worldPositions, indices, triangleCount, y);
    if (!contour) continue;
    const center = polygonCentroid(contour.points);
    try {
      const radii = sampleContourRadii(contour.points, center, radialSamples);
      sections.push({
        y,
        fraction: (y - bounds.min.y) / height,
        centerX: center.x,
        centerZ: center.z,
        circumference: contour.perimeter,
        radii
      });
    } catch {
      // A non-star-shaped or open section is excluded rather than fabricated.
    }
  }

  const minimumSections = Math.max(8, Math.ceil(sectionCount * 0.35));
  if (sections.length < minimumSections) {
    throw new Error(`تعذر استخراج مقاطع جسم مغلقة كافية من Anny (${sections.length}/${sectionCount})`);
  }

  sections.sort((a, b) => a.y - b.y);
  const landmarks = options.landmarks ?? [];
  const landmarkFraction = (zone: 'hip' | 'waist' | 'bust', fallback: number) => {
    const candidate = landmarks.find(item => item.zone === zone);
    return candidate && Number.isFinite(candidate.heightFraction) &&
      candidate.heightFraction >= startFraction && candidate.heightFraction <= endFraction
      ? candidate.heightFraction
      : fallback;
  };
  const hipFallback = findLandmarkSection(sections, 0.30, 0.58, 'max').fraction;
  const waistFallback = findLandmarkSection(sections, 0.48, 0.72, 'min').fraction;
  const bustFallback = findLandmarkSection(sections, 0.64, 0.86, 'max').fraction;
  const hipFraction = landmarkFraction('hip', hipFallback);
  const waistFraction = landmarkFraction('waist', waistFallback);
  const bustFraction = landmarkFraction('bust', bustFallback);
  if (!(hipFraction < waistFraction && waistFraction < bustFraction)) {
    throw new Error('مواضع الورك والخصر والصدر في Anny غير مرتبة؛ راجع المعالم التشريحية');
  }

  return {
    minY: bounds.min.y,
    maxY: bounds.max.y,
    height,
    hipY: bounds.min.y + height * hipFraction,
    waistY: bounds.min.y + height * waistFraction,
    neckY: bounds.min.y + height * 0.90,
    bustY: bounds.min.y + height * bustFraction,
    sections
  };
}

/** Interpolates an extracted Anny circumference section at a world-space height. */
export function sampleAnnyBodySection(
  profile: AnnyBodyProfile,
  y: number
): AnnyBodyProfileSection {
  if (!Number.isFinite(y)) throw new Error('ارتفاع مقطع Anny يجب أن يكون رقماً صالحاً');
  const sections = profile.sections;
  if (!sections.length) throw new Error('ملف مقاطع Anny فارغ');
  if (y <= sections[0].y) return sections[0];
  if (y >= sections[sections.length - 1].y) return sections[sections.length - 1];

  const upperIndex = sections.findIndex(section => section.y >= y);
  const lower = sections[upperIndex - 1];
  const upper = sections[upperIndex];
  const t = (y - lower.y) / (upper.y - lower.y);
  return {
    y,
    fraction: THREE.MathUtils.lerp(lower.fraction, upper.fraction, t),
    centerX: THREE.MathUtils.lerp(lower.centerX, upper.centerX, t),
    centerZ: THREE.MathUtils.lerp(lower.centerZ, upper.centerZ, t),
    circumference: THREE.MathUtils.lerp(lower.circumference, upper.circumference, t),
    radii: lower.radii.map((radius, index) =>
      THREE.MathUtils.lerp(radius, upper.radii[index] ?? radius, t)
    )
  };
}
