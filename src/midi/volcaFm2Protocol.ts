import { pack8to7, unpack7to8 } from '@/utils/sequenceCodec'

export const VOLCA_FM2_ID = { manufacturer: 0x42, familyLsb: 0x2f, familyMsb: 0x01, memberLsb: 0x08, memberMsb: 0x00 } as const
const prefix = [0xf0, 0x42, 0x30, 0x00, 0x01, 0x2f] as const

export const createDeviceInquiry = () => new Uint8Array([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7])
export const createProgramRequest = (programNo: number) => new Uint8Array([...prefix, 0x1e, programNo & 0x3f, 0xf7])
export const createCurrentVoiceRequest = () => new Uint8Array([...prefix, 0x12, 0xf7])
export const createCurrentVoiceDump = (data: Uint8Array) => new Uint8Array([...prefix, 0x42, ...pack8to7(data), 0xf7])

export const isDeviceInquiryReply = (data: Uint8Array) => data[5] === VOLCA_FM2_ID.manufacturer && data[6] === VOLCA_FM2_ID.familyLsb && data[7] === VOLCA_FM2_ID.familyMsb && data[8] === VOLCA_FM2_ID.memberLsb && data[9] === VOLCA_FM2_ID.memberMsb
const isVolcaMessage = (data: Uint8Array) => data[1] === VOLCA_FM2_ID.manufacturer && data[2] === 0x30 && data[3] === 0x00 && data[4] === VOLCA_FM2_ID.familyMsb && data[5] === VOLCA_FM2_ID.familyLsb
export const isProgramDump = (data: Uint8Array) => isVolcaMessage(data) && data[6] === 0x4e
export const isCurrentVoiceDump = (data: Uint8Array) => isVolcaMessage(data) && data[6] === 0x42
export const isStatusReply = (data: Uint8Array) => isVolcaMessage(data) && data[6] >= 0x23 && data[6] <= 0x26
export const decodeCurrentVoice = (data: Uint8Array) => unpack7to8(data.slice(7, -1), 140)
export const decodeVoiceName = (voiceData: Uint8Array) => String.fromCharCode(...voiceData.slice(118, 128)).replace(/\0/g, '').trim()

export function unpackProgramDump(data: Uint8Array) {
  const unpacked = new Uint8Array(128)
  let read = 0; let write = 0
  while (read < data.length) {
    for (let bit = 0; bit < 7; bit++) unpacked[write + bit] = data[read + bit + 1] | (((data[read] >> bit) & 1) << 7)
    read += 8; write += 7
  }
  return unpacked
}

export function countVoiceDifferences(current: Uint8Array, stored: Uint8Array) {
  let count = 0
  for (let index = 0; index < 128; index++) if (current[index] !== stored[index]) count++
  return count
}

export const statusLabel = (status: number) => ({ 0x23: 'ACK: DATA LOAD COMPLETED', 0x24: 'NAK: DATA LOAD ERROR', 0x25: 'NAK: BUFFER FULL', 0x26: 'NAK: DATA FORMAT ERROR' })[status] ?? 'unknown'

