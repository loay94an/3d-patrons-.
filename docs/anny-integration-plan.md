# Anny integration: current status and staged technical plan

## Architecture decision: local-first body model

Anny is the default visual human body in the 3D viewer. The GitHub Pages build generates a neutral Anny GLB and the browser loads it automatically; no hosted inference API is needed to display the bundled model. The local Three.js mannequin remains as a fallback and as a measurement-driven geometry reference while Anny calibration is developed.

Do not treat automatic loading or display-height normalization as anthropometric fitting. Anny is the preferred anatomical surface, but bust/waist/hip and other tape measurements must not be claimed to fit it until mesh landmarks, physical scale, and deformation have been validated. The optional Python API remains a separate route for generating phenotype variants; it is not required for the default viewer.

The local model is currently a procedural fitting mannequin, not a photorealistic anatomical digital human. Its torso profile uses ellipse-based circumference targets; limbs and detailed anatomy remain approximations. Calibrating physical scale and validating real body-shape diversity are still required before claiming production measurement accuracy.

## Current implementation status

The product is a Vite/React/Three.js static site deployed through GitHub Pages. The Anny integration combines a bundled static GLB for default viewing, browser-side Three.js display, and an optional separate Python API for phenotype generation.

### Completed

- **Runtime proof of concept:** `tools/anny-poc` runs upstream Anny v0.6.2 on CPU, exports a neutral-pose GLB and a JSON report, and validates the mesh. The runtime workflow passed on 2026-11-11: [run 42962889281](https://github.com/loay94an/3d-patrons-./actions/runs/42962889281).
- **Python API foundation:** `tools/anny-api` exposes health, phenotype-label, ZIP-generation, and direct-GLB endpoints.
- **Viewer transport:** PR #44 added an Anny API panel to `Pattern3DViewer`. It can load the exact phenotype labels from the API, submit changed phenotype values, load the returned GLB into Three.js, and retain manual GLB upload as a fallback.
- **Frontend deployment:** PR #44 was merged to `main` at `edcf6a085a3e32da65f8b4ef0940a98e89ea91bf`. Type-check, unit tests, production build, and GitHub Pages deployment all passed in [run 42962889468](https://github.com/loay94an/3d-patrons-./actions/runs/42962889468).

### Local model improvements

- The browser builds the mannequin directly from user measurements; no inference API is required for this.
- A mesh-ring measurement helper now checks the generated torso geometry at the bust, waist, and hip profile levels. These are geometry regression checks, not a substitute for validation against real scanned bodies.
- Future work should extend the same local model with measured neck, upper-arm, thigh, inseam, and shoulder/torso landmark controls, and use a smooth continuous body surface rather than disconnected primitive limb shapes.

### Not yet completed

- The Python API is **not hosted**. GitHub Pages only serves the frontend; it does not run PyTorch or the Anny Python process.
- The viewer needs a reachable API base URL, supplied through `VITE_ANNY_API_URL` at build time or entered in the Anny API panel.
- No validated mapping exists from bust, waist, hip, height, or other tape measurements to Anny phenotype parameters.
- The displayed GLB normalization is for viewer presentation only. It is not physical-unit calibration.
- No garment-to-body collision, cloth drape, pressure, ease, or fit simulation is provided by this integration.

## Phase 1 — Anny model runtime proof of concept: complete

The `tools/anny-poc` utility uses the upstream Anny package to produce a neutral-pose mesh and a reproducibility report. The runtime workflow validates finite vertices and triangular faces. This proves that the model can run in CI; it does not prove anthropometric accuracy or production service capacity.

## Phase 2 — Anthropometric calibration: measurement foundation added; Anny fitting not implemented

`src/lib/mesh-anthropometry.ts` now measures triangle-mesh section perimeters along an explicitly selected axis and computes diagnostic radial scale factors for ordered measurement landmarks. Unit tests use a known synthetic cylinder. This utility does not infer Anny landmarks, deform a GLB, establish centimetres, or claim a fitted result.

Do not map bust/waist/hip measurements directly to phenotype labels by name. Build a separate fitting layer only after:

1. Documenting the exact phenotype labels and experimentally measuring their effects.
2. Establishing mesh orientation, scale, landmarks, and consistent body-region cross-sections.
3. Implementing circumference extraction from the mesh with tests on known synthetic geometry.
4. Defining target measurement landmarks and a numerical error metric in explicit units.
5. Implementing a bounded optimizer over phenotype parameters and validating it across varied body shapes, heights, and age groups.
6. Reporting per-measurement residuals and rejecting unsupported or out-of-range targets rather than silently claiming a fit.

The calibration report must distinguish user-entered measurements, measured mesh circumferences, residuals, and any inferred values.

## Phase 3 — Browser viewer integration: complete as a frontend feature

The Anny API panel in `src/components/Pattern3DViewer.tsx` supports API URL configuration, phenotype discovery, parameter adjustment, GLB generation/loading, and manual GLB fallback. The frontend build and Pages deployment passed. End-to-end use still depends on deploying and configuring the separate API.

## Phase 4 — Optional hosted Anny inference service: not deployed

This phase is optional and must not block the local-first fitting workflow. Before public exposure:

- Choose a hosting target only after checking CPU/RAM limits, persistent cache behavior, cold-start time, request latency, concurrency, and cost.
- Add authentication, per-user rate limits, bounded concurrency/queueing, request-size limits, timeouts, and operational health checks.
- Configure exact-origin CORS for the production website.
- Add privacy/retention controls; do not persist generated body meshes or measurements unless explicitly required and disclosed.
- Pin and audit dependencies, publish container image provenance, and monitor failures and resource use.
- Test the deployed service from the actual GitHub Pages origin, including CORS preflight and GLB loading.

Do not publish a public unauthenticated inference endpoint.

## Phase 5 — Pattern and garment fitting: not implemented

Only after calibrated body geometry exists should the pattern engine consume the body model. Validate pattern dimensions and seam relationships independently, then add garment panels, seam assembly, collision detection, cloth simulation, and fit/ease analysis. A static GLB body or garment mesh must not be described as cloth simulation.

## Licensing

The core Anny code is Apache-2.0 and upstream README identifies MakeHuman/MPFB2-derived assets under CC0. Optional SMPL-X topology may carry non-commercial restrictions unless separately licensed. Verify the exact release's package and dependency notices before commercial distribution.


## Bundled Anny body preview

The GitHub Pages build now generates a neutral Anny v0.6.2 GLB on CPU and publishes it at `models/anny-neutral.glb`. The viewer's **عرض جسم Anny** action loads this static asset without requiring a separately hosted API. The generated reference mesh currently contains 13,718 vertices and 27,420 triangles (about 0.5 MB in the verified runtime run).

The bundled body is a neutral-pose visual reference. The viewer normalizes its displayed height only; this does not calibrate its coordinates to centimetres or adapt the mesh to the user's tape measurements. The Anny API and manual GLB upload remain optional alternatives. The runtime proof-of-concept workflow is now manual-only to avoid generating the same model twice on every main-branch deployment.

The Pages build runs Anny inference only for non-pull-request builds. Pull-request checks validate TypeScript, tests, and the site build without installing CPU PyTorch.


## Updated default-viewer behavior

The bundled Anny GLB is now loaded automatically when the 3D viewer opens. If the asset cannot be fetched or parsed, the viewer keeps the local procedural mannequin available and displays the Anny load error. Garment overlay on Anny starts disabled because the current pattern mesh has not yet been calibrated to Anny's physical scale and body landmarks. Users can explicitly enable the overlay for visual inspection, but it must not be interpreted as validated fit.

The uploaded repository GLB assets are treated as reference candidates. A pull-request CI audit reports their mesh topology, bounds, connected components, skin joints, animation and morph-target metadata. The audit does not modify, redistribute, or automatically select any uploaded model as the fitting body.
