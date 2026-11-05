#!/usr/bin/env bash
# Export YOLO11n for Coral Edge TPU -> ai/model/yolo11n_edgetpu.tflite
# Run on x86-64 Linux (edgetpu_compiler is x86-64 only). Usage: scripts/export-edgetpu.sh [imgsz, default 320]
set -euo pipefail
cd "$(dirname "$0")/.."
IMGSZ="${1:-320}"
command -v edgetpu_compiler >/dev/null || { echo "edgetpu_compiler missing: https://coral.ai/docs/edgetpu/compiler/"; exit 1; }
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q --upgrade pip ultralytics
mkdir -p ai/model
TMP="$(mktemp -d)"
( cd "$TMP" && yolo export model=yolo11n.pt format=edgetpu imgsz="$IMGSZ" )
OUT="$(find "$TMP" -name '*_full_integer_quant_edgetpu.tflite' | head -1)"
[ -n "$OUT" ] || { echo "export produced no edgetpu model in $TMP"; exit 1; }
mv "$OUT" ai/model/yolo11n_edgetpu.tflite
echo "Wrote ai/model/yolo11n_edgetpu.tflite (check the compiler log for ops left on CPU)"
