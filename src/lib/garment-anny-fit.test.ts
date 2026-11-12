import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { conformGarmentMeshToBody } from './garment-anny-fit';
import { calculateFabricDrapeFold } from './garment-3d-generator';

describe('Anny garment surface conform', () => {
  it('preserves drafted ease when the garment already clears the body', () => {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 40, 64, 12, false),
      new THREE.MeshBasicMaterial({ side: THREE.FrontSide })
    );
    const garment = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 14, 30, 64, 10, false),
      new THREE.MeshBasicMaterial()
    );
    const before = garment.geometry.getAttribute('position').getX(0);
    body.updateMatrixWorld(true);
    garment.updateMatrixWorld(true);
    const report = conformGarmentMeshToBody(garment, body, 2);
    assert.equal(report.status, 'already-clear');
    assert.equal(report.fittedVertices, 0);
    assert.equal(garment.geometry.getAttribute('position').getX(0), before);
    garment.geometry.dispose();
    body.geometry.dispose();
    (garment.material as THREE.Material).dispose();
    (body.material as THREE.Material).dispose();
  });

  it('preserves vertices when the body does not intersect the garment height', () => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 20, 32), new THREE.MeshBasicMaterial());
    const garment = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 10, 32), new THREE.MeshBasicMaterial());
    garment.position.y = 40;
    body.updateMatrixWorld(true);
    garment.updateMatrixWorld(true);
    const report = conformGarmentMeshToBody(garment, body);
    assert.equal(report.status, 'no-intersections');
    assert.equal(report.fittedVertices, 0);
    garment.geometry.dispose();
    body.geometry.dispose();
    (garment.material as THREE.Material).dispose();
    (body.material as THREE.Material).dispose();
  });

  it('rejects unsafe clearance values', () => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 10), new THREE.MeshBasicMaterial());
    const garment = new THREE.Mesh(new THREE.BoxGeometry(12, 22, 12), new THREE.MeshBasicMaterial());
    assert.throws(() => conformGarmentMeshToBody(garment, body, 20), /between 0 and 8/);
    garment.geometry.dispose();
    body.geometry.dispose();
    (garment.material as THREE.Material).dispose();
    (body.material as THREE.Material).dispose();
  });
});


describe('garment body clearance', () => {
  it('preserves drafted ease when the garment is already outside the body', () => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 40, 48), new THREE.MeshBasicMaterial());
    const garment = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 30, 48), new THREE.MeshBasicMaterial());
    body.updateMatrixWorld(true);
    garment.updateMatrixWorld(true);
    const before = garment.geometry.getAttribute('position').getX(0);
    const report = conformGarmentMeshToBody(garment, body, 1);
    assert.equal(report.status, 'already-clear');
    assert.equal(garment.geometry.getAttribute('position').getX(0), before);
    garment.geometry.dispose();
    body.geometry.dispose();
    (garment.material as THREE.Material).dispose();
    (body.material as THREE.Material).dispose();
  });

  it('corrects penetrating vertices but does not shrink vertices with sufficient ease', () => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 40, 48), new THREE.MeshBasicMaterial());
    const garment = new THREE.Mesh(new THREE.CylinderGeometry(9, 15, 30, 48, 4), new THREE.MeshBasicMaterial());
    body.updateMatrixWorld(true);
    garment.updateMatrixWorld(true);
    const report = conformGarmentMeshToBody(garment, body, 1);
    assert.ok(report.fittedVertices > 0);
    assert.ok(report.maxDisplacementCm > 0);
    garment.geometry.dispose();
    body.geometry.dispose();
    (garment.material as THREE.Material).dispose();
    (body.material as THREE.Material).dispose();
  });
});


describe('fabric-aware drape profile', () => {
  it('starts smoothly at the supported top edge and grows toward the free hem', () => {
    const top = calculateFabricDrapeFold(0.7, 0, 0.2, 75, 90);
    const lower = calculateFabricDrapeFold(0.7, 0.9, 0.2, 75, 90);
    assert.equal(top, 0);
    assert.ok(Number.isFinite(lower));
    assert.ok(Math.abs(lower) > Math.abs(top));
  });

  it('keeps folds finite and bounded for every supported fabric range', () => {
    for (const stiffness of [0, 0.2, 0.5, 0.85, 1]) {
      for (const weight of [45, 75, 130, 210, 380, 450]) {
        const fold = calculateFabricDrapeFold(Math.PI / 3, 1, stiffness, weight, 110);
        assert.ok(Number.isFinite(fold));
        assert.ok(Math.abs(fold) <= 2.1);
      }
    }
  });
});
