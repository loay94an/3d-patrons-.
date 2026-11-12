# Unified fashion-engine pipeline

## Runtime flow

`Anthropometry → Parametric CAD → Sewing audit → Fabric/material → Three.js preview → Cloth solver → Fit analysis`

The browser uses Three.js as the single presentation and scene graph layer. Engine code returns typed geometry/data and does not create independent canvases or duplicate viewers.

## Implemented integration boundary

`src/lib/fashion-pipeline.ts` composes the current TypeScript engines into one versioned session:

- Resolves standard/custom anthropometric measurements and builds the parametric mannequin.
- Converts every CAD piece into a validated panel geometry.
- Audits explicitly paired stitch edges and preserves unresolved seam issues.
- Resolves the selected fabric preset.
- Reports per-stage readiness rather than treating a successful preview as proof of physical fit.

## Honest capability boundary

The current garment renderer includes a deterministic drape/fold approximation for visual preview. It is **not** a physical cloth solver. The unified session therefore marks physical simulation as `adapter-required`. A future solver adapter must consume panel meshes, seam constraints, fabric mass/stiffness/stretch, body collision geometry and gravity, then return updated vertex positions to the same Three.js scene.

Virtual try-on is also not inferred from a static preview. A fit-analysis stage must compare garment and body surfaces, produce signed clearance/penetration values and identify local pressure/ease regions. AI image try-on projects are separate optional services and must not replace geometric fit validation.

## Integration rules

1. Centimetres are the source unit for body measurements and CAD geometry.
2. Seam allowance remains separate from stitch-line geometry.
3. Stitch constraints reference stable piece/edge IDs.
4. Fabric visual properties and physical material properties are distinct.
5. A failed panel, seam or fabric validation blocks the corresponding readiness stage.
6. The Three.js viewer remains the only scene renderer; adapters return data/geometry, never their own UI.

## Next engineering gates

1. Add an explicit cloth-solver adapter contract and a CPU test implementation for deterministic constraints.
2. Convert CAD panels and paired seam edges into a solver mesh with stable vertex-to-edge mappings.
3. Add body collision and signed garment/body clearance sampling.
4. Validate seam lengths, penetration and drape against reference garments before describing results as physically accurate.
5. Add optional CatVTON-style image try-on as an isolated inference adapter, not as the source of geometric garment fit.
