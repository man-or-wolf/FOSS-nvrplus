# FOSS-nvrplus notes

Koa/TypeScript NVR (`server/`), React UI (`src/`), Python detector (`ai/`). Status and open work: `ROADMAP.md`.

## Commands
- Build: `scripts/build.sh` (npm ci, tsc, vite, venv, model fetch). Output: `lib/server/index.js`, `build/`.
- Run: `PATH="$PWD/.venv/bin:$PATH" node lib/server/index.js`. Env: `PORT`, `HOST`, `NVR_USER`, `NVR_PASSWORD`, `FFMPEG_PATH`, `LOG_LEVEL`, `DBPATH`.
- Tests: `npx vitest run` (needs ffmpeg + python3 for e2e); Python: `cd ai && python3 -m unittest discover tests`.
- Preflight: `scripts/preflight.sh /video`.

## Decisions
- Inference: Coral Edge TPU (`.tflite`, `scripts/export-edgetpu.sh`) and ONNX CPU only. RKNN/PyTorch removed on purpose.
- No Prometheus monitoring work wanted (metrics endpoint exists, no scrape docs).
- Auth is optional basic auth; TLS via nginx (see README).

## Gotchas
- Detector gets 640x640 letterboxed frames; `post_process` expects (1, 84, N) pixel-space output.
- Edge TPU executor is untested on hardware.
- Module-level state in `process-utils.ts` must use getters, not snapshots of mutable settings.
