/// <reference types="vite/client" />

import type { VideoToolkitApi } from '../preload/preload';

declare global {
  interface Window {
    videoToolkit: VideoToolkitApi;
  }
}
