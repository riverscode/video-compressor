# Video Toolkit

![Platform](https://img.shields.io/badge/platform-Windows-lightgray.svg)
![Electron](https://img.shields.io/badge/Electron-33-47848F.svg?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCB1cArVscPlRRBS7Sa-3Gqw?label=River%20Code&style=social)](https://youtube.com/riverscode?sub_confirmation=1)
![GitHub followers](https://img.shields.io/github/stars/riverscode?style=social)

Aplicación de escritorio para procesar videos localmente usando **FFmpeg**. Sin subir archivos a la nube, sin límites de tamaño.

---

## Características

| Acción | Descripción | Salida |
|---|---|---|
| **Comprimir MP4** | Reduce el peso manteniendo calidad | `_compressed.mp4` |
| **Convertir a MP3** | Extrae el audio del video | `_audio.mp3` |
| **Convertir a WebM** | Formato optimizado para web | `_webm.webm` |
| **Reducir a 720p** | Escala el video a 720p máximo | `_720p.mp4` |
| **Reducir a 1080p** | Escala el video a 1080p máximo | `_1080p.mp4` |

- Arrastra y suelta archivos directamente sobre la app
- Compatible con MP4, MOV, MKV, WebM y AVI
- Abre el archivo generado automáticamente al terminar
- FFmpeg incluido — no requiere instalación manual

---

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior
- Windows 10 / 11

---

## Instalación

```bash
# 1. Clona el repositorio
git clone https://github.com/riverscode/video-toolkit.git
cd video-toolkit

# 2. Instala las dependencias
#    (esto también copia ffmpeg automáticamente)
npm install
```

---

## Uso en desarrollo

```bash
npm run dev
```

Abre la ventana de la aplicación en modo desarrollo con hot-reload.

---

## Íconos de la aplicación

El proyecto incluye un script que genera automáticamente todos los íconos necesarios a partir de una sola imagen PNG.

**1. Coloca tu imagen fuente aquí** (mínimo 256×256 px, fondo transparente recomendado):

```
build/icon-source.png
```

**2. Ejecuta el generador:**

```bash
npm run icons
```

Esto produce en `build/`:

| Archivo | Uso |
|---|---|
| `icon.ico` | Ícono de la app y accesos directos |
| `icon-16.png` / `icon-32.png` | Menú contextual de Windows |
| `icon-256.png` | Referencia de alta resolución |
| `installerHeader.bmp` | Cabecera del instalador NSIS |
| `installerSidebar.bmp` | Panel lateral del instalador |

> El siguiente `npm run dist` los usará automáticamente.

---

## Compilar instalador

```bash
npm run dist
```

Genera un instalador `.exe` en la carpeta `dist/` listo para distribuir.

### Firmar el instalador en Windows

Si quieres evitar la advertencia de Windows al instalarlo por primera vez, el instalador debe ir firmado con un certificado de firma de código válido. Un certificado autofirmado no suele bastar para evitar esa alerta de SmartScreen.

Con un certificado `.pfx` ya adquirido, puedes firmarlo así:

```powershell
$env:CSC_LINK="C:\certificados\video-toolkit.pfx"
$env:CSC_KEY_PASSWORD="tu-contraseña"
npm run dist
```

Electron Builder usará esas variables para firmar el `.exe` y el instalador.

### Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia la app en modo desarrollo |
| `npm run build` | Compila renderer y proceso principal |
| `npm run icons` | Genera íconos desde `build/icon-source.png` |
| `npm run dist` | Genera el instalador de Windows (NSIS) |

---

## Estructura del proyecto

```
src/
├── main/         # Proceso principal de Electron
├── preload/      # Bridge seguro entre main y renderer
├── renderer/     # Interfaz React
└── shared/       # Tipos y definiciones compartidas
resources/
└── ffmpeg/       # Binario de FFmpeg (se copia al instalar)
```

---

## Licencia

MIT © [River Code](https://youtube.com/riverscode)
