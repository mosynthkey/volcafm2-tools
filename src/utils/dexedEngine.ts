import createDexedPreview from '@/wasm/dexedPreview.mjs'
import { PREVIEW_BLOCK_FRAMES, PREVIEW_SAMPLE_RATE } from './previewConstants'
import type { PreviewEvent } from './previewEvents'

export { PREVIEW_BLOCK_FRAMES, PREVIEW_SAMPLE_RATE }

type DexedPreviewModule = Awaited<ReturnType<typeof createDexedPreview>>

let modulePromise: Promise<DexedPreviewModule> | null = null

const wasmUrl = () => `${import.meta.env.BASE_URL}dexed-preview.wasm`

export const loadDexedPreview = () => {
  if (!modulePromise) {
    modulePromise = createDexedPreview({
      locateFile: (path) => (path.endsWith('.wasm') ? wasmUrl() : path),
    }).then(module => {
      module._dexed_preview_init(PREVIEW_SAMPLE_RATE)
      return module
    }).catch(error => {
      modulePromise = null
      throw error
    })
  }
  return modulePromise
}

const writeBytes = (module: DexedPreviewModule, bytes: Uint8Array) => {
  const pointer = module._malloc(bytes.length)
  module.HEAPU8.set(bytes, pointer)
  return pointer
}

const setVoice = (module: DexedPreviewModule, unpacked155: Uint8Array, opSwitch: string) => {
  const patchPointer = writeBytes(module, unpacked155.subarray(0, 155))
  const switchBytes = new Uint8Array(7)
  for (let operatorIndex = 0; operatorIndex < 6; operatorIndex++) {
    switchBytes[operatorIndex] = (opSwitch[operatorIndex] === '0' ? 0x30 : 0x31)
  }
  const switchPointer = writeBytes(module, switchBytes)
  module._dexed_preview_set_voice(patchPointer, switchPointer)
  module._free(patchPointer)
  module._free(switchPointer)
}

export const renderDexedPreview = async (
  unpacked155: Uint8Array,
  opSwitch: string,
  events: PreviewEvent[],
  frameCount: number,
) => {
  const module = await loadDexedPreview()
  module._dexed_preview_reset()
  setVoice(module, unpacked155, opSwitch)

  const samples = new Float32Array(frameCount)
  const blockPointer = module._malloc(PREVIEW_BLOCK_FRAMES * 4)
  const heapIndex = blockPointer >> 2
  let nextEvent = 0
  for (let frame = 0; frame < frameCount; frame += PREVIEW_BLOCK_FRAMES) {
    while (nextEvent < events.length && events[nextEvent].frame <= frame) {
      const event = events[nextEvent]
      if (event.type === 'patch') setVoice(module, event.unpacked, opSwitch)
      else if (event.type === 'on') module._dexed_preview_note_on(event.note, event.velocity ?? 100)
      else module._dexed_preview_note_off(event.note)
      nextEvent += 1
    }
    const frames = Math.min(PREVIEW_BLOCK_FRAMES, frameCount - frame)
    module._dexed_preview_render(blockPointer, frames)
    samples.set(module.HEAPF32.subarray(heapIndex, heapIndex + frames), frame)
  }
  module._free(blockPointer)
  module._dexed_preview_reset()
  return samples
}
