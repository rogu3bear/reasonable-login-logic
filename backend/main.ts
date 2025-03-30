import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { setupCredentialIPC } from './ipc/credentialIpc';
import { setupOAuthServer } from './ipc/oauthServer';
import { setupAutomationIPC } from './ipc/automationIpc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load from React dev server
  // In production, load from built files
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../frontend/build/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Open the DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Set up IPC handlers
  setupCredentialIPC();
  setupOAuthServer();
  setupAutomationIPC();
  
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle external links
ipcMain.handle('open-external-url', async (_, url: string) => {
  if (
    url.startsWith('https://') ||
    url.startsWith('http://') ||
    url.startsWith('mailto:')
  ) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// Handle file saving (e.g., for exporting the vault)
ipcMain.handle('save-file', async (_, { content, defaultPath, filters }) => {
  if (!mainWindow) return { success: false, error: 'No active window' };

  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters,
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(filePath, content);
    return { success: true, filePath };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'Failed to save file',
    };
  }
});

// Handle file opening (e.g., for importing the vault)
ipcMain.handle('open-file', async (_, { filters }) => {
  if (!mainWindow) return { success: false, error: 'No active window' };

  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters,
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const content = fs.readFileSync(filePaths[0], 'utf8');
    return { success: true, content, filePath: filePaths[0] };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'Failed to open file',
    };
  }
}); 