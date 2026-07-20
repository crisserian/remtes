const { app, BrowserWindow } = require('electron');

// Starts the same signing proxy + local HTTP server + Cloudflare tunnel
// used by the browser-based version (server.js), in-process.
require('./server.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 1060,
    minWidth: 960,
    minHeight: 1060,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
    },
  });

  function tryLoad() {
    win.loadURL('http://localhost:5750').catch(() => {
      setTimeout(tryLoad, 500);
    });
  }
  tryLoad();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
