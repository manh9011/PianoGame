const { app, BrowserWindow, ipcMain, shell, protocol, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '..', 'dist')
const DEV_URL = 'http://localhost:1420'

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mid': 'audio/midi',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '')
    let filePath = path.normalize(path.join(DIST, rel || 'index.html'))
    if (!filePath.startsWith(DIST)) {
      return new Response('Forbidden', { status: 403 })
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST, 'index.html')
    }
    const ext = path.extname(filePath).toLowerCase()
    return new Response(fs.readFileSync(filePath), {
      headers: { 'content-type': MIME[ext] ?? 'application/octet-stream' },
    })
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'PianoGame',
    backgroundColor: '#202020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.on('console-message', (_event, ...args) => {
    console.log('[renderer]', ...args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)))
  })
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('[did-fail-load]', code, desc, url)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[render-process-gone]', details)
  })
  win.webContents.on('preload-error', (_event, path, error) => {
    console.error('[preload-error]', path, error)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://') && !url.startsWith(DEV_URL)) {
      event.preventDefault()
      if (/^https?:/i.test(url)) shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_DEV) {
    win.loadURL(DEV_URL)
  } else {
    win.loadURL('app://bundle/index.html')
  }
  return win
}

ipcMain.on('exit-app', () => app.quit())
ipcMain.on('open-url', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url)
})

app.whenReady().then(() => {
  registerAppProtocol()
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['midi', 'midiSysex', 'fullscreen'].includes(permission))
  })
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders }
    if (details.url.startsWith('https://scorelibrary.manh9011.qzz.io/')) {
      headers['Access-Control-Allow-Origin'] = ['*']
    }
    callback({ responseHeaders: headers })
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
