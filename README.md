# volcafm2-dx7

## Desktop app

The Electron build uses the secure, fixed `app://volcafm2` origin so Web MIDI
and the IndexedDB Sound/Sequence libraries remain available between launches.

```bash
npm install
npm run desktop:run      # Build and launch the Electron app
npm run desktop:package  # Create installers in dist-desktop/
```
Receive programs from KORG volca fm2 and save as DX7 SysEx

https://mosynthkey.github.io/volcafm2-tools/
