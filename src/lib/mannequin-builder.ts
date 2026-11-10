import * as THREE from 'three';
import { Gender } from './pattern-logic';

export interface MannequinMeasurements {
  bust: number;       // cm (e.g. 88)
  waist: number;      // cm (e.g. 70)
  hip: number;        // cm (e.g. 94)
  shoulder: number;   // cm (e.g. 12)
  backLength: number; // cm (e.g. 40)
  height: number;     // cm (e.g. 168)
}

export const DEFAULT_MANNEQUIN_MEASUREMENTS: Record<Gender, MannequinMeasurements> = {
  women: {
    bust: 88,
    waist: 70,
    hip: 94,
    shoulder: 12,
    backLength: 40,
    height: 168
  },
  men: {
    bust: 98, // chest
    waist: 82,
    hip: 98,
    shoulder: 15,
    backLength: 44,
    height: 178
  },
  kids: {
    bust: 62,
    waist: 56,
    hip: 66,
    shoulder: 8.5,
    backLength: 29,
    height: 120
  },
  infant: {
    bust: 48,
    waist: 46,
    hip: 50,
    shoulder: 6.5,
    backLength: 19.5,
    height: 70
  }
};

export interface TorsoSpan {
  /** World Y of the bottom edge of the torso (hip / pelvis level). */
  yOffset: number;
  /** Height of the torso tube, from hip level up to the top of the neck. */
  torsoHeight: number;
}

/**
 * Vertical extent of the dress form for a given gender / back length.
 * Both the mannequin and the garment are built from this span, so a garment
 * can never drift away from the body it is supposed to sit on.
 */
export function getTorsoSpan(gender: Gender, measurements: MannequinMeasurements): TorsoSpan {
  const ref = DEFAULT_MANNEQUIN_MEASUREMENTS[gender] || DEFAULT_MANNEQUIN_MEASUREMENTS.women;
  const lengthScale = (measurements.backLength || ref.backLength) / ref.backLength;
  const isChild = gender === 'kids' || gender === 'infant';
  return {
    yOffset: isChild ? 25 : 45,
    torsoHeight: (isChild ? 45 : 68) * lengthScale
  };
}

export interface TorsoProfile {
  y: number;      // world Y of this horizontal slice
  rx: number;     // lateral (side to side) radius
  rz: number;     // front to back radius (already includes the bust shaping)
  zCenter: number; // forward offset of the slice (bust projection)
}

/**
 * The single source of truth for the dress form silhouette.
 *
 * `v` runs from 0 (bottom of the hips) to 1 (top of the neck).
 * `angle` is measured around the torso: 0 = side (+X), PI/2 = front (+Z).
 * A point on the body surface is `(rx*cos(angle), y, rz*sin(angle) + zCenter)`.
 *
 * The garment generator samples this same function and only inflates it by the
 * clothing ease, which is what makes the clothes actually sit *on* the body.
 */
export function getTorsoProfile(
  gender: Gender,
  measurements: MannequinMeasurements,
  v: number,
  angle: number = 0
): TorsoProfile {
  const ref = DEFAULT_MANNEQUIN_MEASUREMENTS[gender] || DEFAULT_MANNEQUIN_MEASUREMENTS.women;
  const bustScale = (measurements.bust || ref.bust) / ref.bust;
  const waistScale = (measurements.waist || ref.waist) / ref.waist;
  const hipScale = (measurements.hip || ref.hip) / ref.hip;
  const shoulderScale = (measurements.shoulder || ref.shoulder) / ref.shoulder;

  const { yOffset, torsoHeight } = getTorsoSpan(gender, measurements);
  const y = yOffset + v * torsoHeight;

  let rx = 14; // lateral radius
  let rz = 10; // depth radius
  let zCenter = 0;

  if (gender === 'women') {
    if (v < 0.25) {
      // Lower pelvis / hips
      const t = v / 0.25;
      rx = 18 * hipScale * (0.85 + 0.15 * Math.sin(t * Math.PI));
      rz = 13 * hipScale * (0.85 + 0.15 * Math.sin(t * Math.PI));
    } else if (v < 0.5) {
      // Waist
      const t = (v - 0.25) / 0.25;
      const currentHip = 18 * hipScale;
      const currentWaist = 11.5 * waistScale;
      rx = THREE.MathUtils.lerp(currentHip, currentWaist, Math.sin(t * Math.PI * 0.5));
      rz = THREE.MathUtils.lerp(13 * hipScale, 8.5 * waistScale, Math.sin(t * Math.PI * 0.5));
    } else if (v < 0.75) {
      // Bust
      const t = (v - 0.5) / 0.25;
      const currentWaist = 11.5 * waistScale;
      const currentBust = 15.5 * bustScale;
      rx = THREE.MathUtils.lerp(currentWaist, currentBust, Math.sin(t * Math.PI * 0.5));
      // Female bust projection in front (+Z)
      const bustPeak = Math.sin(t * Math.PI);
      rz = THREE.MathUtils.lerp(8.5 * waistScale, 11 * bustScale, t) + bustPeak * 2.8 * bustScale;
      zCenter = bustPeak * 1.5;
    } else if (v < 0.9) {
      // Shoulders / upper chest
      const t = (v - 0.75) / 0.15;
      rx = THREE.MathUtils.lerp(15.5 * bustScale, 17.5 * shoulderScale, t);
      rz = THREE.MathUtils.lerp(11 * bustScale, 8.5, t);
    } else {
      // Neck base to top of neck
      const t = (v - 0.9) / 0.1;
      rx = THREE.MathUtils.lerp(17.5 * shoulderScale * 0.45, 6, t);
      rz = THREE.MathUtils.lerp(8.5 * 0.7, 5.5, t);
    }
  } else if (gender === 'men') {
    if (v < 0.25) {
      // Hips
      rx = 16.5 * hipScale;
      rz = 12 * hipScale;
    } else if (v < 0.5) {
      // Waist
      const t = (v - 0.25) / 0.25;
      rx = THREE.MathUtils.lerp(16.5 * hipScale, 14.5 * waistScale, t);
      rz = THREE.MathUtils.lerp(12 * hipScale, 10.5 * waistScale, t);
    } else if (v < 0.78) {
      // Broad chest & lats
      const t = (v - 0.5) / 0.28;
      rx = THREE.MathUtils.lerp(14.5 * waistScale, 19.5 * shoulderScale, t);
      rz = THREE.MathUtils.lerp(10.5 * waistScale, 13 * bustScale, t);
      zCenter = Math.sin(t * Math.PI) * 0.8;
    } else if (v < 0.9) {
      // Broad shoulder line
      const t = (v - 0.78) / 0.12;
      rx = THREE.MathUtils.lerp(19.5 * shoulderScale, 19 * shoulderScale, t);
      rz = THREE.MathUtils.lerp(13 * bustScale, 9.5, t);
    } else {
      // Neck
      const t = (v - 0.9) / 0.1;
      rx = THREE.MathUtils.lerp(19 * shoulderScale * 0.45, 7.5, t);
      rz = THREE.MathUtils.lerp(9.5 * 0.8, 7, t);
    }
  } else {
    // Kids / Infant
    if (v < 0.3) {
      rx = 11 * hipScale;
      rz = 9.5 * hipScale;
    } else if (v < 0.6) {
      // Soft rounded tummy
      const t = (v - 0.3) / 0.3;
      rx = THREE.MathUtils.lerp(11 * hipScale, 10.5 * waistScale, t);
      rz = THREE.MathUtils.lerp(9.5 * hipScale, 10 * waistScale, t);
      zCenter = Math.sin(t * Math.PI) * 1.2;
    } else if (v < 0.85) {
      // Chest
      const t = (v - 0.6) / 0.25;
      rx = THREE.MathUtils.lerp(10.5 * waistScale, 12 * shoulderScale, t);
      rz = THREE.MathUtils.lerp(10 * waistScale, 9 * bustScale, t);
    } else {
      // Neck
      const t = (v - 0.85) / 0.15;
      rx = THREE.MathUtils.lerp(12 * shoulderScale * 0.5, 5.5, t);
      rz = THREE.MathUtils.lerp(9 * 0.6, 5, t);
    }
  }

  // Bust prominence separation (front volume only), kept angle dependent so
  // both the mannequin and the garment share exactly the same chest shape.
  if (gender === 'women' && v > 0.55 && v < 0.75 && Math.sin(angle) > 0) {
    const bustPeak = Math.sin(((v - 0.55) / 0.2) * Math.PI);
    const leftRightSpread = Math.abs(Math.cos(angle));
    if (leftRightSpread > 0.15 && leftRightSpread < 0.85) {
      rz *= (1 + bustPeak * 0.28);
    }
  }

  return { y, rx, rz, zCenter };
}

/** Ramanujan approximation of an ellipse perimeter, used to convert a
 *  measurement (a circumference) into the ease a garment needs at that level. */
export function ellipsePerimeter(a: number, b: number): number {
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/**
 * Builds a parametric tailoring dress form mannequin with realistic anatomy,
 * fabric texture, wooden neck topper, and metallic/wood floor stand.
 */
export function buildParametricMannequin(
  gender: Gender,
  measurements: MannequinMeasurements
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'MannequinRoot';

  // Base scaling relative to canonical reference
  const ref = DEFAULT_MANNEQUIN_MEASUREMENTS[gender] || DEFAULT_MANNEQUIN_MEASUREMENTS.women;
  const waistScale = (measurements.waist || ref.waist) / ref.waist;
  const shoulderScale = (measurements.shoulder || ref.shoulder) / ref.shoulder;

  const { yOffset, torsoHeight } = getTorsoSpan(gender, measurements);

  // Materials
  // Unified skin material keeps the torso, limbs, hands and head visually coherent.
  const dummyTorsoMaterial = new THREE.MeshStandardMaterial({
    color: gender === 'women' ? 0xc99578 : 0xb98265,
    roughness: 0.78,
    metalness: 0,
    bumpScale: 0.015
  });
  const featureMaterial = new THREE.MeshStandardMaterial({ color: 0x38251f, roughness: 0.62 });
  const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xf2e9df, roughness: 0.35 });
  const irisMaterial = new THREE.MeshStandardMaterial({ color: 0x514033, roughness: 0.28 });

  const seamLineMaterial = new THREE.LineBasicMaterial({
    color: 0xa89984,
    linewidth: 1
  });

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d2314, // Dark walnut wood
    roughness: 0.4,
    metalness: 0.1
  });

  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0xc89b3c, // Antique brass
    roughness: 0.3,
    metalness: 0.75
  });

  // Construct Torso Mesh via Lofted Profiles
  const torsoGroup = new THREE.Group();
  torsoGroup.name = 'MannequinTorso';

  // Number of vertical slice levels
  const verticalSegments = 32;
  const radialSegments = 36;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Generate slice heights and radii from the shared body profile
  for (let i = 0; i <= verticalSegments; i++) {
    const v = i / verticalSegments; // 0 = bottom (hip/pelvis), 1 = top (neck)

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const angle = u * Math.PI * 2;

      const profile = getTorsoProfile(gender, measurements, v, angle);

      positions.push(
        profile.rx * Math.cos(angle),
        profile.y,
        profile.rz * Math.sin(angle) + profile.zCenter
      );
      uvs.push(u, v);
    }
  }

  // Generate grid indices
  for (let i = 0; i < verticalSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = (i + 1) * (radialSegments + 1) + j;
      const c = (i + 1) * (radialSegments + 1) + (j + 1);
      const d = i * (radialSegments + 1) + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const torsoGeom = new THREE.BufferGeometry();
  torsoGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  torsoGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  torsoGeom.setIndex(indices);
  torsoGeom.computeVertexNormals();

  const torsoMesh = new THREE.Mesh(torsoGeom, dummyTorsoMaterial);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // Close the bottom of the dress form so it is never see-through
  const bottomRx = getTorsoProfile(gender, measurements, 0, 0).rx;
  const bottomRz = getTorsoProfile(gender, measurements, 0, Math.PI / 2).rz;
  const bottomCapGeom = new THREE.CircleGeometry(1, 48);
  bottomCapGeom.rotateX(Math.PI / 2); // face downwards
  const bottomCapMesh = new THREE.Mesh(bottomCapGeom, dummyTorsoMaterial);
  bottomCapMesh.scale.set(bottomRx, 1, bottomRz);
  bottomCapMesh.position.set(0, yOffset + 0.01, 0);
  bottomCapMesh.receiveShadow = true;
  torsoGroup.add(bottomCapMesh);

  // Add Tailoring Ribbon Lines (waist tape line & center front / center back lines)
  const waistTapeRadiusX = (gender === 'women' ? 12 * waistScale : 15 * waistScale) + 0.15;
  const waistTapeRadiusZ = (gender === 'women' ? 9 * waistScale : 11 * waistScale) + 0.15;
  const waistY = yOffset + torsoHeight * 0.45;

  const waistPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    waistPoints.push(new THREE.Vector3(
      Math.cos(a) * waistTapeRadiusX,
      waistY,
      Math.sin(a) * waistTapeRadiusZ
    ));
  }
  const waistTapeGeom = new THREE.BufferGeometry().setFromPoints(waistPoints);
  const waistTapeLine = new THREE.Line(waistTapeGeom, seamLineMaterial);
  torsoGroup.add(waistTapeLine);

  // Full anatomical head, arms, hands, legs and feet.
  // The proportions follow the same adult/child scale as the existing torso profile.
  const neckTopY = yOffset + torsoHeight;
  const isChild = gender === 'kids' || gender === 'infant';
  const bodyScale = isChild ? (gender === 'infant' ? 0.48 : 0.68) : 1;
  const shoulderY = yOffset + torsoHeight * 0.86;
  const shoulderOffset = (gender === 'women' ? 18 : 20.5) * shoulderScale;

  const addEllipsoid = (
    name: string,
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    material: THREE.Material = dummyTorsoMaterial
  ) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    torsoGroup.add(mesh);
    return mesh;
  };

  const addLimbSegment = (
    name: string,
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    material: THREE.Material = dummyTorsoMaterial
  ) => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, Math.max(0.1, length - radius * 1.25), 8, 16),
      material
    );
    mesh.name = name;
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    torsoGroup.add(mesh);
    return mesh;
  };

  // Head and neck transition: oval cranium, jaw, ears and readable facial features.
  const headCenterY = neckTopY + 10.5 * bodyScale;
  addEllipsoid('Head_Cranium', 0, headCenterY + 1.1 * bodyScale, 0,
    7.2 * bodyScale, 9.1 * bodyScale, 6.6 * bodyScale);
  addEllipsoid('Head_Jaw', 0, headCenterY - 4.0 * bodyScale, 1.0 * bodyScale,
    5.4 * bodyScale, 4.7 * bodyScale, 5.7 * bodyScale);
  [-1, 1].forEach(side => {
    addEllipsoid(`Ear_${side}`, side * 7.0 * bodyScale, headCenterY - 0.2 * bodyScale, 0,
      1.35 * bodyScale, 2.35 * bodyScale, 1.0 * bodyScale);
    // Eye socket, eyeball and iris are placed on the front (+Z) plane.
    addEllipsoid(`Eye_${side}`, side * 2.55 * bodyScale, headCenterY + 0.7 * bodyScale,
      5.65 * bodyScale, 1.35 * bodyScale, 0.82 * bodyScale, 0.58 * bodyScale, eyeWhiteMaterial);
    addEllipsoid(`Iris_${side}`, side * 2.55 * bodyScale, headCenterY + 0.7 * bodyScale,
      6.16 * bodyScale, 0.48 * bodyScale, 0.52 * bodyScale, 0.22 * bodyScale, irisMaterial);
    addEllipsoid(`Pupil_${side}`, side * 2.55 * bodyScale, headCenterY + 0.7 * bodyScale,
      6.34 * bodyScale, 0.21 * bodyScale, 0.28 * bodyScale, 0.12 * bodyScale, featureMaterial);
    addEllipsoid(`Brow_${side}`, side * 2.55 * bodyScale, headCenterY + 2.0 * bodyScale,
      5.75 * bodyScale, 1.55 * bodyScale, 0.28 * bodyScale, 0.35 * bodyScale, featureMaterial);
  });
  addEllipsoid('Nose_Bridge', 0, headCenterY - 0.8 * bodyScale, 6.0 * bodyScale,
    0.85 * bodyScale, 1.8 * bodyScale, 1.05 * bodyScale);
  addEllipsoid('Nose_Tip', 0, headCenterY - 1.8 * bodyScale, 6.8 * bodyScale,
    1.0 * bodyScale, 0.75 * bodyScale, 0.85 * bodyScale);
  addEllipsoid('Mouth_Upper', 0, headCenterY - 3.0 * bodyScale, 5.95 * bodyScale,
    1.35 * bodyScale, 0.28 * bodyScale, 0.25 * bodyScale, featureMaterial);
  addEllipsoid('Mouth_Lower', 0, headCenterY - 3.45 * bodyScale, 5.9 * bodyScale,
    1.1 * bodyScale, 0.2 * bodyScale, 0.22 * bodyScale, featureMaterial);

  // Arms: shoulder caps, upper arms, elbows, forearms, wrists, palms and five fingers.
  [-1, 1].forEach(side => {
    const shoulder = new THREE.Vector3(side * shoulderOffset, shoulderY, 0);
    const elbow = new THREE.Vector3(side * (shoulderOffset + 5.0 * bodyScale), yOffset + torsoHeight * 0.55, 0.8 * bodyScale);
    const wrist = new THREE.Vector3(side * (shoulderOffset + 5.5 * bodyScale), yOffset + 13 * bodyScale, 1.0 * bodyScale);
    const palm = new THREE.Vector3(side * (shoulderOffset + 5.8 * bodyScale), yOffset + 8.8 * bodyScale, 1.35 * bodyScale);
    addEllipsoid(`Shoulder_${side}`, shoulder.x, shoulder.y, shoulder.z,
      4.4 * bodyScale, 4.7 * bodyScale, 4.2 * bodyScale);
    addLimbSegment(`UpperArm_${side}`, shoulder, elbow, 3.35 * bodyScale);
    addEllipsoid(`Elbow_${side}`, elbow.x, elbow.y, elbow.z, 2.8 * bodyScale, 2.8 * bodyScale, 2.8 * bodyScale);
    addLimbSegment(`Forearm_${side}`, elbow, wrist, 2.65 * bodyScale);
    addEllipsoid(`Wrist_${side}`, wrist.x, wrist.y, wrist.z, 1.9 * bodyScale, 1.8 * bodyScale, 1.8 * bodyScale);
    addEllipsoid(`Palm_${side}`, palm.x, palm.y, palm.z, 2.15 * bodyScale, 3.0 * bodyScale, 1.0 * bodyScale);
    for (let finger = 0; finger < 4; finger++) {
      const offset = (finger - 1.5) * 0.88 * bodyScale;
      const start = new THREE.Vector3(palm.x + offset, palm.y - 1.4 * bodyScale, palm.z + 0.05 * bodyScale);
      const end = new THREE.Vector3(palm.x + offset * 1.12, palm.y - (4.1 + (finger === 1 || finger === 2 ? 0.35 : 0)) * bodyScale,
        palm.z + 0.12 * bodyScale);
      addLimbSegment(`Finger_${side}_${finger}`, start, end, 0.48 * bodyScale);
      addEllipsoid(`Fingertip_${side}_${finger}`, end.x, end.y, end.z,
        0.48 * bodyScale, 0.55 * bodyScale, 0.48 * bodyScale);
    }
    const thumbStart = new THREE.Vector3(palm.x - side * 1.6 * bodyScale, palm.y + 0.1 * bodyScale, palm.z + 0.1 * bodyScale);
    const thumbEnd = new THREE.Vector3(palm.x - side * 3.0 * bodyScale, palm.y - 2.0 * bodyScale, palm.z + 0.25 * bodyScale);
    addLimbSegment(`Thumb_${side}`, thumbStart, thumbEnd, 0.65 * bodyScale);
  });

  // Legs: anatomical thighs, knees, calves, ankles and feet. The central stand
  // remains behind the body and no longer substitutes for the lower limbs.
  [-1, 1].forEach(side => {
    const hip = new THREE.Vector3(side * 9.0 * bodyScale, yOffset + 2.0 * bodyScale, 0);
    const knee = new THREE.Vector3(side * 9.6 * bodyScale, yOffset * 0.52, 0.2 * bodyScale);
    const ankle = new THREE.Vector3(side * 10.0 * bodyScale, 5.0 * bodyScale, 0.15 * bodyScale);
    addEllipsoid(`HipJoint_${side}`, hip.x, hip.y, hip.z, 5.2 * bodyScale, 6.0 * bodyScale, 5.5 * bodyScale);
    addLimbSegment(`Thigh_${side}`, hip, knee, 5.0 * bodyScale);
    addEllipsoid(`Knee_${side}`, knee.x, knee.y, knee.z, 3.8 * bodyScale, 3.8 * bodyScale, 3.7 * bodyScale);
    addLimbSegment(`Calf_${side}`, knee, ankle, 3.45 * bodyScale);
    addEllipsoid(`Ankle_${side}`, ankle.x, ankle.y, ankle.z, 2.35 * bodyScale, 2.5 * bodyScale, 2.5 * bodyScale);
    addEllipsoid(`Foot_${side}`, side * 10.0 * bodyScale, 2.5 * bodyScale, 4.0 * bodyScale,
      3.4 * bodyScale, 2.2 * bodyScale, 6.8 * bodyScale);
    addEllipsoid(`Heel_${side}`, side * 10.0 * bodyScale, 2.3 * bodyScale, -1.2 * bodyScale,
      2.6 * bodyScale, 2.2 * bodyScale, 2.8 * bodyScale);
  });

  root.add(torsoGroup);

  // Construct Stand Assembly
  const standGroup = new THREE.Group();
  standGroup.name = 'MannequinStand';

  // Chrome / Brass Central Pole
  const poleHeight = yOffset + 10;
  const poleGeom = new THREE.CylinderGeometry(1.4, 1.4, poleHeight, 24);
  const poleMesh = new THREE.Mesh(poleGeom, brassMaterial);
  poleMesh.position.set(0, poleHeight / 2, 0);
  standGroup.add(poleMesh);

  // Height Adjustment Turn-Knob
  const knobGeom = new THREE.TorusGeometry(2.6, 0.6, 16, 24);
  knobGeom.rotateX(Math.PI / 2);
  const knobMesh = new THREE.Mesh(knobGeom, brassMaterial);
  knobMesh.position.set(0, poleHeight * 0.55, 0);
  standGroup.add(knobMesh);

  // Circular Pedestal Base or Tripod
  const baseGeom = new THREE.CylinderGeometry(16, 18, 3.5, 36);
  const baseMesh = new THREE.Mesh(baseGeom, woodMaterial);
  baseMesh.position.set(0, 1.75, 0);
  baseMesh.receiveShadow = true;
  standGroup.add(baseMesh);

  const baseRimGeom = new THREE.TorusGeometry(17.8, 0.6, 16, 36);
  baseRimGeom.rotateX(Math.PI / 2);
  const baseRimMesh = new THREE.Mesh(baseRimGeom, brassMaterial);
  baseRimMesh.position.set(0, 3.5, 0);
  standGroup.add(baseRimMesh);

  root.add(standGroup);

  return root;
}
