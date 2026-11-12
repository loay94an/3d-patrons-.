import * as THREE from 'three';
import type { CadStitchPair } from './cad-sewing-engine';
import type { CadPanelGeometry } from './cad-panel-geometry';

export type ClothConstraintKind = 'structural' | 'shear' | 'bend' | 'seam';

export interface ClothParticle {
  position: THREE.Vector3;
  previous: THREE.Vector3;
  inverseMass: number;
}

export interface ClothDistanceConstraint {
  a: number;
  b: number;
  restLength: number;
  stiffness: number;
  kind: ClothConstraintKind;
}

export interface ClothTriangle {
  a: number;
  b: number;
  c: number;
}

export interface ClothCollisionSample {
  /** Signed distance in scene units: positive outside, negative inside. */
  signedDistance: number;
  /** Outward unit normal at the nearest point on the body surface. */
  normal: THREE.Vector3;
  closestPoint: THREE.Vector3;
}

export interface ClothBodyCollider {
  sample(point: THREE.Vector3): ClothCollisionSample;
}

export interface ClothSolverOptions {
  gravity?: THREE.Vector3;
  damping?: number;
  iterations?: number;
  stretchStiffness?: number;
  shearStiffness?: number;
  bendStiffness?: number;
  seamStiffness?: number;
  collisionThickness?: number;
  /** Fixed time step in seconds. */
  timeStep?: number;
}

export interface ClothSimulation {
  particles: ClothParticle[];
  triangles: ClothTriangle[];
  constraints: ClothDistanceConstraint[];
  options: Required<ClothSolverOptions>;
  step(collider?: ClothBodyCollider): ClothCollisionReport | null;
  positions(): THREE.Vector3[];
}

export interface ClothCollisionReport {
  sampleCount: number;
  contactCount: number;
  penetrationCount: number;
  minimumClearance: number;
  maximumPenetration: number;
  meanClearance: number;
}

export interface ClothFitAnalysis extends ClothCollisionReport {
  fitStatus: 'clear' | 'contact' | 'penetration';
  warningAr: string;
}

export interface ClothPanelPlacement {
  /** Transform from the panel's centimetre CAD plane into the shared 3D scene. */
  matrix?: THREE.Matrix4;
  /** Optional vertex indices fixed in world space. */
  pinnedVertices?: number[];
}

export interface ClothPhysicalMaterial {
  /** Fabric areal density in grams per square centimetre. */
  arealDensityGPerCm2: number;
  stretchStiffness: number;
  shearStiffness: number;
  bendStiffness: number;
}

export interface ClothSimulationBuildOptions extends ClothSolverOptions {
  /** One placement per piece ID. CAD coordinates are centimetres. */
  placements?: Record<string, ClothPanelPlacement>;
  /** Calibrated physical properties resolved from the selected fabric preset. */
  material?: ClothPhysicalMaterial;
}

const DEFAULT_OPTIONS: Required<ClothSolverOptions> = {
  gravity: new THREE.Vector3(0, -981, 0),
  damping: 0.015,
  iterations: 8,
  stretchStiffness: 0.92,
  shearStiffness: 0.72,
  bendStiffness: 0.18,
  seamStiffness: 1,
  collisionThickness: 0.25,
  timeStep: 1 / 60
};

function assertUnitInterval(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`قيمة ${name} يجب أن تكون بين صفر وواحد.`);
  }
}

function edgeKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Builds a unified particle mesh from CAD panels. Each panel is transformed
 * into the same scene before simulation; callers should lay panels out in 3D
 * around the body rather than leave every 2D pattern on the same plane.
 */
export function buildClothSimulation(
  panels: CadPanelGeometry[],
  stitchPairs: CadStitchPair[] = [],
  buildOptions: ClothSimulationBuildOptions = {}
): ClothSimulation {
  if (!panels.length) throw new Error('لا يمكن إنشاء محاكاة قماش بلا قطع باترون.');
  const options: Required<ClothSolverOptions> = {
    ...DEFAULT_OPTIONS,
    ...buildOptions,
    stretchStiffness: buildOptions.material?.stretchStiffness ?? buildOptions.stretchStiffness ?? DEFAULT_OPTIONS.stretchStiffness,
    shearStiffness: buildOptions.material?.shearStiffness ?? buildOptions.shearStiffness ?? DEFAULT_OPTIONS.shearStiffness,
    bendStiffness: buildOptions.material?.bendStiffness ?? buildOptions.bendStiffness ?? DEFAULT_OPTIONS.bendStiffness,
    gravity: buildOptions.gravity?.clone() ?? DEFAULT_OPTIONS.gravity.clone()
  };
  const arealDensity = buildOptions.material?.arealDensityGPerCm2 ?? 0.012;
  if (!Number.isFinite(arealDensity) || arealDensity <= 0 || arealDensity > 1) {
    throw new Error('كثافة القماش السطحية غير صالحة.');
  }
  for (const [name, value] of [
    ['damping', options.damping],
    ['stretchStiffness', options.stretchStiffness],
    ['shearStiffness', options.shearStiffness],
    ['bendStiffness', options.bendStiffness],
    ['seamStiffness', options.seamStiffness]
  ] as const) assertUnitInterval(value, name);
  if (!Number.isInteger(options.iterations) || options.iterations < 1 || options.iterations > 100 ||
      !Number.isFinite(options.timeStep) || options.timeStep <= 0 || options.timeStep > 0.1 ||
      !Number.isFinite(options.collisionThickness) || options.collisionThickness < 0) {
    throw new Error('إعدادات محاكاة القماش غير صالحة.');
  }

  const particles: ClothParticle[] = [];
  const triangles: ClothTriangle[] = [];
  const constraints: ClothDistanceConstraint[] = [];
  const edgeUse = new Map<string, { a: number; b: number; opposite: number[] }>();
  const panelOffsets = new Map<string, number>();
  const panelByPiece = new Map<string, CadPanelGeometry>();

  for (const panel of panels) {
    if (panelByPiece.has(panel.pieceId)) throw new Error('معرّف قطعة باترون مكرر في شبكة القماش.');
    panelByPiece.set(panel.pieceId, panel);
    const placement = buildOptions.placements?.[panel.pieceId];
    const matrix = placement?.matrix ?? new THREE.Matrix4();
    const offset = particles.length;
    panelOffsets.set(panel.pieceId, offset);
    for (let index = 0; index < panel.vertices.length; index++) {
      const point = panel.vertices[index];
      const position = new THREE.Vector3(point.x, point.y, 0).applyMatrix4(matrix);
      const pinned = placement?.pinnedVertices?.includes(index) ?? false;
      particles.push({
        position,
        previous: position.clone(),
        inverseMass: pinned ? 0 : 1
      });
    }
    for (let index = 0; index < panel.triangleIndices.length; index += 3) {
      const a = offset + panel.triangleIndices[index];
      const b = offset + panel.triangleIndices[index + 1];
      const c = offset + panel.triangleIndices[index + 2];
      triangles.push({ a, b, c });
      const edges: Array<[number, number, number]> = [[a, b, c], [b, c, a], [c, a, b]];
      for (const [first, second, opposite] of edges) {
        const key = edgeKey(first, second);
        const entry = edgeUse.get(key) ?? { a: first, b: second, opposite: [] };
        entry.opposite.push(opposite);
        edgeUse.set(key, entry);
      }
    }
  }

  // Distribute fabric mass to vertices by triangle area. Inverse mass weights
  // constraint corrections, while gravity remains acceleration-based.
  const vertexMass = new Array<number>(particles.length).fill(0);
  for (const triangle of triangles) {
    const a = particles[triangle.a].position;
    const b = particles[triangle.b].position;
    const c = particles[triangle.c].position;
    const area = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).length() / 2;
    const massPerVertex = area * arealDensity / 3;
    vertexMass[triangle.a] += massPerVertex;
    vertexMass[triangle.b] += massPerVertex;
    vertexMass[triangle.c] += massPerVertex;
  }
  particles.forEach((particle, index) => {
    if (particle.inverseMass > 0) {
      particle.inverseMass = 1 / Math.max(vertexMass[index], 1e-6);
    }
  });

  // Triangle edges provide membrane resistance; interior diagonals are treated
  // as shear constraints. Opposite vertices across shared edges provide bend resistance.
  for (const [key, edge] of edgeUse) {
    const boundary = panels.some(panel => {
      const offset = panelOffsets.get(panel.pieceId)!;
      return panel.boundaryEdges.some(boundaryEdge =>
        boundaryEdge.vertexIndices.slice(0, -1).some((vertex, index) =>
          edgeKey(offset + vertex, offset + boundaryEdge.vertexIndices[index + 1]) === key
        )
      );
    });
    const delta = particles[edge.a].position.distanceTo(particles[edge.b].position);
    constraints.push({
      a: edge.a,
      b: edge.b,
      restLength: delta,
      stiffness: boundary ? options.stretchStiffness : options.shearStiffness,
      kind: boundary ? 'structural' : 'shear'
    });
    if (edge.opposite.length === 2) {
      const [a, b] = edge.opposite;
      constraints.push({
        a,
        b,
        restLength: particles[a].position.distanceTo(particles[b].position),
        stiffness: options.bendStiffness,
        kind: 'bend'
      });
    }
  }

  // Match seam samples by normalized position along each CAD edge. The sewing
  // audit remains authoritative for length/ease validity; constraints only
  // close the selected stitch line and do not hide mismatched seam lengths.
  const usedSeamEdges = new Set<string>();
  for (const pair of stitchPairs) {
    const firstKey = `${pair.first.pieceId}\u0000${pair.first.segmentId}`;
    const secondKey = `${pair.second.pieceId}\u0000${pair.second.segmentId}`;
    if (usedSeamEdges.has(firstKey) || usedSeamEdges.has(secondKey)) {
      throw new Error('حافة خياطة واحدة مرتبطة بأكثر من وصلة في محول المحاكاة.');
    }
    usedSeamEdges.add(firstKey);
    usedSeamEdges.add(secondKey);
    const firstPanel = panelByPiece.get(pair.first.pieceId);
    const secondPanel = panelByPiece.get(pair.second.pieceId);
    if (!firstPanel || !secondPanel) throw new Error('قطعة وصلة الخياطة غير موجودة في شبكة القماش.');
    const firstEdge = firstPanel.boundaryEdges.find(edge => edge.segmentId === pair.first.segmentId);
    const secondEdge = secondPanel.boundaryEdges.find(edge => edge.segmentId === pair.second.segmentId);
    if (!firstEdge || !secondEdge) throw new Error('حافة وصلة الخياطة غير موجودة على محيط قطعة الباترون.');
    const firstOffset = panelOffsets.get(firstPanel.pieceId)!;
    const secondOffset = panelOffsets.get(secondPanel.pieceId)!;
    const sampleCount = Math.max(firstEdge.vertexIndices.length, secondEdge.vertexIndices.length);
    const usedPairs = new Set<string>();
    for (let sample = 0; sample < sampleCount; sample++) {
      const firstIndex = firstOffset + firstEdge.vertexIndices[
        Math.round(sample * (firstEdge.vertexIndices.length - 1) / Math.max(1, sampleCount - 1))
      ];
      const secondIndex = secondOffset + secondEdge.vertexIndices[
        Math.round(sample * (secondEdge.vertexIndices.length - 1) / Math.max(1, sampleCount - 1))
      ];
      const key = edgeKey(firstIndex, secondIndex);
      if (firstIndex === secondIndex || usedPairs.has(key)) continue;
      usedPairs.add(key);
      constraints.push({
        a: firstIndex,
        b: secondIndex,
        restLength: 0,
        stiffness: options.seamStiffness,
        kind: 'seam'
      });
    }
  }

  function solveConstraint(constraint: ClothDistanceConstraint) {
    const first = particles[constraint.a];
    const second = particles[constraint.b];
    const totalInverseMass = first.inverseMass + second.inverseMass;
    if (totalInverseMass <= 0) return;
    const delta = second.position.clone().sub(first.position);
    const length = delta.length();
    if (length <= 1e-9) return;
    const correction = delta.multiplyScalar(
      ((length - constraint.restLength) / length) * constraint.stiffness
    );
    if (first.inverseMass > 0) {
      first.position.addScaledVector(correction, first.inverseMass / totalInverseMass);
    }
    if (second.inverseMass > 0) {
      second.position.addScaledVector(correction, -second.inverseMass / totalInverseMass);
    }
  }

  function step(collider?: ClothBodyCollider): ClothCollisionReport | null {
    const dt2 = options.timeStep * options.timeStep;
    for (const particle of particles) {
      if (particle.inverseMass === 0) continue;
      const current = particle.position.clone();
      const velocity = particle.position.clone().sub(particle.previous).multiplyScalar(1 - options.damping);
      particle.position.add(velocity).addScaledVector(options.gravity, dt2);
      particle.previous.copy(current);
    }

    for (let iteration = 0; iteration < options.iterations; iteration++) {
      for (const constraint of constraints) solveConstraint(constraint);
      if (collider) {
        for (const particle of particles) {
          if (particle.inverseMass === 0) continue;
          const sample = collider.sample(particle.position);
          if (sample.signedDistance < options.collisionThickness) {
            particle.position.addScaledVector(
              sample.normal,
              options.collisionThickness - sample.signedDistance
            );
          }
        }
      }
    }
    return collider ? analyzeClothBodyClearance(particles.map(p => p.position), collider, options.collisionThickness) : null;
  }

  return {
    particles,
    triangles,
    constraints,
    options,
    step,
    positions: () => particles.map(particle => particle.position.clone())
  };
}

/** Closest point on a triangle (Ericson region tests). */
function closestPointOnTriangle(
  point: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3
): THREE.Vector3 {
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const ap = point.clone().sub(a);
  const d1 = ab.dot(ap);
  const d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) return a.clone();
  const bp = point.clone().sub(b);
  const d3 = ab.dot(bp);
  const d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) return b.clone();
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return a.clone().addScaledVector(ab, d1 / (d1 - d3));
  const cp = point.clone().sub(c);
  const d5 = ab.dot(cp);
  const d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) return c.clone();
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return a.clone().addScaledVector(ac, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return b.clone().addScaledVector(c.clone().sub(b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
  }
  const denominator = 1 / (va + vb + vc);
  const v = vb * denominator;
  const w = vc * denominator;
  return a.clone().addScaledVector(ab, v).addScaledVector(ac, w);
}

function rayIntersectsTriangle(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3
): boolean {
  const edge1 = b.clone().sub(a);
  const edge2 = c.clone().sub(a);
  const p = new THREE.Vector3().crossVectors(direction, edge2);
  const determinant = edge1.dot(p);
  if (Math.abs(determinant) < 1e-9) return false;
  const inverse = 1 / determinant;
  const t = origin.clone().sub(a);
  const u = t.dot(p) * inverse;
  if (u < 0 || u > 1) return false;
  const q = new THREE.Vector3().crossVectors(t, edge1);
  const v = direction.dot(q) * inverse;
  if (v < 0 || u + v > 1) return false;
  return edge2.dot(q) * inverse > 1e-8;
}

/**
 * Creates a CPU triangle-mesh collider from a Three.js mesh or group. The
 * implementation is intentionally simple and O(particles × body triangles);
 * use a BVH-backed implementation for production-scale high-poly bodies.
 */
export function createThreeMeshBodyCollider(root: THREE.Object3D): ClothBodyCollider {
  root.updateWorldMatrix(true, true);
  const vertices: THREE.Vector3[] = [];
  const triangles: Array<[number, number, number]> = [];
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    if (!position) return;
    const offset = vertices.length;
    for (let index = 0; index < position.count; index++) {
      vertices.push(new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld));
    }
    const indexAttribute = geometry.getIndex();
    const indexAt = (i: number) => offset + (indexAttribute ? indexAttribute.getX(i) : i);
    const count = indexAttribute ? indexAttribute.count : position.count;
    for (let index = 0; index + 2 < count; index += 3) {
      triangles.push([indexAt(index), indexAt(index + 1), indexAt(index + 2)]);
    }
  });
  if (!triangles.length) throw new Error('شبكة الجسم لا تحتوي مثلثات صالحة للتصادم.');

  const direction = new THREE.Vector3(1, 0.000137, 0.000271).normalize();
  return {
    sample(point) {
      let nearest = Number.POSITIVE_INFINITY;
      let closest = new THREE.Vector3();
      let faceNormal = new THREE.Vector3(0, 1, 0);
      let intersections = 0;
      for (const [ia, ib, ic] of triangles) {
        const a = vertices[ia];
        const b = vertices[ib];
        const c = vertices[ic];
        const candidate = closestPointOnTriangle(point, a, b, c);
        const distance = candidate.distanceToSquared(point);
        if (distance < nearest) {
          nearest = distance;
          closest = candidate;
          faceNormal = new THREE.Vector3().crossVectors(
            b.clone().sub(a),
            c.clone().sub(a)
          ).normalize();
        }
        if (rayIntersectsTriangle(point, direction, a, b, c)) intersections++;
      }
      const inside = intersections % 2 === 1;
      const unsignedDistance = Math.sqrt(nearest);
      const delta = point.clone().sub(closest);
      const normal = unsignedDistance > 1e-8
        ? delta.normalize().multiplyScalar(inside ? -1 : 1)
        : faceNormal;
      return {
        signedDistance: inside ? -unsignedDistance : unsignedDistance,
        normal,
        closestPoint: closest
      };
    }
  };
}

/** Computes garment/body clearance and penetration from the current cloth vertices. */
export function analyzeClothBodyClearance(
  positions: THREE.Vector3[],
  collider: ClothBodyCollider,
  contactThreshold = 0.25
): ClothFitAnalysis {
  if (!Number.isFinite(contactThreshold) || contactThreshold < 0) {
    throw new Error('حد تحليل التلامس غير صالح.');
  }
  let contactCount = 0;
  let penetrationCount = 0;
  let minimumClearance = Number.POSITIVE_INFINITY;
  let maximumPenetration = 0;
  let total = 0;
  for (const position of positions) {
    const sample = collider.sample(position);
    const clearance = sample.signedDistance;
    total += clearance;
    minimumClearance = Math.min(minimumClearance, clearance);
    if (clearance <= contactThreshold) contactCount++;
    if (clearance < 0) {
      penetrationCount++;
      maximumPenetration = Math.max(maximumPenetration, -clearance);
    }
  }
  const fitStatus = penetrationCount > 0 ? 'penetration' : contactCount > 0 ? 'contact' : 'clear';
  return {
    sampleCount: positions.length,
    contactCount,
    penetrationCount,
    minimumClearance: positions.length ? minimumClearance : Number.POSITIVE_INFINITY,
    maximumPenetration,
    meanClearance: positions.length ? total / positions.length : 0,
    fitStatus,
    warningAr: fitStatus === 'penetration'
      ? 'يوجد تداخل بين القماش والجسم؛ راجع موضع القطع أو مقدار الراحة.'
      : fitStatus === 'contact'
        ? 'القماش يلامس سطح الجسم أو يقترب منه ضمن هامش التلامس.'
        : 'لا يظهر تداخل أو تلامس ضمن هامش التحليل الحالي.'
  };
}
