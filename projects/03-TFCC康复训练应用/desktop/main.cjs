'use strict';

const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

function contentPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'content', 'index.html')
    : path.join(__dirname, 'content', 'index.html');
}

function createWindow() {
  const compactPreview = process.argv.includes('--compact-layout-preview');
  const win = new BrowserWindow({
    width: compactPreview ? 1100 : 1440,
    height: compactPreview ? 760 : 900,
    minWidth: 1100,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: '#f3f3ee',
    title: 'TFCC 四阶段康复训练',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(contentPath());
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith('file://') });
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
