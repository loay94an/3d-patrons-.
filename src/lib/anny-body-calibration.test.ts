import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { calibrateAnnyBodyGeometry } from './anny-body-calibration';
import { measureMeshSectionCircumference } from './mesh-anthropometry';

describe('Anny body geometry calibration', () => {
  it('normalizes stature and applies bounded waist/bust/hip radial adjustments', () => {
    const source = new THREE.CylinderGeometry(0.16, 0.16, 2, 256, 120, false);
    source.rotateX(Math.PI / 2);
    const result = calibrateAnnyBodyGeometry(source, {
      heightCm: 170, bustCm: 92, waistCm: 72, hipCm: 98
    });
    assert.ok(Math.abs(result.heightScale * result.nativeHeight - 170) < 1e-8);
    assert.equal(result.landmarks.length, 3);
    assert.ok(result.landmarks.every(item => item.radialScaleApplied >= 0.75 && item.radialScaleApplied <= 1.25));
    assert.ok(result.geometry !== source);
    const waist = result.landmarks.find(item => item.zone === 'waist')!;
    const actual = measureMeshSectionCircumference(result.geometry, 'z',
      result.geometry.boundingBox!.min.z + waist.heightFraction * result.nativeHeight);
    assert.ok(Number.isFinite(actual) && actual > 0);
    result.geometry.dispose();
    source.dispose();
  });


  it('keeps the shoulder and arm geometry outside the torso contour unchanged', () => {
    const torso = new THREE.LatheGeometry([
      new THREE.Vector2(0.14, -1),
      new THREE.Vector2(0.18, -0.2),
      new THREE.Vector2(0.13, 0.2),
      new THREE.Vector2(0.19, 0.56),
      new THREE.Vector2(0.14, 1)
    ], 128, 0, Math.PI * 2);
    torso.rotateX(Math.PI / 2);
    const armParts = [-1, 1].map(side => {
      const arm = new THREE.CylinderGeometry(0.04, 0.04, 0.36, 32, 24, false);
      arm.rotateZ(Math.PI / 2);
      arm.translate(side * 0.42, 0, 0.56);
      return arm;
    });
    const source = mergeGeometries([torso, ...armParts], false)!;
    const original = source.getAttribute('position');
    const outsideArmVertices: Array<[number, number, number]> = [];
    for (let i = 0; i < original.count; i++) {
      const x = original.getX(i);
      const y = original.getY(i);
      if (Math.hypot(x, y) > 0.24) {
        outsideArmVertices.push([x, y, original.getZ(i)]);
      }
    }
    const result = calibrateAnnyBodyGeometry(source, {
      heightCm: 170, bustCm: 110, waistCm: 72, hipCm: 100
    });
    const updated = result.geometry.getAttribute('position');
    for (let i = 0; i < original.count; i++) {
      const x = original.getX(i);
      const y = original.getY(i);
      if (Math.hypot(x, y) > 0.24) {
        assert.ok(Math.hypot(updated.getX(i) - x, updated.getY(i) - y) < 1e-8,
          'upper-arm vertices must not inherit torso circumference scaling');
      }
    }
    assert.ok(outsideArmVertices.length > 0);
    result.geometry.dispose();
    source.dispose();
    torso.dispose();
    armParts.forEach(geometry => geometry.dispose());
  });

  it('rejects invalid tape measurements and non-Z-up geometry', () => {
    const geometry = new THREE.CylinderGeometry(0.16, 0.16, 2, 64, 8, false);
    assert.throws(() => calibrateAnnyBodyGeometry(geometry, {
      heightCm: 170, bustCm: 0, waistCm: 72, hipCm: 98
    }), /positive finite/);
    assert.throws(() => calibrateAnnyBodyGeometry(geometry, {
      heightCm: 170, bustCm: 92, waistCm: 72, hipCm: 98
    }), /Z-up vertical axis/);
    geometry.dispose();
  });

  it('does not mutate the source geometry', () => {
    const source = new THREE.CylinderGeometry(0.16, 0.16, 2, 128, 40, false);
    source.rotateX(Math.PI / 2);
    const before = source.getAttribute('position').getX(0);
    const result = calibrateAnnyBodyGeometry(source, {
      heightCm: 168, bustCm: 90, waistCm: 70, hipCm: 94
    });
    assert.equal(source.getAttribute('position').getX(0), before);
    result.geometry.dispose();
    source.dispose();
  });
});
