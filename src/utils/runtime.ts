export const isDesktopApp =
  import.meta.env.VITE_APP_RUNTIME === 'desktop' ||
  (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent))
