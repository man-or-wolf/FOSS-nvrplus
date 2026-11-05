# Roadmap

Effort: S (<1 day), M (days), L (week+).

## Pre-install (blocking)

| Priority | Title | Description | Effort |
|----------|-------|-------------|--------|
| HIGH | Verify build on target | Run `scripts/build.sh` and `scripts/preflight.sh` on the target host | S |
| HIGH | Coral Edge TPU bring-up | Install `libedgetpu1-std`, `pip install -e "./ai[coral]"`, run `scripts/export-edgetpu.sh`, verify `load_delegate` works on the host Python, then run a sample frame through `nvr-detect` (executor is untested on hardware) | M |
| HIGH | Real-camera smoke test | Stream, motion event, frame extraction, detection tags, disk cleanup threshold | S |
| HIGH | Auth and TLS | Set `NVR_USER`/`NVR_PASSWORD` and front with nginx TLS, or bind `HOST=127.0.0.1` | S |

## Improved Object Detection Accuracy

| Priority | Title | Description | Effort |
|----------|-------|-------------|--------|
| MED | Improve YOLO | Higher-resolution images for detection, latest YOLO (Edge TPU: weigh 320 vs 640 speed against accuracy) | M |
| MED | More samples | Grab more frames per movement and combine the tags | M |
| MED | Offer tuning | Priority and time of day to refine tags; accept/reject movements and auto-derive filters | L |

## Done

- Build/model/preflight scripts, example systemd unit (`scripts/`, `docs/`).
- Optional basic auth (`NVR_USER`/`NVR_PASSWORD`), `HOST` bind, credential redaction, configurable camera user.
- `FFMPEG_PATH` setting.
- Inference: Coral Edge TPU (`.tflite`) and ONNX CPU only; RKNN and PyTorch removed.
- Tests: ML restart, security, e2e movement pipeline (stub detector), Edge TPU executor (fake interpreter), class labels.
- ONNX output verified on CPU with a sample image.
- Fixed: stale settings snapshot blocking frames to the detector; class label whitespace.

## Notes

Coral Edge TPU setup: [ai/README.md](./ai/README.md#coral-edge-tpu).
