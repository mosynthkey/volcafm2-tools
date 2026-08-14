import { countVoiceDifferences, decodeVoiceName } from './volcaFm2Protocol'

export async function loadProgramReferences(options: {
  hasProgram: (programNo: number) => boolean
  request: (programNo: number) => void
  waitFor: (programNo: number, timeoutMs: number) => Promise<boolean>
  log: (message: string) => void
}) {
  const missing: number[] = []
  for (let programNo = 0; programNo < 64; programNo++) {
    if (options.hasProgram(programNo)) continue
    let timeoutMs = 120; let received = false
    for (let attempt = 1; attempt <= 4; attempt++) {
      options.request(programNo); received = await options.waitFor(programNo, timeoutMs)
      if (received) break
      options.log(`Program #${programNo} timed out after ${timeoutMs}ms (attempt ${attempt}/4); backing off.`)
      timeoutMs *= 2
    }
    if (!received) missing.push(programNo)
  }
  return missing
}

export function matchCurrentVoice(voiceData: Uint8Array, programs: (Uint8Array | undefined)[], names: { name: string }[]) {
  const currentName = decodeVoiceName(voiceData)
  const ranked = programs.flatMap((stored, programNo) => stored
    ? [{ programNo, name: names[programNo]?.name.trim() ?? '', differences: countVoiceDifferences(voiceData, stored) }]
    : [])
  const sameName = ranked.filter(candidate => candidate.name === currentName)
  const match = (sameName.length ? sameName : ranked).sort((a, b) => a.differences - b.differences)[0]
  if (!match) throw new Error('No stored program data is available for comparison.')
  return { ...match, currentName, nameCandidateCount: sameName.length }
}

