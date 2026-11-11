#!/usr/bin/env python3
"""Measure Anny's neutral-pose horizontal sections for calibration research.

Distances remain in native Anny model units. Landmark bands are heuristic;
this report is diagnostic and is not a tape-measure calibration.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import trimesh


def contour_metrics(points: np.ndarray) -> dict | None:
    """Return planar polygon metrics for one closed horizontal contour."""
    points = np.asarray(points, dtype=float)
    if len(points) < 4 or not np.allclose(points[0], points[-1], atol=1e-5):
        return None

    # Anny's vertical axis is Z; horizontal section coordinates are X/Y.
    polygon = points[:, :2]
    edges = np.diff(polygon, axis=0)
    perimeter = float(np.linalg.norm(edges, axis=1).sum())
    if not np.isfinite(perimeter) or perimeter <= 0:
        return None

    x, y = polygon[:, 0], polygon[:, 1]
    cross = x[:-1] * y[1:] - x[1:] * y[:-1]
    signed_area = float(cross.sum() / 2.0)
    area = abs(signed_area)
    if not np.isfinite(area) or area <= 1e-12:
        return None

    centroid_x = float(((x[:-1] + x[1:]) * cross).sum() / (6.0 * signed_area))
    centroid_y = float(((y[:-1] + y[1:]) * cross).sum() / (6.0 * signed_area))
    min_x, min_y = polygon[:-1].min(axis=0)
    max_x, max_y = polygon[:-1].max(axis=0)
    compactness = float(4.0 * np.pi * area / (perimeter * perimeter))

    return {
        "perimeter_model_units": perimeter,
        "area_model_units_squared": area,
        "centroid_xy": [centroid_x, centroid_y],
        "bounds_xy": [float(min_x), float(min_y), float(max_x), float(max_y)],
        "width_depth_ratio": float((max_x - min_x) / max(max_y - min_y, 1e-12)),
        "compactness": compactness,
    }


def closed_contours(section) -> list[dict]:
    if section is None:
        return []
    contours = []
    for points in section.discrete:
        metrics = contour_metrics(points)
        if metrics is not None:
            contours.append(metrics)
    return sorted(contours, key=lambda item: item["perimeter_model_units"], reverse=True)


def summarize_section(contours: list[dict], center_xy: np.ndarray, body_span_xy: np.ndarray) -> dict:
    if not contours:
        return {
            "contour_count": 0,
            "circumference_model_units": None,
            "selected_contour": None,
            "diagnostics": ["no_closed_contour"],
            "confidence": 0.0,
        }

    # Keep the largest contour as a reproducible baseline, but expose all
    # competing contours and geometry warnings instead of hiding ambiguity.
    selected = contours[0]
    center_offset = float(np.linalg.norm(np.asarray(selected["centroid_xy"]) - center_xy))
    normalized_offset = center_offset / max(float(np.linalg.norm(body_span_xy)), 1e-12)
    diagnostics = []
    if len(contours) > 1:
        diagnostics.append("multiple_closed_contours_possible_limbs_or_disconnected_parts")
    if normalized_offset > 0.12:
        diagnostics.append("selected_contour_centroid_off_body_center")
    if selected["compactness"] < 0.35:
        diagnostics.append("low_compactness_possible_concavity_or_limb_inclusion")
    if selected["width_depth_ratio"] > 2.8 or selected["width_depth_ratio"] < 0.35:
        diagnostics.append("unusual_section_aspect_ratio")

    confidence = 0.55
    if diagnostics:
        confidence = max(0.15, confidence - 0.12 * len(diagnostics))
    return {
        "contour_count": len(contours),
        "circumference_model_units": selected["perimeter_model_units"],
        "selected_contour": selected,
        "center_offset_model_units": center_offset,
        "normalized_center_offset": normalized_offset,
        "diagnostics": diagnostics,
        "confidence": round(confidence, 2),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--samples", type=int, default=121)
    args = parser.parse_args()
    if args.samples < 21 or args.samples > 501:
        parser.error("--samples must be between 21 and 501")

    scene = trimesh.load(Path(args.model), force="scene", process=False)
    mesh = scene.to_geometry()
    if not isinstance(mesh, trimesh.Trimesh) or len(mesh.vertices) == 0:
        raise RuntimeError("Anny GLB did not produce a triangle mesh")
    bounds = mesh.bounds
    low, high = float(bounds[0, 2]), float(bounds[1, 2])
    height = high - low
    if not np.isfinite(height) or height <= 0:
        raise RuntimeError("Anny model has invalid vertical bounds")

    center_xy = (bounds[0, :2] + bounds[1, :2]) / 2.0
    body_span_xy = bounds[1, :2] - bounds[0, :2]
    samples = []
    for fraction in np.linspace(0.08, 0.94, args.samples):
        z = low + float(fraction) * height
        section = mesh.section(
            plane_origin=[0.0, 0.0, z],
            plane_normal=[0.0, 0.0, 1.0],
        )
        contours = closed_contours(section)
        summary = summarize_section(contours, center_xy, body_span_xy)
        samples.append({
            "height_fraction": round(float(fraction), 5),
            "height_cm_at_168cm": round(float(fraction) * 168.0, 2),
            "model_z": round(z, 7),
            **summary,
            "contours": contours,
        })

    valid = [row for row in samples if row["circumference_model_units"] is not None]
    if len(valid) < 12:
        raise RuntimeError(f"Too few closed horizontal body sections: {len(valid)}")

    def candidate(start: float, end: float, maximize: bool, label: str):
        rows = [row for row in valid if start <= row["height_fraction"] <= end]
        if not rows:
            return None
        selected = (max if maximize else min)(
            rows, key=lambda row: row["circumference_model_units"]
        )
        return {
            "height_fraction": selected["height_fraction"],
            "height_cm_at_168cm": selected["height_cm_at_168cm"],
            "circumference_model_units": selected["circumference_model_units"],
            "contour_count": selected["contour_count"],
            "confidence": selected["confidence"],
            "diagnostics": selected["diagnostics"],
            "selection": f"{label} profile extremum; requires anatomical validation",
        }

    report = {
        "model": "Anny neutral GLB",
        "units": "Anny model units; not centimetres",
        "bounds_z": [low, high],
        "height_model_units": height,
        "closed_section_samples": len(valid),
        "total_section_samples": len(samples),
        "section_diagnostics": {
            "sections_with_multiple_contours": sum(row["contour_count"] > 1 for row in valid),
            "sections_with_warnings": sum(bool(row["diagnostics"]) for row in valid),
            "mean_heuristic_confidence": round(float(np.mean([row["confidence"] for row in valid])), 3),
            "confidence_note": "heuristic geometry warning score, not a validated probability",
        },
        "heuristic_candidates": {
            "hip_peak": candidate(0.30, 0.58, True, "hip"),
            "waist_minimum": candidate(0.48, 0.72, False, "waist"),
            "bust_peak": candidate(0.64, 0.86, True, "bust"),
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
