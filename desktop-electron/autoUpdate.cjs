'use strict'

const { app, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')

const CHECK_DELAY_MS = 4_000

function setupAutoUpdater() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    console.error('[auto-update]', error == null ? 'unknown error' : error)
  })

  autoUpdater.on('update-downloaded', (info) => {
    const version = typeof info?.version === 'string' ? info.version : ''
    void dialog.showMessageBox({
      type: 'info',
      title: 'volca fm2 tools',
      message: 'Update ready',
      detail: version
        ? `Version ${version} has been downloaded. Restart the app to install it.`
        : 'A new version has been downloaded. Restart the app to install it.',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall()
    })
  })

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.error('[auto-update] check failed', error)
    })
  }, CHECK_DELAY_MS)
}

module.exports = { setupAutoUpdater }
