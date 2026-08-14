const clamp99 = (value: number) => Math.max(0, Math.min(99, Math.round(value)))

export type Adsr = {
  attack: number
  decay: number
  sustain: number
  release: number
}

export const adsrToEg = (adsr: Adsr) => ({
  rates: [99 - clamp99(adsr.attack), 99 - clamp99(adsr.decay), 99, 99 - clamp99(adsr.release)] as const,
  levels: [99, clamp99(adsr.sustain), clamp99(adsr.sustain), 0] as const,
})

export const egToAdsr = (rates: number[], levels: number[]): Adsr => ({
  attack: 99 - clamp99(rates[0] ?? 99),
  decay: 99 - clamp99(rates[1] ?? 99),
  sustain: clamp99(levels[2] ?? levels[1] ?? 99),
  release: 99 - clamp99(rates[3] ?? 99),
})

export const isAdsrEnvelope = (rates: number[], levels: number[]) => {
  const { rates: nextRates, levels: nextLevels } = adsrToEg(egToAdsr(rates, levels))
  return nextRates.every((rate, index) => rate === rates[index])
    && nextLevels.every((level, index) => level === levels[index])
}
