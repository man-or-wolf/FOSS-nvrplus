# Roadmap

Effort: S (<1 day), M (days), L (week+).

## Pre-install (blocking)

| Priority | Title | Description | Effort |
|----------|-------|-------------|--------|
| HIGH | Verify build on target | Run `scripts/build.sh` and `scripts/preflight.sh`; fix the frontend output check if it warns | S |
| HIGH | Verify ONNX model output | Confirm `detect.py` parses a stock Ultralytics `yolo11n.onnx` export (sample frame via `nvr-detect`) | S |
| HIGH | Real-camera smoke test | Stream, motion event, frame extraction, detection tags, disk cleanup threshold | S |
| HIGH | Auth and TLS | Set `NVR_USER`/`NVR_PASSWORD` and front with nginx TLS, or bind `HOST=127.0.0.1` | S |
| MED | Configurable ffmpeg path | `/usr/bin/ffmpeg` is hardcoded in `server/processor.ts`; add `FFMPEG_PATH` | S |

## Quality

| Priority | Title | Description | Effort |
|----------|-------|-------------|--------|
| MED | End-to-end tests | ffmpeg launch, simulated movement, frame extraction, movement completion; replace the CRA `src/App.test.js` leftover | M |
| MED | Prometheus scrape example | Sample config with `basic_auth` for `/metrics` | S |
| LOW | Housekeeping | Fix `.github/prompts` refs to the missing `docs/required-server-program-structure.md`; `pyproject.toml` placeholder author/URLs; README typos | S |

## Improved Object Detection Accuracy

| Priority | Title | Description | Effort |
|----------|-------|-------------|--------|
| MED | Improve YOLO | Higher-resolution images for detection, latest YOLO | M |
| MED | More samples | Grab more frames per movement and combine the tags | M |
| MED | Offer tuning | Priority and time of day to refine tags; accept/reject movements and auto-derive filters | L |

## Notes

RKNN (Rockchip NPU) model conversion steps are in [ai/README.md](./ai/README.md#rknn-rockchip-npu-conversion).
