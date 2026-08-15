const isDesktopBuild =
  import.meta.env.MODE === 'desktop' || import.meta.env.VITE_APP_RUNTIME === 'desktop'

const isAppProtocol = () =>
  typeof window !== 'undefined' && window.location.protocol === 'app:'

/** Packaged desktop app only. Do not treat Electron user agents as desktop; IDE browsers also match. */
export const isDesktopApp = isDesktopBuild || isAppProtocol()
