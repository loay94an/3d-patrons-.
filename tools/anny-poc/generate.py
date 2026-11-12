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
import roma
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
    """Build a relaxed, symmetric arm pose using Anny's documented local-ref rig.

    This follows NAVER's keypoint tutorial: rotate the upper arms outward/down
    and add a mild, mirrored elbow bend through the native lower-arm bones.
    Parent-child transforms remain in the rig's local reference coordinates;
    no vertices are edited directly.
    """
    required = ("upperarm01.L", "upperarm01.R", "lowerarm01.L", "lowerarm01.R")
    labels = list(model.bone_labels)
    missing = [label for label in required if label not in labels]
    if missing:
        raise RuntimeError(
            "Anny rig is missing required arm bones: " + ", ".join(missing)
        )

    pose = torch.eye(4, dtype=torch.float32, device=device)[None, None].expand(
        1, model.bone_count, 4, 4
    ).clone()
    # Keep these mirrored signs: the CPU keypoint regression verifies both wrists descend.
    # NAVER's tutorial signs map inversely in this generator's current local-ref basis.
    rotations = {
        "upperarm01.L": (0.0, 0.0, -0.9),
        "upperarm01.R": (0.0, 0.0, 0.9),
        "lowerarm01.L": (0.0, 1.1, 0.0),
        "lowerarm01.R": (0.0, -1.1, 0.0),
    }
    for label, rotation_vector in rotations.items():
        index = labels.index(label)
        vector = torch.tensor(rotation_vector, dtype=torch.float32, device=device)
        pose[0, index, :3, :3] = roma.rotvec_to_rotmat(vector)

    return pose


def measure_arm_pose(model: anny.Anny, output: dict) -> dict:
    """Measure real shoulder/elbow/wrist positions and reject asymmetric poses."""
    labels = [
        "left_shoulder", "right_shoulder",
        "left_elbow", "right_elbow",
        "left_wrist", "right_wrist",
    ]
    regressor = anny.KeypointsRegressor.coco(model, labels)
    points = regressor(output).squeeze(0).detach().cpu().numpy()
    by_label = {label: points[index].tolist() for index, label in enumerate(labels)}
    bounds = np.asarray(output["vertices"].squeeze(0).detach().cpu().numpy()).min(axis=0), np.asarray(
        output["vertices"].squeeze(0).detach().cpu().numpy()
    ).max(axis=0)
    height = float(bounds[1][2] - bounds[0][2])
    if not np.isfinite(height) or height <= 0:
        raise RuntimeError("Anny produced an invalid vertical body extent")

    drops = {}
    for side in ("left", "right"):
        shoulder = np.asarray(by_label[f"{side}_shoulder"])
        elbow = np.asarray(by_label[f"{side}_elbow"])
        wrist = np.asarray(by_label[f"{side}_wrist"])
        drops[side] = {
            "shoulder_to_elbow_vertical": float(shoulder[2] - elbow[2]),
            "elbow_to_wrist_vertical": float(elbow[2] - wrist[2]),
            "shoulder_to_wrist_vertical": float(shoulder[2] - wrist[2]),
        }
        if drops[side]["elbow_to_wrist_vertical"] < height * 0.01:
            raise RuntimeError(
                f"Anny {side} forearm/hand is not directed downward from the elbow; "
                f"vertical drops={drops[side]}, keypoints={{'shoulder': {by_label[f'{side}_shoulder']}, "
                f"'elbow': {by_label[f'{side}_elbow']}, 'wrist': {by_label[f'{side}_wrist']}}}"
            )
        if drops[side]["shoulder_to_wrist_vertical"] < height * 0.015:
            raise RuntimeError(
                f"Anny {side} wrist is not sufficiently below the shoulder; "
                "the relaxed downward arm pose failed anatomical validation"
            )

    symmetry_error = max(
        abs(by_label["left_shoulder"][0] + by_label["right_shoulder"][0]),
        abs(by_label["left_elbow"][0] + by_label["right_elbow"][0]),
        abs(by_label["left_wrist"][0] + by_label["right_wrist"][0]),
        abs(by_label["left_shoulder"][1] - by_label["right_shoulder"][1]),
        abs(by_label["left_shoulder"][2] - by_label["right_shoulder"][2]),
        abs(by_label["left_elbow"][1] - by_label["right_elbow"][1]),
        abs(by_label["left_elbow"][2] - by_label["right_elbow"][2]),
        abs(by_label["left_wrist"][1] - by_label["right_wrist"][1]),
        abs(by_label["left_wrist"][2] - by_label["right_wrist"][2]),
    )
    if symmetry_error > height * 0.025:
        raise RuntimeError(
            f"Anny arm pose is not sufficiently symmetric: {symmetry_error:.6f} "
            f"model units (body height {height:.6f})"
        )

    return {
        "keypoints_model_units": by_label,
        "vertical_drop_model_units": drops,
        "left_right_symmetry_error_model_units": float(symmetry_error),
        "validation": "passed",
    }

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
            pose_parameterization="local-ref",
            phenotype_kwargs=phenotypes,
            local_changes_kwargs={},
        )
        arm_pose_report = measure_arm_pose(model, output)

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
        "pose": "symmetric-relaxed-arms-down-with-soft-elbow-bend",
        "pose_parameterization": "local-ref",
        "arm_pose_rotvec_radians": {
            "upperarm01.L": [0.0, 0.0, -0.9],
            "upperarm01.R": [0.0, 0.0, 0.9],
            "lowerarm01.L": [0.0, 1.1, 0.0],
            "lowerarm01.R": [0.0, -1.1, 0.0]
        },
        "arm_pose_validation": arm_pose_report,
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
