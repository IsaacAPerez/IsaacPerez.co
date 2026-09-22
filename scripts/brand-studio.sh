#!/bin/sh
# Thin launcher; shared exporter/renderer remain owned by platform.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PLATFORM=${BRAND_STUDIO_PLATFORM_ROOT:-"$ROOT/../platform"}
PLATFORM_REVISION="f558b4c8091fe12d402f03c78d31189d2abdc79c"
ACTUAL_REVISION=$(git -C "$PLATFORM" rev-parse HEAD 2>/dev/null || true)
if [ "$ACTUAL_REVISION" != "$PLATFORM_REVISION" ]; then
  printf '%s\n' "Brand Studio requires platform $PLATFORM_REVISION. Set BRAND_STUDIO_PLATFORM_ROOT to that reviewed checkout." >&2
  exit 1
fi
ACTION=${1:-check}
if [ "$#" -gt 0 ]; then shift; fi
case "$ACTION" in
  export) exec node "$PLATFORM/tools/brand-studio/export.mjs" --root "$ROOT" ${BRAND_STUDIO_SOURCE_MAP:+--source-map "$BRAND_STUDIO_SOURCE_MAP"} "$@" ;;
  check) exec node "$PLATFORM/tools/brand-studio/export.mjs" --root "$ROOT" ${BRAND_STUDIO_SOURCE_MAP:+--source-map "$BRAND_STUDIO_SOURCE_MAP"} --check "$@" ;;
  serve) exec node "$PLATFORM/tools/brand-studio/serve.mjs" --root "$ROOT" ${BRAND_STUDIO_SOURCE_MAP:+--source-map "$BRAND_STUDIO_SOURCE_MAP"} "$@" ;;
  *) printf '%s\n' 'Usage: brand-studio.sh export|check|serve' >&2; exit 2 ;;
esac
