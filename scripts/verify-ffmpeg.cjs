const fs = require('node:fs');
const path = require('node:path');

const ffmpegPath = path.resolve(__dirname, '..', 'resources', 'ffmpeg', 'ffmpeg.exe');

if (!fs.existsSync(ffmpegPath)) {
  console.error('FFmpeg no está disponible.');
  console.error(`Ruta esperada: ${ffmpegPath}`);
  console.error('Ejecuta "npm install" para copiarlo desde ffmpeg-static.');
  console.error('También puedes colocar manualmente ffmpeg.exe en resources/ffmpeg/.');
  process.exit(1);
}

const stat = fs.statSync(ffmpegPath);

if (!stat.isFile() || stat.size === 0) {
  console.error(`FFmpeg existe pero no parece ser un archivo válido: ${ffmpegPath}`);
  process.exit(1);
}

console.log(`FFmpeg encontrado: ${ffmpegPath}`);
