const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const targetDir = path.join(projectRoot, 'resources', 'ffmpeg');
const targetPath = path.join(targetDir, 'ffmpeg.exe');

function main() {
  let sourcePath;

  try {
    sourcePath = require('ffmpeg-static');
  } catch (error) {
    console.error('No se pudo cargar ffmpeg-static. Ejecuta npm install nuevamente.');
    console.error(error.message);
    process.exit(1);
  }

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.error('ffmpeg-static no devolvió una ruta válida para FFmpeg.');
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, 0o755);

  console.log(`FFmpeg copiado a ${targetPath}`);
}

main();
