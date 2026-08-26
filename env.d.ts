/// <reference types="vite/client" />

declare module '@/wasm/dexedPreview.mjs' {
  type DexedPreviewModule = {
    _malloc: (size: number) => number
    _free: (pointer: number) => void
    _dexed_preview_init: (sampleRate: number) => void
    _dexed_preview_reset: () => void
    _dexed_preview_set_voice: (patchPointer: number, opSwitchPointer: number) => void
    _dexed_preview_note_on: (midiNote: number, velocity: number) => void
    _dexed_preview_note_off: (midiNote: number) => void
    _dexed_preview_render: (outPointer: number, frames: number) => void
    HEAPU8: Uint8Array
    HEAPF32: Float32Array
  }

  const createDexedPreview: (options?: {
    locateFile?: (path: string, scriptDirectory: string) => string
  }) => Promise<DexedPreviewModule>

  export default createDexedPreview
}
