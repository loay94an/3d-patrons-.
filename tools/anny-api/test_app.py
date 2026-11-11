import unittest

from app import normalize_phenotypes


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


if __name__ == "__main__":
    unittest.main()
