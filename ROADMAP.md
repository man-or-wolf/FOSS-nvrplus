# Roadmap

Effort: S (<1 day), M (days), L (week+).

## Pre-install (blocking)

| Priority | Title | Description | Effort |
|----------|-------|-------------|--------|
| HIGH | `edgetpu_compiler` unavailable | Google's `coral-edgetpu-stable` apt repo 404s on Release (looks discontinued); no YOLO11 `.tflite` can be exported via `scripts/export-edgetpu.sh` until a compiler source is found (cached `.deb`, build from source, or an already-compiled model) | M |
| HIGH | Real-camera smoke test | Stream, motion event, frame extraction, detection tags, disk cleanup threshold | S |
| HIGH | Non-Reolink camera motion detection | `detectCameraMovement()` still hard-parses Reolink's `GetMdState` JSON shape (`body[0].value.state`); `streamSource`/`motionUrl` are overridable but the parser isn't - cameras with a different motion API (e.g. Hikvision ISAPI) need either a parser adapter or local frame-diff motion detection | M |
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
- Coral Edge TPU bring-up verified on hardware (`libedgetpu.so.1` + gasket/apex kernel driver present): `EdgeTPU_model_container.run()` drives the real chip - confirmed via `/sys/class/apex/apex_0/interrupt_counts` incrementing 1:1 with invocations, 9ms median latency. Done with an already-compiled SSD model as a stand-in (wrong output shape for this repo's YOLO `post_process`, so only proves the executor/hardware path, not the full detection pipeline) because `edgetpu_compiler` isn't installable right now - see blocked item above.

## Notes

Coral Edge TPU setup: [ai/README.md](./ai/README.md#coral-edge-tpu).
