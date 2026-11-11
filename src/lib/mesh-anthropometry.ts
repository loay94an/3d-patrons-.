import * as THREE from 'three';

export type MeshSectionAxis = 'x' | 'y' | 'z';

export interface MeshSectionMeasurement {
  axis: MeshSectionAxis;
  coordinate: number;
  circumference: number;
}

export interface CircumferenceCalibrationAnchor extends MeshSectionMeasurement {
  targetCircumference: number;
  radialScale: number;
}

const AXIS_INDEX: Record<MeshSectionAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/**
 * Measures the perimeter of a closed triangle mesh where it intersects a
 * plane perpendicular to the selected axis. The plane must not pass exactly
 * through a mesh vertex/edge. Geometry is read in its local coordinate space.
 *
 * This is a geometric measurement only: callers must establish the model's
 * axis, units, landmarks, and mesh scale before interpreting it as centimetres.
 */
export function measureMeshSectionCircumference(
  geometry: THREE.BufferGeometry,
  axis: MeshSectionAxis,
  coordinate: number
) {
  if (!Number.isFinite(coordinate)) throw new Error('Section coordinate must be finite');
  const positions = geometry.getAttribute('position');
  if (!positions || positions.itemSize < 3 || positions.count < 3) {
    throw new Error('Mesh geometry must contain at least three 3D vertices');
  }

  const axisIndex = AXIS_INDEX[axis];
  const index = geometry.getIndex();
  const triangleCount = index ? index.count / 3 : positions.count / 3;
  if (!Number.isInteger(triangleCount) || triangleCount < 1) {
    throw new Error('Mesh geometry must contain triangular faces');
  }

  const pointFor = (vertex: number) => new THREE.Vector3(
    positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)
  );
  const signedDistance = (vertex: number) => positions.getComponent(vertex, axisIndex) - coordinate;
  const segmentKeys = new Set<string>();
  const segments: Array<{ a: string; b: string; length: number }> = [];
  const epsilon = 1e-9;

  const quantize = (point: THREE.Vector3) => {
    const values = [point.x, point.y, point.z].map(value => Math.round(value * 1e7));
    return values.join(',');
  };

  for (let face = 0; face < triangleCount; face++) {
    const ids = [0, 1, 2].map(corner => index
      ? index.getX(face * 3 + corner)
      : face * 3 + corner);
    const intersections: THREE.Vector3[] = [];

    for (let edge = 0; edge < 3; edge++) {
      const a = ids[edge];
      const b = ids[(edge + 1) % 3];
      const da = signedDistance(a);
      const db = signedDistance(b);
      if ((da < -epsilon && db > epsilon) || (da > epsilon && db < -epsilon)) {
        const t = da / (da - db);
        intersections.push(pointFor(a).lerp(pointFor(b), t));
      }
    }

    if (intersections.length !== 2) continue;
    const [pointA, pointB] = intersections;
    const keyA = quantize(pointA);
    const keyB = quantize(pointB);
    if (keyA === keyB) continue;
    const key = keyA < keyB ? keyA + '|' + keyB : keyB + '|' + keyA;
    if (segmentKeys.has(key)) continue;
    segmentKeys.add(key);
    segments.push({ a: keyA, b: keyB, length: pointA.distanceTo(pointB) });
  }

  // A full human mesh can intersect the same horizontal plane at the torso
  // and both arms. Keep the largest closed contour instead of adding unrelated
  // perimeters together.
  const adjacency = new Map<string, number[]>();
  segments.forEach((segment, segmentIndex) => {
    adjacency.set(segment.a, [...(adjacency.get(segment.a) ?? []), segmentIndex]);
    adjacency.set(segment.b, [...(adjacency.get(segment.b) ?? []), segmentIndex]);
  });

  const visited = new Set<number>();
  let circumference = 0;
  for (let seed = 0; seed < segments.length; seed++) {
    if (visited.has(seed)) continue;
    const stack = [seed];
    const component: number[] = [];
    const nodes = new Set<string>();
    while (stack.length) {
      const segmentIndex = stack.pop()!;
      if (visited.has(segmentIndex)) continue;
      visited.add(segmentIndex);
      component.push(segmentIndex);
      const segment = segments[segmentIndex];
      nodes.add(segment.a);
      nodes.add(segment.b);
      for (const node of [segment.a, segment.b]) {
        for (const neighbor of adjacency.get(node) ?? []) {
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
      }
    }
    const isClosed = [...nodes].every(node => (adjacency.get(node)?.length ?? 0) === 2);
    if (!isClosed) continue;
    const perimeter = component.reduce((sum, segmentIndex) => sum + segments[segmentIndex].length, 0);
    circumference = Math.max(circumference, perimeter);
  }

  if (!Number.isFinite(circumference) || circumference <= 0) {
    throw new Error('The section plane did not produce a measurable closed contour');
  }
  return circumference;
}

/**
 * Computes per-landmark radial scale factors without mutating the source mesh.
 * The resulting factors are diagnostic inputs for a later deformation step;
 * they do not themselves modify an Anny GLB or guarantee a fitted body.
 */
export function buildCircumferenceCalibrationAnchors(
  geometry: THREE.BufferGeometry,
  axis: MeshSectionAxis,
  targets: Array<{ coordinate: number; circumference: number }>
): CircumferenceCalibrationAnchor[] {
  if (targets.length < 2) throw new Error('At least two calibration landmarks are required');
  const sorted = [...targets].sort((a, b) => a.coordinate - b.coordinate);
  for (let i = 0; i < sorted.length; i++) {
    const target = sorted[i];
    if (!Number.isFinite(target.coordinate) || !Number.isFinite(target.circumference) || target.circumference <= 0) {
      throw new Error('Calibration landmarks require finite coordinates and positive circumferences');
    }
    if (i > 0 && target.coordinate <= sorted[i - 1].coordinate) {
      throw new Error('Calibration landmark coordinates must be distinct');
    }
  }

  return sorted.map(target => {
    const circumference = measureMeshSectionCircumference(geometry, axis, target.coordinate);
    return {
      axis,
      coordinate: target.coordinate,
      circumference,
      targetCircumference: target.circumference,
      radialScale: target.circumference / circumference
    };
  });
}
