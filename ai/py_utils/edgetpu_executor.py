"""Coral Edge TPU executor for INT8 YOLO TFLite models (*_full_integer_quant_edgetpu.tflite).

Presents the same run([img]) interface as the ONNX executor: takes a uint8 RGB
HxWx3 image and returns [array of shape (1, 4+nc, N)] with boxes in the input
image's pixel space (xywh centre format), as expected by detect.post_process.
"""
import cv2
import numpy as np

EDGETPU_LIB = 'libedgetpu.so.1'


def _load_interpreter(model_path, device):
    try:
        from tflite_runtime.interpreter import Interpreter, load_delegate
    except ImportError:
        from ai_edge_litert.interpreter import Interpreter, load_delegate
    opts = {'device': device} if device else {}
    return Interpreter(model_path=model_path,
                       experimental_delegates=[load_delegate(EDGETPU_LIB, opts)])


class EdgeTPU_model_container:
    def __init__(self, model_path, device=None):
        self.interp = _load_interpreter(model_path, device)
        self.interp.allocate_tensors()
        self.inp = self.interp.get_input_details()[0]
        self.out = self.interp.get_output_details()[0]
        _, self.h, self.w, _ = self.inp['shape']

    def run(self, input_datas):
        img = input_datas[0]
        src_h, src_w = img.shape[:2]
        if (src_w, src_h) != (self.w, self.h):
            img = cv2.resize(img, (self.w, self.h), interpolation=cv2.INTER_LINEAR)

        dtype = self.inp['dtype']
        if dtype == np.uint8 or dtype == np.int8:
            scale, zp = self.inp['quantization']
            x = img.astype(np.float32) / 255.0
            x = np.clip(np.round(x / scale + zp), np.iinfo(dtype).min, np.iinfo(dtype).max).astype(dtype)
        else:
            x = (img.astype(np.float32) / 255.0)
        self.interp.set_tensor(self.inp['index'], x[None])
        self.interp.invoke()

        out = self.interp.get_tensor(self.out['index']).astype(np.float32)
        if self.out['dtype'] in (np.uint8, np.int8):
            scale, zp = self.out['quantization']
            out = (out - zp) * scale

        # Normalise layout to (1, 4+nc, N)
        if out.shape[1] > out.shape[2]:
            out = out.transpose(0, 2, 1)
        # Ultralytics TFLite boxes are normalised 0..1; scale to source pixels
        if out[0, :4].max() <= 2.0:
            out[0, [0, 2]] *= src_w
            out[0, [1, 3]] *= src_h
        else:
            out[0, [0, 2]] *= src_w / self.w
            out[0, [1, 3]] *= src_h / self.h
        return [out]

    def release(self):
        self.interp = None
