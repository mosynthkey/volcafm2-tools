#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
dexed_msfa="${DEXED_MSFA:-$root/third_party/dexed/Source/msfa}"
if [ ! -d "$dexed_msfa" ]; then
  echo "Dexed msfa sources not found at $dexed_msfa" >&2
  echo "Run: git submodule update --init third_party/dexed" >&2
  echo "Or set DEXED_MSFA to Source/msfa inside a Dexed checkout." >&2
  exit 1
fi

if ! command -v emcc >/dev/null 2>&1; then
  echo "emcc not found. Install Emscripten and ensure emcc is on PATH." >&2
  exit 1
fi

out_dir="$root/public"
js_out="$root/src/wasm/dexedPreview.mjs"
mkdir -p "$out_dir" "$(dirname "$js_out")" "$root/native/dexed-preview/build"

emcc -O3 \
  -std=c++17 \
  -fno-exceptions \
  -fno-rtti \
  -DNDEBUG \
  -I "$root/native/dexed-preview/include" \
  -I "$root/native/dexed-preview/src" \
  -I "$dexed_msfa" \
  -I "$(dirname "$dexed_msfa")" \
  "$root/native/dexed-preview/src/dexed_preview.cpp" \
  "$root/native/dexed-preview/src/tuning_stub.cpp" \
  "$dexed_msfa/sin.cc" \
  "$dexed_msfa/exp2.cc" \
  "$dexed_msfa/freqlut.cc" \
  "$dexed_msfa/env.cc" \
  "$dexed_msfa/pitchenv.cc" \
  "$dexed_msfa/lfo.cc" \
  "$dexed_msfa/fm_core.cc" \
  "$dexed_msfa/fm_op_kernel.cc" \
  "$dexed_msfa/dx7note.cc" \
  "$dexed_msfa/porta.cpp" \
  -o "$root/native/dexed-preview/build/dexed-preview.js" \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createDexedPreview \
  -s ENVIRONMENT=web \
  -s FILESYSTEM=0 \
  -s ALLOW_MEMORY_GROWTH=0 \
  -s INITIAL_MEMORY=16777216 \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_dexed_preview_init","_dexed_preview_reset","_dexed_preview_set_voice","_dexed_preview_note_on","_dexed_preview_note_off","_dexed_preview_render"]' \
  -s EXPORTED_RUNTIME_METHODS='["HEAPF32","HEAPU8","HEAP8","UTF8ToString"]' \
  -s INVOKE_RUN=0 \
  --no-entry

cp "$root/native/dexed-preview/build/dexed-preview.wasm" "$out_dir/dexed-preview.wasm"
cp "$root/native/dexed-preview/build/dexed-preview.js" "$js_out"
echo "Wrote $out_dir/dexed-preview.wasm and $js_out"
