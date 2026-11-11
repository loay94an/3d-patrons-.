import unittest
from generate_skirt import build_skirt_pattern


class PyGarmentSkirtTests(unittest.TestCase):
    def setUp(self):
        self.pattern = build_skirt_pattern(
            waist_cm=70, hip_cm=96, waist_to_hip_cm=20, length_cm=60)

    def test_front_and_back_panels(self):
        self.assertEqual(len(self.pattern["pieces"]), 2)
        self.assertEqual(self.pattern["pieces"][0]["id"], "pygarment_skirt_front")
        self.assertEqual(self.pattern["pieces"][1]["id"], "pygarment_skirt_back")

    def test_units_and_finished_measurements(self):
        self.assertEqual(self.pattern["units"], "cm")
        m = self.pattern["validation"]["measurements"]
        self.assertAlmostEqual(m["finishedWaistCm"], 72.0)
        self.assertAlmostEqual(m["finishedHipCm"], 100.0)

    def test_side_seams_match(self):
        m = self.pattern["validation"]["measurements"]
        self.assertLessEqual(m["sideSeamDifferenceCm"], 0.01)
        self.assertTrue(self.pattern["validation"]["valid"])

    def test_darts_grainlines_and_notches(self):
        for piece in self.pattern["pieces"]:
            self.assertEqual(len(piece["grainlines"]), 1)
            self.assertEqual(len(piece["notches"]), 2)
            darts = [s for s in piece["segments"] if "_dart_" in s["id"]]
            self.assertEqual(len(darts), 2)
            self.assertTrue(all(s["layer"] == "guideline" for s in darts))

    def test_invalid_measurements_rejected(self):
        with self.assertRaises(ValueError):
            build_skirt_pattern(waist_cm=70, hip_cm=60,
                waist_to_hip_cm=20, length_cm=60)


if __name__ == "__main__":
    unittest.main()
