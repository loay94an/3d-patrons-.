import * as THREE from 'three';
import { Gender } from './pattern-logic';

export interface MannequinMeasurements {
  bust: number;
  waist: number;
  hip: number;
  shoulder: number;
  backLength: number;
  height: number;
  /** Optional tape measurements in centimetres; omitted values use category defaults. */
  armCircumference?: number;
  thighCircumference?: number;
}

export const DEFAULT_MANNEQUIN_MEASUREMENTS: Record<Gender, MannequinMeasurements> = {
  women: { bust: 88, waist: 70, hip: 94, shoulder: 12, backLength: 40, height: 168 },
  men: { bust: 98, waist: 82, hip: 98, shoulder: 15, backLength: 44, height: 178 },
  kids: { bust: 62, waist: 56, hip: 66, shoulder: 8.5, backLength: 29, height: 120 },
  infant: { bust: 48, waist: 46, hip: 50, shoulder: 6.5, backLength: 19.5, height: 70 }
};

export interface TorsoSpan {
  yOffset: number;
  torsoHeight: number;
}

export function getTorsoSpan(gender: Gender, measurements: MannequinMeasurements): TorsoSpan {
  const ref = DEFAULT_MANNEQUIN_MEASUREMENTS[gender] ?? DEFAULT_MANNEQUIN_MEASUREMENTS.women;
  const headScale = gender === 'infant' ? 0.48 : gender === 'kids' ? 0.68 : 1;
  const headAllowance = 20.8 * headScale;
  // Height is a full-body measurement in centimetres; fall back to the
  // category reference when older projects do not contain it.
  const requestedHeight = Number.isFinite(measurements.height) && measurements.height > 0
    ? measurements.height
    : ref.height;
  const torsoHeight = Math.max(1, (measurements.backLength || ref.backLength) * 1.7);
  const targetHeight = Math.max(requestedHeight, torsoHeight + headAllowance + 1);
  return {
    yOffset: Math.max(1, targetHeight - torsoHeight - headAllowance),
    torsoHeight
  };
}

export interface TorsoProfile {
  y: number;
  rx: number;
  rz: number;
  zCenter: number;
}

const smooth = (a: number, b: number, t: number) => {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

function radiiForCircumference(circumference: number, depthRatio: number) {
  // Solve the ellipse semi-width so the Ramanujan perimeter matches the tape measurement.
  let low = 0.1;
  let high = 80;
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    if (ellipsePerimeter(mid, mid * depthRatio) < circumference) low = mid;
    else high = mid;
  }
  const rx = (low + high) / 2;
  return { rx, rz: rx * depthRatio };
}

export function getTorsoProfile(
  gender: Gender,
  measurements: MannequinMeasurements,
  v: number,
  angle = 0
): TorsoProfile {
  const ref = DEFAULT_MANNEQUIN_MEASUREMENTS[gender] ?? DEFAULT_MANNEQUIN_MEASUREMENTS.women;
  const child = gender === 'kids' || gender === 'infant';
  const hip = radiiForCircumference(measurements.hip || ref.hip, gender === 'women' ? 0.72 : 0.76);
  const waist = radiiForCircumference(measurements.waist || ref.waist, gender === 'women' ? 0.74 : 0.79);
  const bust = radiiForCircumference(measurements.bust || ref.bust, gender === 'women' ? 0.72 : 0.77);
  const shoulderRx = (measurements.shoulder || ref.shoulder) * (gender === 'men' ? 1.3 : 1.46);
  const shoulderRz = gender === 'men' ? 9.5 : 8.5;
  const { yOffset, torsoHeight } = getTorsoSpan(gender, measurements);
  let rx: number;
  let rz: number;
  let zCenter = 0;

  if (child) {
    const waistV = 0.6;
    const bustV = 0.85;
    if (v < 0.3) {
      const t = smooth(0, 0.3, v);
      rx = THREE.MathUtils.lerp(hip.rx * 0.9, hip.rx, t);
      rz = THREE.MathUtils.lerp(hip.rz * 0.9, hip.rz, t);
    } else if (v < waistV) {
      const t = smooth(0.3, waistV, v);
      rx = THREE.MathUtils.lerp(hip.rx, waist.rx, t);
      rz = THREE.MathUtils.lerp(hip.rz, waist.rz, t);
      zCenter = Math.sin(Math.PI * t) * 0.55;
    } else if (v < bustV) {
      const t = smooth(waistV, bustV, v);
      rx = THREE.MathUtils.lerp(waist.rx, bust.rx, t);
      rz = THREE.MathUtils.lerp(waist.rz, bust.rz, t);
    } else {
      const t = smooth(bustV, 1, v);
      rx = THREE.MathUtils.lerp(bust.rx, shoulderRx * 0.5, t);
      rz = THREE.MathUtils.lerp(bust.rz, shoulderRz * 0.62, t);
    }
  } else if (gender === 'women') {
    if (v < 0.25) {
      const t = smooth(0, 0.25, v);
      rx = THREE.MathUtils.lerp(hip.rx * 0.87, hip.rx, t);
      rz = THREE.MathUtils.lerp(hip.rz * 0.87, hip.rz, t);
    } else if (v < 0.5) {
      const t = smooth(0.25, 0.5, v);
      rx = THREE.MathUtils.lerp(hip.rx, waist.rx, t);
      rz = THREE.MathUtils.lerp(hip.rz, waist.rz, t);
    } else if (v < 0.75) {
      const t = smooth(0.5, 0.75, v);
      rx = THREE.MathUtils.lerp(waist.rx, bust.rx, t);
      rz = THREE.MathUtils.lerp(waist.rz, bust.rz, t);
      zCenter = Math.sin(Math.PI * t) * 0.45;
    } else if (v < 0.9) {
      const t = smooth(0.75, 0.9, v);
      rx = THREE.MathUtils.lerp(bust.rx, shoulderRx, t);
      rz = THREE.MathUtils.lerp(bust.rz, shoulderRz, t);
    } else {
      const t = smooth(0.9, 1, v);
      rx = THREE.MathUtils.lerp(shoulderRx * 0.45, 6, t);
      rz = THREE.MathUtils.lerp(shoulderRz * 0.68, 5.5, t);
    }
  } else {
    if (v < 0.25) {
      rx = THREE.MathUtils.lerp(hip.rx * 0.92, hip.rx, smooth(0, 0.25, v));
      rz = THREE.MathUtils.lerp(hip.rz * 0.92, hip.rz, smooth(0, 0.25, v));
    } else if (v < 0.5) {
      const t = smooth(0.25, 0.5, v);
      rx = THREE.MathUtils.lerp(hip.rx, waist.rx, t);
      rz = THREE.MathUtils.lerp(hip.rz, waist.rz, t);
    } else if (v < 0.78) {
      const t = smooth(0.5, 0.78, v);
      rx = THREE.MathUtils.lerp(waist.rx, bust.rx, t);
      rz = THREE.MathUtils.lerp(waist.rz, bust.rz, t);
      zCenter = Math.sin(Math.PI * t) * 0.35;
    } else if (v < 0.9) {
      const t = smooth(0.78, 0.9, v);
      rx = THREE.MathUtils.lerp(bust.rx, shoulderRx, t);
      rz = THREE.MathUtils.lerp(bust.rz, shoulderRz, t);
    } else {
      const t = smooth(0.9, 1, v);
      rx = THREE.MathUtils.lerp(shoulderRx * 0.45, 7.5, t);
      rz = THREE.MathUtils.lerp(shoulderRz * 0.8, 7, t);
    }
  }

  return { y: yOffset + THREE.MathUtils.clamp(v, 0, 1) * torsoHeight, rx, rz, zCenter };
}
/**
 * Measures the perimeter of an actual generated torso-mesh ring.
 * The body model is generated in centimetre-like project units; this value
 * is meaningful in cm only after the model's physical scale is calibrated.
 */
export function measureTorsoMeshCircumference(
  gender: Gender,
  measurements: MannequinMeasurements,
  v: number
): number {
  const mannequin = buildParametricMannequin(gender, measurements);
  let torso: THREE.Mesh | undefined;
  mannequin.traverse(object => {
    if (object instanceof THREE.Mesh && object.name === 'TorsoSurface') torso = object;
  });
  if (!torso) throw new Error('Generated mannequin has no torso surface');

  const radialSegments = 64;
  const verticalSegments = 100;
  const row = Math.round(THREE.MathUtils.clamp(v, 0, 1) * verticalSegments);
  const positions = torso.geometry.getAttribute('position');
  const stride = radialSegments + 1;
  let perimeter = 0;
  for (let j = 0; j < radialSegments; j++) {
    const a = row * stride + j;
    const b = a + 1;
    perimeter += Math.hypot(
      positions.getX(b) - positions.getX(a),
      positions.getZ(b) - positions.getZ(a)
    );
  }
  mannequin.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    }
  });
  return perimeter;
}

/** Converts a tape circumference into a conservative circular limb radius. */
export function limbRadiusFromCircumference(
  circumference: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(circumference) || (circumference ?? 0) <= 0) return fallback;
  return THREE.MathUtils.clamp((circumference as number) / (2 * Math.PI), minimum, maximum);
}

export function ellipsePerimeter(a: number, b: number): number {
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/**
 * Small anatomical surface offsets for the parametric torso.
 * Positive values project toward the front (+Z); negative values toward the back.
 * Child and infant silhouettes intentionally remain neutral.
 */
export function getTorsoSculptDisplacement(
  gender: Gender,
  v: number,
  x: number,
  rx: number,
  frontFacing: boolean
): number {
  if (gender === 'kids' || gender === 'infant' || rx <= 0) return 0;
  const normalizedX = x / rx;
  const gaussian = (value: number, center: number, spread: number) =>
    Math.exp(-0.5 * ((value - center) / spread) ** 2);
  const sideLobes = gaussian(normalizedX, -0.29, 0.22) + gaussian(normalizedX, 0.29, 0.22);

  if (frontFacing) {
    if (gender === 'women') {
      // Two broad, blended breast volumes, sculpted into the torso surface.
      return 2.2 * sideLobes * gaussian(v, 0.705, 0.075);
    }
    // A restrained pectoral contour for the men's fitting form.
    return 0.65 * sideLobes * gaussian(v, 0.765, 0.065);
  }

  // Gluteal projection is subtle and remains part of the continuous torso shell.
  return -1.15 * sideLobes * gaussian(v, gender === 'women' ? 0.19 : 0.22, 0.085);
}

export function buildParametricMannequin(
  gender: Gender,
  measurements: MannequinMeasurements
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'MannequinRoot';
  const { yOffset, torsoHeight } = getTorsoSpan(gender, measurements);
  const scale = gender === 'infant' ? 0.48 : gender === 'kids' ? 0.68 : 1;

  const referenceHeight = DEFAULT_MANNEQUIN_MEASUREMENTS[gender]?.height ?? 168;
  // Stature changes should affect limb reach as well as leg length, while
  // tape-derived girths remain controlled exclusively by circumference inputs.
  const statureScale = THREE.MathUtils.clamp(
    (Number.isFinite(measurements.height) && measurements.height > 0
      ? measurements.height
      : referenceHeight) / referenceHeight,
    0.85,
    1.15
  );
  const limbLengthScale = scale * statureScale;

  const skin = new THREE.MeshStandardMaterial({
    color: 0xc99a80, roughness: 0.82, metalness: 0,
    side: THREE.DoubleSide
  });
  const wood = new THREE.MeshStandardMaterial({ color: 0x49301f, roughness: 0.58 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb58a42, roughness: 0.32, metalness: 0.65 });
  const tape = new THREE.LineBasicMaterial({ color: 0xb7a58d });

  const body = new THREE.Group();
  body.name = 'MannequinBody';

  // Higher tessellation and shared profile sampling remove the visibly faceted torso.
  const verticalSegments = 100;
  const radialSegments = 64;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= verticalSegments; i++) {
    const v = i / verticalSegments;
    const rowStart = positions.length;
    const profile = getTorsoProfile(gender, measurements, v);
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const a = u * Math.PI * 2;
      const p = getTorsoProfile(gender, measurements, v, a);
      const x = p.rx * Math.cos(a);
      const z = p.rz * Math.sin(a) + p.zCenter;
      const frontFacing = Math.sin(a) > 0;
      const sculpt = getTorsoSculptDisplacement(gender, v, x, p.rx, frontFacing);
      positions.push(x, p.y, z + sculpt);
      uvs.push(u, v);
    }

    // Preserve the original tape circumference after adding local anatomical
    // contours. This keeps the measured ring size stable for pattern drafting.
    if (gender === 'women' || gender === 'men') {
      let perimeter = 0;
      for (let j = 0; j < radialSegments; j++) {
        const a = rowStart + j * 3;
        const b = a + 3;
        perimeter += Math.hypot(positions[b] - positions[a], positions[b + 2] - positions[a + 2]);
      }
      const targetPerimeter = ellipsePerimeter(profile.rx, profile.rz);
      const correction = perimeter > 0 ? targetPerimeter / perimeter : 1;
      for (let j = 0; j <= radialSegments; j++) {
        const offset = rowStart + j * 3;
        positions[offset] *= correction;
        positions[offset + 2] = profile.zCenter +
          (positions[offset + 2] - profile.zCenter) * correction;
      }
    }
  }
  for (let i = 0; i < verticalSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const torsoGeometry = new THREE.BufferGeometry();
  torsoGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  torsoGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  torsoGeometry.setIndex(indices);
  torsoGeometry.computeVertexNormals();
  const torso = new THREE.Mesh(torsoGeometry, skin);
  torso.name = 'TorsoSurface';
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  // Measurement tape follows the exact waist cross-section used by the garment generator.
  const waistV = gender === 'kids' || gender === 'infant' ? 0.6 : 0.5;
  const waistProfile = getTorsoProfile(gender, measurements, waistV);
  const waistPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    waistPoints.push(new THREE.Vector3(
      Math.cos(a) * (waistProfile.rx + 0.18),
      waistProfile.y,
      Math.sin(a) * (waistProfile.rz + 0.18) + waistProfile.zCenter
    ));
  }
  body.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(waistPoints), tape
  ));

  const addEllipsoid = (
    name: string, x: number, y: number, z: number,
    sx: number, sy: number, sz: number
  ) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skin);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.add(mesh);
    return mesh;
  };

  const addSegment = (
    name: string,
    start: THREE.Vector3,
    end: THREE.Vector3,
    startRadius: number,
    endRadius = startRadius * 0.78
  ) => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const profile = [
      new THREE.Vector2(0, -length / 2 - startRadius),
      new THREE.Vector2(startRadius * 0.707, -length / 2 - startRadius * 0.707),
      new THREE.Vector2(startRadius, -length / 2),
      new THREE.Vector2(THREE.MathUtils.lerp(startRadius, endRadius, 0.25), -length / 4),
      new THREE.Vector2(THREE.MathUtils.lerp(startRadius, endRadius, 0.5), 0),
      new THREE.Vector2(THREE.MathUtils.lerp(startRadius, endRadius, 0.75), length / 4),
      new THREE.Vector2(endRadius, length / 2),
      new THREE.Vector2(endRadius * 0.707, length / 2 + endRadius * 0.707),
      new THREE.Vector2(0, length / 2 + endRadius)
    ];
    const geometry = new THREE.LatheGeometry(profile, 32);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, skin);
    mesh.name = name;
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.add(mesh);
    return mesh;
  };

  // A neutral, featureless head reads as a fitting mannequin rather than a toy face.
  const neckTop = yOffset + torsoHeight;
  const headY = neckTop + 10.5 * scale;
  addEllipsoid('Head', 0, headY + 1.1 * scale, 0,
    7.0 * scale, 9.2 * scale, 6.5 * scale);
  addEllipsoid('Neck', 0, neckTop - 1.0 * scale, 0,
    4.3 * scale, 4.6 * scale, 4.0 * scale);
  [-1, 1].forEach(side => {
    addEllipsoid('Ear_' + side, side * 6.8 * scale, headY, 0,
      1.15 * scale, 2.1 * scale, 0.85 * scale);
  });

  // Optional limb tape measurements shape the local mesh without requiring a server.
  const upperArmRadius = limbRadiusFromCircumference(
    measurements.armCircumference, 3.0 * scale, 2.0 * scale, 6.5 * scale
  );
  const thighRadius = limbRadiusFromCircumference(
    measurements.thighCircumference, 4.35 * scale, 2.8 * scale, 9.0 * scale
  );

  // Shoulder position comes from the measured torso silhouette, not a hard-coded width.
  const shoulderProfile = getTorsoProfile(gender, measurements, 0.86);
  const shoulderX = shoulderProfile.rx * 0.92;
  const shoulderY = yOffset + torsoHeight * 0.86;
  [-1, 1].forEach(side => {
    const shoulder = new THREE.Vector3(side * shoulderX, shoulderY, 0);
    const elbow = new THREE.Vector3(side * (shoulderX + 5.2 * limbLengthScale), yOffset + torsoHeight * 0.57, 0.6 * scale);
    const wrist = new THREE.Vector3(side * (shoulderX + 7.2 * limbLengthScale), yOffset + 13.5 * scale, 0.8 * scale);
    const palm = new THREE.Vector3(side * (shoulderX + 7.5 * limbLengthScale), yOffset + 8.8 * scale, 1.0 * scale);
    addEllipsoid('Shoulder_' + side, shoulder.x, shoulder.y, shoulder.z,
      4.0 * scale, 4.1 * scale, 3.8 * scale);
    addSegment('UpperArm_' + side, shoulder, elbow, upperArmRadius, upperArmRadius * 0.82);
    addEllipsoid('Elbow_' + side, elbow.x, elbow.y, elbow.z, 2.35 * scale, 2.35 * scale, 2.35 * scale);
    addSegment('Forearm_' + side, elbow, wrist, 2.25 * scale, 1.55 * scale);
    addEllipsoid('Wrist_' + side, wrist.x, wrist.y, wrist.z, 1.5 * scale, 1.45 * scale, 1.5 * scale);
    addEllipsoid('Palm_' + side, palm.x, palm.y, palm.z, 1.8 * limbLengthScale, 2.8 * scale, 0.9 * scale);
    for (let finger = 0; finger < 5; finger++) {
      const offset = (finger - 2) * 0.72 * limbLengthScale;
      const fingerLength = (finger === 1 || finger === 2 ? 4.1 : 3.55) * limbLengthScale;
      const start = new THREE.Vector3(palm.x + offset, palm.y - 1.2 * scale, palm.z + 0.08 * limbLengthScale);
      const end = new THREE.Vector3(palm.x + offset * 1.08, palm.y - fingerLength, palm.z + 0.1 * limbLengthScale);
      addSegment('Finger_' + side + '_' + finger, start, end, 0.34 * scale, 0.22 * scale);
    }
    const thumbStart = new THREE.Vector3(palm.x - side * 1.25 * limbLengthScale, palm.y + 0.1 * scale, palm.z + 0.1 * scale);
    const thumbEnd = new THREE.Vector3(palm.x - side * 2.8 * limbLengthScale, palm.y - 1.8 * scale, palm.z + 0.15 * scale);
    addSegment('Thumb_' + side, thumbStart, thumbEnd, 0.48 * scale, 0.31 * scale);
  });

  // Legs now occupy the full height budget instead of the old short 40–45 cm stumps.
  const hipProfile = getTorsoProfile(gender, measurements, gender === 'kids' || gender === 'infant' ? 0.3 : 0.25);
  const hipX = Math.min(9 * scale, hipProfile.rx * 0.48);
  const kneeY = yOffset * 0.52;
  const ankleY = Math.max(4 * scale, 4.5);
  [-1, 1].forEach(side => {
    const hip = new THREE.Vector3(side * hipX, yOffset + 1.5 * scale, 0);
    const knee = new THREE.Vector3(side * hipX * 1.05, kneeY, 0.35 * scale);
    const ankle = new THREE.Vector3(side * hipX * 1.08, ankleY, 0.1 * scale);
    addEllipsoid('HipJoint_' + side, hip.x, hip.y, hip.z,
      4.7 * scale, 5.2 * scale, 4.9 * scale);
    addSegment('Thigh_' + side, hip, knee, thighRadius, thighRadius * 0.72);
    addEllipsoid('Knee_' + side, knee.x, knee.y, knee.z, 3.0 * scale, 3.1 * scale, 3.0 * scale);
    addSegment('Calf_' + side, knee, ankle, 2.8 * scale, 1.65 * scale);
    addEllipsoid('Ankle_' + side, ankle.x, ankle.y, ankle.z, 1.8 * scale, 2.0 * scale, 1.8 * scale);
    addEllipsoid('Foot_' + side, side * hipX * 1.08, 2.2 * scale, 4.0 * scale,
      2.7 * scale, 1.9 * scale, 5.7 * scale);
  });

  root.add(body);

  // Rear support: shifted behind the body so it no longer pierces the torso or legs.
  const stand = new THREE.Group();
  stand.name = 'MannequinStand';
  const poleHeight = Math.max(8, yOffset + 1);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, poleHeight, 20), brass);
  pole.position.set(0, poleHeight / 2 + 1.5, -13);
  stand.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 3, 40), wood);
  base.position.set(0, 1.5, -13);
  base.receiveShadow = true;
  stand.add(base);
  root.add(stand);

  return root;
}
