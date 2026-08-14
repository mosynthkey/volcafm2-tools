export type EgShapeId = 'gate' | 'pluck' | 'pad' | 'swell'

export interface EgShapePreset {
  id: EgShapeId
  rates: readonly [number, number, number, number]
  levels: readonly [number, number, number, number]
}

export const EG_SHAPE_PRESETS: readonly EgShapePreset[] = [
  { id: 'gate', rates: [99, 99, 99, 99], levels: [99, 99, 99, 0] },
  { id: 'pluck', rates: [99, 60, 99, 99], levels: [99, 0, 0, 0] },
  { id: 'pad', rates: [45, 99, 99, 45], levels: [99, 99, 99, 0] },
  { id: 'swell', rates: [22, 99, 99, 48], levels: [99, 99, 99, 0] },
]

export const matchingEgShape = (rates: number[], levels: number[]) =>
  EG_SHAPE_PRESETS.find(shape =>
    shape.rates.every((rate, index) => rate === rates[index])
    && shape.levels.every((level, index) => level === levels[index]))
    ?? null
