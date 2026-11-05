"""Unit tests for the Edge TPU executor using a fake interpreter (no hardware).

Run from ./ai:  python3 -m unittest discover tests
"""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from py_utils import edgetpu_executor as ex  # noqa: E402


class FakeInterpreter:
    def __init__(self, out, out_dtype=np.int8, out_q=(0.01, 0), in_dtype=np.uint8, size=320):
        self._out, self._out_dtype, self._out_q = out, out_dtype, out_q
        self._in = {'shape': [1, size, size, 3], 'dtype': in_dtype, 'quantization': (1 / 255, 0), 'index': 0}
        self.last_input = None

    def allocate_tensors(self): pass
    def get_input_details(self): return [self._in]
    def get_output_details(self): return [{'dtype': self._out_dtype, 'quantization': self._out_q, 'index': 1}]
    def set_tensor(self, _i, x): self.last_input = x
    def invoke(self): pass
    def get_tensor(self, _i): return self._out


def make(out, **kw):
    fake = FakeInterpreter(out, **kw)
    ex._load_interpreter = lambda *a, **k: fake
    return ex.EdgeTPU_model_container('model.tflite'), fake


class EdgeTPUExecutorTest(unittest.TestCase):
    def test_transposes_dequantizes_and_scales_normalised_boxes(self):
        out = np.zeros((1, 2100, 84), np.int8)          # (1, N, 84) layout
        out[0, 0, :4] = [50, 50, 20, 20]                # 0.5, 0.5, 0.2, 0.2 normalised
        out[0, 0, 4] = 90                               # class 0 score 0.9
        m, fake = make(out)
        res = m.run([np.zeros((640, 640, 3), np.uint8)])[0]
        self.assertEqual(res.shape, (1, 84, 2100))
        np.testing.assert_allclose(res[0, :4, 0], [320, 320, 128, 128], rtol=1e-3)
        self.assertAlmostEqual(float(res[0, 4, 0]), 0.9, places=5)
        self.assertEqual(fake.last_input.shape, (1, 320, 320, 3))

    def test_pixel_space_boxes_rescaled_to_source(self):
        out = np.zeros((1, 84, 2100), np.float32)       # already (1, 84, N), model pixels
        out[0, :4, 0] = [160, 160, 64, 64]              # in 320px model space
        m, _ = make(out, out_dtype=np.float32)
        res = m.run([np.zeros((640, 640, 3), np.uint8)])[0]
        np.testing.assert_allclose(res[0, :4, 0], [320, 320, 128, 128])

    def test_input_quantisation(self):
        out = np.zeros((1, 84, 2100), np.float32)
        m, fake = make(out, out_dtype=np.float32)
        m.run([np.full((320, 320, 3), 255, np.uint8)])
        self.assertEqual(fake.last_input.dtype, np.uint8)
        self.assertTrue((fake.last_input == 255).all())

    def test_non_square_source_scales_each_axis(self):
        out = np.zeros((1, 84, 2100), np.float32)
        out[0, :4, 0] = [0.5, 0.5, 0.5, 0.5]
        m, _ = make(out, out_dtype=np.float32)
        res = m.run([np.zeros((360, 640, 3), np.uint8)])[0]
        np.testing.assert_allclose(res[0, :4, 0], [320, 180, 320, 180])


if __name__ == '__main__':
    unittest.main()
