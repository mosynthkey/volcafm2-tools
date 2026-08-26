# Third-party notices

## Dexed FM engine (preview)

Program preview compiles the [music-synthesizer-for-android](https://github.com/google/music-synthesizer-for-android)
engine as vendored by [Dexed](https://github.com/asb2m10/dexed) (`third_party/dexed/Source/msfa`).

That engine is licensed under the Apache License 2.0 (Google Inc. / Pascal Gauthier).
The Dexed plugin host, JUCE UI, and related plugin code are GPL-3.0 and are **not** compiled into this app.

See `third_party/dexed/LICENSE` and `third_party/dexed/Source/msfa` copyright headers.

Rebuild the WASM module (requires [Emscripten](https://emscripten.org)):

```bash
git submodule update --init third_party/dexed
npm run wasm:dexed
```
