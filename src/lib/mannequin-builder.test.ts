import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildParametricMannequin,
  DEFAULT_MANNEQUIN_MEASUREMENTS,
  ellipsePerimeter,
  getTorsoProfile,
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
});
