const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');

// Starts the same signing proxy + local HTTP server + Cloudflare tunnel
// used by the browser-based version (server.js), in-process.
require('./server.js');

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createTrayIcon() {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - r + 0.5, dy = y - r + 0.5;
      if (dx * dx + dy * dy <= r * r) {
        buffer[i] = 0x6c; buffer[i + 1] = 0x63; buffer[i + 2] = 0xff; buffer[i + 3] = 0xff;
      }
    }
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 700,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
    },
  });

  function tryLoad() {
    mainWindow.loadURL('http://localhost:5750').catch(() => {
      setTimeout(tryLoad, 500);
    });
  }
  tryLoad();

  // Closing the window just hides it - the app keeps running in the tray so
  // background polling (alert notifications, battery-history tracking) still
  // works without a window open. Quitting is only via the tray menu.
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('RemTes');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Deschide RemTes', click: () => (mainWindow ? mainWindow.show() : createWindow()) },
    { type: 'separator' },
    { label: 'Ieșire', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => { if (mainWindow) mainWindow.show(); });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  // Don't quit on Windows/Linux - see the close handler above.
});

app.on('before-quit', () => { isQuitting = true; });
