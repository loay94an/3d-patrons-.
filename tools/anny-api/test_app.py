import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from app import (
    GenerationBusyError,
    _analyze_generated_profile,
    normalize_phenotypes,
    run_with_generation_slot,
)


class PhenotypeValidationTests(unittest.TestCase):
    def test_normalizes_integer_and_float_values(self):
        self.assertEqual(
            normalize_phenotypes({"shape_a": 1, "shape_b": 0.25}),
            {"shape_a": 1.0, "shape_b": 0.25},
        )

    def test_rejects_values_outside_documented_range(self):
        for value in (-0.01, 1.01):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_phenotypes({"shape": value})

    def test_rejects_booleans_and_non_numeric_values(self):
        for value in (True, "0.5", None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_phenotypes({"shape": value})

    def test_rejects_too_many_parameters(self):
        with self.assertRaises(ValueError):
            normalize_phenotypes({f"p{i}": 0.5 for i in range(41)})

    def test_rejects_empty_or_excessively_long_labels(self):
        for label in ("", "x" * 121):
            with self.subTest(label=label), self.assertRaises(ValueError):
                normalize_phenotypes({label: 0.5})



class ProfileAnalysisTests(unittest.TestCase):
    def test_returns_the_generated_profile_report_and_cleans_temporary_files(self):
        with tempfile.TemporaryDirectory() as parent:
            workdir = Path(parent) / "anny-job"
            workdir.mkdir()
            glb_path = workdir / "body.glb"
            glb_path.write_bytes(b"glb")
            expected = {
                "height_model_units": 1.7,
                "heuristic_candidates": {"hip_peak": None},
                "profile": [],
            }

            def fake_analyzer(command, **_kwargs):
                report_path = Path(command[command.index("--output") + 1])
                report_path.write_text(json.dumps(expected), encoding="utf-8")

            with patch("app._generate_glb_file", return_value=str(glb_path)), patch(
                "app.subprocess.run", side_effect=fake_analyzer
            ):
                result = _analyze_generated_profile({"shape": 0.6})

            self.assertEqual(result, expected)
            self.assertFalse(workdir.exists())


class GenerationCapacityTests(unittest.TestCase):
    def test_releases_slot_after_success(self):
        slots = threading.BoundedSemaphore(1)
        result = run_with_generation_slot(lambda values: values["shape"], {"shape": 0.4}, slots=slots)
        self.assertEqual(result, 0.4)
        self.assertTrue(slots.acquire(blocking=False))
        slots.release()

    def test_rejects_when_capacity_is_full(self):
        slots = threading.BoundedSemaphore(1)
        slots.acquire()
        called = []
        with self.assertRaises(GenerationBusyError):
            run_with_generation_slot(lambda values: called.append(values), {}, slots=slots)
        self.assertEqual(called, [])
        slots.release()

    def test_releases_slot_when_generator_fails(self):
        slots = threading.BoundedSemaphore(1)
        def fail(_values):
            raise RuntimeError("failed")
        with self.assertRaises(RuntimeError):
            run_with_generation_slot(fail, {}, slots=slots)
        self.assertTrue(slots.acquire(blocking=False))
        slots.release()


if __name__ == "__main__":
    unittest.main()
