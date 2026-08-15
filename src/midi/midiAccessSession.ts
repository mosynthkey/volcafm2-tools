export type MidiPortLike = {
  name?: string | null
  state: string
  type?: string
}

export type MidiStateChangeAction = 'refresh' | 'rescan' | 'mark-disconnected'

export const nextDetectGeneration = (current: number) => current + 1

export const isStaleDetectGeneration = (started: number, current: number) => started !== current

export const portNamesFrom = (ports: Iterable<MidiPortLike>) =>
  [...ports].map(port => port.name ?? '').filter(Boolean)

export const selectedPortDisconnected = (selectedName: string | null, ports: Iterable<MidiPortLike>) => {
  if (!selectedName) return false
  return [...ports].some(port => port.name === selectedName && port.state === 'disconnected')
}

export const midiStateChangeAction = (input: {
  isDeviceReady: boolean
  isBusy: boolean
  portState: string
  selectedDisconnected: boolean
}): MidiStateChangeAction => {
  if (input.selectedDisconnected) return 'mark-disconnected'
  if (input.portState === 'connected' && !input.isDeviceReady && !input.isBusy) return 'rescan'
  return 'refresh'
}

export const MIDI_AUTO_RELOAD_KEY = 'volca-fm2-midi-auto-reload'

export const readDidAutoReloadMidi = (storage: { getItem(key: string): string | null } | null) =>
  storage?.getItem(MIDI_AUTO_RELOAD_KEY) === '1'

export const markAutoReloadMidi = (storage: { setItem(key: string, value: string): void } | null) => {
  storage?.setItem(MIDI_AUTO_RELOAD_KEY, '1')
}

export const clearAutoReloadMidi = (storage: { removeItem(key: string): void } | null) => {
  storage?.removeItem(MIDI_AUTO_RELOAD_KEY)
}

export const desktopMidiBootAction = (input: { isDesktop: boolean; didAutoReload: boolean }) =>
  input.isDesktop && input.didAutoReload ? 'reconnect' : 'init'

export const shouldAutoReloadMidiDocument = (input: {
  isDesktop: boolean
  didAutoReload: boolean
  midiAccessFailed: boolean
  deviceNotFound: boolean
  hasNoPorts: boolean
}) => {
  if (!input.isDesktop || input.didAutoReload) return false
  if (input.midiAccessFailed) return true
  return input.deviceNotFound && input.hasNoPorts
}
