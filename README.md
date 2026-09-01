# volca fm2 tools

A web and desktop editor for KORG volca fm2 Programs and Sequences, with DX7 SysEx support.

[Open the web app](https://mosynthkey.github.io/volcafm2-tools/)

## Features

- Edit volca fm2 Programs and Sequences.
- Manage and reorder the 64 Programs stored on the device.
- Import and export DX7 SysEx files.
- Save Programs, Sequences, and device backups in the Library.
- Preview Programs and Sequences with the built-in Dexed FM engine.

## Requirements

Use Google Chrome or the desktop app.
To communicate with a volca fm2, connect both MIDI IN and MIDI OUT through a MIDI interface.

## Development

Node.js 22 and npm are required.

```bash
npm ci
npm run dev
```

```bash
npm run build       # Build the web app
npm run verify      # Run verification scripts
npm run desktop:run # Build and launch the Electron app
```

## Support

Report bugs and request features in [GitHub Issues](https://github.com/mosynthkey/volcafm2-tools/issues).

## License

This project is licensed under the [MIT License](LICENSE).
The preview engine includes Apache-2.0-licensed code from Dexed. See [THIRD_PARTY.md](THIRD_PARTY.md).
