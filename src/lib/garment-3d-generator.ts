import * as THREE from 'three';
import { GarmentType, Gender } from './pattern-logic';
import { FabricCustomState, FABRIC_PRESETS } from './fabric-engine';
import {
  ellipsePerimeter,
  getTorsoProfile,
  getTorsoSpan,
  MannequinMeasurements
} from './mannequin-builder';

export interface Garment3DOptions {
  garmentType: GarmentType | 'bodice';
  gender: Gender;
  bust: number;
  waist: number;
  hip: number;
  shoulder: number;
  backLength: number;
  sleeveLength: number;
  totalLength: number;
  fabricState: FabricCustomState;
  showSeamLines?: boolean;
  showHeatmap?: boolean;
}

export interface Garment3DResult {
  group: THREE.Group;
  garmentMesh: THREE.Mesh;
  seamLinesGroup: THREE.Group;
  updateMaterial: (newMat: THREE.Material) => void;
  exportObj: () => string;
}

/** Wearing ease (in cm, added to the circumference) at each body level. */
const EASE_HIP = 2.5;
const EASE_WAIST = 1.8;
const EASE_BUST = 2.0;
const EASE_SHOULDER = 2.4;

/** Extra air between the body surface and the cloth, so nothing pokes through. */
const SURFACE_CLEARANCE = 0.35;

/** Hard minimum distance kept between the body surface and the fabric. */
const MIN_CLOTH_GAP = 0.6;

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

/** Circumference ease required at a given body level (0 = hip, 1 = neck). */
function easeAt(bodyV: number): number {
  if (bodyV >= 0.75) return EASE_SHOULDER;
  if (bodyV >= 0.60) return lerp(EASE_BUST, EASE_SHOULDER, (bodyV - 0.60) / 0.15);
  if (bodyV >= 0.45) return lerp(EASE_WAIST, EASE_BUST, (bodyV - 0.45) / 0.15);
  if (bodyV >= 0.28) return lerp(EASE_HIP, EASE_WAIST, (bodyV - 0.28) / 0.17);
  return EASE_HIP;
}

/**
 * Procedurally generates a 3D garment that is draped *over* the parametric body
 * instead of being an independent tube: every ring is sampled from the very same
 * body profile the mannequin is built from, then inflated by the wearing ease.
 */
export function generate3DGarmentMesh(options: Garment3DOptions, fabricMaterial: THREE.Material): Garment3DResult {
  const group = new THREE.Group();
  group.name = 'Garment3D';

  const seamLinesGroup = new THREE.Group();
  seamLinesGroup.name = 'SeamLines';

  const {
    garmentType,
    gender,
    bust,
    waist,
    hip,
    shoulder,
    backLength,
    sleeveLength,
    totalLength,
    fabricState,
    showHeatmap = false
  } = options;

  const preset = FABRIC_PRESETS.find(f => f.id === fabricState.presetId) || FABRIC_PRESETS[1];
  const stiffness = fabricState.stiffness;

  const bodyMeasurements: MannequinMeasurements = {
    bust,
    waist,
    hip,
    shoulder,
    backLength,
    height: gender === 'men' ? 178 : gender === 'kids' ? 120 : gender === 'infant' ? 70 : 168
  };

  const { yOffset, torsoHeight } = getTorsoSpan(gender, bodyMeasurements);

  /**
   * Radial envelope of the body cross section at a given level.
   *
   * Returns the support function of the slice outline, which is the exact
   * distance from the body axis to its surface in any direction. Building the
   * cloth from this envelope (instead of a plain ellipse) is what guarantees
   * the garment always encloses the body, bust shaping included.
   */
  const BODY_SAMPLES = 96;
  const bodyEnvelope = (bodyV: number) => {
    const level = clamp(bodyV, 0, 1);
    const pts: number[] = []; // pairs of (x, z) relative to the slice centre
    let zCenter = 0;
    let y = yOffset;

    for (let k = 0; k < BODY_SAMPLES; k++) {
      const theta = (k / BODY_SAMPLES) * Math.PI * 2;
      const p = getTorsoProfile(gender, bodyMeasurements, level, theta);
      zCenter = p.zCenter;
      y = p.y;
      pts.push(p.rx * Math.cos(theta), p.rz * Math.sin(theta));
    }

    let perim = 0;
    for (let k = 0; k < BODY_SAMPLES; k++) {
      const a = k * 2;
      const b = ((k + 1) % BODY_SAMPLES) * 2;
      perim += Math.hypot(pts[b] - pts[a], pts[b + 1] - pts[a + 1]);
    }

    return { pts, perim: perim || 1, zCenter, y };
  };

  /** Body radius in a given direction, from the slice envelope. */
  const envelopeRadius = (env: { pts: number[] }, angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let r = 0;
    for (let k = 0; k < BODY_SAMPLES; k++) {
      const d = env.pts[k * 2] * cos + env.pts[k * 2 + 1] * sin;
      if (d > r) r = d;
    }
    return r;
  };

  const hasLegs = ['pants', 'shorts', 'culottes', 'jumpsuit', 'romper', 'pajamas'].includes(garmentType as string);
  const isOnePieceWithLegs = ['jumpsuit', 'romper', 'pajamas'].includes(garmentType as string);
  const isDress = garmentType === 'dress' || garmentType === 'abaya';
  const isSkirt = garmentType === 'skirt';
  const isCape = garmentType === 'cape';
  const sleeveless = garmentType === 'vest' || isCape || isSkirt || hasLegs && !isOnePieceWithLegs;

  // Vertical span expressed in world Y, so a hem that falls below the hips
  // still hangs down instead of collapsing onto the bottom of the dress form.
  const NECK_V = 0.93;
  const WAIST_V = 0.45;
  const CROTCH_V = 0.08;

  const waistY = yOffset + torsoHeight * WAIST_V;
  const crotchY = yOffset + torsoHeight * CROTCH_V;

  let topY = yOffset + torsoHeight * NECK_V;
  let hemY = yOffset + torsoHeight * 0.05; // shirts / blouses finish just under the hip
  let flare = 0;                           // extra circumference added below the waist

  if (isDress) {
    // Skirt part of a dress hangs from the waist down to the drafted length
    hemY = garmentType === 'abaya'
      ? Math.max(5, waistY - totalLength * 1.5)
      : Math.max(8, waistY - totalLength);
    flare = garmentType === 'abaya' ? 46 : 34;
  } else if (isSkirt) {
    topY = waistY;
    hemY = Math.max(14, waistY - totalLength * 0.8);
    flare = 30;
  } else if (isCape) {
    hemY = Math.max(10, waistY - 40);
    flare = 55;
  } else if (hasLegs) {
    topY = isOnePieceWithLegs ? topY : waistY;
    hemY = crotchY;                        // the trousers continue as two legs
  }

  // ---------------------------------------------------------------- body tube
  const verticalSteps = 44;
  const radialSteps = 48;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const leftSideSeam: THREE.Vector3[] = [];
  const rightSideSeam: THREE.Vector3[] = [];
  const centerFrontSeam: THREE.Vector3[] = [];
  const centerBackSeam: THREE.Vector3[] = [];
  const hemLine: THREE.Vector3[] = [];

  const waveCount = stiffness > 0.6 ? 5 : 9;
  const foldStrength = (1 - stiffness * 0.7) * 0.55;

  for (let i = 0; i <= verticalSteps; i++) {
    const v = i / verticalSteps; // 0 = top, 1 = bottom
    const y = lerp(topY, hemY, v);
    const bodyV = (y - yOffset) / torsoHeight;
    const flareT = clamp((waistY - y) / Math.max(waistY - hemY, 0.001), 0, 1);
    const localFlare = flare * Math.pow(flareT, 1.25);

    const env = bodyEnvelope(bodyV);
    const scale = (env.perim + easeAt(bodyV) + localFlare) / env.perim;

    for (let j = 0; j <= radialSteps; j++) {
      const u = j / radialSteps;
      const angle = u * Math.PI * 2;

      // Fabric drape: small radial folds that grow towards the hem
      const fold = Math.sin(angle * waveCount) * foldStrength * Math.sin(v * Math.PI) * (0.35 + flareT * 1.6);

      // The cloth is placed outside the body envelope in this exact direction,
      // so it can never sink into the body even where the chest is shaped.
      const bodyR = envelopeRadius(env, angle) * scale;
      const radius = bodyR + SURFACE_CLEARANCE + Math.max(fold, -SURFACE_CLEARANCE * 0.5);

      const x = radius * Math.cos(angle);
      const z = env.zCenter + radius * Math.sin(angle);

      positions.push(x, y, z);
      uvs.push(u, v);

      // Fit analysis: compare the garment circumference with the body one.
      if (showHeatmap) {
        const localEase = env.perim * scale - env.perim;
        if (localEase < 1.2) {
          colors.push(0.95, 0.2, 0.2);   // tight
        } else if (localEase > 12) {
          colors.push(0.95, 0.8, 0.1);   // loose / flared
        } else {
          colors.push(0.2, 0.85, 0.35);  // ideal fit
        }
      } else {
        colors.push(1, 1, 1);
      }

      const pt = new THREE.Vector3(x, y, z);
      if (j === 0) leftSideSeam.push(pt);
      if (j === Math.floor(radialSteps / 2)) rightSideSeam.push(pt);
      if (j === Math.floor(radialSteps / 4)) centerFrontSeam.push(pt);
      if (j === Math.floor((radialSteps * 3) / 4)) centerBackSeam.push(pt);
      if (i === verticalSteps) hemLine.push(pt);
    }
  }

  for (let i = 0; i < verticalSteps; i++) {
    for (let j = 0; j < radialSteps; j++) {
      const a = i * (radialSteps + 1) + j;
      const b = (i + 1) * (radialSteps + 1) + j;
      const c = (i + 1) * (radialSteps + 1) + (j + 1);
      const d = i * (radialSteps + 1) + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const garmentGeom = new THREE.BufferGeometry();
  garmentGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  garmentGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  garmentGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  garmentGeom.setIndex(indices);
  garmentGeom.computeVertexNormals();

  const finalMaterial = showHeatmap
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide })
    : fabricMaterial;

  const garmentMesh = new THREE.Mesh(garmentGeom, finalMaterial);
  garmentMesh.name = 'GarmentBody';
  garmentMesh.castShadow = true;
  garmentMesh.receiveShadow = true;
  group.add(garmentMesh);

  // ------------------------------------------------------------------- sleeves
  if (!sleeveless) {
    const armholeV = 0.845;
    const shoulderSlice = getTorsoProfile(gender, bodyMeasurements, armholeV, 0);
    const armholeX = shoulderSlice.rx * 0.82;          // armhole sits inside the shoulder tip
    const armholeY = shoulderSlice.y - 1.2;
    const armCirc = Math.max(18, bust * 0.34);         // upper arm circumference
    const armRadius = armCirc / (2 * Math.PI) + 1.6;
    const tilt = (14 * Math.PI) / 180;                 // arms hang slightly away from the body
    const length = Math.max(6, sleeveLength || 58);

    [-1, 1].forEach(side => {
      const sleeve = build3DSleeve({
        side,
        startX: side * armholeX,
        startY: armholeY,
        length,
        radius: armRadius,
        tilt,
        stiffness,
        material: finalMaterial
      });
      group.add(sleeve);
    });
  }

  // -------------------------------------------------------------------- trousers
  if (hasLegs) {
    const crotchEnv = bodyEnvelope(CROTCH_V);
    const hipOuterX = envelopeRadius(crotchEnv, 0) * ((crotchEnv.perim + easeAt(CROTCH_V) + 1.2) / crotchEnv.perim);
    const thighRadius = Math.max(3, hipOuterX * 0.46);
    const ankleRadius = thighRadius * (garmentType === 'culottes' ? 0.85 : 0.6);
    const isShort = garmentType === 'shorts';
    const isWide = garmentType === 'culottes';
    const legEndY = isShort ? crotchY * 0.45 : isWide ? crotchY * 0.6 : 6;

    [-1, 1].forEach(side => {
      const leg = build3DPantsLeg({
        side,
        topY: crotchY + 5, // start inside the hip section so no gap shows
        endY: legEndY,
        centerX: thighRadius * 0.9, // magnitude, the side is applied inside
        topRadius: thighRadius,
        endRadius: ankleRadius,
        flare: isWide ? thighRadius * 1.3 : 0,
        material: finalMaterial
      });
      group.add(leg);
    });
  }

  // --------------------------------------------------------------- seam lines
  const stitchMat = new THREE.LineBasicMaterial({
    color: 0xf59e0b, // Amber gold stitch
    linewidth: 2,
    transparent: true,
    opacity: 0.85
  });

  [leftSideSeam, rightSideSeam, centerFrontSeam, centerBackSeam, hemLine].forEach(pts => {
    if (pts.length > 1) {
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(g, stitchMat);
      seamLinesGroup.add(line);
    }
  });

  group.add(seamLinesGroup);

  return {
    group,
    garmentMesh,
    seamLinesGroup,
    updateMaterial: (newMat: THREE.Material) => {
      garmentMesh.material = newMat;
      group.traverse(child => {
        if (child instanceof THREE.Mesh && child !== garmentMesh) {
          child.material = newMat;
        }
      });
    },
    exportObj: () => exportGroupToObj(group)
  };
}

interface SleeveOptions {
  side: number;
  startX: number;
  startY: number;
  length: number;
  radius: number;
  tilt: number;
  stiffness: number;
  material: THREE.Material;
}

/**
 * Draped sleeve: starts at the armhole (slightly inside the torso so the
 * shoulder reads as attached), tapers towards the wrist and is closed with a
 * rounded sleeve head.
 */
function build3DSleeve(opts: SleeveOptions): THREE.Mesh {
  const { side, startX, startY, length, radius, tilt, stiffness, material } = opts;

  const vSteps = 22;
  const rSteps = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const dirX = side * Math.sin(tilt);
  const dirY = -Math.cos(tilt);
  const foldStrength = (1 - stiffness * 0.7) * 0.6;

  for (let i = 0; i <= vSteps; i++) {
    const v = i / vSteps;
    const cx = startX + dirX * v * length;
    const cy = startY + dirY * v * length;

    // Fuller sleeve head, slight narrowing at the elbow, taper at the wrist
    let rad: number;
    if (v < 0.18) {
      rad = lerp(radius * 1.22, radius * 1.02, v / 0.18);
    } else {
      rad = lerp(radius * 1.04, radius * 0.82, (v - 0.18) / 0.82);
    }

    for (let j = 0; j <= rSteps; j++) {
      const u = j / rSteps;
      const angle = u * Math.PI * 2;
      const fold = Math.sin(angle * 6) * foldStrength * Math.sin(v * Math.PI);

      positions.push(
        cx + (rad + fold) * Math.cos(angle),
        cy,
        (rad + fold) * Math.sin(angle)
      );
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < vSteps; i++) {
    for (let j = 0; j < rSteps; j++) {
      const a = i * (rSteps + 1) + j;
      const b = (i + 1) * (rSteps + 1) + j;
      const c = (i + 1) * (rSteps + 1) + (j + 1);
      const d = i * (rSteps + 1) + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, material);
  mesh.name = `Sleeve_${side > 0 ? 'Right' : 'Left'}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Rounded sleeve head so the shoulder is closed and looks sewn on
  const headGeom = new THREE.SphereGeometry(radius * 1.15, 20, 16);
  const head = new THREE.Mesh(headGeom, material);
  head.scale.set(1.05, 0.92, 1.05);
  head.position.set(startX + dirX * radius * 0.5, startY + dirY * radius * 0.5, 0);
  head.castShadow = true;
  mesh.add(head);

  return mesh;
}

interface PantsLegOptions {
  side: number;
  topY: number;
  endY: number;
  centerX: number;
  topRadius: number;
  endRadius: number;
  flare: number;
  material: THREE.Material;
}

/** Tapered trouser leg hanging from the crotch down to the hem. */
function build3DPantsLeg(opts: PantsLegOptions): THREE.Mesh {
  const { side, topY, endY, centerX, topRadius, endRadius, flare, material } = opts;

  const vSteps = 18;
  const rSteps = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= vSteps; i++) {
    const v = i / vSteps;
    const cy = lerp(topY, endY, v);
    const rad = flare > 0
      ? lerp(topRadius, topRadius + flare, Math.pow(v, 1.15))
      : lerp(topRadius, endRadius, Math.pow(v, 0.92));
    const cx = side * (centerX + v * 2.5); // legs drift slightly outwards

    for (let j = 0; j <= rSteps; j++) {
      const u = j / rSteps;
      const angle = u * Math.PI * 2;

      positions.push(
        cx + rad * Math.cos(angle),
        cy,
        rad * Math.sin(angle) * 0.95
      );
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < vSteps; i++) {
    for (let j = 0; j < rSteps; j++) {
      const a = i * (rSteps + 1) + j;
      const b = (i + 1) * (rSteps + 1) + j;
      const c = (i + 1) * (rSteps + 1) + (j + 1);
      const d = i * (rSteps + 1) + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, material);
  mesh.name = `PantsLeg_${side > 0 ? 'Right' : 'Left'}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Exports a Three.js Group to standard Wavefront OBJ format.
 */
function exportGroupToObj(group: THREE.Group): string {
  let output = '# 3D Fashion CAD Studio OBJ Export\n# Pattern & Mannequin Mesh\n';
  let vertexOffset = 1;

  group.traverse(child => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geom = child.geometry as THREE.BufferGeometry;
      const pos = geom.getAttribute('position');
      const uv = geom.getAttribute('uv');
      const idx = geom.getIndex();

      if (!pos) return;

      output += `o ${child.name || 'GarmentMesh'}\n`;

      // World matrix transform
      child.updateMatrixWorld(true);
      const m = child.matrixWorld;

      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        v.applyMatrix4(m);
        output += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
      }

      if (uv) {
        for (let i = 0; i < uv.count; i++) {
          output += `vt ${uv.getX(i).toFixed(4)} ${uv.getY(i).toFixed(4)}\n`;
        }
      }

      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          const a = idx.getX(i) + vertexOffset;
          const b = idx.getX(i + 1) + vertexOffset;
          const c = idx.getX(i + 2) + vertexOffset;
          output += `f ${a}/${a} ${b}/${b} ${c}/${c}\n`;
        }
      }

      vertexOffset += pos.count;
    }
  });

  return output;
}
