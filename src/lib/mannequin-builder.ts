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
  const isChild = gender === 'kids' || gender === 'infant';
  const headScale = gender === 'infant' ? 0.48 : gender === 'kids' ? 0.68 : 1;
  const headAllowance = 20.7 * headScale;
  // The viewer currently supplies a fixed 168 cm placeholder. Use the
  // gender-specific reference height until a real height control is wired in.
  const targetHeight = ref.height;
  const torsoHeight = Math.max(1, (measurements.backLength || ref.backLength) * 1.7);
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

export function getTorsoProfile(
  gender: Gender,
  measurements: MannequinMeasurements,
  v: number,
  angle = 0
): TorsoProfile {
  const ref = DEFAULT_MANNEQUIN_MEASUREMENTS[gender] ?? DEFAULT_MANNEQUIN_MEASUREMENTS.women;
  const bust = (measurements.bust || ref.bust) / ref.bust;
  const waist = (measurements.waist || ref.waist) / ref.waist;
  const hip = (measurements.hip || ref.hip) / ref.hip;
  const shoulder = (measurements.shoulder || ref.shoulder) / ref.shoulder;
  const { yOffset, torsoHeight } = getTorsoSpan(gender, measurements);
  const child = gender === 'kids' || gender === 'infant';

  let rx: number;
  let rz: number;
  let zCenter = 0;

  if (gender === 'women') {
    const pelvisT = smooth(0, 0.25, v);
    const waistT = smooth(0.25, 0.5, v);
    const bustT = smooth(0.5, 0.75, v);
    const shoulderT = smooth(0.75, 0.9, v);
    if (v < 0.25) {
      rx = THREE.MathUtils.lerp(15.3 * hip, 18 * hip, pelvisT);
      rz = THREE.MathUtils.lerp(11.1 * hip, 13 * hip, pelvisT);
    } else if (v < 0.5) {
      rx = THREE.MathUtils.lerp(18 * hip, 11.5 * waist, waistT);
      rz = THREE.MathUtils.lerp(13 * hip, 8.5 * waist, waistT);
    } else if (v < 0.75) {
      rx = THREE.MathUtils.lerp(11.5 * waist, 15.5 * bust, bustT);
      const peak = Math.sin(Math.PI * THREE.MathUtils.clamp((v - 0.5) / 0.25, 0, 1));
      rz = THREE.MathUtils.lerp(8.5 * waist, 11 * bust, bustT) + peak * 1.7 * bust;
      // Smooth paired front shaping; avoids the hard angular banding in the old mesh.
      const lateral = Math.abs(Math.cos(angle));
      const lobe = Math.exp(-Math.pow((lateral - 0.42) / 0.25, 2));
      rz += peak * lobe * 0.9 * bust;
      zCenter = peak * 0.55;
    } else if (v < 0.9) {
      rx = THREE.MathUtils.lerp(15.5 * bust, 17.5 * shoulder, shoulderT);
      rz = THREE.MathUtils.lerp(11 * bust, 8.5, shoulderT);
    } else {
      const t = smooth(0.9, 1, v);
      rx = THREE.MathUtils.lerp(7.9 * shoulder, 6, t);
      rz = THREE.MathUtils.lerp(6.2, 5.5, t);
    }
  } else if (gender === 'men') {
    if (v < 0.25) {
      rx = 16.5 * hip;
      rz = 12 * hip;
    } else if (v < 0.5) {
      const t = smooth(0.25, 0.5, v);
      rx = THREE.MathUtils.lerp(16.5 * hip, 14.5 * waist, t);
      rz = THREE.MathUtils.lerp(12 * hip, 10.5 * waist, t);
    } else if (v < 0.78) {
      const t = smooth(0.5, 0.78, v);
      rx = THREE.MathUtils.lerp(14.5 * waist, 19.5 * shoulder, t);
      rz = THREE.MathUtils.lerp(10.5 * waist, 13 * bust, t);
      zCenter = Math.sin(Math.PI * t) * 0.6;
    } else if (v < 0.9) {
      const t = smooth(0.78, 0.9, v);
      rx = 19.5 * shoulder;
      rz = THREE.MathUtils.lerp(13 * bust, 9.5, t);
    } else {
      const t = smooth(0.9, 1, v);
      rx = THREE.MathUtils.lerp(8.55 * shoulder, 7.5, t);
      rz = THREE.MathUtils.lerp(7.6, 7, t);
    }
  } else {
    if (v < 0.3) {
      rx = 11 * hip;
      rz = 9.5 * hip;
    } else if (v < 0.6) {
      const t = smooth(0.3, 0.6, v);
      rx = THREE.MathUtils.lerp(11 * hip, 10.5 * waist, t);
      rz = THREE.MathUtils.lerp(9.5 * hip, 10 * waist, t);
      zCenter = Math.sin(Math.PI * t) * 0.8;
    } else if (v < 0.85) {
      const t = smooth(0.6, 0.85, v);
      rx = THREE.MathUtils.lerp(10.5 * waist, 12 * shoulder, t);
      rz = THREE.MathUtils.lerp(10 * waist, 9 * bust, t);
    } else {
      const t = smooth(0.85, 1, v);
      rx = THREE.MathUtils.lerp(6 * shoulder, 5.5, t);
      rz = THREE.MathUtils.lerp(5.4, 5, t);
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
  const ref = DEFAULT_MANNEQUIN_MEASUREMENTS[gender] ?? DEFAULT_MANNEQUIN_MEASUREMENTS.women;
  const { yOffset, torsoHeight } = getTorsoSpan(gender, measurements);
  const child = gender === 'kids' || gender === 'infant';
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
  const waistProfile = getTorsoProfile(gender, measurements, 0.45);
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

  const addSegment = (name: string, start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 12, 24),
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
    addSegment('UpperArm_' + side, shoulder, elbow, 3.0 * scale);
    addEllipsoid('Elbow_' + side, elbow.x, elbow.y, elbow.z, 2.35 * scale, 2.35 * scale, 2.35 * scale);
    addSegment('Forearm_' + side, elbow, wrist, 2.25 * scale);
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
  const hipProfile = getTorsoProfile(gender, measurements, 0.08);
  const hipX = Math.min(9 * scale, hipProfile.rx * 0.48);
  const kneeY = yOffset * 0.52;
  const ankleY = Math.max(4 * scale, 4.5);
  [-1, 1].forEach(side => {
    const hip = new THREE.Vector3(side * hipX, yOffset + 1.5 * scale, 0);
    const knee = new THREE.Vector3(side * hipX * 1.05, kneeY, 0.35 * scale);
    const ankle = new THREE.Vector3(side * hipX * 1.08, ankleY, 0.1 * scale);
    addEllipsoid('HipJoint_' + side, hip.x, hip.y, hip.z,
      4.7 * scale, 5.2 * scale, 4.9 * scale);
    addSegment('Thigh_' + side, hip, knee, 4.35 * scale);
    addEllipsoid('Knee_' + side, knee.x, knee.y, knee.z, 3.0 * scale, 3.1 * scale, 3.0 * scale);
    addSegment('Calf_' + side, knee, ankle, 2.8 * scale);
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

  // Keep unused variables explicit while retaining the public measurements contract.
  void child;
  void ref;
  return root;
}
