# Anny body-model proof of concept

This folder is an isolated Python experiment for the fashion-pattern platform.
It does **not** replace the existing Three.js mannequin or run on GitHub Pages.

## What it does

- Loads NAVER LABS Anny v0.6.2 with the native `anny` rig/topology.
- Creates a neutral identity pose.
- Starts from the midpoint (0.5) of every published phenotype parameter.
- Allows explicit phenotype overrides in the documented [0, 1] range.
- Exports the generated triangular mesh as GLB and writes a JSON report beside it.
- Checks that vertices and triangle indices are finite and valid.

The report records mesh bounds in **model units**. It intentionally does not label
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

After generating a file, open the website's 3D viewer and choose **تحميل Anny GLB** (Load Anny GLB), then select the `.glb` file. The viewer scales the mesh to an approximate display height and centers it on the stage. This is visual-only normalization: the viewer hides the existing procedural mannequin and garment while the Anny preview is active, so no unvalidated pattern fit is implied. Choose **إغلاق Anny** (Close Anny) to return to the existing mannequin and garment preview.

## Current limitations and next validation gate

1. This experiment has not yet been executed in the project's GitHub Actions
   environment or on the target Android device. A successful repository build
   does not prove that Anny's PyTorch model runs on either environment.
2. Mesh coordinates are not assumed to be centimetres. A scale/orientation
   calibration against known reference geometry is required.
3. No circumference extraction, anthropometric fitting, measurement-error
   report, or pattern-to-body collision test is implemented yet.
4. GLB export is a transport format for the viewer; materials, skeleton/rig
   animation, and UV fidelity must be verified separately before production use.
5. GitHub Pages is static hosting. Production inference requires a separately
   deployed Python service (or pre-generated model assets); this repository
   currently does not configure such a service.

Do not use the optional `smplx` topology for commercial work without obtaining
the separate SMPL-X license. The core Anny code is Apache-2.0; its README also
identifies MakeHuman/MPFB2-derived assets under CC0. Recheck the exact package,
asset, and dependency licenses before redistributing generated content.

## Upstream

- [NAVER LABS Anny](https://github.com/naver/anny)
- Tested API reference: [README at commit 8f35dc2](https://github.com/naver/anny/blob/8f35dc2df1c4062fd2fae86734f9705de50c0c2b/README.md)
