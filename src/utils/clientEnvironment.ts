export type ClientOs = 'windows' | 'macos' | 'other'

export const DESKTOP_APP_DOWNLOAD_URL =
  'https://github.com/mosynthkey/volcafm2-tools/releases/latest/download/volca-fm2-tools-macOS.dmg'

export const WINDOWS_MIDI_HELP_URL =
  'https://devblogs.microsoft.com/windows-music-dev/windows-midi-services-rollout-known-issues-and-workarounds/'

export const detectClientOs = (ua: string): ClientOs => {
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos'
  return 'other'
}

export const midiTroubleshootAdvice = (input: {
  os: ClientOs
}): { windowsHelp: boolean; restart: boolean } => ({
  windowsHelp: input.os === 'windows',
  restart: input.os !== 'windows',
})
