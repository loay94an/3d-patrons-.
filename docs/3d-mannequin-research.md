# 3D mannequin research and repair notes

## Executive recommendation

Use a **real, rigged, parametric human mesh** as the long-term body source, not a collection of spheres and capsules. Keep the tailoring profile as a separate, measurement-driven surface contract so garment generation and the visible body use the same measurement landmarks. The recommended path is to prototype a CC0 MakeHuman/MPFB-derived GLB, verify its topology, scale, rig and morph targets, then fit the clothing surface to the same measurements. Do not replace the current body with an unrelated static GLB: that would make the garment/body fit visibly wrong.

## Candidate open-source projects and assets

| Project | What it provides | License / caveat | Suitability |
|---|---|---|---|
| MakeHuman Community + MPFB | Parametric human creation, body assets, Blender workflow and exportable meshes | Core graphic assets CC0; MakeHuman app AGPL and MPFB GPL. Track asset and code licenses separately. | Strong production source for realistic base bodies and morphs. |
| CharacterCreator (kblood) | MPFB/MakeHuman-to-GLB pipeline, rig, morph targets, Three.js viewer and clothing examples | Repository currently GPL-3.0; its generated body assets are documented as CC0. Verify current license files and asset provenance before copying code or binaries. | Useful end-to-end reference for GLB, rig and morph integration. |
| OxiHuman | Browser/native parametric human body generation and measurement fitting | Apache-2.0 code; bundled MakeHuman-derived body data CC0. Current release is early and body output is bodysuit-covered; review age/body-shape limitations. | Promising for measurement-driven mesh generation; prototype before adopting. |
| humanoid-kit | Three.js / React Three Fiber parametric body based on CC0 MakeHuman data | Pre-release; APIs and file formats may change. | Useful architectural reference, not a stable dependency yet. |
| Innerscene 53-bone human base mesh | Downloadable GLB with CC0 body and rig | Neutral bent-A bind pose; no animation; not a tailoring-measurement fitter. Confirm the asset terms at download time. | Good rig/import smoke-test asset, not a drop-in replacement for the measured body. |
| Ara 3D Gen | Self-hosted human character generation, clothing, animations and GLB/FBX/OBJ export | MIT code with CC0 MakeHuman-derived character assets; motion data has separate terms. | Good alternative for generating reference characters; verify its output dimensions and topology for tailoring. |

## Three.js integration requirements

1. Prefer glTF 2.0 / GLB for web delivery. Three.js `GLTFLoader` loads meshes, materials, skins, morph targets and animation clips.
2. A rigged character must preserve `SkinnedMesh`, `Skeleton`, skin indices/weights and a stable bone naming scheme. Use `AnimationMixer` only when animation is needed.
3. For body measurement changes, use morph targets or a parametric mesh generator. Do not scale the whole character non-uniformly: that distorts anatomy and invalidates tape measurements.
4. Measure the resulting mesh at defined anatomical cross-sections. A UI value echoed back is not proof that the generated mesh has that circumference.
5. Keep units explicit. This project currently treats torso dimensions as centimetres in Three.js world units; GLB assets commonly use metres. Convert once at the import boundary.
6. Keep the visible mannequin, garment ease and heatmap derived from the same measurement landmarks and coordinate convention (+Z front, +Y up).
7. On model replacement, test front, side and back silhouettes; body/garment intersections; mobile memory; GLB load failures; and fallback behavior.

## Defects found in the previous procedural mannequin

- The body height was not reconciled with the gender reference height. Adult legs used a pelvis-to-knee-to-ankle range of roughly 40–45 world units, while the reference bodies are 168–178 cm tall.
- The viewer passed a fixed height value of 168 for every gender, so children and infants could not use their own reference stature.
- Arms and legs were built from capsules whose cylinder length used `length - radius * 1.25`; capsule geometry adds both hemispherical ends, making the segment longer than the intended joint-to-joint distance.
- The face was assembled from protruding primitive eyes, pupils, nose and mouth. It read as a toy face rather than a professional fitting mannequin.
- The torso used only 32 vertical by 36 radial segments, and the bust added an angular band with hard thresholds. This could create visible banding and lumpy transitions.
- The waist tape used hard-coded radii instead of sampling the same torso profile used by the garment generator.
- The support pole ran through the centre of the full human body.

## Repairs in this branch

- Reconciled torso and lower-body vertical proportions against the gender-specific reference height and back length. The existing viewer's fixed 168 cm placeholder is intentionally not trusted; until a real height control is wired in, gender-specific reference heights are used.
- Increased torso tessellation to 100 × 64 and smoothed profile transitions.
- Removed the toy-like facial feature primitives and retained a neutral fitting-form head.
- Corrected capsule lengths so segment end points match the intended joint positions.
- Derived shoulder and hip placement from the same body profile rather than unrelated fixed widths.
- Made the waist tape sample the exact shared waist profile.
- Moved the stand behind the body to prevent the pole intersecting the torso.

## Important limitations

These repairs improve proportions, continuity and fitting alignment, but the body is **still procedural geometry**. It is not a photorealistic scanned human, does not yet use a unified watertight anatomical mesh, and has no deformable skeleton or calibrated morph-target set. The next milestone should be a CC0 rigged GLB proof-of-concept with measured morphs and regression tests for bust/chest, waist, hip, shoulder and back length. Do not label the result photorealistic until it has been visually reviewed from multiple angles and its measured cross-sections have been validated.

## Sources

- MakeHuman / MPFB asset and source licensing: https://www.makehumancommunity.org/about/license.html
- CharacterCreator pipeline and license notes: https://github.com/kblood/CharacterCreator
- OxiHuman generator and measurement-fit benchmarks: https://github.com/cool-japan/oxihuman
- humanoid-kit parametric Three.js body: https://github.com/jbcom/humanoid-kit
- Innerscene CC0 53-bone GLB base mesh: https://www.innerscene.com/tools/library/3d-parts/human-base-mesh-with-editable-53-bone-rig-8e7c8ab1
- Ara 3D Gen: https://github.com/olatunde85/3d-gen
- Three.js GLTFLoader: https://threejs.org/docs/pages/GLTFLoader.html
- Three.js animation system: https://threejs.org/manual/pages/animation-system.html
