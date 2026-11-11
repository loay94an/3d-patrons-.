import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildCircumferenceCalibrationAnchors,
  measureMeshSectionCircumference
} from './mesh-anthropometry';

describe('mesh anthropometry', () => {
  it('measures a known cylindrical cross-section from triangle intersections', () => {
    const geometry = new THREE.CylinderGeometry(2, 2, 4, 256, 8, false);
    const actual = measureMeshSectionCircumference(geometry, 'y', 0.137);
    const expected = 2 * Math.PI * 2;
    assert.ok(Math.abs(actual - expected) < 0.02,
      `expected approximately ${expected}, got ${actual}`);
    geometry.dispose();
  });

  it('returns circumference targets and radial scale factors in landmark order', () => {
    const geometry = new THREE.CylinderGeometry(2, 2, 4, 256, 8, false);
    const anchors = buildCircumferenceCalibrationAnchors(geometry, 'y', [
      { coordinate: 0.61, circumference: 18 },
      { coordinate: -0.43, circumference: 12 },
      { coordinate: 0.13, circumference: 15 }
    ]);
    assert.deepEqual(anchors.map(anchor => anchor.coordinate), [-0.43, 0.13, 0.61]);
    for (const anchor of anchors) {
      assert.ok(Math.abs(anchor.radialScale - anchor.targetCircumference / anchor.circumference) < 1e-10);
      assert.ok(Math.abs(anchor.circumference - 4 * Math.PI) < 0.02);
    }
    geometry.dispose();
  });

  it('selects the largest closed contour when a plane also intersects separate limbs', () => {
    const torso = new THREE.CylinderGeometry(2, 2, 4, 256, 8, false);
    const limb = new THREE.CylinderGeometry(0.5, 0.5, 4, 128, 8, false);
    limb.translate(5, 0, 0);
    const merged = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    for (const geometry of [torso, limb]) {
      const position = geometry.getAttribute('position');
      const offset = vertices.length / 3;
      for (let i = 0; i < position.count; i++) {
        vertices.push(position.getX(i), position.getY(i), position.getZ(i));
      }
      const index = geometry.getIndex();
      if (index) {
        for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + offset);
      }
    }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    merged.setIndex(indices);
    const actual = measureMeshSectionCircumference(merged, 'y', 0.137);
    assert.ok(Math.abs(actual - 4 * Math.PI) < 0.02,
      `expected largest torso contour, got ${actual}`);
    torso.dispose();
    limb.dispose();
    merged.dispose();
  });

  it('rejects invalid or ambiguous calibration landmarks', () => {
    const geometry = new THREE.CylinderGeometry(2, 2, 4, 64, 8, false);
    assert.throws(() => buildCircumferenceCalibrationAnchors(geometry, 'y', [
      { coordinate: 0, circumference: 10 }
    ]), /at least two/i);
    assert.throws(() => buildCircumferenceCalibrationAnchors(geometry, 'y', [
      { coordinate: 0, circumference: 10 },
      { coordinate: 0, circumference: 12 }
    ]), /distinct/i);
    assert.throws(() => buildCircumferenceCalibrationAnchors(geometry, 'y', [
      { coordinate: 0, circumference: -1 },
      { coordinate: 1, circumference: 12 }
    ]), /positive/i);
    geometry.dispose();
  });

  it('rejects section planes that do not intersect the mesh', () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    assert.throws(() => measureMeshSectionCircumference(geometry, 'y', 3), /did not produce/i);
    geometry.dispose();
  });
});
