# PyGarment skirt adapter — proof of concept

This isolated prototype exercises the official PyGarment 2.0.2 source and
converts two PyGarment Panel objects into the platform's initial neutral
pattern JSON. It does not replace the browser CAD engine.

## Setup

The upstream project publishes PyGarment 2.0.2. Its installation guide lists
additional geometry dependencies, some of which may require native build
support. Use Python 3.9 or 3.10 for the first reproducible environment.

    git clone --branch v2.0.2 --depth 1 https://github.com/maria-korosteleva/GarmentCode.git vendor/GarmentCode
    python -m venv .venv
    source .venv/bin/activate
    python -m pip install --upgrade pip
    python -m pip install -r tools/pygarment-poc/requirements.txt
    export PYTHONPATH="$PWD/vendor/GarmentCode"

The source checkout is intentional: the upstream distribution metadata and
import-package layout do not expose \`pygarment\` consistently when installed
as a wheel in an isolated working directory. Import from the pinned upstream
source tree, while installing its declared runtime dependencies from PyPI.

## Generate

    python tools/pygarment-poc/generate_skirt.py --waist 70 --hip 96 --waist-to-hip 20 --length 60 --output artifacts/pygarment-skirt.json

Defaults are illustrative centimetre dimensions, not a recommended size.
Supply a measured and reviewed profile before use on an individual.

## What this prototype verifies

- Uses PyGarment Panel and EdgeSeqFactory to construct both panels.
- Exports front-on-fold and back-seam outlines as platform CAD segments.
- Keeps dart guides separate from the outline.
- Carries notches, grainline, seam-allowance metadata, and provenance.
- Checks dimensions, panel self-intersection, finished waist/hip arithmetic,
  and front/back side-seam length equality.

## Known limitations — not production ready

- Front and back use equal dart intake in this first adapter.
- Side contours are straight in this initial proof of concept.
- Seam allowances are metadata only; offset cutting geometry is not generated.
- No fit, balance, drape, fabric simulation, grading, or toile validation.
- The adapter JSON is not PyGarment's native serialized assembly. A later
  adapter must preserve curved-edge control data and stitches.
- The prototype does not run inside the website. GitHub Pages is static;
  a hosted Python service would be a separate deployment.

## Upstream

- https://github.com/maria-korosteleva/GarmentCode
- https://pypi.org/project/pygarment/

PyGarment is MIT-licensed upstream. Review dependencies and external datasets
or body assets independently before redistribution.
