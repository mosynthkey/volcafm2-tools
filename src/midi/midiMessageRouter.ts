export type NoteEventCallback = (note: number, on: boolean, velocity: number) => void
export type MidiMessageCallback = (data: Uint8Array, inputName: string) => void
export type ProgramChangeCallback = (programNo: number) => void

export function createMidiMessageRouter() {
  const noteListeners = new Set<NoteEventCallback>()
  const messageListeners = new Set<MidiMessageCallback>()
  const programListeners = new Set<ProgramChangeCallback>()
  const subscribe = <T>(set: Set<T>, callback: T) => { set.add(callback); return () => set.delete(callback) }

  const publishRaw = (data: Uint8Array, inputName: string) => messageListeners.forEach(callback => callback(data, inputName))
  const publishChannel = (data: Uint8Array) => {
    const type = data[0] & 0xf0
    if (type === 0x90 || type === 0x80) {
      const velocity = data[2] ?? 0
      noteListeners.forEach(callback => callback(data[1], type === 0x90 && velocity > 0, velocity))
    } else if (type === 0xc0) {
      const programNo = data[1] & 0x7f
      programListeners.forEach(callback => callback(programNo))
    }
  }

  return {
    publishRaw, publishChannel,
    onNote: (callback: NoteEventCallback) => subscribe(noteListeners, callback),
    onMessage: (callback: MidiMessageCallback) => subscribe(messageListeners, callback),
    onProgramChange: (callback: ProgramChangeCallback) => subscribe(programListeners, callback),
  }
}

