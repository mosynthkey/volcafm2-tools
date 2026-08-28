import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { packedVoiceName } from '@/midi/dx7Cartridge'
import { useMidiStore } from '@/stores/midiStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useSoundStore } from '@/stores/soundStore'
import {
  isCatalogKind,
  serializeSoundList,
  type CatalogKind,
  type LibraryItemSnapshot,
  type LibraryKind,
  type LibraryPayload,
} from '@/utils/libraryFormat'
import { listLibrary, saveLibrary } from '@/utils/presetLibrary'
import { appError } from '@/utils/appError'
import { bytesEqual } from '@/utils/bytesEqual'
import { decodeSoundProgram, encodeSoundProgram } from '@/utils/soundProgramCodec'

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

type SequenceProgramChoice = 'load' | 'keep' | 'cancel'

export const useLibraryCurrent = () => {
  const { t } = useI18n()
  const soundStore = useSoundStore()
  const seqStore = useSequencerStore()
  const midiStore = useMidiStore()
  const sequenceProgramMismatch = ref<{ slot: number; name: string } | null>(null)
  let sequenceProgramChoice: ((choice: SequenceProgramChoice) => void) | null = null

  const showSequenceProgramMismatch = computed({
    get: () => sequenceProgramMismatch.value !== null,
    set: open => { if (!open) resolveSequenceProgramChoice('cancel') },
  })

  const resolveSequenceProgramChoice = (choice: SequenceProgramChoice) => {
    sequenceProgramMismatch.value = null
    const resolve = sequenceProgramChoice
    sequenceProgramChoice = null
    resolve?.(choice)
  }

  const askSequenceProgramChoice = (slot: number, name: string) =>
    new Promise<SequenceProgramChoice>(resolve => {
      sequenceProgramMismatch.value = { slot, name }
      sequenceProgramChoice = resolve
    })

  const suggestedNameFor = (kind: LibraryKind) => {
    if (kind === 'sound') return soundStore.program.name.trim() || t('sound.untitled')
    if (kind === 'sequence') return t('sequence.libraryName', { count: seqStore.programNo + 1 })
    if (kind === 'sound-list') return t('library.suggestedSoundList')
    if (kind === 'backup') return t('library.suggestedBackup')
    return t('library.suggestedBundle')
  }

  const catalogSnapshot = async (): Promise<LibraryItemSnapshot[]> => {
    const records = await listLibrary()
    return records.flatMap(record => {
      if (!isCatalogKind(record.kind)) return []
      return [{
        id: record.id,
        kind: record.kind as CatalogKind,
        name: record.name,
        ...(record.memo ? { memo: record.memo } : {}),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        payload: cloneJson(record.payload),
      }]
    })
  }

  const currentPayload = async (kind: LibraryKind): Promise<LibraryPayload> => {
    if (kind === 'sound') return { sound: soundStore.snapshot() }
    if (kind === 'sequence') return { sequence: cloneJson(seqStore.toState()), sound: soundStore.snapshot() }
    if (kind === 'sound-list') return { soundList: serializeSoundList(midiStore.cloneSoundList()) }
    if (kind === 'backup') return {}
    return { items: await catalogSnapshot() }
  }

  const prepareSequencePayload = async (): Promise<LibraryPayload | null> => {
    const sequence = cloneJson(seqStore.toState())
    if (!midiStore.isIdleConnected) return { sequence, sound: soundStore.snapshot() }
    const dump = await midiStore.fetchProgramDump(seqStore.programNo)
    if (!dump) throw appError('library.sequenceProgramFetchFailed')
    const deviceProgram = decodeSoundProgram(dump)
    if (bytesEqual(encodeSoundProgram(soundStore.snapshot()), encodeSoundProgram(deviceProgram))) {
      return { sequence, sound: soundStore.snapshot() }
    }
    const choice = await askSequenceProgramChoice(
      seqStore.programNo,
      packedVoiceName(dump).trim() || t('sound.untitled'),
    )
    if (choice === 'cancel') return null
    if (choice === 'load') {
      soundStore.loadFromVoiceData(dump)
      return { sequence, sound: deviceProgram }
    }
    return { sequence, sound: soundStore.snapshot() }
  }

  const stampSoundName = (payload: LibraryPayload, name: string) => {
    if (payload.sound && typeof payload.sound === 'object' && payload.sound !== null && 'name' in payload.sound) {
      (payload.sound as { name: string }).name = name.slice(0, 10)
    }
  }

  const saveCurrent = async (kind: LibraryKind, name: string, memo = '') => {
    const trimmed = name.trim()
    if (!trimmed) return false
    if (kind === 'backup') {
      throw new Error('Device backup must be captured from the volca fm2.')
    }
    const payload = kind === 'sequence' ? await prepareSequencePayload() : await currentPayload(kind)
    if (!payload) return false
    if (kind === 'sound') stampSoundName(payload, trimmed)
    await saveLibrary(kind, trimmed, payload, memo)
    return true
  }

  return {
    suggestedNameFor,
    currentPayload,
    stampSoundName,
    saveCurrent,
    showSequenceProgramMismatch,
    sequenceProgramMismatch,
    keepSequenceProgramMismatch: () => resolveSequenceProgramChoice('keep'),
    loadSequenceProgramMismatch: () => resolveSequenceProgramChoice('load'),
  }
}
