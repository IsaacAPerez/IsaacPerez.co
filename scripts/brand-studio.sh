#!/bin/sh
# Thin launcher; shared exporter/renderer remain owned by platform.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PLATFORM=${BRAND_STUDIO_PLATFORM_ROOT:-"$ROOT/../platform"}
PLATFORM_REVISION="f558b4c8091fe12d402f03c78d31189d2abdc79c"
# HEAD may advance or be squash-merged; the reviewed tooling bytes must match.
if ! git -C "$PLATFORM" cat-file -e "${PLATFORM_REVISION}^{commit}" 2>/dev/null ||
   ! git -C "$PLATFORM" diff --quiet "$PLATFORM_REVISION" -- Package.swift packages/brand-studio tools/brand-studio; then
  printf '%s\n' "Brand Studio requires the tooling contents from platform $PLATFORM_REVISION. Set BRAND_STUDIO_PLATFORM_ROOT to a matching reviewed checkout." >&2
  exit 1
fi
UNTRACKED_TOOLING=$(git -C "$PLATFORM" ls-files --others --exclude-standard -- Package.swift packages/brand-studio tools/brand-studio)
if [ -n "$UNTRACKED_TOOLING" ]; then
  printf '%s\n' 'Brand Studio refuses untracked files in the reviewed tooling paths.' >&2
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
