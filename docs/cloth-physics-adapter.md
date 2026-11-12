# Cloth physics and body collision adapter

## Purpose

This adapter replaces a purely visual drape approximation with a deterministic CPU position-based dynamics (PBD) foundation. It consumes CAD panel triangulations and confirmed sewing-edge pairs, and it collides the cloth particles against the same Three.js body scene.

## Coordinate and material contract

- CAD source coordinates are centimetres. Apply a per-panel `THREE.Matrix4` to place each 2D panel around the body in the shared scene.
- The default gravity is `981 cm/s²`; if the scene uses metres, supply gravity and collision thickness in metres instead.
- Fabric presets already expose weight, stretch and stiffness. A material-calibration layer must map those values to solver stiffness, mass and bending coefficients before production use; this first adapter exposes explicit solver coefficients rather than pretending visual material values are calibrated physics.

## Implemented

- Particle state with Verlet integration, damping and fixed time steps.
- Structural constraints on panel edges, shear constraints inside triangulated panels, and bending constraints across adjacent triangles.
- Stitch constraints generated from stable CAD piece/segment IDs. Samples are paired by normalized position along the stitch line; sewing audit remains the source of truth for ease and length mismatch.
- Three.js body-mesh collider with closest-triangle distance and ray-parity inside/outside classification.
- Collision projection during solver iterations.
- Fit report with contact count, penetration count, minimum/mean clearance and maximum penetration.
- CPU tests for gravity, seam constraints and signed-distance analysis.

## Limitations and production gates

The triangle collider currently uses a brute-force scan over body triangles for each particle and time step. It is a reference CPU implementation, not a high-performance solver. Before enabling it on dense Anny meshes in the interactive viewer, add a BVH/spatial index, broad-phase bounds, self-collision, adaptive substeps and worker/WASM execution.

The parity-based signed distance expects closed, consistently triangulated body surfaces. Open or self-intersecting meshes need a dedicated signed-distance field. Current collision tests cover a deterministic signed-distance provider; the Three.js mesh adapter must also be validated against watertight synthetic meshes.

The solver currently uses uniform particle mass and explicit constraint coefficients. Calibrate mass from fabric GSM and triangle area, and derive stretch/shear/bend parameters from measured fabric properties before claiming material-accurate behavior.

The adapter returns positions and fit metrics only. The application must update the existing Three.js garment mesh from those positions; it does not create a second renderer or a separate canvas.
