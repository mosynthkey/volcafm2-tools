export type PreviewNoteEvent = {
  frame: number
  type: 'on' | 'off'
  note: number
  velocity?: number
}

export type PreviewPatchEvent = {
  frame: number
  type: 'patch'
  unpacked: Uint8Array
}

export type PreviewEvent = PreviewNoteEvent | PreviewPatchEvent

const eventOrder = (event: PreviewEvent) => {
  if (event.type === 'patch') return 0
  if (event.type === 'off') return 1
  return 2
}

export const sortPreviewEvents = (events: PreviewEvent[]) =>
  events.sort((left, right) => left.frame - right.frame || eventOrder(left) - eventOrder(right))
