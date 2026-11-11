import numpy as np
import torch


class Torch_model_container_py:
    def __init__(self, model_path) -> None:
        from ultralytics import YOLO
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.yolo = YOLO(model_path)
        self.model = self.yolo.model.to(self.device).eval()
        self.model_path = model_path

    def run(self, input_datas):
        if self.model is None:
            print("ERROR: model has been released")
            return []

        input_tensor = torch.from_numpy(input_datas[0]).to(self.device)
        with torch.no_grad():
            output = self.model(input_tensor)
        # DetectionModel forward returns the raw head tensor directly in eval
        # mode, or (preds, raw_features) in some export-adjacent paths --
        # take element 0 either way to match the ONNX export's output shape.
        if isinstance(output, (tuple, list)):
            output = output[0]
        return [output.detach().cpu().numpy()]

    def release(self):
        self.model = None
        self.yolo = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def Torch_model_container(model_path):
    return Torch_model_container_py(model_path)
