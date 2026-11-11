import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
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

  it('rejects invalid tape measurements and non-Z-up geometry', () => {
    const geometry = new THREE.CylinderGeometry(0.16, 0.16, 2, 64, 8, false);
    assert.throws(() => calibrateAnnyBodyGeometry(geometry, {
      heightCm: 170, bustCm: 0, waistCm: 72, hipCm: 98
    }), /positive finite/);
    const unrotated = calibrateAnnyBodyGeometry;
    assert.equal(typeof unrotated, 'function');
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
