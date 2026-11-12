# Anny engine source archive

This folder receives the official NAVER LABS Anny source archive during the GitHub Pages build.

- Upstream: https://github.com/naver/anny
- Pinned source revision: `8f35dc2df1c4062fd2fae86734f9705de50c0c2b`
- Download: [anny-source.zip](./anny-source.zip)
- License files are copied beside the archive when available.

The browser does not execute the Python/PyTorch source archive. The Pages build uses this pinned source to generate `/models/anny-neutral.glb`, which the 3D viewer loads as its default human body. Interactive phenotype generation requires the separate Python API service described in `tools/anny-api/README.md`.

Anny source and its included assets remain subject to the upstream license notices. Review `LICENSE` and `LICENSE_THINGS` before redistribution or commercial use.
