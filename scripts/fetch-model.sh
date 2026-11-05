#!/usr/bin/env bash
# Export YOLO11n to ONNX at ai/model/yolo11n.onnx (needs .venv with ultralytics).
# Usage: scripts/fetch-model.sh [model-name, default yolo11n]
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${1:-yolo11n}"
OUT="ai/model/${NAME}.onnx"
[ -f "$OUT" ] && { echo "$OUT exists"; exit 0; }
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q --upgrade pip
pip install -q "ultralytics" onnx
mkdir -p ai/model
TMP="$(mktemp -d)"
( cd "$TMP" && yolo export model="${NAME}.pt" format=onnx opset=12 )
mv "$TMP/${NAME}.onnx" "$OUT"
rm -rf "$TMP"
echo "Model written to $OUT"
