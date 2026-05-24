/**
 * AmbientOS — main.js
 * Native Electron launcher. Configures a 100% transparent, click-through,
 * always-on-top window overlay and runs the Express/WS server.
 */

'use strict';

const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

// Append switches to ensure transparent visual support is enabled at the OS level
app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Start Express and WebSocket server inside the Electron process
try {
  require('./server.js');
} catch (err) {
  console.error('[AmbientOS Native] Failed to load server.js:', err.message);
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true, // Spans the full monitor display robustly
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false, // Prevents stealing key focus from active apps/games
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Enable click-through so user can interact with apps behind the planes
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Stays on top of fullscreen apps/games
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Pipe frontend console logs directly to the terminal for easy debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Overlay Console] ${message}`);
  });

  // Load the transparent local overlay page
  mainWindow.loadURL('http://localhost:3000');

  // Explicitly trigger show to guarantee it draws
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

app.whenReady().then(() => {
  // Brief delay to allow Express & WebSocket server to initialize fully
  setTimeout(createWindow, 1500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
