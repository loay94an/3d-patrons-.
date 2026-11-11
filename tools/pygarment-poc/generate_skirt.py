#!/usr/bin/env python3
"""Generate a two-panel parametric skirt block with PyGarment."""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
from typing import Any
import pygarment as pyg


def build_skirt_pattern(*, waist_cm: float, hip_cm: float,
    waist_to_hip_cm: float, length_cm: float, waist_ease_cm: float = 2.0,
    hip_ease_cm: float = 4.0, dart_intake_cm: float = 2.5,
    dart_length_cm: float = 12.0, seam_allowance_cm: float = 1.0,
    hem_allowance_cm: float = 3.0, center_back_allowance_cm: float = 1.0
) -> dict[str, Any]:
    """All dimensions are centimetres. This is a geometry adapter POC."""
    positive = {"waist_cm": waist_cm, "hip_cm": hip_cm,
        "waist_to_hip_cm": waist_to_hip_cm, "length_cm": length_cm,
        "dart_length_cm": dart_length_cm}
    for name, value in positive.items():
        if not math.isfinite(value) or value <= 0:
            raise ValueError(f"{name} must be finite and positive")
    nonnegative = {"waist_ease_cm": waist_ease_cm, "hip_ease_cm": hip_ease_cm,
        "dart_intake_cm": dart_intake_cm, "seam_allowance_cm": seam_allowance_cm,
        "hem_allowance_cm": hem_allowance_cm,
        "center_back_allowance_cm": center_back_allowance_cm}
    for name, value in nonnegative.items():
        if not math.isfinite(value) or value < 0:
            raise ValueError(f"{name} must be finite and non-negative")

    qwaist = (waist_cm + waist_ease_cm) / 4
    qhip = (hip_cm + hip_ease_cm) / 4
    top_width = qwaist + dart_intake_cm
    if qhip <= qwaist:
        raise ValueError("hip quarter with ease must exceed waist quarter with ease")
    if waist_to_hip_cm >= length_cm or dart_length_cm >= length_cm:
        raise ValueError("waist-to-hip depth and dart length must be shorter than skirt length")

    outline = [[0.0, 0.0], [top_width, 0.0], [qhip, waist_to_hip_cm],
               [qhip, length_cm], [0.0, length_cm]]

    def make_panel(name: str) -> pyg.Panel:
        panel = pyg.Panel(name)
        # PyGarment v2.0.2 takes each vertex as a positional argument;
        # loop=True closes the chain and preserves shared endpoint references.
        panel.edges = pyg.EdgeSeqFactory.from_verts(*outline, loop=True)
        if panel.is_self_intersecting():
            raise ValueError(f"Self-intersecting PyGarment panel: {name}")
        return panel

    front, back = make_panel("skirt_front"), make_panel("skirt_back")

    def to_cad_piece(panel: pyg.Panel, piece_id: str, name: str,
                     name_ar: str, x_offset: float, is_front: bool) -> dict[str, Any]:
        edge_types = ["waist", "side", "side", "hem", "center"]
        labels = ["خط الخصر قبل إغلاق البنسة", "الجنب من الخصر إلى الورك",
            "الجنب من الورك إلى الذيل", "خط الذيل",
            "منتصف الأمام على الثنية" if is_front else "منتصف الخلف للخياطة والسحاب"]
        segments = []
        for i, edge in enumerate(panel.edges):
            p1 = {"x": round(float(edge.start[0]) + x_offset, 4),
                  "y": round(float(edge.start[1]), 4)}
            p2 = {"x": round(float(edge.end[0]) + x_offset, 4),
                  "y": round(float(edge.end[1]), 4)}
            segments.append({"id": f"{piece_id}_edge_{i+1}", "type": "line",
                "p1": p1, "p2": p2, "layer": "cutting",
                "edgeType": edge_types[i], "label": labels[i],
                "lengthCm": round(float(edge.length()), 4)})

        dart_x = top_width * (0.48 if is_front else 0.56)
        apex = {"x": round(x_offset + dart_x, 4), "y": round(dart_length_cm, 4)}
        for side, base_x in (("left", dart_x - dart_intake_cm / 2),
                             ("right", dart_x + dart_intake_cm / 2)):
            start = {"x": round(x_offset + base_x, 4), "y": 0.0}
            segments.append({"id": f"{piece_id}_dart_{side}", "type": "line",
                "p1": start, "p2": apex, "layer": "guideline",
                "edgeType": "waist", "label": "رجل بنسة تُغلق عند الخياطة",
                "lengthCm": round(math.hypot(apex["x"]-start["x"], dart_length_cm), 4)})

        side_waist = {"x": round(x_offset + top_width, 4), "y": 0.0}
        side_hip = {"x": round(x_offset + qhip, 4), "y": round(waist_to_hip_cm, 4)}
        return {
            "id": piece_id, "name": name, "nameAr": name_ar, "garmentType": "skirt",
            "segments": segments,
            "notches": [
                {"id": f"{piece_id}_waist_notch", "point": side_waist,
                 "angleDeg": 90, "type": "v_notch", "depthCm": 0.5,
                 "label": "علامة الجنب عند الخصر"},
                {"id": f"{piece_id}_hip_notch", "point": side_hip,
                 "angleDeg": 180, "type": "v_notch", "depthCm": 0.5,
                 "label": "علامة خط الورك"}],
            "grainlines": [{"id": f"{piece_id}_grainline",
                "p1": {"x": round(x_offset + qhip/2, 4), "y": round(waist_to_hip_cm+5, 4)},
                "p2": {"x": round(x_offset + qhip/2, 4), "y": round(length_cm-5, 4)},
                "label": "اتجاه النسيج الطولي"}],
            "seamAllowanceCm": seam_allowance_cm,
            "edgeSeamAllowances": {"waist": seam_allowance_cm, "side": seam_allowance_cm,
                "hem": hem_allowance_cm,
                "center": 0.0 if is_front else center_back_allowance_cm},
            "isMirrored": False, "mirrorSynced": False,
            "notes": ("نصف الأمام؛ يوضع خط المنتصف على ثنية القماش. تُغلق البنسة عند الخياطة."
                if is_front else "نصف الخلف؛ يقص قطعتين مع خياطة منتصف الخلف وإمكانية تركيب سحاب.")
        }

    gap = 12.0
    pieces = [
        to_cad_piece(front, "pygarment_skirt_front", "PyGarment Skirt Front",
                     "تنورة — الأمام على الثنية", 0.0, True),
        to_cad_piece(back, "pygarment_skirt_back", "PyGarment Skirt Back",
                     "تنورة — الخلف", qhip + gap, False)]
    front_side = float(front.edges[1].length() + front.edges[2].length())
    back_side = float(back.edges[1].length() + back.edges[2].length())
    side_diff = abs(front_side - back_side)
    finished_waist, finished_hip = 4*(top_width-dart_intake_cm), 4*qhip
    errors = []
    if side_diff > 0.01: errors.append("Front/back side seams do not match")
    if abs(finished_waist-(waist_cm+waist_ease_cm)) > 0.01: errors.append("Finished waist mismatch")
    if abs(finished_hip-(hip_cm+hip_ease_cm)) > 0.01: errors.append("Finished hip mismatch")
    return {
        "schemaVersion": "1.0.0", "units": "cm",
        "engine": {"name": "PyGarment", "version": "2.0.2"},
        "garmentType": "skirt", "patternName": "Parametric straight skirt — PyGarment POC",
        "input": {"waistCm": waist_cm, "hipCm": hip_cm,
            "waistToHipCm": waist_to_hip_cm, "lengthCm": length_cm,
            "waistEaseCm": waist_ease_cm, "hipEaseCm": hip_ease_cm,
            "dartIntakeCm": dart_intake_cm, "dartLengthCm": dart_length_cm,
            "seamAllowanceCm": seam_allowance_cm, "hemAllowanceCm": hem_allowance_cm,
            "centerBackAllowanceCm": center_back_allowance_cm},
        "pieces": pieces,
        "validation": {"valid": not errors, "errors": errors,
            "warnings": ["Prototype only; not a production-validated block.",
                "Front and back dart intakes are equal in this first adapter.",
                "Side contours are straight; seam allowance is metadata only.",
                "Toile fitting and expert pattern review are required before production."],
            "measurements": {"finishedWaistCm": round(finished_waist, 4),
                "finishedHipCm": round(finished_hip, 4),
                "frontSideSeamCm": round(front_side, 4),
                "backSideSeamCm": round(back_side, 4),
                "sideSeamDifferenceCm": round(side_diff, 4)}},
        "provenance": {"generator": "tools/pygarment-poc/generate_skirt.py",
            "source": "PyGarment Panel and EdgeSeqFactory",
            "note": "Platform adapter JSON; not PyGarment native assembly."}
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    for arg, default, help_text in [
        ("waist", 70.0, "Body waist in cm"), ("hip", 96.0, "Body hip in cm"),
        ("waist-to-hip", 20.0, "Waist-to-hip depth in cm"),
        ("length", 60.0, "Skirt length in cm"), ("waist-ease", 2.0, "Waist ease in cm"),
        ("hip-ease", 4.0, "Hip ease in cm"), ("dart-intake", 2.5, "Equal front/back dart intake in cm"),
        ("dart-length", 12.0, "Dart length in cm"), ("seam-allowance", 1.0, "Seam allowance in cm"),
        ("hem-allowance", 3.0, "Hem allowance in cm"),
        ("center-back-allowance", 1.0, "Center-back allowance in cm")]:
        parser.add_argument("--"+arg, type=float, default=default, help=help_text)
    parser.add_argument("--output", type=Path, default=Path("pygarment-skirt.json"))
    a = parser.parse_args()
    result = build_skirt_pattern(waist_cm=a.waist, hip_cm=a.hip,
        waist_to_hip_cm=a.waist_to_hip, length_cm=a.length,
        waist_ease_cm=a.waist_ease, hip_ease_cm=a.hip_ease,
        dart_intake_cm=a.dart_intake, dart_length_cm=a.dart_length,
        seam_allowance_cm=a.seam_allowance, hem_allowance_cm=a.hem_allowance,
        center_back_allowance_cm=a.center_back_allowance)
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"output": str(a.output), "pieces": len(result["pieces"]),
        "valid": result["validation"]["valid"],
        "measurements": result["validation"]["measurements"]}, ensure_ascii=False, indent=2))
    if not result["validation"]["valid"]: raise SystemExit(2)


if __name__ == "__main__":
    main()
