# Anny integration: staged technical plan

## Repository findings

The current product is a Vite/React/Three.js static site deployed through
GitHub Pages. Its current 3D viewer builds a local procedural mannequin from
a small set of measurements. There is no configured Python inference service
in the deployment workflow.

Anny is a PyTorch differentiable human mesh model. It cannot be imported
directly into the browser bundle or executed by GitHub Pages.

## Phase 1 — isolated model-generation proof of concept

The `tools/anny-poc` utility uses the upstream v0.6.2 Python API to produce a
neutral-pose GLB mesh and a JSON report. It exposes actual phenotype labels
rather than inventing a fixed semantic mapping. The report explicitly marks
units and anthropometric measurements as uncalibrated.

Acceptance criteria:
- Generate a finite triangular mesh with valid face indices.
- Export a GLB and reproducibility report.
- Record runtime, device, vertex/triangle counts, bounds, and phenotype values.
- Run at least two different phenotype configurations and confirm that the
  resulting meshes differ.
- Record first-run and warm-run resource use on the intended deployment hardware.

## Phase 2 — anthropometric calibration (not implemented)

Do not map a bust/waist/hip measurement directly to a phenotype label by name.
Build a measurement-fitting layer only after:
- documenting the exact Anny phenotype labels and their effects;
- establishing mesh coordinate orientation and scale;
- implementing validated cross-section/landmark measurement extraction;
- defining target measurement landmarks and a numerical error metric;
- testing fitting across varied body shapes and age groups.

## Phase 3 — viewer transport (not implemented)

After Phase 1 is validated, add a GLB import path to the existing Three.js
viewer or a separate Anny preview panel. Preserve the current mannequin as a
fallback. Do not represent a static body mesh as cloth simulation.

## Phase 4 — hosted inference (not implemented)

GitHub Pages cannot host the PyTorch runtime. Select and configure a separate
Python service only after measuring model initialization, inference latency,
memory, concurrency, asset caching, and operating cost. Keep model generation
behind a versioned API and return GLB plus a calibration report.

## Licensing

The core Anny code is Apache-2.0 and upstream README identifies MakeHuman/
MPFB2-derived assets under CC0. The optional SMPL-X topology is non-commercial
only unless separately licensed. Verify package and dependency notices for the
exact release before commercial distribution.
