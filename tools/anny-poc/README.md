# Anny body-model proof of concept

This folder generates the platform's default Anny body asset. The pinned official Anny source archive is downloaded during the Pages build, used for GLB generation, and published under `public/assets/engines/anny-source.zip`. Python/PyTorch still runs in GitHub Actions during the build, not inside the visitor's browser.

## What it does

- Loads the pinned NAVER LABS Anny source revision `8f35dc2df1c4062fd2fae86734f9705de50c0c2b` with the native `anny` rig/topology.
- Creates a symmetric relaxed-down arm pose using Anny's native upper-arm rig bones.
- Starts from the midpoint (0.5) of every published phenotype parameter.
- Allows explicit phenotype overrides in the documented [0, 1] range.
- Exports the generated triangular mesh as GLB and writes a JSON report beside it.
- Checks that vertices and triangle indices are finite and valid.

The arm pose follows NAVER's `tutorials/keypoints.py` rotation pattern: mirrored upper-arm and lower-arm rotations in `local-ref` mode. It preserves the native mesh topology and skinning; no arm vertices are moved independently. The report records mesh bounds in **model units**. It intentionally does not label
those values as centimetres or claim that phenotype controls directly represent
bust, waist, hip, height, or other tape measurements.

## Requirements

Use Python 3.10+ in a clean virtual environment. PyTorch installation can vary
by operating system and accelerator; install the appropriate CPU or CUDA build
from the official PyTorch instructions first, then install this folder's
requirements.

```bash
python -m venv .venv
source .venv/bin/activate
# Install a compatible PyTorch build for your platform first.
pip install -r tools/anny-poc/requirements.txt
python tools/anny-poc/generate.py --output artifacts/anny-neutral.glb
```

The first model initialization may take several minutes while Anny prepares and
caches its assets. The default cache is `~/.cache/anny/`; set `ANNY_CACHE_DIR`
to change it.

## Shape parameter experiments

Discover the exact parameter names from the installed model instead of assuming
a fixed list:

```bash
python -c "import anny; m=anny.Anny(); print(*m.phenotype_labels, sep='\\n')"
```

Then override selected labels:

```bash
python tools/anny-poc/generate.py \
  --output artifacts/anny-variant.glb \
  --phenotype SOME_LABEL=0.65
```

Replace `SOME_LABEL` with a real label printed by the command. Values outside
[0, 1] and unknown labels are rejected.

## Preview the generated GLB in the website

The production Pages build generates `public/models/anny-neutral.glb` from the pinned upstream source and the viewer auto-loads it as the default body. The viewer scales the mesh for display and centers it on the stage; this is visual normalization only, not centimetre calibration. The official source archive is downloadable from the Anny viewer panel.

## Current limitations and next validation gate

1. GitHub Actions runs the CPU model-generation and geometry-validation workflow on relevant pull requests and on production Pages builds. A successful CI run still does not prove identical performance on the target Android device.
2. Mesh coordinates are not assumed to be centimetres. A scale/orientation
   calibration against known reference geometry is required.
3. No circumference extraction, anthropometric fitting, measurement-error
   report, or pattern-to-body collision test is implemented yet.
4. GLB export is a transport format for the viewer; materials, skeleton/rig
   animation, and UV fidelity must be verified separately before production use.
5. The source archive download is not a browser-executable engine. Live phenotype changes require a separately hosted, secured Python API.
6. GitHub Pages is static hosting. This repository includes the API service and Docker configuration, but does not deploy that service or assign it a public URL.

Do not use the optional `smplx` topology for commercial work without obtaining
the separate SMPL-X license. The core Anny code is Apache-2.0; its README also
identifies MakeHuman/MPFB2-derived assets under CC0. Recheck the exact package,
asset, and dependency licenses before redistributing generated content.

## Upstream

- [NAVER LABS Anny](https://github.com/naver/anny)
- Tested API reference: [README at commit 8f35dc2](https://github.com/naver/anny/blob/8f35dc2df1c4062fd2fae86734f9705de50c0c2b/README.md)
