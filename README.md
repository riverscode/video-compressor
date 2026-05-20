# Video Toolkit

Aplicación de escritorio para Windows hecha con Electron, React, TypeScript y Vite. Procesa videos usando FFmpeg desde el proceso principal de Electron.

## Requisitos

- Windows.
- Node.js 20 o superior.
- npm.

## Instalación

```bash
npm install
```

Durante la instalación se ejecuta `scripts/setup-ffmpeg.cjs`, que copia el binario de `ffmpeg-static` a:

```text
resources/ffmpeg/ffmpeg.exe
```

Si prefieres usar tu propio FFmpeg, coloca manualmente `ffmpeg.exe` en esa misma ruta.

## Desarrollo

```bash
npm run dev
```

Esto levanta Vite y abre la aplicación Electron con `nodeIntegration` desactivado y `contextIsolation` activado.

## Compilar

```bash
npm run build
```

El build verifica primero que exista `resources/ffmpeg/ffmpeg.exe`.

## Generar instalador .exe

```bash
npm run dist
```

El instalador se genera en la carpeta:

```text
dist/
```

El nombre del instalador sigue el formato:

```text
Video Toolkit-Setup-1.0.0.exe
```

## Funciones

- Seleccionar un video manualmente.
- Arrastrar y soltar un archivo de video.
- Comprimir un `.mp4` desde el menú contextual de Windows con `Comprimir con Video Toolkit`.
- Comprimir video MP4.
- Convertir video a MP3.
- Convertir video a WebM.
- Reducir video a 720p.
- Reducir video a 1080p.
- Mostrar nombre del archivo, acción seleccionada, progreso, errores y ruta final.
- Mostrar tiempo restante aproximado durante el proceso.
- Detener el proceso activo en cualquier momento.

## Seguridad

- El renderer no ejecuta FFmpeg.
- El procesamiento ocurre en el proceso principal con `child_process.spawn`.
- La detención del proceso también ocurre desde el proceso principal, enviando `q` a FFmpeg y matando el proceso si no responde.
- La comunicación usa `contextBridge` e `ipcRenderer`.
- `nodeIntegration` está desactivado.
- `contextIsolation` está activado.
- Las rutas con espacios se manejan pasando argumentos como arreglo a `spawn`, sin usar shell.

## Salidas generadas

Los archivos se guardan en la misma carpeta del archivo original:

- `_compressed.mp4`
- `_audio.mp3`
- `_webm.webm`
- `_720p.mp4`
- `_1080p.mp4`

## Menú contextual de Windows

El instalador registra esta acción para archivos `.mp4`:

```text
Comprimir con Video Toolkit
```

Al usarla, Windows abre la app con:

```text
Video Toolkit.exe --compress "ruta\del\archivo.mp4"
```

La app selecciona automáticamente `Comprimir MP4` y genera el archivo con sufijo `_compressed.mp4` en la misma carpeta del video original.
El parser de arranque también reconoce rutas con espacios, rutas `file:///`, `--compress="ruta.mp4"` y argumentos enviados por Explorer sin el flag explícito.

En Windows 11, esta opción puede aparecer dentro de `Mostrar más opciones` porque es un verbo clásico del Explorador.

## Estructura

```text
src/
  main/
    main.ts
  preload/
    preload.ts
  renderer/
    App.tsx
    main.tsx
    styles.css
resources/
  ffmpeg/
    ffmpeg.exe
scripts/
  setup-ffmpeg.cjs
  verify-ffmpeg.cjs
```
