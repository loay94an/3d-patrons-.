#!/usr/bin/env python3
"""Measure Anny's neutral-pose horizontal section profile for calibration research.

All output distances remain in Anny model units. The candidate landmark bands
are explicitly heuristic and must not be interpreted as centimetres.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
import trimesh

def largest_closed_perimeter(section) -> float | None:
    if section is None:
        return None
    perimeters = []
    for path in section.discrete:
        points = np.asarray(path, dtype=float)
        if len(points) < 4 or not np.allclose(points[0], points[-1], atol=1e-5):
            continue
        length = float(np.linalg.norm(np.diff(points, axis=0), axis=1).sum())
        if np.isfinite(length) and length > 0:
            perimeters.append(length)
    return max(perimeters) if perimeters else None

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--samples", type=int, default=121)
    args = parser.parse_args()
    if args.samples < 21 or args.samples > 501:
        parser.error("--samples must be between 21 and 501")

    path = Path(args.model)
    scene = trimesh.load(path, force="scene", process=False)
    mesh = scene.dump(concatenate=True)
    if not isinstance(mesh, trimesh.Trimesh) or len(mesh.vertices) == 0:
        raise RuntimeError("Anny GLB did not produce a triangle mesh")
    bounds = mesh.bounds
    low, high = float(bounds[0, 2]), float(bounds[1, 2])
    height = high - low
    if not np.isfinite(height) or height <= 0:
        raise RuntimeError("Anny model has invalid vertical bounds")

    samples = []
    for fraction in np.linspace(0.08, 0.94, args.samples):
        z = low + float(fraction) * height
        section = mesh.section(plane_origin=[0.0, 0.0, z], plane_normal=[0.0, 0.0, 1.0])
        perimeter = largest_closed_perimeter(section)
        samples.append({
            "height_fraction": round(float(fraction), 5),
            "model_z": round(z, 7),
            "circumference_model_units": round(perimeter, 7) if perimeter is not None else None,
        })

    valid = [row for row in samples if row["circumference_model_units"] is not None]
    if len(valid) < 12:
        raise RuntimeError(f"Too few closed horizontal body sections: {len(valid)}")

    def candidate(start: float, end: float, maximize: bool):
        rows = [row for row in valid if start <= row["height_fraction"] <= end]
        if not rows:
            return None
        key = lambda row: row["circumference_model_units"]
        selected = (max if maximize else min)(rows, key=key)
        return {
            "height_fraction": selected["height_fraction"],
            "circumference_model_units": selected["circumference_model_units"],
            "selection": "heuristic profile extremum; requires anatomical validation",
        }

    report = {
        "model": "Anny neutral GLB",
        "units": "Anny model units; not centimetres",
        "bounds_z": [low, high],
        "height_model_units": height,
        "closed_section_samples": len(valid),
        "total_section_samples": len(samples),
        "heuristic_candidates": {
            "hip_peak": candidate(0.30, 0.58, True),
            "waist_minimum": candidate(0.48, 0.72, False),
            "bust_peak": candidate(0.64, 0.86, True),
        },
        "profile": samples,
        "calibration_status": "diagnostic only; no tape-measure fitting or centimetre scale is established",
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "profile"}, indent=2))

if __name__ == "__main__":
    main()
