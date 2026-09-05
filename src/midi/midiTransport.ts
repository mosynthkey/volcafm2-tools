import { matchingMidiOutputName } from './midiAccessSession'

type Log = (message: string) => void
type StateChangeHandler = (port: MIDIPort) => void

export class MidiTransport {
  access: MIDIAccess | null = null
  private stateChangeListener: ((event: Event) => void) | null = null

  constructor(private readonly log: Log) {}

  async initialize() {
    const previous = this.access
    await this.release()
    this.access = await navigator.requestMIDIAccess({ sysex: true })
    if (previous) {
      this.log(previous === this.access
        ? 'MIDIAccess is the same object (document-scoped). A window reload is needed to fully recreate it.'
        : 'MIDIAccess is a new object.')
    }
    return this.access
  }

  async release() {
    this.unbindStateChange()
    const access = this.access
    this.access = null
    if (!access) return
    const ports = [...access.inputs.values(), ...access.outputs.values()]
    for (const port of ports) {
      if (port.type === 'input') (port as MIDIInput).onmidimessage = null
      try {
        await port.close()
      } catch {
        /* already closed or unsupported */
      }
    }
  }

  bindStateChange(onStateChange: StateChangeHandler) {
    this.unbindStateChange()
    if (!this.access) return
    this.stateChangeListener = (event: Event) => {
      const port = (event as MIDIConnectionEvent).port
      if (port) onStateChange(port)
    }
    this.access.addEventListener('statechange', this.stateChangeListener)
  }

  unbindStateChange() {
    if (this.access && this.stateChangeListener) {
      this.access.removeEventListener('statechange', this.stateChangeListener)
    }
    this.stateChangeListener = null
  }

  inputNames() { return this.access ? [...this.access.inputs.values()].map(port => port.name ?? '').filter(Boolean) : [] }
  outputNames() { return this.access ? [...this.access.outputs.values()].map(port => port.name ?? '').filter(Boolean) : [] }
  matchingOutputId(inputName: string) {
    if (!this.access) return null
    const outputs = [...this.access.outputs]
    const outputName = matchingMidiOutputName(inputName, outputs.map(([, output]) => output.name ?? ''))
    if (!outputName) return null
    return outputs.find(([, output]) => output.name === outputName)?.[0] ?? null
  }

  async openAllPorts(onResult?: (port: MIDIPort, error: unknown | null) => void) {
    if (!this.access) return
    const ports = [...this.access.inputs.values(), ...this.access.outputs.values()]
    for (const port of ports) {
      try {
        await port.open()
        onResult?.(port, null)
      } catch (error) {
        onResult?.(port, error)
      }
    }
  }

  async sendToAll(bytes: Uint8Array, onResult?: (outputName: string, error: unknown | null) => void) {
    if (!this.access) return
    for (const output of this.access.outputs.values()) {
      try {
        await output.open()
        output.send(bytes)
        onResult?.(output.name ?? '', null)
      } catch (error) {
        onResult?.(output.name ?? '', error)
      }
    }
  }
  send(outputName: string | null, bytes: Uint8Array) {
    if (!outputName || !this.access) return false
    const output = [...this.access.outputs.values()].find(candidate => candidate.name === outputName)
    if (!output) return false
    this.log(`TX MIDI to "${output.name}": ${formatMidiBytes(bytes)}`)
    output.send(bytes); return true
  }
}

export function formatMidiBytes(bytes: Uint8Array | number[], limit = 24) {
  const content = Array.from(bytes).slice(0, limit).map(byte => byte.toString(16).padStart(2, '0')).join(' ')
  return bytes.length > limit ? `${content} ... (${bytes.length} bytes)` : `${content} (${bytes.length} bytes)`
}
