const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pianogameDesktop', {
  platform: 'electron',
  exitApp: () => ipcRenderer.send('exit-app'),
  openUrl: (url) => ipcRenderer.send('open-url', url),
})
