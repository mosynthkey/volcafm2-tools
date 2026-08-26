# Dexed preview WASM

This directory wraps Dexed's Apache-2.0 `msfa` FM core for Program preview.

```bash
# from the repo root
git submodule update --init third_party/dexed
npm run wasm:dexed
```

`scripts/build-dexed-wasm.sh` writes:

- `public/dexed-preview.wasm`
- `src/wasm/dexedPreview.mjs`
