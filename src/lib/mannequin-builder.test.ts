import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildParametricMannequin,
  DEFAULT_MANNEQUIN_MEASUREMENTS,
  ellipsePerimeter,
  getTorsoProfile,
  measureTorsoMeshCircumference,
  limbRadiusFromCircumference,
  getTorsoSculptDisplacement,
  type MannequinMeasurements
} from './mannequin-builder';
import type { Gender } from './pattern-logic';

const genders: Gender[] = ['women', 'men', 'kids', 'infant'];

describe('3D mannequin geometry', () => {
  it('matches the configured waist and bust circumferences at their profile levels', () => {
    for (const gender of genders) {
      const base = DEFAULT_MANNEQUIN_MEASUREMENTS[gender];
      const measurements: MannequinMeasurements = {
        ...base,
        bust: base.bust + 4,
        waist: base.waist + 3,
        hip: base.hip + 5
      };
      const waistV = gender === 'kids' || gender === 'infant' ? 0.6 : 0.5;
      const bustV = gender === 'women' ? 0.75 : gender === 'men' ? 0.78 : 0.85;

      for (const [label, level, expected] of [
        ['waist', waistV, measurements.waist],
        ['bust', bustV, measurements.bust]
      ] as const) {
        const profile = getTorsoProfile(gender, measurements, level);
        const actual = ellipsePerimeter(profile.rx, profile.rz);
        assert.ok(Math.abs(actual - expected) < 0.01,
          `${gender} ${label}: expected ${expected} cm, got ${actual} cm`);
      }
    }
  });


  it('measures bust, waist, and hip from the generated local mesh rings', () => {
    for (const gender of genders) {
      const base = DEFAULT_MANNEQUIN_MEASUREMENTS[gender];
      const measurements = {
        ...base,
        bust: base.bust + 6,
        waist: base.waist + 4,
        hip: base.hip + 8
      };
      const levels = gender === 'kids' || gender === 'infant'
        ? [
            ['hip', 0.3, measurements.hip],
            ['waist', 0.6, measurements.waist],
            ['bust', 0.85, measurements.bust]
          ] as const
        : gender === 'women'
          ? [
              ['hip', 0.25, measurements.hip],
              ['waist', 0.5, measurements.waist],
              ['bust', 0.75, measurements.bust]
            ] as const
          : [
              ['hip', 0.25, measurements.hip],
              ['waist', 0.5, measurements.waist],
              ['bust', 0.78, measurements.bust]
            ] as const;

      for (const [label, level, expected] of levels) {
        const actual = measureTorsoMeshCircumference(gender, measurements, level);
        assert.ok(Math.abs(actual - expected) < 0.35,
          `${gender} ${label} mesh ring: expected ${expected} cm, got ${actual.toFixed(2)} cm`);
      }
    }
  });


  it('uses optional arm and thigh tape measurements to shape limb geometry', () => {
    const gender: Gender = 'women';
    const base = DEFAULT_MANNEQUIN_MEASUREMENTS[gender];
    const measurements: MannequinMeasurements = {
      ...base,
      armCircumference: 30,
      thighCircumference: 56
    };
    const mannequin = buildParametricMannequin(gender, measurements);
    const meshes = new Map<string, THREE.Mesh>();
    mannequin.traverse(object => {
      if (object instanceof THREE.Mesh && (object.name === 'UpperArm_1' || object.name === 'Thigh_1')) {
        meshes.set(object.name, object);
      }
    });
    assert.ok(meshes.has('UpperArm_1'));
    assert.ok(meshes.has('Thigh_1'));
    for (const [name, circumference] of [['UpperArm_1', 30], ['Thigh_1', 56]] as const) {
      const geometry = meshes.get(name)!.geometry as THREE.LatheGeometry;
      geometry.computeBoundingBox();
      const radius = (geometry.boundingBox!.max.x - geometry.boundingBox!.min.x) / 2;
      assert.ok(Math.abs(radius - circumference / (2 * Math.PI)) < 0.001,
        `${name} should retain its tape-derived proximal radius`);
      assert.ok(geometry.getAttribute('position').count > 100,
        `${name} should use a smooth tapered surface`);
    }
  });

  it('bounds optional limb radii and safely falls back when measurements are absent', () => {
    assert.equal(limbRadiusFromCircumference(undefined, 3, 2, 6), 3);
    assert.equal(limbRadiusFromCircumference(0, 3, 2, 6), 3);
    assert.equal(limbRadiusFromCircumference(1000, 3, 2, 6), 6);
    assert.equal(limbRadiusFromCircumference(1, 3, 2, 6), 2);
  });

  it('uses the entered full-body height for every body category', () => {
    for (const gender of genders) {
      const base = DEFAULT_MANNEQUIN_MEASUREMENTS[gender];
      const requestedHeight = base.height + 12;
      const mannequin = buildParametricMannequin(gender, { ...base, height: requestedHeight });
      let body: THREE.Group | undefined;
      mannequin.traverse(object => {
        if (object instanceof THREE.Group && object.name === 'MannequinBody') body = object;
      });
      assert.ok(body, `${gender} mannequin must contain a body group`);
      const bounds = new THREE.Box3().setFromObject(body!);
      const actualHeight = bounds.max.y - bounds.min.y;
      assert.ok(Math.abs(actualHeight - requestedHeight) < 1.5,
        `${gender}: expected body height ${requestedHeight} cm, got ${actualHeight.toFixed(2)} cm`);
    }
  });

  it('scales arm reach with stature without changing tape-derived torso girths', () => {
    const base = DEFAULT_MANNEQUIN_MEASUREMENTS.women;
    const standard = buildParametricMannequin('women', { ...base, height: 168 });
    const tall = buildParametricMannequin('women', { ...base, height: 188 });
    const findArm = (root: THREE.Group) => {
      let arm: THREE.Mesh | undefined;
      root.traverse(object => {
        if (object instanceof THREE.Mesh && object.name === 'UpperArm_1') arm = object;
      });
      assert.ok(arm, 'upper arm mesh should exist');
      return arm!;
    };
    assert.ok(findArm(tall).position.x > findArm(standard).position.x,
      'taller stature should proportionally increase arm reach');
    assert.ok(Math.abs(measureTorsoMeshCircumference('women', { ...base, height: 188 }, 0.5) - base.waist) < 0.35,
      'stature adjustment must not alter the waist tape circumference');
  });

  it('builds a finite, non-empty torso mesh for every supported body category', () => {
    for (const gender of genders) {
      const mannequin = buildParametricMannequin(gender, DEFAULT_MANNEQUIN_MEASUREMENTS[gender]);
      let torso: THREE.Mesh | undefined;
      mannequin.traverse(object => {
        if (object instanceof THREE.Mesh && object.name === 'TorsoSurface') torso = object;
      });

      assert.ok(torso, `${gender} mannequin must contain a torso surface`);
      const positions = torso!.geometry.getAttribute('position');
      assert.ok(positions.count > 0);
      for (let i = 0; i < positions.count; i++) {
        assert.ok(Number.isFinite(positions.getX(i)));
        assert.ok(Number.isFinite(positions.getY(i)));
        assert.ok(Number.isFinite(positions.getZ(i)));
      }

      const bounds = new THREE.Box3().setFromObject(mannequin);
      assert.ok(!bounds.isEmpty());
      assert.ok(bounds.min.y >= -0.01);
      assert.ok(bounds.max.y > bounds.min.y);
    }
  });
  it('adds smooth adult torso contours without changing tape circumference', () => {
    const women = DEFAULT_MANNEQUIN_MEASUREMENTS.women;
    const mannequin = buildParametricMannequin('women', women);
    let torso: THREE.Mesh | undefined;
    mannequin.traverse(object => {
      if (object instanceof THREE.Mesh && object.name === 'TorsoSurface') torso = object;
    });
    assert.ok(torso);
    const positions = torso!.geometry.getAttribute('position');
    const radialSegments = 64;
    const verticalSegments = 100;
    const row = Math.round(0.705 * verticalSegments);
    const stride = radialSegments + 1;
    const frontIndex = row * stride + Math.round(radialSegments / 4);
    const profile = getTorsoProfile('women', women, row / verticalSegments);
    const frontPointZ = positions.getZ(frontIndex);
    assert.ok(frontPointZ > profile.rz + profile.zCenter + 0.2,
      'female bust surface should project smoothly beyond the base ellipse');

    for (const [level, expected] of [
      [0.25, women.hip],
      [0.5, women.waist],
      [0.75, women.bust]
    ] as const) {
      const measured = measureTorsoMeshCircumference('women', women, level);
      assert.ok(Math.abs(measured - expected) < 0.35,
        `sculpted ring at ${level} should preserve ${expected} cm, got ${measured}`);
    }
  });

  it('keeps child and infant torso sculpting neutral', () => {
    for (const gender of ['kids', 'infant'] as const) {
      assert.equal(getTorsoSculptDisplacement(gender, 0.7, 4, 12, true), 0);
      assert.equal(getTorsoSculptDisplacement(gender, 0.2, 4, 12, false), 0);
    }
  });

});
