export const videoActions = [
  'compress-mp4',
  'extract-mp3',
  'convert-webm',
  'resize-720p',
  'resize-1080p'
] as const;

export type VideoAction = (typeof videoActions)[number];

export interface ActionDefinition {
  id: VideoAction;
  label: string;
  description: string;
  suffix: string;
  extension: string;
}

export const actionDefinitions: Record<VideoAction, ActionDefinition> = {
  'compress-mp4': {
    id: 'compress-mp4',
    label: 'Comprimir MP4',
    description: 'Reduce el peso manteniendo salida MP4.',
    suffix: '_compressed',
    extension: '.mp4'
  },
  'extract-mp3': {
    id: 'extract-mp3',
    label: 'Convertir a MP3',
    description: 'Extrae el audio del video en formato MP3.',
    suffix: '_audio',
    extension: '.mp3'
  },
  'convert-webm': {
    id: 'convert-webm',
    label: 'Convertir a WebM',
    description: 'Crea una versión WebM compatible con web.',
    suffix: '_webm',
    extension: '.webm'
  },
  'resize-720p': {
    id: 'resize-720p',
    label: 'Reducir a 720p',
    description: 'Escala el video a una altura máxima de 720p.',
    suffix: '_720p',
    extension: '.mp4'
  },
  'resize-1080p': {
    id: 'resize-1080p',
    label: 'Reducir a 1080p',
    description: 'Escala el video a una altura máxima de 1080p.',
    suffix: '_1080p',
    extension: '.mp4'
  }
};

export interface SelectedVideo {
  path: string;
  name: string;
  size: number;
}

export interface ProcessRequest {
  inputPath: string;
  action: VideoAction;
  openOnComplete?: boolean;
}

export interface ProcessProgress {
  percent: number;
  time?: string;
  remainingSeconds?: number;
  remainingLabel?: string;
  message?: string;
}

export interface ProcessResult {
  outputPath: string;
}

export interface ProcessError {
  message: string;
}
