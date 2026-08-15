export type ClientBrowser = 'chrome' | 'other'
export type ClientOs = 'windows' | 'macos' | 'other'

export const WINDOWS_MIDI_HELP_URL =
  'https://devblogs.microsoft.com/windows-music-dev/windows-midi-services-rollout-known-issues-and-workarounds/'

export const detectClientBrowser = (ua: string): ClientBrowser => {
  if (/Edg\//i.test(ua) || /EdgA\//i.test(ua)) return 'other'
  if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) return 'chrome'
  return 'other'
}

export const detectClientOs = (ua: string): ClientOs => {
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos'
  return 'other'
}

export const midiTroubleshootAdvice = (input: {
  browser: ClientBrowser
  os: ClientOs
}): { useChrome: boolean; windowsHelp: boolean; restart: boolean } => ({
  useChrome: input.browser !== 'chrome',
  windowsHelp: input.os === 'windows',
  restart: input.os !== 'windows',
})
