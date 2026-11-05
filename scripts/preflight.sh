#!/usr/bin/env bash
# Check host prerequisites. Usage: scripts/preflight.sh [video_dir, default /video]
VIDEO_DIR="${1:-/video}"
fail=0
ok()   { echo "  OK   $*"; }
bad()  { echo "  FAIL $*"; fail=1; }
warn() { echo "  WARN $*"; }

command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] \
  && ok "node $(node -v)" || bad "node >= 22 required"
[ -x /usr/bin/ffmpeg ] && ok "$(/usr/bin/ffmpeg -version | head -1)" || bad "/usr/bin/ffmpeg missing (path is hardcoded in server)"
command -v python3 >/dev/null && python3 -c 'import venv' 2>/dev/null \
  && ok "$(python3 -V) + venv" || bad "python3 with venv module required"

if [ -d "$VIDEO_DIR" ]; then
  mountpoint -q "$VIDEO_DIR" && ok "$VIDEO_DIR is a mount point" || warn "$VIDEO_DIR is not a separate mount (root disk may fill)"
  [ -w "$VIDEO_DIR" ] && ok "$VIDEO_DIR writable" || bad "$VIDEO_DIR not writable by ${USER:-$(id -un)}"
  df -h "$VIDEO_DIR" | tail -1 | awk '{print "       size "$2", avail "$4", used "$5}'
else
  bad "$VIDEO_DIR does not exist"
fi

[ -f ai/model/yolo11n.onnx ] && ok "ai/model/yolo11n.onnx" || warn "model missing: run scripts/fetch-model.sh"
[ -d lib/server ] && ok "server built (lib/server)" || warn "not built: run scripts/build.sh"
[ -f dist/index.html ] || [ -f build/index.html ] || warn "frontend build output not found"
loginctl show-user "${USER:-$(id -un)}" -p Linger 2>/dev/null | grep -q yes \
  && ok "linger enabled" || warn "linger off: sudo loginctl enable-linger ${USER:-$(id -un)}"
[ -n "$NVR_USER" ] && [ -n "$NVR_PASSWORD" ] && ok "web auth enabled" \
  || warn "NVR_USER/NVR_PASSWORD unset: UI/API unauthenticated (use nginx or set them)"
exit $fail
