# FFmpeg

Este directorio debe contener `ffmpeg.exe`.

El proyecto usa `ffmpeg-static` y el script `postinstall` copia automáticamente el binario a:

```text
resources/ffmpeg/ffmpeg.exe
```

Si el archivo no existe, ejecuta:

```bash
npm install
```

También puedes reemplazarlo manualmente por otra compilación de FFmpeg para Windows, siempre que el archivo final se llame `ffmpeg.exe`.
