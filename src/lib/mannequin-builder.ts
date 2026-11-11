import * as THREE from 'three';
import { Gender } from './pattern-logic';

export interface MannequinMeasurements {
  bust: number;
  waist: number;
  hip: number;
  shoulder: number;
  backLength: number;
  height: number;
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
export function ellipsePerimeter(a: number, b: number): number {
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export function buildParametricMannequin(
  gender: Gender,
  measurements: MannequinMeasurements
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'MannequinRoot';
  const { yOffset, torsoHeight } = getTorsoSpan(gender, measurements);
  const scale = gender === 'infant' ? 0.48 : gender === 'kids' ? 0.68 : 1;

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
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const a = u * Math.PI * 2;
      const p = getTorsoProfile(gender, measurements, v, a);
      positions.push(p.rx * Math.cos(a), p.y, p.rz * Math.sin(a) + p.zCenter);
      uvs.push(u, v);
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

  // Soft anatomical volumes blend into the torso silhouette. The pelvis
  // bridges the open lower torso to the thighs; gluteal forms add a natural
  // posterior contour instead of leaving a flat, tube-like back.
  const pelvisProfile = getTorsoProfile(gender, measurements, gender === 'kids' || gender === 'infant' ? 0.34 : 0.28);
  const pelvisCenterY = yOffset + torsoHeight * 0.16;
  addEllipsoid('PelvisCore', 0, pelvisCenterY, -0.15 * scale,
    pelvisProfile.rx * 0.94, 8.2 * scale, pelvisProfile.rz * 0.98);
  [-1, 1].forEach(side => {
    addEllipsoid('Gluteal_' + side, side * pelvisProfile.rx * 0.39,
      pelvisCenterY - 0.4 * scale, -pelvisProfile.rz * 0.56,
      pelvisProfile.rx * 0.43, 6.8 * scale, pelvisProfile.rz * 0.56);
  });

  // Tapered anatomical segments replace uniform capsules: real limbs narrow
  // towards wrists/ankles and widen at their muscle origins.
  const addSegment = (
    name: string,
    start: THREE.Vector3,
    end: THREE.Vector3,
    startRadius: number,
    endRadius = startRadius
  ) => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(endRadius, startRadius, Math.max(0.01, length), 32, 4, false),
      skin
    );
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

  // Shoulder position comes from the measured torso silhouette, not a hard-coded width.
  const shoulderProfile = getTorsoProfile(gender, measurements, 0.86);
  const shoulderX = shoulderProfile.rx * 0.92;
  const shoulderY = yOffset + torsoHeight * 0.86;
  [-1, 1].forEach(side => {
    const shoulder = new THREE.Vector3(side * shoulderX, shoulderY, 0);
    const elbow = new THREE.Vector3(side * (shoulderX + 5.2 * scale), yOffset + torsoHeight * 0.57, 0.6 * scale);
    const wrist = new THREE.Vector3(side * (shoulderX + 7.2 * scale), yOffset + 13.5 * scale, 0.8 * scale);
    const palm = new THREE.Vector3(side * (shoulderX + 7.5 * scale), yOffset + 8.8 * scale, 1.0 * scale);
    addEllipsoid('Shoulder_' + side, shoulder.x, shoulder.y, shoulder.z,
      4.0 * scale, 4.1 * scale, 3.8 * scale);
    addEllipsoid('Deltoid_' + side, shoulder.x, shoulder.y - 0.7 * scale, shoulder.z,
      4.25 * scale, 4.8 * scale, 4.0 * scale);
    addSegment('UpperArm_' + side, shoulder, elbow, 3.35 * scale, 2.45 * scale);
    addEllipsoid('Elbow_' + side, elbow.x, elbow.y, elbow.z, 2.35 * scale, 2.45 * scale, 2.25 * scale);
    addSegment('Forearm_' + side, elbow, wrist, 2.45 * scale, 1.45 * scale);
    addEllipsoid('Wrist_' + side, wrist.x, wrist.y, wrist.z, 1.5 * scale, 1.45 * scale, 1.5 * scale);
    addEllipsoid('Palm_' + side, palm.x, palm.y, palm.z, 1.8 * scale, 2.8 * scale, 0.9 * scale);
    for (let finger = 0; finger < 5; finger++) {
      const offset = (finger - 2) * 0.72 * scale;
      const fingerLength = (finger === 1 || finger === 2 ? 4.1 : 3.55) * scale;
      const start = new THREE.Vector3(palm.x + offset, palm.y - 1.2 * scale, palm.z + 0.08 * scale);
      const end = new THREE.Vector3(palm.x + offset * 1.08, palm.y - fingerLength, palm.z + 0.1 * scale);
      addSegment('Finger_' + side + '_' + finger, start, end, 0.34 * scale);
    }
    const thumbStart = new THREE.Vector3(palm.x - side * 1.25 * scale, palm.y + 0.1 * scale, palm.z + 0.1 * scale);
    const thumbEnd = new THREE.Vector3(palm.x - side * 2.8 * scale, palm.y - 1.8 * scale, palm.z + 0.15 * scale);
    addSegment('Thumb_' + side, thumbStart, thumbEnd, 0.48 * scale);
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
    addEllipsoid('GlutealFold_' + side, hip.x, hip.y - 2.2 * scale, -2.2 * scale,
      5.0 * scale, 5.2 * scale, 4.5 * scale);
    addSegment('Thigh_' + side, hip, knee, 5.0 * scale, 3.0 * scale);
    addEllipsoid('Knee_' + side, knee.x, knee.y, knee.z, 3.05 * scale, 3.35 * scale, 2.8 * scale);
    addSegment('Calf_' + side, knee, ankle, 3.0 * scale, 1.65 * scale);
    addEllipsoid('Ankle_' + side, ankle.x, ankle.y, ankle.z, 1.8 * scale, 2.0 * scale, 1.8 * scale);
    addEllipsoid('Heel_' + side, ankle.x, 2.1 * scale, -0.3 * scale,
      2.35 * scale, 2.0 * scale, 2.8 * scale);
    addEllipsoid('Foot_' + side, side * hipX * 1.08, 2.0 * scale, 3.4 * scale,
      2.65 * scale, 1.75 * scale, 5.2 * scale);
    addEllipsoid('ToeBox_' + side, side * hipX * 1.08, 1.75 * scale, 7.0 * scale,
      2.55 * scale, 1.35 * scale, 2.5 * scale);
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
