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
export type GarmentBodyEnvelope = RadialEnvelope;

interface RadialEnvelope {
  minY: number;
  maxY: number;
  centerX: number;
  centerZ: number;
  bands: number;
  directions: number;
  radii: Float32Array;
}

/**
 * Coarse max-radius envelope of the body, computed in a single pass over its
 * vertices. It is only used to skip raycasts for garment vertices that are
 * provably outside the body, which is where most of the cost used to go.
 */
export function buildGarmentBodyEnvelope(bodyMesh: THREE.Mesh): GarmentBodyEnvelope {
  bodyMesh.updateWorldMatrix(true, false);
  return buildBodyRadialEnvelope(bodyMesh, new THREE.Box3().setFromObject(bodyMesh));
}

function buildBodyRadialEnvelope(bodyMesh: THREE.Mesh, bodyBounds: THREE.Box3): RadialEnvelope {
  const bands = 48;
  const directions = 32;
  const center = bodyBounds.getCenter(new THREE.Vector3());
  const minY = bodyBounds.min.y;
  const spanY = Math.max(1e-6, bodyBounds.max.y - minY);
  const radii = new Float32Array(bands * directions);
  const position = bodyMesh.geometry.getAttribute('position');
  if (!position) return { minY, maxY: bodyBounds.max.y, centerX: center.x, centerZ: center.z, bands, directions, radii };

  // The body surface in a sector is taken from a high quantile of the sampled
  // radii, not the maximum. Arms and hands sweep the same height bands as the
  // torso, and a maximum made the garment balloon sideways around them.
  const buckets: number[][] = Array.from({ length: bands * directions }, () => []);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(bodyMesh.matrixWorld);
    const band = Math.min(bands - 1, Math.max(0, Math.floor(((vertex.y - minY) / spanY) * bands)));
    const dx = vertex.x - center.x;
    const dz = vertex.z - center.z;
    const angle = Math.atan2(dz, dx);
    const sector = Math.min(directions - 1, Math.max(0, Math.floor(((angle + Math.PI) / (Math.PI * 2)) * directions)));
    buckets[band * directions + sector].push(Math.hypot(dx, dz));
  }
  for (let index = 0; index < buckets.length; index++) {
    const values = buckets[index];
    if (!values.length) continue;
    values.sort((a, b) => a - b);
    radii[index] = values[Math.min(values.length - 1, Math.floor(values.length * 0.75))];
  }
  smoothRadii(radii, bands, directions);
  return { minY, maxY: bodyBounds.max.y, centerX: center.x, centerZ: center.z, bands, directions, radii };
}

/**
 * A handful of outlier vertices (hands, hair, accessories) otherwise produce
 * one-sector spikes that the garment shadows as hard creases.
 */
function smoothRadii(radii: Float32Array, bands: number, directions: number) {
  const copy = Float32Array.from(radii);
  for (let band = 0; band < bands; band++) {
    for (let sector = 0; sector < directions; sector++) {
      const left = copy[band * directions + ((sector - 1 + directions) % directions)];
      const center = copy[band * directions + sector];
      const right = copy[band * directions + ((sector + 1) % directions)];
      const up = copy[Math.min(bands - 1, band + 1) * directions + sector];
      const down = copy[Math.max(0, band - 1) * directions + sector];
      radii[band * directions + sector] = (center * 4 + left + right + up + down) / 8;
    }
  }
}

function envelopeRadiusAt(
  envelope: RadialEnvelope,
  x: number,
  y: number,
  z: number
): number {
  if (y < envelope.minY || y > envelope.maxY) return 0;
  const { bands, directions, radii } = envelope;
  // Nearest-band/nearest-sector sampling made adjacent garment vertices jump
  // between neighbouring body radii, which read as crumpled fabric. Interpolate
  // between the four surrounding samples instead so the shell follows the body
  // smoothly.
  const bandPosition = Math.min(bands - 1, Math.max(0, ((y - envelope.minY) / (envelope.maxY - envelope.minY)) * bands - 0.5));
  const bandLow = Math.floor(bandPosition);
  const bandHigh = Math.min(bands - 1, bandLow + 1);
  const bandMix = bandPosition - bandLow;

  const angle = Math.atan2(z - envelope.centerZ, x - envelope.centerX);
  const sectorPosition = ((angle + Math.PI) / (Math.PI * 2)) * directions - 0.5;
  const sectorLowRaw = Math.floor(sectorPosition);
  const sectorMix = sectorPosition - sectorLowRaw;
  const sectorLow = ((sectorLowRaw % directions) + directions) % directions;
  const sectorHigh = (sectorLow + 1) % directions;

  const sample = (band: number, sector: number) => radii[band * directions + sector];
  const low = sample(bandLow, sectorLow) * (1 - sectorMix) + sample(bandLow, sectorHigh) * sectorMix;
  const high = sample(bandHigh, sectorLow) * (1 - sectorMix) + sample(bandHigh, sectorHigh) * sectorMix;
  return low * (1 - bandMix) + high * bandMix;
}

export function conformGarmentMeshToBody(
  garmentMesh: THREE.Mesh,
  bodyMesh: THREE.Mesh,
  clearanceCm = 1.5,
  envelope?: RadialEnvelope
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

  const radialEnvelope = envelope ?? buildBodyRadialEnvelope(bodyMesh, bodyBounds);
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
  let envelopeClearedVertices = 0;
  let totalDisplacement = 0;
  let maxDisplacementCm = 0;

  for (let i = 0; i < fittedPosition.count; i++) {
    localVertex.fromBufferAttribute(position, i);
    worldVertex.copy(localVertex).applyMatrix4(garmentMesh.matrixWorld);
    direction.set(worldVertex.x - center.x, 0, worldVertex.z - center.z);
    if (direction.lengthSq() < 1e-10) continue;
    // Skip the raycast when the vertex lies beyond the body's widest surface in
    // that direction: it cannot be inside the body there.
    const envelopeRadius = envelopeRadiusAt(radialEnvelope, worldVertex.x, worldVertex.y, worldVertex.z);
    if (envelopeRadius > 0 && Math.hypot(direction.x, direction.z) > envelopeRadius + clearanceCm + 0.2) {
      envelopeClearedVertices++;
      continue;
    }
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
    // (the envelope skip above already removed the obviously clear vertices)

    fittedWorld.addScaledVector(outwardNormal, clearanceCm);
    // Limit the correction so a vertex that is deliberately buried (a sleeve
    // head inside the shoulder) is not flung far outside the body silhouette.
    const rawDisplacement = fittedWorld.distanceTo(worldVertex);
    const maxCorrection = 3;
    if (rawDisplacement > maxCorrection) {
      fittedWorld.copy(worldVertex).addScaledVector(
        fittedWorld.clone().sub(worldVertex).normalize(),
        maxCorrection
      );
    }
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
      // Vertices skipped by the envelope test were proven to sit outside the
      // body surface, so the garment is clear of it rather than unexamined.
      status: bodyIntersections > 0 || envelopeClearedVertices > 0 ? 'already-clear' : 'no-intersections'
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
 * Cheap clearance pass for the torso shell only.
 *
 * Raycasting every garment vertex against the full body mesh costs hundreds of
 * millions of triangle tests on a detailed body and froze the 3D workspace.
 * The torso shell is centred on the body axis, so the radial envelope built in
 * a single pass over the body vertices is enough to guarantee clearance.
 * Sleeves and trouser legs are generated around their own measured
 * circumferences and must not be clamped against the torso envelope.
 */
/** One-ring vertex neighbours, used to relax the corrected shell surface. */
function buildVertexNeighbours(index: THREE.BufferAttribute | null, count: number): Int32Array[] {
  const neighbours: number[][] = Array.from({ length: count }, () => []);
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      neighbours[a].push(b, c);
      neighbours[b].push(a, c);
      neighbours[c].push(a, b);
    }
  }
  return neighbours.map(list => Int32Array.from(list));
}

export function conformGarmentShellToBodyEnvelope(
  garmentGroup: THREE.Group,
  bodyMesh: THREE.Mesh,
  clearanceCm = 1,
  cachedEnvelope?: GarmentBodyEnvelope
): GarmentConformReport {
  const shell = garmentGroup.getObjectByName('GarmentBody');
  if (!(shell instanceof THREE.Mesh)) {
    return { totalVertices: 0, fittedVertices: 0, fitRatio: 0, meanDisplacementCm: 0, maxDisplacementCm: 0, status: 'no-intersections' };
  }

  const envelope = cachedEnvelope ?? buildGarmentBodyEnvelope(bodyMesh);
  const geometry = shell.geometry as THREE.BufferGeometry;
  const position = geometry.getAttribute('position');
  if (!position) {
    return { totalVertices: 0, fittedVertices: 0, fitRatio: 0, meanDisplacementCm: 0, maxDisplacementCm: 0, status: 'no-intersections' };
  }

  shell.updateWorldMatrix(true, false);
  const toWorld = shell.matrixWorld;
  const toLocal = shell.matrixWorld.clone().invert();
  const vertex = new THREE.Vector3();
  const moved = new Uint8Array(position.count);
  let fittedVertices = 0;
  let totalDisplacement = 0;
  let maxDisplacementCm = 0;

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(toWorld);
    const dx = vertex.x - envelope.centerX;
    const dz = vertex.z - envelope.centerZ;
    const radius = Math.hypot(dx, dz);
    if (radius < 1e-6) continue;
    const bodyRadius = envelopeRadiusAt(envelope, vertex.x, vertex.y, vertex.z);
    if (bodyRadius <= 0) continue;
    const target = bodyRadius + clearanceCm;
    if (radius >= target) continue;
    const factor = target / radius;
    vertex.x = envelope.centerX + dx * factor;
    vertex.z = envelope.centerZ + dz * factor;
    const displacement = target - radius;
    totalDisplacement += displacement;
    maxDisplacementCm = Math.max(maxDisplacementCm, displacement);
    vertex.applyMatrix4(toLocal);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    moved[i] = 1;
    fittedVertices++;
  }

  if (fittedVertices > 0) {
    // Pushing single vertices out of the body leaves steps between corrected
    // and untouched neighbours, which reads as crumpled fabric with hard
    // facets. Relax the corrected vertices over their one-ring neighbours and
    // then restore body clearance, so the shell stays smooth and still clear.
    const neighbours = buildVertexNeighbours(geometry.getIndex(), position.count);
    const snapshot = new Float32Array((position.array as Float32Array).subarray(0, position.count * 3));
    for (let pass = 0; pass < 2; pass++) {
      const previous = Float32Array.from(snapshot);
      for (let i = 0; i < position.count; i++) {
        if (!moved[i]) continue;
        const list = neighbours[i];
        if (!list.length) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        for (let n = 0; n < list.length; n++) {
          const base = list[n] * 3;
          sx += previous[base];
          sy += previous[base + 1];
          sz += previous[base + 2];
        }
        const inverse = 1 / list.length;
        position.setXYZ(
          i,
          previous[i * 3] * 0.5 + sx * inverse * 0.5,
          previous[i * 3 + 1] * 0.5 + sy * inverse * 0.5,
          previous[i * 3 + 2] * 0.5 + sz * inverse * 0.5
        );
      }
      snapshot.set((position.array as Float32Array).subarray(0, position.count * 3));
    }
    for (let i = 0; i < position.count; i++) {
      if (!moved[i]) continue;
      vertex.fromBufferAttribute(position, i).applyMatrix4(toWorld);
      const dx = vertex.x - envelope.centerX;
      const dz = vertex.z - envelope.centerZ;
      const radius = Math.hypot(dx, dz);
      if (radius < 1e-6) continue;
      const bodyRadius = envelopeRadiusAt(envelope, vertex.x, vertex.y, vertex.z);
      if (bodyRadius <= 0) continue;
      const target = bodyRadius + clearanceCm;
      if (radius >= target) continue;
      const factor = target / radius;
      vertex.x = envelope.centerX + dx * factor;
      vertex.z = envelope.centerZ + dz * factor;
      vertex.applyMatrix4(toLocal);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  return {
    totalVertices: position.count,
    fittedVertices,
    fitRatio: fittedVertices / position.count,
    meanDisplacementCm: fittedVertices ? totalDisplacement / fittedVertices : 0,
    maxDisplacementCm,
    status: fittedVertices === 0 ? 'already-clear' : (fittedVertices / position.count > 0.75 ? 'conformed' : 'partial')
  };
}

/**
 * Apply the non-destructive body-clearance correction to every mesh in a garment.
 * This covers torso, sleeves and trouser legs while preserving existing wearing ease.
 * Kept for tests and offline tooling; the interactive viewer uses the cheaper
 * envelope shell pass above.
 */
export function conformGarmentGroupToBody(
  garmentGroup: THREE.Group,
  bodyMesh: THREE.Mesh,
  clearanceCm = 0.6
): GarmentConformReport {
  garmentGroup.updateWorldMatrix(true, true);
  bodyMesh.updateWorldMatrix(true, false);
  const reports: GarmentConformReport[] = [];
  // Build the prunable envelope once and reuse it for every garment piece.
  const envelope = buildBodyRadialEnvelope(bodyMesh, new THREE.Box3().setFromObject(bodyMesh));
  garmentGroup.traverse(object => {
    if (object instanceof THREE.Mesh && object !== bodyMesh) {
      reports.push(conformGarmentMeshToBody(object, bodyMesh, clearanceCm, envelope));
    }
  });
  const totalVertices = reports.reduce((sum, report) => sum + report.totalVertices, 0);
  const fittedVertices = reports.reduce((sum, report) => sum + report.fittedVertices, 0);
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
