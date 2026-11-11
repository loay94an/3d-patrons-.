import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildAnnyBodyProfile, sampleAnnyBodySection } from './anny-body-profile';
import { generate3DGarmentMesh } from './garment-3d-generator';
import { DEFAULT_FABRIC_STATE } from './fabric-engine';

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
    const profile = buildAnnyBodyProfile(mesh, {
      sectionCount: 40,
      radialSamples: 64,
      landmarks: [
        { zone: 'hip', heightFraction: 0.35 },
        { zone: 'waist', heightFraction: 0.55 },
        { zone: 'bust', heightFraction: 0.75 }
      ]
    });
    const middle = sampleAnnyBodySection(profile, (profile.sections[10].y + profile.sections[11].y) / 2);
    assert.ok(Number.isFinite(middle.circumference));
    assert.ok(middle.circumference > 0);
    assert.equal(middle.radii.length, 64);
    geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('builds the garment torso around the Anny mesh centre instead of the legacy mannequin axis', () => {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 100, 64, 32, false),
      new THREE.MeshBasicMaterial()
    );
    body.position.set(4, 50, -7);
    body.updateMatrixWorld(true);
    const profile = buildAnnyBodyProfile(body, { sectionCount: 32, radialSamples: 96 });
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const garment = generate3DGarmentMesh({
      garmentType: 'vest',
      gender: 'women',
      bust: 80,
      waist: 70,
      hip: 90,
      shoulder: 12,
      backLength: 40,
      height: 100,
      sleeveLength: 0,
      totalLength: 50,
      fabricState: DEFAULT_FABRIC_STATE,
      annyBodyProfile: profile
    }, material);

    garment.garmentMesh.geometry.computeBoundingBox();
    const center = garment.garmentMesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(center.x - 4) < 0.1, `expected Anny centre x=4, received ${center.x}`);
    assert.ok(Math.abs(center.z + 7) < 0.1, `expected Anny centre z=-7, received ${center.z}`);

    garment.group.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();
    });
    material.dispose();
    body.geometry.dispose();
    (body.material as THREE.Material).dispose();
  });

  it('rejects meshes that do not provide enough closed body sections', () => {
    const geometry = new THREE.PlaneGeometry(20, 20);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);
    assert.throws(() => buildAnnyBodyProfile(mesh), /مقاطع جسم مغلقة كافية/);
    geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
});
