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
  const dummyTorsoMaterial = new THREE.MeshStandardMaterial({
    color: 0xede4d3, // Ecru / linen tailoring dummy color
    roughness: 0.85,
    metalness: 0.05,
    bumpScale: 0.03
  });

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

  // Add Wooden Neck Cap & Finial
  const neckTopY = yOffset + torsoHeight;
  const neckCapGeom = new THREE.CylinderGeometry(5.8, 6.2, 2.5, 32);
  const neckCapMesh = new THREE.Mesh(neckCapGeom, woodMaterial);
  neckCapMesh.position.set(0, neckTopY + 1.25, 0);
  torsoGroup.add(neckCapMesh);

  const finialGeom = new THREE.SphereGeometry(3.2, 24, 24);
  const finialMesh = new THREE.Mesh(finialGeom, woodMaterial);
  finialMesh.position.set(0, neckTopY + 4.5, 0);
  torsoGroup.add(finialMesh);

  // Add Shoulder Caps / arm stubs
  const shoulderY = yOffset + torsoHeight * 0.86;
  const shoulderOffset = (gender === 'women' ? 18 : 20.5) * shoulderScale;
  [-1, 1].forEach(side => {
    // Short nubs that stay tucked under the shoulder of any garment worn on top
    const armStubGeom = new THREE.CylinderGeometry(2.8, 3.4, 2.4, 24);
    armStubGeom.rotateZ(Math.PI / 2);
    const armStubMesh = new THREE.Mesh(armStubGeom, woodMaterial);
    armStubMesh.name = `ArmStub_${side > 0 ? 'Right' : 'Left'}`;
    armStubMesh.position.set(side * (shoulderOffset - 3.2), shoulderY, 0);
    torsoGroup.add(armStubMesh);
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
