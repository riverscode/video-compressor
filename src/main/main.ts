import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import {
  actionDefinitions,
  type ProcessProgress,
  type ProcessRequest,
  type ProcessResult,
  type SelectedVideo,
  videoActions
} from '../shared/video-actions';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let mainWindow: BrowserWindow | null = null;
let activeProcess: ReturnType<typeof spawn> | null = null;
let activeOutputPath: string | null = null;
let cancelRequested = false;
let pendingContextFile: SelectedVideo | null = null;

const videoExtensions = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.wmv', '.m4v']);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 780,
    height: 610,
    resizable: false,
    title: 'Video Toolkit',
    frame: false,
    backgroundColor: '#f7f7f9',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

}

function getFfmpegPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe');
  }

  return path.join(process.cwd(), 'resources', 'ffmpeg', 'ffmpeg.exe');
}

function ensureFfmpegAvailable() {
  const ffmpegPath = getFfmpegPath();

  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(
      `FFmpeg no está disponible en ${ffmpegPath}. Ejecuta "npm install" para copiarlo desde ffmpeg-static o coloca ffmpeg.exe en resources/ffmpeg/.`
    );
  }

  return ffmpegPath;
}

function ensureValidRequest(request: ProcessRequest) {
  if (!request || typeof request.inputPath !== 'string') {
    throw new Error('No se recibió un archivo válido.');
  }

  if (!videoActions.includes(request.action)) {
    throw new Error('La acción seleccionada no es válida.');
  }

  if (!fs.existsSync(request.inputPath)) {
    throw new Error('El archivo seleccionado no existe o no está disponible.');
  }
}

function selectedVideoFromPath(filePath: string): SelectedVideo | null {
  const normalizedPath = path.resolve(filePath.trim());
  const extension = path.extname(normalizedPath).toLowerCase();

  if (!videoExtensions.has(extension) || !fs.existsSync(normalizedPath)) {
    return null;
  }

  const stat = fs.statSync(normalizedPath);
  if (!stat.isFile()) {
    return null;
  }

  return {
    path: normalizedPath,
    name: path.basename(normalizedPath),
    size: stat.size
  };
}

function cleanContextArgument(argument: string) {
  let cleaned = argument.trim();

  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }

  if (cleaned.startsWith('file:///')) {
    cleaned = decodeURIComponent(cleaned.replace(/^file:\/\/\//, ''));
  }

  return cleaned;
}

function parseContextFile(argv: string[]) {
  const cleanedArgs = argv.map(cleanContextArgument);
  const compressIndex = cleanedArgs.findIndex((arg) => arg === '--compress');
  const inlineCompressArg = cleanedArgs.find((arg) => arg.startsWith('--compress='));
  const candidates = [
    compressIndex >= 0 ? cleanedArgs[compressIndex + 1] : null,
    inlineCompressArg ? inlineCompressArg.slice('--compress='.length) : null,
    ...cleanedArgs
  ].filter((arg): arg is string => Boolean(arg));

  for (const candidate of candidates) {
    const selectedVideo = selectedVideoFromPath(candidate);

    if (selectedVideo) {
      return selectedVideo;
    }
  }

  return null;
}

function queueContextFile(file: SelectedVideo | null) {
  if (!file) {
    return;
  }

  pendingContextFile = file;
  sendPendingContextFile();
}

function sendPendingContextFile() {
  if (!mainWindow || !pendingContextFile || mainWindow.webContents.isLoading()) {
    return;
  }

  mainWindow.webContents.send('video:auto-compress', pendingContextFile);
  pendingContextFile = null;
}

function buildOutputPath(inputPath: string, action: ProcessRequest['action']) {
  const definition = actionDefinitions[action];
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}${definition.suffix}${definition.extension}`);
}

function buildFfmpegArgs(inputPath: string, outputPath: string, action: ProcessRequest['action']) {
  const commonInput = ['-hide_banner', '-y', '-i', inputPath];

  switch (action) {
    case 'compress-mp4':
      return [
        ...commonInput,
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '28',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outputPath
      ];
    case 'extract-mp3':
      return [...commonInput, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', outputPath];
    case 'convert-webm':
      return [...commonInput, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-c:a', 'libopus', outputPath];
    case 'resize-720p':
      return [
        ...commonInput,
        '-vf',
        'scale=-2:min(720\\,ih)',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '24',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outputPath
      ];
    case 'resize-1080p':
      return [
        ...commonInput,
        '-vf',
        'scale=-2:min(1080\\,ih)',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '24',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        outputPath
      ];
    default:
      throw new Error('Acción no soportada.');
  }
}

function parseDuration(stderr: string) {
  const match = stderr.match(/Duration:\s(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

function parseCurrentTime(stderr: string) {
  const matches = [...stderr.matchAll(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/g)];
  const last = matches.at(-1);

  if (!last) {
    return null;
  }

  const hours = Number(last[1]);
  const minutes = Number(last[2]);
  const seconds = Number(last[3]);

  return {
    seconds: hours * 3600 + minutes * 60 + seconds,
    label: `${last[1]}:${last[2]}:${last[3]}`
  };
}

function formatRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function sendProgress(progress: ProcessProgress) {
  mainWindow?.webContents.send('video:progress', progress);
}

ipcMain.handle('dialog:select-video', async () => {
  const options = {
    title: 'Seleccionar video',
    properties: ['openFile'],
    filters: [
      {
        name: 'Videos',
        extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'wmv', 'm4v']
      }
    ]
  } satisfies Electron.OpenDialogOptions;

  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const stat = fs.statSync(filePath);

  return {
    path: filePath,
    name: path.basename(filePath),
    size: stat.size
  };
});

ipcMain.handle('ffmpeg:check', async () => {
  const ffmpegPath = getFfmpegPath();
  return {
    available: fs.existsSync(ffmpegPath),
    path: ffmpegPath
  };
});

ipcMain.handle('video:get-pending-context-file', async () => {
  const file = pendingContextFile;
  pendingContextFile = null;
  return file;
});

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return;
  }

  mainWindow.maximize();
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('video:cancel', async () => {
  if (!activeProcess) {
    return { cancelled: false };
  }

  const processToCancel = activeProcess;
  cancelRequested = true;
  sendProgress({ percent: 0, message: 'Deteniendo proceso...' });

  if (processToCancel.stdin && !processToCancel.stdin.destroyed) {
    try {
      processToCancel.stdin.write('q');
    } catch {
      processToCancel.kill();
    }
  }

  setTimeout(() => {
    if (activeProcess === processToCancel && !processToCancel.killed) {
      processToCancel.kill();
    }
  }, 1500);

  return { cancelled: true };
});

ipcMain.handle('video:process', async (_event, request: ProcessRequest): Promise<ProcessResult> => {
  if (activeProcess) {
    throw new Error('Ya hay un proceso de video en ejecución.');
  }

  ensureValidRequest(request);
  const ffmpegPath = ensureFfmpegAvailable();
  const outputPath = buildOutputPath(request.inputPath, request.action);
  const args = buildFfmpegArgs(request.inputPath, outputPath, request.action);

  return await new Promise<ProcessResult>((resolve, reject) => {
    let stderrBuffer = '';
    let duration: number | null = null;
    let settled = false;
    const startedAt = Date.now();

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      activeProcess = null;
      activeOutputPath = null;
      cancelRequested = false;
      callback();
    };

    sendProgress({ percent: 0, message: 'Iniciando FFmpeg...' });

    const ffmpegProcess = spawn(ffmpegPath, args, {
      windowsHide: true,
      shell: false
    });

    activeProcess = ffmpegProcess;
    activeOutputPath = outputPath;
    cancelRequested = false;

    ffmpegProcess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuffer += text;

      duration ??= parseDuration(stderrBuffer);
      const currentTime = parseCurrentTime(text);

      if (duration && currentTime) {
        const exactPercent = Math.max(0, Math.min(99, (currentTime.seconds / duration) * 100));
        const percent = Math.round(exactPercent);
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        const remainingSeconds =
          exactPercent > 0 ? Math.max(0, elapsedSeconds * ((100 - exactPercent) / exactPercent)) : undefined;

        sendProgress({
          percent,
          time: currentTime.label,
          remainingSeconds,
          remainingLabel: remainingSeconds === undefined ? undefined : formatRemainingTime(remainingSeconds),
          message: 'Procesando video...'
        });
      }
    });

    ffmpegProcess.on('error', (error) => {
      finish(() => {
        reject(new Error(`No se pudo iniciar FFmpeg: ${error.message}`));
      });
    });

    ffmpegProcess.on('close', (code) => {
      if (cancelRequested) {
        const partialOutputPath = activeOutputPath;

        if (partialOutputPath && fs.existsSync(partialOutputPath)) {
          try {
            fs.rmSync(partialOutputPath, { force: true });
          } catch {
            sendProgress({ percent: 0, message: `Proceso detenido. No se pudo eliminar el archivo parcial: ${partialOutputPath}` });
          }
        }

        sendProgress({ percent: 0, message: 'Proceso detenido.' });
        finish(() => {
          reject(new Error('Proceso cancelado por el usuario.'));
        });
        return;
      }

      if (code === 0 && fs.existsSync(outputPath)) {
        sendProgress({ percent: 100, message: 'Proceso completado.' });
        if (request.openOnComplete) {
          shell.showItemInFolder(outputPath);
        }
        finish(() => {
          resolve({ outputPath });
        });
        return;
      }

      finish(() => {
        reject(new Error(`FFmpeg terminó con código ${code ?? 'desconocido'}. ${stderrBuffer.trim()}`));
      });
    });
  });
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  pendingContextFile = parseContextFile(process.argv);

  app.on('second-instance', (_event, argv) => {
    queueContextFile(parseContextFile(argv));

    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });
  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
