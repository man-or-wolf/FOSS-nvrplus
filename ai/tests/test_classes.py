"""Class labels must be clean so tag filters match. Run from ./ai: python3 -m unittest discover tests"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class ClassesTest(unittest.TestCase):
    def test_labels_have_no_stray_whitespace(self):
        from detector.detect import CLASSES
        self.assertEqual(len(CLASSES), 80)
        for c in CLASSES:
            self.assertEqual(c, c.strip())
        self.assertIn('bus', CLASSES)


if __name__ == '__main__':
    unittest.main()
