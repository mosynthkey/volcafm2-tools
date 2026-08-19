import { ref } from 'vue'
import { getPref, setPref } from '@/utils/appPrefs'

export const SKIP_DEVICE_WRITE_PREF = 'skipDeviceMemoryWriteDialog'
export const SKIP_PROGRAM_NAME_HINT_PREF = 'skipProgramNameHintDialog'

export const useSkipConfirm = (prefKey: string) => {
  const skip = ref(false)
  const show = ref(false)
  const dontShowAgain = ref(false)

  getPref<boolean>(prefKey).then(value => {
    if (value === true) skip.value = true
  })

  let pending: (() => void) | null = null

  const request = (action: () => void) => {
    if (skip.value) {
      action()
      return
    }
    pending = action
    dontShowAgain.value = false
    show.value = true
  }

  const notify = () => {
    if (skip.value) return
    pending = null
    dontShowAgain.value = false
    show.value = true
  }

  const confirm = () => {
    show.value = false
    if (dontShowAgain.value && !skip.value) {
      skip.value = true
      setPref(prefKey, true).catch(() => {
        skip.value = false
      })
    }
    const action = pending
    pending = null
    action?.()
  }

  const cancel = () => {
    show.value = false
    pending = null
  }

  return { show, dontShowAgain, request, notify, confirm, cancel }
}
