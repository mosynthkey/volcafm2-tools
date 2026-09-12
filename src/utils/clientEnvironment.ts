export type ClientBrowser = 'chrome' | 'other'
export type ClientOs = 'windows' | 'macos' | 'other'

export const MIN_CHROME_MAJOR = 153

export const DESKTOP_APP_DOWNLOAD_URL =
  'https://github.com/mosynthkey/volcafm2-tools/releases/latest/download/volca-fm2-tools-macOS.dmg'

export const WINDOWS_MIDI_HELP_URL =
  'https://devblogs.microsoft.com/windows-music-dev/windows-midi-services-rollout-known-issues-and-workarounds/'

export const detectClientBrowser = (ua: string): ClientBrowser => {
  if (/Edg\//i.test(ua) || /EdgA\//i.test(ua)) return 'other'
  if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) return 'chrome'
  return 'other'
}

export const detectChromeMajorVersion = (ua: string): number | null => {
  if (/Edg\//i.test(ua) || /EdgA\//i.test(ua) || /OPR\//i.test(ua)) return null
  const match = /(?:Chrome|CriOS)\/(\d+)/i.exec(ua)
  return match ? Number(match[1]) : null
}

export const detectClientOs = (ua: string): ClientOs => {
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos'
  return 'other'
}

export const midiTroubleshootAdvice = (input: {
  browser: ClientBrowser
  os: ClientOs
  chromeMajorVersion?: number | null
}): { useChrome: boolean; windowsHelp: boolean; restart: boolean } => ({
  useChrome: input.browser !== 'chrome'
    || (input.chromeMajorVersion != null && input.chromeMajorVersion < MIN_CHROME_MAJOR),
  windowsHelp: input.os === 'windows',
  restart: input.os !== 'windows',
})
