
# Object Detection App

This app can be lauched by the server to analyse objects from the images the cameras are streaming


## Install the Model


The `detector` app can be launched by the server to analyze objects from the images the cameras are streaming, this app needs a model, 


The Yolo11 models are what we are going to base this on 
https://docs.ultralytics.com/tasks/detect/



### (opt a) Installs 'yolo' CLI
```
python3 -m pip install ultralytics
```
https://docs.ultralytics.com/integrations/onnx/#exporting-yolo11-models-to-onnx

```
yolo export model=yolo11n.pt format=onnx imgsz=1280
```


Lets test it

```
yolo predict model=yolo11n.onnx source=./image150519558.jpg
```

## Run to develop
```shell

# Upgrade pip to ensure it supports pyproject.toml only projects
python3 -m pip install --upgrade pip


cd ai

# install package in, reads pyproject.toml to get metadata and dependencies (doesnt create a virtual environment)
python3 -m pip install  .

python3 -m detector.detect --model_path ./yolo11n.onnx
```


## Build wheel to execute (we don't need this!!)
```bash
cd ai

#  We just require 'build', the rest will be installed in the venv
python3 -m pip install build 

#  This creates its own virtual environment! and creates the whl
python3 -m build

# Install the wheel, this will create the ~/.local/bin/nvr-detect script
python3 -m pip  install dist/open_source_nvr_detector-0.1.0-py3-none-any.whl

```

```bash
nvr-detect --model_path ./model/yolo11n_edgetpu.tflite
# or
nvr-detect --model_path ./model/yolo11n.onnx 
```


## Coral Edge TPU

1. Host: install the Edge TPU runtime (`libedgetpu1-std`, https://coral.ai/docs/accelerator/get-started/) and ensure the user can access the device (udev rules from that package; USB: `plugdev` group).
2. Python: `pip install -e "./ai[coral]"` (`tflite-runtime` on Python < 3.12, `ai-edge-litert` otherwise; Coral wheels on newer Pythons are the main compatibility risk, so test with `python -c "from tflite_runtime.interpreter import load_delegate; load_delegate('libedgetpu.so.1')"`).
3. Model: on an x86-64 Linux box with `edgetpu_compiler`, run `scripts/export-edgetpu.sh [imgsz]` (default 320; 640 leaves more ops on the CPU and is slower). Copy `ai/model/yolo11n_edgetpu.tflite` to the NVR host.
4. Settings: set the detection model to `ai/model/yolo11n_edgetpu.tflite`. Frames arrive at 640x640 and are resized to the model input; boxes are mapped back.

INT8 quantisation lowers accuracy versus the ONNX model; compare tags on real footage. Check the compiler log for ops left on the CPU.
