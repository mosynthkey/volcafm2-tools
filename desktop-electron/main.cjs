'use strict'

const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, Menu, dialog, net, protocol, session, shell } = require('electron')

const APP_SCHEME = 'app'
const APP_HOST = 'volcafm2'
const distRoot = path.join(__dirname, '..', 'dist')

protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
  },
}])

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url)
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const relativePath = path.normalize(pathname).replace(/^[/\\]+/, '')
    const filePath = path.join(distRoot, relativePath)
    if (!filePath.startsWith(distRoot + path.sep)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function allowMidiPermissions() {
  const isAppOrigin = (origin) => origin === `${APP_SCHEME}://${APP_HOST}` || origin.startsWith(`${APP_SCHEME}://${APP_HOST}/`)
  const isMidiPermission = (permission) => permission === 'midi' || permission === 'midiSysex'

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    isMidiPermission(permission) && isAppOrigin(requestingOrigin)
  )
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(isMidiPermission(permission) && isAppOrigin(webContents.getURL()))
  })
}

function setupMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
  ]))
}

async function createWindow() {
  const win = new BrowserWindow({
    title: 'volca fm2 tools',
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: '#211a1b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!navigationUrl.startsWith(`${APP_SCHEME}://${APP_HOST}/`)) event.preventDefault()
  })

  try {
    await win.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`)
  } catch (error) {
    console.error('[electron] Failed to load the application', error)
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'volca fm2 tools',
      message: 'アプリケーションを読み込めませんでした。',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

app.whenReady().then(() => {
  registerAppProtocol()
  allowMidiPermissions()
  setupMenu()
  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
