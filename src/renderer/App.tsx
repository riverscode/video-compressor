import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  actionDefinitions,
  videoActions,
  type ProcessProgress,
  type SelectedVideo,
  type VideoAction
} from '../shared/video-actions';

type ProcessState = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

interface FfmpegStatus {
  available: boolean;
  path: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function App() {
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);
  const [selectedAction, setSelectedAction] = useState<VideoAction>('compress-mp4');
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [progress, setProgress] = useState<ProcessProgress>({ percent: 0 });
  const [message, setMessage] = useState('Selecciona un archivo y una acción para comenzar.');
  const [outputPath, setOutputPath] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [openOnComplete, setOpenOnComplete] = useState(true);
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus | null>(null);

  const selectedActionDefinition = useMemo(() => actionDefinitions[selectedAction], [selectedAction]);
  const canStart = Boolean(selectedVideo && ffmpegStatus?.available && processState !== 'running');

  const processSelectedVideo = useCallback(async (video: SelectedVideo, action: VideoAction) => {
    setSelectedVideo(video);
    setSelectedAction(action);
    setProcessState('running');
    setIsStopping(false);
    setOutputPath('');
    setProgress({ percent: 0, message: 'Preparando proceso...' });
    setMessage('Preparando proceso...');

    try {
      const result = await window.videoToolkit.processVideo({
        inputPath: video.path,
        action,
        openOnComplete
      });

      setOutputPath(result.outputPath);
      setProgress({ percent: 100, message: 'Proceso completado.' });
      setProcessState('success');
      setMessage('Archivo generado correctamente.');
      setSelectedVideo(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      if (errorMessage.includes('cancelado')) {
        setProcessState('cancelled');
        setMessage('Proceso detenido por el usuario. No se generó un archivo final.');
      } else {
        setProcessState('error');
        setMessage(errorMessage);
      }
    } finally {
      setIsStopping(false);
    }
  }, [openOnComplete]);

  useEffect(() => {
    let isMounted = true;

    window.videoToolkit
      .checkFfmpeg()
      .then((status) => {
        if (!isMounted) {
          return;
        }

        setFfmpegStatus(status);
        if (!status.available) {
          setMessage('FFmpeg no está disponible. Ejecuta npm install o coloca ffmpeg.exe en resources/ffmpeg/.');
        }
      })
      .catch((error: Error) => {
        if (!isMounted) {
          return;
        }

        setFfmpegStatus({ available: false, path: '' });
        setMessage(error.message);
      });

    const removeProgressListener = window.videoToolkit.onProgress((nextProgress) => {
      setProgress(nextProgress);
      if (nextProgress.message) {
        setMessage(nextProgress.message);
      }
    });

    const removeAutoCompressListener = window.videoToolkit.onAutoCompress((file) => {
      void processSelectedVideo(file, 'compress-mp4');
    });

    window.videoToolkit
      .getPendingContextFile()
      .then((file) => {
        if (!isMounted || !file) {
          return;
        }

        void processSelectedVideo(file, 'compress-mp4');
      })
      .catch((error: Error) => {
        if (!isMounted) {
          return;
        }

        setProcessState('error');
        setMessage(error.message);
      });

    return () => {
      isMounted = false;
      removeProgressListener();
      removeAutoCompressListener();
    };
  }, [processSelectedVideo]);

  async function selectVideo() {
    const file = await window.videoToolkit.selectVideo();

    if (!file) {
      return;
    }

    setSelectedVideo(file);
    setOutputPath('');
    setProgress({ percent: 0 });
    setProcessState('idle');
    setIsStopping(false);
    setMessage('Archivo listo para procesar.');
  }

  function handleDroppedFile(file: File) {
    const fileInfo = window.videoToolkit.getFileInfo(file);

    if (!fileInfo) {
      setProcessState('error');
      setMessage('No se pudo obtener la ruta del archivo arrastrado.');
      return;
    }

    setSelectedVideo(fileInfo);
    setOutputPath('');
    setProgress({ percent: 0 });
    setProcessState('idle');
    setIsStopping(false);
    setMessage('Archivo listo para procesar.');
  }

  async function startProcessing() {
    if (!selectedVideo) {
      setProcessState('error');
      setMessage('Selecciona un archivo de video primero.');
      return;
    }

    await processSelectedVideo(selectedVideo, selectedAction);
  }

  async function stopProcessing() {
    if (processState !== 'running') {
      return;
    }

    setIsStopping(true);
    setMessage('Deteniendo proceso...');

    try {
      await window.videoToolkit.cancelVideo();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo detener el proceso.';
      setProcessState('error');
      setMessage(errorMessage);
      setIsStopping(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="titlebar">
        <div className="brand-mark" />
        <span>Video Toolkit</span>
        <div className="window-controls">
          <button type="button" aria-label="Minimizar" onClick={() => void window.videoToolkit.minimizeWindow()}>
            -
          </button>
          <button type="button" aria-label="Maximizar" onClick={() => void window.videoToolkit.toggleMaximizeWindow()}>
            □
          </button>
          <button type="button" aria-label="Cerrar" onClick={() => void window.videoToolkit.closeWindow()}>
            ×
          </button>
        </div>
      </header>

      <section className="content">
        <div className="hero-row">
          <div>
            <h1>Video Toolkit</h1>
            <p>Comprime, convierte y extrae audio.</p>
          </div>
          <div className={ffmpegStatus?.available ? 'status-pill ready' : 'status-pill warning'}>
            <span />
            {ffmpegStatus?.available ? 'FFmpeg listo' : 'FFmpeg no disponible'}
          </div>
        </div>

        <div
          className={isDragging ? 'dropzone dragging' : 'dropzone'}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);

            const file = event.dataTransfer.files.item(0);
            if (file) {
              handleDroppedFile(file);
            }
          }}
        >
          <div className="drop-content">
            <div className="drop-icon">+</div>
            <div>
              <h2>{selectedVideo ? selectedVideo.name : 'Arrastra un video o haz clic para elegir'}</h2>
              <p>{selectedVideo ? `${formatBytes(selectedVideo.size)} seleccionado` : 'Compatibles: MP4, MOV, MKV, WebM, AVI'}</p>
            </div>
          </div>
          <button className="secondary-button" type="button" onClick={selectVideo} disabled={processState === 'running'}>
            Seleccionar video
          </button>
        </div>

        <section className="actions-section">
          <p className="section-label">Acción</p>
          <div className="action-list">
            {videoActions.map((action) => {
              const definition = actionDefinitions[action];
              return (
                <label className={selectedAction === action ? 'action-option active' : 'action-option'} key={action}>
                  <input
                    type="radio"
                    name="video-action"
                    value={action}
                    checked={selectedAction === action}
                    disabled={processState === 'running'}
                    onChange={() => setSelectedAction(action)}
                  />
                  <span className="action-icon" aria-hidden="true">
                    {action === 'compress-mp4'
                      ? '⌘'
                      : action === 'extract-mp3'
                        ? '♪'
                        : action === 'convert-webm'
                          ? '◎'
                          : action === 'resize-720p'
                            ? '↙'
                            : '↗'}
                  </span>
                  <span>
                    <strong>{definition.label}</strong>
                    <small>{definition.description}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="settings-row">
          <div>
            <span>Sufijo</span>
            <code>
              {selectedActionDefinition.suffix}
              {selectedActionDefinition.extension}
            </code>
          </div>
          <div className="toggle-row">
            <span>Abrir al terminar</span>
            <button
              className={openOnComplete ? 'toggle active' : 'toggle'}
              type="button"
              aria-pressed={openOnComplete}
              onClick={() => setOpenOnComplete((current) => !current)}
            >
              <span />
            </button>
          </div>
        </section>

        <div className="progress-row">
          <div className="progress-header">
            <span>Progreso</span>
            <strong>{progress.percent}%</strong>
          </div>
          <div className="progress-track" aria-label="Progreso del proceso">
            <div className="progress-bar" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="time-grid">
            <small>Tiempo procesado: {progress.time ?? 'Pendiente'}</small>
            <small>
              Tiempo restante:{' '}
              {progress.remainingLabel ??
                (progress.remainingSeconds === undefined
                  ? processState === 'running'
                    ? 'Calculando...'
                    : 'Pendiente'
                  : formatSeconds(progress.remainingSeconds))}
            </small>
          </div>
        </div>

        {outputPath ? (
          <div className="output-box">
            <span>Archivo generado</span>
            <strong className="path-text">{outputPath}</strong>
          </div>
        ) : null}

        <div className="status-action-row">
          <div className={`message ${processState}`}>
            <strong>
              {processState === 'success'
                ? 'Éxito'
                : processState === 'error'
                  ? 'Error'
                  : processState === 'cancelled'
                    ? 'Detenido'
                    : 'Estado'}
            </strong>
            <span>{message}</span>
          </div>
          <div className="button-row">
            {processState === 'running' ? (
              <button className="stop-button" type="button" onClick={stopProcessing} disabled={isStopping}>
                {isStopping ? 'Deteniendo...' : 'Detener proceso'}
              </button>
            ) : null}
            <button className="run-button" type="button" onClick={startProcessing} disabled={!canStart}>
              {processState === 'running' ? 'Procesando...' : 'Iniciar ›'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
