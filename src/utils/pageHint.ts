export type PageHintId = 'sound' | 'sound-list' | 'sequence'

export const PAGE_HINT_BY_TAB: Record<string, PageHintId> = {
  'sound-edit': 'sound',
  dx7: 'sound-list',
  sequencer: 'sequence',
}

const hintStorageKey = (id: PageHintId) => `volca-fm2-hint-${id}`

export const isPageHintSeen = (id: PageHintId) => {
  try {
    return localStorage.getItem(hintStorageKey(id)) === '1'
  } catch {
    return false
  }
}

export const markPageHintSeen = (id: PageHintId) => {
  try {
    localStorage.setItem(hintStorageKey(id), '1')
  } catch {
    /* ignore quota / private mode */
  }
}
