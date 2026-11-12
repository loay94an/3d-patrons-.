import * as THREE from 'three';

export interface GarmentConformReport {
  totalVertices: number;
  fittedVertices: number;
  fitRatio: number;
  meanDisplacementCm: number;
  maxDisplacementCm: number;
  status: 'conformed' | 'partial' | 'already-clear' | 'no-intersections';
}

/**
 * Conform the torso shell of a generated garment to the actual Anny mesh.
 * Both objects must already be in the same Three.js world coordinate system.
 * Rays are cast from outside toward the body so front-facing GLB surfaces are
 * hit correctly even when their materials are not DoubleSide.
 *
 * This is a geometric preview operation, not cloth simulation or a substitute
 * for sewn 2D pattern panels. Vertices with no body intersection are preserved
 * (for example a flared hem below the body).
 */
export function conformGarmentMeshToBody(
  garmentMesh: THREE.Mesh,
  bodyMesh: THREE.Mesh,
  clearanceCm = 1.5
): GarmentConformReport {
  if (!Number.isFinite(clearanceCm) || clearanceCm < 0 || clearanceCm > 8) {
    throw new Error('Garment/body clearance must be between 0 and 8 cm');
  }

  bodyMesh.updateWorldMatrix(true, false);
  garmentMesh.updateWorldMatrix(true, false);
  const bodyBounds = new THREE.Box3().setFromObject(bodyMesh);
  if (bodyBounds.isEmpty()) {
    return { totalVertices: 0, fittedVertices: 0, fitRatio: 0, meanDisplacementCm: 0, maxDisplacementCm: 0, status: 'no-intersections' };
  }

  const center = bodyBounds.getCenter(new THREE.Vector3());
  const bodySize = bodyBounds.getSize(new THREE.Vector3());
  const rayDistance = Math.max(bodySize.x, bodySize.z) * 2.5 + 10;
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0;
  raycaster.far = rayDistance * 2;
  const normalMatrix = new THREE.Matrix3();
  const inverseGarmentWorld = garmentMesh.matrixWorld.clone().invert();
  const localVertex = new THREE.Vector3();
  const worldVertex = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const rayOrigin = new THREE.Vector3();
  const outwardNormal = new THREE.Vector3();
  const fittedWorld = new THREE.Vector3();
  const fittedLocal = new THREE.Vector3();
  const position = garmentMesh.geometry.getAttribute('position');
  if (!position || position.count === 0) {
    return { totalVertices: 0, fittedVertices: 0, fitRatio: 0, meanDisplacementCm: 0, maxDisplacementCm: 0, status: 'no-intersections' };
  }

  const fittedGeometry = garmentMesh.geometry.clone();
  const fittedPosition = fittedGeometry.getAttribute('position') as THREE.BufferAttribute;
  let fittedVertices = 0;
  let bodyIntersections = 0;
  let totalDisplacement = 0;
  let maxDisplacementCm = 0;

  for (let i = 0; i < fittedPosition.count; i++) {
    localVertex.fromBufferAttribute(position, i);
    worldVertex.copy(localVertex).applyMatrix4(garmentMesh.matrixWorld);
    direction.set(worldVertex.x - center.x, 0, worldVertex.z - center.z);
    if (direction.lengthSq() < 1e-10) continue;
    direction.normalize();

    rayOrigin.set(
      center.x + direction.x * rayDistance,
      worldVertex.y,
      center.z + direction.z * rayDistance
    );
    raycaster.set(rayOrigin, direction.clone().negate());
    const hits = raycaster.intersectObject(bodyMesh, false);
    if (!hits.length) continue;
    bodyIntersections++;

    const hit = hits[0];
    fittedWorld.copy(hit.point);
    if (hit.face) {
      outwardNormal.copy(hit.face.normal);
      normalMatrix.getNormalMatrix(bodyMesh.matrixWorld);
      outwardNormal.applyMatrix3(normalMatrix).normalize();
      // Ensure the offset points away from the body's horizontal centre.
      if (outwardNormal.dot(direction) < 0) outwardNormal.negate();
    } else {
      outwardNormal.copy(direction);
    }
    // Preserve the drafted wearing ease. Only move vertices that penetrate the
    // body or fall inside the requested safety gap; never pull loose cloth inward.
    const signedGap = worldVertex.clone().sub(hit.point).dot(outwardNormal);
    if (signedGap >= clearanceCm) continue;

    fittedWorld.addScaledVector(outwardNormal, clearanceCm);
    const displacement = fittedWorld.distanceTo(worldVertex);
    totalDisplacement += displacement;
    maxDisplacementCm = Math.max(maxDisplacementCm, displacement);
    fittedLocal.copy(fittedWorld).applyMatrix4(inverseGarmentWorld);
    fittedPosition.setXYZ(i, fittedLocal.x, fittedLocal.y, fittedLocal.z);
    fittedVertices++;
  }

  if (fittedVertices === 0) {
    fittedGeometry.dispose();
    return {
      totalVertices: position.count, fittedVertices: 0, fitRatio: 0,
      meanDisplacementCm: 0, maxDisplacementCm: 0,
      status: bodyIntersections > 0 ? 'already-clear' : 'no-intersections'
    };
  }

  fittedPosition.needsUpdate = true;
  fittedGeometry.computeVertexNormals();
  fittedGeometry.computeBoundingBox();
  fittedGeometry.computeBoundingSphere();
  const previousGeometry = garmentMesh.geometry;
  garmentMesh.geometry = fittedGeometry;
  previousGeometry.dispose();

  const fitRatio = fittedVertices / position.count;
  return {
    totalVertices: position.count,
    fittedVertices,
    fitRatio,
    meanDisplacementCm: totalDisplacement / fittedVertices,
    maxDisplacementCm,
    status: fitRatio > 0.75 ? 'conformed' : 'partial'
  };
}


/**
 * Apply the non-destructive body-clearance correction to every mesh in a garment.
 * This covers torso, sleeves and trouser legs while preserving existing wearing ease.
 */
export function conformGarmentGroupToBody(
  garmentGroup: THREE.Group,
  bodyMesh: THREE.Mesh,
  clearanceCm = 0.6
): GarmentConformReport {
  garmentGroup.updateWorldMatrix(true, true);
  bodyMesh.updateWorldMatrix(true, false);
  const reports: GarmentConformReport[] = [];
  garmentGroup.traverse(object => {
    if (object instanceof THREE.Mesh && object !== bodyMesh) {
      reports.push(conformGarmentMeshToBody(object, bodyMesh, clearanceCm));
    }
  });
  const totalVertices = reports.reduce((sum, report) => sum + report.totalVertices, 0);
  const fittedVertices = reports.reduce((sum, report) => sum + report.fittedVertices, 0);
  const movedReports = reports.filter(report => report.fittedVertices > 0);
  const meanDisplacementCm = fittedVertices
    ? reports.reduce((sum, report) => sum + report.meanDisplacementCm * report.fittedVertices, 0) / fittedVertices
    : 0;
  const maxDisplacementCm = Math.max(0, ...reports.map(report => report.maxDisplacementCm));
  const fitRatio = totalVertices ? fittedVertices / totalVertices : 0;
  const status = fittedVertices === 0
    ? (reports.some(report => report.status === 'already-clear') ? 'already-clear' : 'no-intersections')
    : fitRatio > 0.75 ? 'conformed' : 'partial';
  return { totalVertices, fittedVertices, fitRatio, meanDisplacementCm, maxDisplacementCm, status };
}
