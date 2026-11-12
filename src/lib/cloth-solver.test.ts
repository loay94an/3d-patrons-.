import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  analyzeClothBodyClearance,
  buildClothSimulation,
  createThreeMeshBodyCollider,
  updateClothBufferGeometry,
  type ClothBodyCollider
} from './cloth-solver';
import { buildCadPanelGeometry } from './cad-panel-geometry';
import type { CadPiece } from './pattern-cad-engine';

const piece = (id: string, xOffset = 0): CadPiece => ({
  id,
  name: id,
  nameAr: id,
  garmentType: 'skirt',
  segments: [
    { id: 'top', type: 'line', p1: { x: xOffset, y: 0 }, p2: { x: xOffset + 10, y: 0 }, layer: 'cutting', edgeType: 'waist', lengthCm: 10 },
    { id: 'right', type: 'line', p1: { x: xOffset + 10, y: 0 }, p2: { x: xOffset + 10, y: 10 }, layer: 'cutting', edgeType: 'side', lengthCm: 10 },
    { id: 'bottom', type: 'line', p1: { x: xOffset + 10, y: 10 }, p2: { x: xOffset, y: 10 }, layer: 'cutting', edgeType: 'hem', lengthCm: 10 },
    { id: 'left', type: 'line', p1: { x: xOffset, y: 10 }, p2: { x: xOffset, y: 0 }, layer: 'cutting', edgeType: 'side', lengthCm: 10 }
  ],
  notches: [],
  grainlines: [],
  seamAllowanceCm: 1,
  notes: ''
});

describe('cloth physics adapter', () => {
  it('builds a triangle cloth mesh and advances particles under gravity', () => {
    const panel = buildCadPanelGeometry(piece('front'));
    const simulation = buildClothSimulation([panel], [], {
      gravity: new THREE.Vector3(0, -100, 0),
      iterations: 4,
      timeStep: 1 / 30
    });
    const before = simulation.particles[0].position.y;
    simulation.step();
    assert.ok(simulation.particles[0].position.y < before);
    assert.ok(simulation.triangles.length > 0);
    assert.ok(simulation.constraints.some(item => item.kind === 'structural'));
    assert.ok(simulation.constraints.some(item => item.kind === 'bend') || simulation.constraints.some(item => item.kind === 'shear'));
  });

  it('connects paired CAD edge samples with zero-rest-length seam constraints', () => {
    const front = buildCadPanelGeometry(piece('front'));
    const back = buildCadPanelGeometry(piece('back', 20));
    const simulation = buildClothSimulation([front, back], [{
      id: 'side-seam',
      first: { pieceId: 'front', segmentId: 'right' },
      second: { pieceId: 'back', segmentId: 'left' },
      mode: 'plain'
    }]);
    const seams = simulation.constraints.filter(item => item.kind === 'seam');
    assert.ok(seams.length > 1);
    assert.ok(seams.every(item => item.restLength === 0));
  });

  it('reports contact and penetration against a signed-distance body collider', () => {
    const collider: ClothBodyCollider = {
      sample(point) {
        const distance = point.length() - 5;
        return {
          signedDistance: distance,
          normal: point.clone().normalize(),
          closestPoint: point.clone().normalize().multiplyScalar(5)
        };
      }
    };
    const report = analyzeClothBodyClearance([
      new THREE.Vector3(5.1, 0, 0),
      new THREE.Vector3(4, 0, 0),
      new THREE.Vector3(8, 0, 0)
    ], collider, 0.25);
    assert.equal(report.fitStatus, 'penetration');
    assert.equal(report.contactCount, 2);
    assert.equal(report.penetrationCount, 1);
    assert.equal(report.maximumPenetration, 1);
  });

  it('samples signed distance from a closed Three.js body mesh', () => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
    const collider = createThreeMeshBodyCollider(body);
    assert.ok(collider.sample(new THREE.Vector3(0, 0, 0)).signedDistance < 0);
    assert.ok(collider.sample(new THREE.Vector3(6, 0, 0)).signedDistance > 0);
  });

  it('writes simulated particles into the existing Three.js geometry', () => {
    const panel = buildCadPanelGeometry(piece('render-panel'));
    const simulation = buildClothSimulation([panel]);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(simulation.particles.length * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    simulation.particles[0].position.set(1, 2, 3);
    updateClothBufferGeometry(simulation, geometry);
    assert.equal(geometry.getAttribute('position').getX(0), 1);
    assert.equal(geometry.getAttribute('position').getY(0), 2);
    assert.equal(geometry.getAttribute('position').getZ(0), 3);
    geometry.dispose();
  });
});
