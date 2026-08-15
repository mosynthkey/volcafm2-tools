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

export const shouldWarnBeforeDocumentReload = (input: {
  hasUnsavedProgram: boolean
  hasSequenceNotes: boolean
}) => input.hasUnsavedProgram || input.hasSequenceNotes
