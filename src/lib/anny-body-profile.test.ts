import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildAnnyBodyProfile, sampleAnnyBodySection } from './anny-body-profile';

describe('Anny mesh-derived body profile', () => {
  it('extracts closed horizontal sections from the actual transformed mesh', () => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 100, 64, 32, false),
      new THREE.MeshBasicMaterial()
    );
    mesh.position.set(4, 50, -7);
    mesh.updateMatrixWorld(true);

    const profile = buildAnnyBodyProfile(mesh, { sectionCount: 32, radialSamples: 96 });
    assert.ok(profile.sections.length >= 24);
    assert.ok(Math.abs(profile.height - 100) < 1e-4);
    assert.ok(profile.hipY < profile.waistY);
    assert.ok(profile.waistY < profile.bustY);
    assert.ok(profile.hipY > 25 && profile.bustY < 90);

    const section = sampleAnnyBodySection(profile, 52);
    assert.ok(Math.abs(section.centerX - 4) < 0.05);
    assert.ok(Math.abs(section.centerZ + 7) < 0.05);
    assert.ok(Math.abs(section.circumference - 2 * Math.PI * 10) < 1);
    assert.ok(section.radii.every(radius => Math.abs(radius - 10) < 0.2));

    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('interpolates measured radius profiles between extracted sections', () => {
    const geometry = new THREE.CylinderGeometry(8, 12, 100, 64, 40, false);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);
    const profile = buildAnnyBodyProfile(mesh, { sectionCount: 40, radialSamples: 64 });
    const middle = sampleAnnyBodySection(profile, (profile.sections[10].y + profile.sections[11].y) / 2);
    assert.ok(Number.isFinite(middle.circumference));
    assert.ok(middle.circumference > 0);
    assert.equal(middle.radii.length, 64);
    geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('rejects meshes that do not provide enough closed body sections', () => {
    const geometry = new THREE.PlaneGeometry(20, 20);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.rotation.x = Math.PI / 2;
    mesh.updateMatrixWorld(true);
    assert.throws(() => buildAnnyBodyProfile(mesh), /مقاطع جسم مغلقة كافية/);
    geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
});
