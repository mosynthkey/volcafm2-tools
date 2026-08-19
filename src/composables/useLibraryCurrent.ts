import { useI18n } from 'vue-i18n'
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

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const useLibraryCurrent = () => {
  const { t } = useI18n()
  const soundStore = useSoundStore()
  const seqStore = useSequencerStore()
  const midiStore = useMidiStore()

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
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        payload: cloneJson(record.payload),
      }]
    })
  }

  const currentPayload = async (kind: LibraryKind): Promise<LibraryPayload> => {
    if (kind === 'sound') return { sound: soundStore.snapshot() }
    if (kind === 'sequence') return { sequence: cloneJson(seqStore.toState()) }
    if (kind === 'sound-list') return { soundList: serializeSoundList(midiStore.cloneSoundList()) }
    if (kind === 'backup') return {}
    return { items: await catalogSnapshot() }
  }

  const stampSoundName = (payload: LibraryPayload, name: string) => {
    if (payload.sound && typeof payload.sound === 'object' && payload.sound !== null && 'name' in payload.sound) {
      (payload.sound as { name: string }).name = name.slice(0, 10)
    }
  }

  const saveCurrent = async (kind: LibraryKind, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (kind === 'backup') {
      throw new Error('Device backup must be captured from the volca fm2.')
    }
    const payload = await currentPayload(kind)
    if (kind === 'sound') stampSoundName(payload, trimmed)
    await saveLibrary(kind, trimmed, payload)
  }

  return { suggestedNameFor, currentPayload, stampSoundName, saveCurrent }
}
