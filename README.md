# volcafm2-dx7

https://mosynthkey.github.io/volcafm2-tools/

Pushing to `main` or a `v*` tag (for example `v2.0.0`) builds the web app and deploys it to GitHub Pages.

Program preview plays a short phrase through the Dexed FM engine compiled to WebAssembly.
The engine sources live in the `third_party/dexed` submodule (Apache 2.0 `msfa` core). See [THIRD_PARTY.md](THIRD_PARTY.md).

```bash
git submodule update --init third_party/dexed
npm run wasm:dexed   # requires emcc; writes public/dexed-preview.wasm
```

## Desktop app

The Electron build uses the secure, fixed `app://volcafm2` origin so Web MIDI
and the IndexedDB Sound/Sequence libraries remain available between launches.

```bash
npm install
npm run desktop:run      # Build and launch the Electron app
npm run desktop:package  # Create installers in dist-desktop/
```
Receive programs from KORG volca fm2 and save as DX7 SysEx
