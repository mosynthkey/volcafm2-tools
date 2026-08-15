import { useI18n } from 'vue-i18n'
import { useMidiStore } from '@/stores/midiStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useSoundStore } from '@/stores/soundStore'
import {
  serializeSoundList,
  type LibraryKind,
  type LibraryPayload,
} from '@/utils/libraryFormat'
import { saveLibrary } from '@/utils/presetLibrary'

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
    return t('library.suggestedBundle')
  }

  const currentPayload = (kind: LibraryKind): LibraryPayload => {
    if (kind === 'sound') return { sound: soundStore.snapshot() }
    if (kind === 'sequence') return { sequence: cloneJson(seqStore.toState()) }
    if (kind === 'sound-list') return { soundList: serializeSoundList(midiStore.cloneSoundList()) }
    return {
      sound: soundStore.snapshot(),
      sequence: cloneJson(seqStore.toState()),
      soundList: serializeSoundList(midiStore.cloneSoundList()),
    }
  }

  const stampSoundName = (payload: LibraryPayload, name: string) => {
    if (payload.sound && typeof payload.sound === 'object' && payload.sound !== null && 'name' in payload.sound) {
      (payload.sound as { name: string }).name = name.slice(0, 10)
    }
  }

  const saveCurrent = async (kind: LibraryKind, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const payload = currentPayload(kind)
    if (kind === 'sound') stampSoundName(payload, trimmed)
    await saveLibrary(kind, trimmed, payload)
  }

  return { suggestedNameFor, currentPayload, stampSoundName, saveCurrent }
}
