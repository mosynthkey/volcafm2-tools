type Log = (message: string) => void

export class MidiTransport {
  access: MIDIAccess | null = null
  constructor(private readonly log: Log) {}

  async initialize() { this.access = await navigator.requestMIDIAccess({ sysex: true }); return this.access }
  inputNames() { return this.access ? [...this.access.inputs.values()].map(port => port.name ?? '').filter(Boolean) : [] }
  outputNames() { return this.access ? [...this.access.outputs.values()].map(port => port.name ?? '').filter(Boolean) : [] }
  matchingOutputId(inputName: string) { return this.access ? [...this.access.outputs].find(([, output]) => output.name === inputName)?.[0] ?? null : null }
  sendToAll(bytes: Uint8Array) { this.access?.outputs.forEach(output => output.send(bytes)) }
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

