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


def build_relaxed_arm_pose(model: anny.Anny, device: str) -> torch.Tensor:
    """Build a symmetric, relaxed-down arm pose using Anny's native rig.

    Anny's world-orient parameterization lets each upper-arm bone be oriented
    in the model's world frame while preserving rig skinning and mesh topology.
    Opposite signs mirror the left and right arms around the sagittal plane.
    """
    labels = list(model.bone_labels)
    required = (
        "upperarm01.L", "upperarm02.L",
        "upperarm01.R", "upperarm02.R",
    )
    missing = [label for label in required if label not in labels]
    if missing:
        raise RuntimeError(
            "Anny rig is missing required upper-arm bones: " + ", ".join(missing)
        )

    # Convert the reference pose to world-orient explicitly. This avoids
    # assuming that local-bone and local-ref rotations share the same axes.
    reference_pose = {
        label: torch.eye(4, dtype=torch.float32, device=device)[None]
        for label in labels
    }
    reference_output = model(pose_parameters=reference_pose)
    pose = model.get_pose_parameterization(
        reference_output, pose_parameterization="world-orient"
    ).clone()

    def rotation_z(degrees: float) -> torch.Tensor:
        angle = torch.tensor(
            degrees * 3.141592653589793 / 180.0,
            dtype=torch.float32,
            device=device,
        )
        cosine = torch.cos(angle)
        sine = torch.sin(angle)
        transform = torch.eye(4, dtype=torch.float32, device=device)
        transform[0, 0] = cosine
        transform[0, 1] = -sine
        transform[1, 0] = sine
        transform[1, 1] = cosine
        return transform

    bone_indices = {label: index for index, label in enumerate(labels)}
    # The upstream Anny pose tutorial demonstrates 90-degree Z rotations
    # on upper-arm bones. Mirrored signs lower both sides symmetrically.
    for side, angle in (("L", -90.0), ("R", 90.0)):
        transform = rotation_z(angle)
        for segment in ("upperarm01", "upperarm02"):
            pose[0, bone_indices[f"{segment}.{side}"]] = transform

    return pose


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
    with torch.inference_mode():
        pose = build_relaxed_arm_pose(model, device)
        output = model(
            pose_parameters=pose,
            pose_parameterization="world-orient",
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
        "pose": "symmetric-relaxed-arms-down",\n        "pose_parameterization": "world-orient",\n        "arm_pose_degrees": {"left_upper_arm": -90.0, "right_upper_arm": 90.0},
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
