import * as THREE from 'three';
import { GarmentType, Gender } from './pattern-logic';
import { FabricCustomState, FABRIC_PRESETS } from './fabric-engine';

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

/**
 * Procedurally generates a 3D garment composed of tailored panels conforming to
 * the parametric body measurements and 2D pattern geometry.
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
    fabricState,
    showHeatmap = false
  } = options;

  const preset = FABRIC_PRESETS.find(f => f.id === fabricState.presetId) || FABRIC_PRESETS[1];
  const stiffness = fabricState.stiffness;

  // Mannequin reference level offsets
  const yOffset = (gender === 'kids' || gender === 'infant') ? 25 : 45;
  const torsoHeight = (gender === 'kids' || gender === 'infant') ? 45 * (backLength / 29) : 68 * (backLength / 40);

  // Clothing Ease (in cm)
  const easeBust = 2.0;
  const easeWaist = 1.8;
  const easeHip = 2.5;

  // Radii with clothing ease
  const rxBust = (bust / (2 * Math.PI)) + easeBust;
  const rzBust = rxBust * 0.85;
  const rxWaist = (waist / (2 * Math.PI)) + easeWaist;
  const rzWaist = rxWaist * 0.8;
  const rxHip = (hip / (2 * Math.PI)) + easeHip;
  const rzHip = rxHip * 0.82;
  const shWidth = shoulder * 1.5;

  // Determine vertical garment span
  let yStart = yOffset + torsoHeight * 0.92; // neck/shoulder line
  let yEnd = yOffset + torsoHeight * 0.35;   // default crop for bodice/shirt

  const isDress = garmentType === 'dress' || garmentType === 'abaya';
  const isSkirt = garmentType === 'skirt';
  const isPants = garmentType === 'pants' || garmentType === 'shorts';

  if (isDress) {
    yEnd = yOffset - 25; // below knee or ankle
  } else if (isSkirt) {
    yStart = yOffset + torsoHeight * 0.48; // starts at waist
    yEnd = yOffset - 20; // skirt hem
  } else if (isPants) {
    yStart = yOffset + torsoHeight * 0.48; // waist
    yEnd = yOffset - 35; // ankle
  }

  // Construct Garment Geometry
  const verticalSteps = 40;
  const radialSteps = 48;
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const seamPoints: THREE.Vector3[][] = [];
  const leftSideSeam: THREE.Vector3[] = [];
  const rightSideSeam: THREE.Vector3[] = [];
  const centerFrontSeam: THREE.Vector3[] = [];
  const hemLine: THREE.Vector3[] = [];

  for (let i = 0; i <= verticalSteps; i++) {
    const v = i / verticalSteps; // 0 = top, 1 = bottom
    const y = THREE.MathUtils.lerp(yStart, yEnd, v);

    // Interpolate width and depth
    let rx = rxBust;
    let rz = rzBust;
    let zCenter = 0;

    if (isSkirt) {
      // Flared or A-line skirt from waist to hem
      const t = v;
      rx = THREE.MathUtils.lerp(rxWaist, rxHip * 1.35, Math.pow(t, 0.85));
      rz = THREE.MathUtils.lerp(rzWaist, rzHip * 1.25, Math.pow(t, 0.85));
    } else if (isDress) {
      if (v < 0.4) {
        // Upper bodice (shoulder to waist)
        const t = v / 0.4;
        rx = THREE.MathUtils.lerp(shWidth, rxWaist, t);
        rz = THREE.MathUtils.lerp(rzBust, rzWaist, t);
        zCenter = (1 - t) * 0.8;
      } else {
        // Skirt portion
        const t = (v - 0.4) / 0.6;
        rx = THREE.MathUtils.lerp(rxWaist, rxHip * 1.45, Math.pow(t, 0.9));
        rz = THREE.MathUtils.lerp(rzWaist, rzHip * 1.35, Math.pow(t, 0.9));
      }
    } else {
      // Bodice / Shirt / Jacket
      const t = v;
      rx = THREE.MathUtils.lerp(shWidth, rxWaist * 1.05, t);
      rz = THREE.MathUtils.lerp(rzBust, rzWaist * 1.05, t);
      zCenter = (1 - t) * 0.6;
    }

    // Fabric Draping Waves & Folds based on stiffness
    const waveCount = stiffness > 0.6 ? 5 : 9;
    const waveAmplitude = (1 - stiffness * 0.7) * (v * 1.8);

    for (let j = 0; j <= radialSteps; j++) {
      const u = j / radialSteps;
      const angle = u * Math.PI * 2;

      // Realistic cloth folds
      const foldNoise = Math.sin(angle * waveCount) * waveAmplitude * Math.sin(v * Math.PI);

      let curRx = rx + foldNoise;
      let curRz = rz + foldNoise;

      // Front bust darts shaping for women
      if (gender === 'women' && !isSkirt && v < 0.4 && Math.sin(angle) > 0) {
        const bustPeak = Math.sin((v / 0.4) * Math.PI) * 2.2;
        curRz += bustPeak;
      }

      const vx = curRx * Math.cos(angle);
      const vz = curRz * Math.sin(angle) + zCenter;
      const vy = y;

      positions.push(vx, vy, vz);
      uvs.push(u, v);

      // Fit Tension Heatmap (Stress analysis)
      if (showHeatmap) {
        // Red = Tight (ease < 1.2cm), Green = Perfect (ease 1.5-3cm), Yellow = Relaxed/Loose
        const localEase = easeWaist;
        if (localEase < 1.2) {
          colors.push(0.95, 0.2, 0.2); // Red tight
        } else if (localEase > 3.0) {
          colors.push(0.95, 0.8, 0.1); // Yellow loose
        } else {
          colors.push(0.2, 0.85, 0.35); // Green ideal fit
        }
      } else {
        colors.push(1, 1, 1);
      }

      // Collect seam points
      const pt = new THREE.Vector3(vx, vy, vz);
      if (j === 0) leftSideSeam.push(pt);
      if (j === Math.floor(radialSteps / 2)) rightSideSeam.push(pt);
      if (j === Math.floor(radialSteps / 4)) centerFrontSeam.push(pt);
      if (i === verticalSteps) hemLine.push(pt);
    }
  }

  // Generate triangles
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
  garmentMesh.castShadow = true;
  garmentMesh.receiveShadow = true;
  group.add(garmentMesh);

  // Construct Sleeves if garment has sleeves and is not skirt/pants
  if (!isSkirt && !isPants && garmentType !== 'vest' && garmentType !== 'cape') {
    const armY = yOffset + torsoHeight * 0.82;
    const armDist = (shWidth * 0.95);
    const slLen = sleeveLength * 0.6; // scaled to 3D scene units

    [-1, 1].forEach((side, sIdx) => {
      const sleeveMesh = build3DSleeve(
        side,
        armDist,
        armY,
        slLen,
        rxBust * 0.35,
        stiffness,
        finalMaterial
      );
      group.add(sleeveMesh);
    });
  }

  // Construct Seamlines (golden stitching lines)
  const stitchMat = new THREE.LineBasicMaterial({
    color: 0xf59e0b, // Amber gold stitch
    linewidth: 2,
    transparent: true,
    opacity: 0.85
  });

  [leftSideSeam, rightSideSeam, centerFrontSeam, hemLine].forEach(pts => {
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
        if (child instanceof THREE.Mesh && child !== garmentMesh && child.name.includes('Sleeve')) {
          child.material = newMat;
        }
      });
    },
    exportObj: () => exportGroupToObj(group)
  };
}

/**
 * Builds a draped 3D sleeve mesh conforming to arm anatomy and fabric drape.
 */
function build3DSleeve(
  side: number,
  armDist: number,
  startY: number,
  length: number,
  armRadius: number,
  stiffness: number,
  material: THREE.Material
): THREE.Mesh {
  const vSteps = 20;
  const rSteps = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const armAngle = (side * 18 * Math.PI) / 180; // slightly ajar from torso

  for (let i = 0; i <= vSteps; i++) {
    const v = i / vSteps;
    const curLen = v * length;

    // Wrist tapers slightly
    const rad = THREE.MathUtils.lerp(armRadius * 1.15, armRadius * 0.75, v);

    // Arm bone position
    const cx = side * (armDist + Math.sin(armAngle) * curLen);
    const cy = startY - Math.cos(armAngle) * curLen;
    const cz = 0;

    for (let j = 0; j <= rSteps; j++) {
      const u = j / rSteps;
      const angle = u * Math.PI * 2;

      const vx = cx + Math.cos(angle) * rad;
      const vz = cz + Math.sin(angle) * rad;
      const vy = cy;

      positions.push(vx, vy, vz);
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
