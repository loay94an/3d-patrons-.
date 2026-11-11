#!/usr/bin/env python3
"""Generate a neutral Anny body mesh and export it as GLB.

This is an isolated proof of concept. It deliberately does not claim that
Anny phenotype parameters are garment measurements or that mesh dimensions
are centimetres.
"""
from __future__ import annotations

import argparse
import json
import platform
import time
from pathlib import Path

import anny
import numpy as np
import torch
import trimesh


def parse_phenotypes(items: list[str], labels: list[str]) -> dict[str, float]:
    values = {label: 0.5 for label in labels}
    for item in items:
        if "=" not in item:
            raise ValueError(f"Expected LABEL=VALUE, got: {item}")
        label, raw = item.split("=", 1)
        if label not in values:
            raise ValueError(
                f"Unknown phenotype '{label}'. Available labels: {', '.join(labels)}"
            )
        value = float(raw)
        if not 0.0 <= value <= 1.0:
            raise ValueError(f"Phenotype '{label}' must be between 0 and 1")
        values[label] = value
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="anny-neutral.glb", help="Output GLB path")
    parser.add_argument(
        "--device", choices=("auto", "cpu", "cuda"), default="auto",
        help="Inference device (default: CUDA when available, otherwise CPU)",
    )
    parser.add_argument(
        "--phenotype", action="append", default=[], metavar="LABEL=VALUE",
        help="Override an Anny phenotype parameter in the documented [0, 1] range",
    )
    args = parser.parse_args()

    if args.device == "cuda" and not torch.cuda.is_available():
        parser.error("CUDA was requested but is not available")
    device = (
        "cuda" if args.device == "cuda" or
        (args.device == "auto" and torch.cuda.is_available()) else "cpu"
    )

    started = time.perf_counter()
    model = anny.Anny(local_changes="default", facial_actions="all").to(
        device=device, dtype=torch.float32
    )
    phenotypes = parse_phenotypes(args.phenotype, list(model.phenotype_labels))
    pose = torch.eye(4, dtype=torch.float32, device=device)[None, None].repeat(
        1, model.bone_count, 1, 1
    )

    with torch.inference_mode():
        output = model(
            pose_parameters=pose,
            phenotype_kwargs=phenotypes,
            local_changes_kwargs={},
        )

    vertices = output["vertices"].squeeze(dim=0).detach().cpu().numpy()
    faces = np.asarray(model.faces, dtype=np.int64)
    if vertices.ndim != 2 or vertices.shape[1] != 3:
        raise RuntimeError(f"Unexpected vertex array shape: {vertices.shape}")
    if faces.ndim != 2 or faces.shape[1] != 3:
        raise RuntimeError(f"Expected triangular faces, got shape: {faces.shape}")
    if not np.isfinite(vertices).all():
        raise RuntimeError("Anny returned non-finite vertex coordinates")
    if faces.size == 0 or faces.min() < 0 or faces.max() >= len(vertices):
        raise RuntimeError("Anny returned invalid face indices")

    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    output_path = Path(args.output).expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mesh.export(output_path, file_type="glb")

    elapsed = time.perf_counter() - started
    report = {
        "model": "Anny",
        "device": device,
        "torch_version": torch.__version__,
        "python_version": platform.python_version(),
        "vertex_count": int(len(vertices)),
        "triangle_count": int(len(faces)),
        "bounds_model_units": mesh.bounds.tolist(),
        "phenotype_parameters": phenotypes,
        "local_changes": {},
        "pose": "identity",
        "elapsed_seconds_including_model_initialization": round(elapsed, 3),
        "output_file": str(output_path),
        "measurement_status": (
            "Not calibrated: Anny model coordinates are not assumed to be centimetres "
            "and no garment-measurement fitting has been performed."
        ),
    }
    report_path = output_path.with_suffix(".json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
