import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  ProcessProgress,
  ProcessRequest,
  ProcessResult,
  SelectedVideo
} from '../shared/video-actions';

const api = {
  selectVideo: () => ipcRenderer.invoke('dialog:select-video') as Promise<SelectedVideo | null>,
  checkFfmpeg: () => ipcRenderer.invoke('ffmpeg:check') as Promise<{ available: boolean; path: string }>,
  getPendingContextFile: () => ipcRenderer.invoke('video:get-pending-context-file') as Promise<SelectedVideo | null>,
  getFileInfo: (file: File): SelectedVideo | null => {
    const filePath = webUtils.getPathForFile(file);

    if (!filePath) {
      return null;
    }

    return {
      path: filePath,
      name: file.name,
      size: file.size
    };
  },
  processVideo: (request: ProcessRequest) => ipcRenderer.invoke('video:process', request) as Promise<ProcessResult>,
  cancelVideo: () => ipcRenderer.invoke('video:cancel') as Promise<{ cancelled: boolean }>,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize') as Promise<void>,
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
  onProgress: (callback: (progress: ProcessProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ProcessProgress) => callback(progress);
    ipcRenderer.on('video:progress', listener);

    return () => {
      ipcRenderer.removeListener('video:progress', listener);
    };
  },
  onAutoCompress: (callback: (file: SelectedVideo) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, file: SelectedVideo) => callback(file);
    ipcRenderer.on('video:auto-compress', listener);

    return () => {
      ipcRenderer.removeListener('video:auto-compress', listener);
    };
  }
};

contextBridge.exposeInMainWorld('videoToolkit', api);

export type VideoToolkitApi = typeof api;
