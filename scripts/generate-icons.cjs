/**
 * generate-icons.cjs
 * Convierte build/icon-source.png a todos los formatos necesarios:
 *  - build/icon.ico          → ícono de la app (multi-size)
 *  - build/icon-256.png      → PNG 256px (referencia)
 *  - build/icon-32.png       → menú contextual
 *  - build/icon-16.png       → menú contextual (pequeño)
 *  - build/installerHeader.bmp  → NSIS header  (150×57)
 *  - build/installerSidebar.bmp → NSIS sidebar (164×314)
 *
 * Uso:
 *   1. Coloca tu PNG en:  build/icon-source.png
 *   2. Ejecuta:           npm run icons
 */

const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

/**
 * Convierte un Buffer de píxeles raw RGB/RGBA a un Buffer de archivo BMP 24-bit.
 * Sharp no soporta BMP como salida, así que escribimos la cabecera manualmente.
 */
function rawToBMP(pixels, width, height, channels) {
  const rowSize = Math.ceil((width * 3) / 4) * 4; // filas alineadas a 4 bytes
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const buf = Buffer.alloc(fileSize, 0);

  // File header (14 bytes)
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // offset al inicio de los píxeles

  // DIB header — BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);  // positivo = bottom-to-top
  buf.writeUInt16LE(1, 26);      // color planes
  buf.writeUInt16LE(24, 28);     // bits por píxel (24 = RGB)
  buf.writeUInt32LE(0, 30);      // compresión (ninguna)
  buf.writeUInt32LE(pixelDataSize, 34);
  buf.writeInt32LE(2835, 38);    // píxeles por metro X (~72 DPI)
  buf.writeInt32LE(2835, 42);    // píxeles por metro Y

  // Datos de píxeles — BMP almacena filas de abajo hacia arriba, en BGR
  for (let y = 0; y < height; y++) {
    const bmpRow = height - 1 - y;
    const rowOffset = 54 + bmpRow * rowSize;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * channels;
      const dst = rowOffset + x * 3;
      buf[dst]     = pixels[src + 2]; // B
      buf[dst + 1] = pixels[src + 1]; // G
      buf[dst + 2] = pixels[src + 0]; // R
    }
  }
  return buf;
}

const BUILD_DIR = path.join(__dirname, '..', 'build');
const SOURCE = path.join(BUILD_DIR, 'icon-source.png');

// ── Validar que el archivo fuente existe ─────────────────────────────────────
if (!fs.existsSync(SOURCE)) {
  console.error('\n❌  No se encontró build/icon-source.png');
  console.error('    Coloca tu PNG ahí y vuelve a ejecutar: npm run icons\n');
  process.exit(1);
}

async function run() {
  console.log('\n🔧  Generando íconos desde:', path.relative(process.cwd(), SOURCE));

  // ── 1. Tamaños PNG para el ICO y uso general ─────────────────────────────
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map((size) =>
      sharp(SOURCE)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );
  console.log('  ✔  PNGs redimensionados:', sizes.map((s) => `${s}px`).join(', '));

  // ── 2. Guardar PNGs de utilidad ──────────────────────────────────────────
  const utilSizes = { 16: 'icon-16.png', 32: 'icon-32.png', 256: 'icon-256.png' };
  for (const [size, filename] of Object.entries(utilSizes)) {
    const idx = sizes.indexOf(Number(size));
    fs.writeFileSync(path.join(BUILD_DIR, filename), pngBuffers[idx]);
  }
  console.log('  ✔  PNGs de utilidad guardados (16, 32, 256)');

  // ── 3. Generar .ico (multi-size) ─────────────────────────────────────────
  const icoBuffer = await toIco(pngBuffers, { sizes });
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), icoBuffer);
  console.log('  ✔  build/icon.ico generado');

  // ── 4. NSIS Header BMP — 150×57 px ──────────────────────────────────────
  //    Fondo blanco con el ícono a la derecha
  const HEADER_W = 150;
  const HEADER_H = 57;
  const iconSize = HEADER_H - 8; // 49px, margen de 4px arriba/abajo

  const iconForHeader = await sharp(SOURCE)
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const { data: headerRaw, info: headerInfo } = await sharp({
    create: { width: HEADER_W, height: HEADER_H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: iconForHeader, left: HEADER_W - iconSize - 4, top: 4 }])
    .flatten({ background: '#FFFFFF' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  fs.writeFileSync(path.join(BUILD_DIR, 'installerHeader.bmp'), rawToBMP(headerRaw, headerInfo.width, headerInfo.height, headerInfo.channels));
  console.log('  ✔  build/installerHeader.bmp generado (150×57)');

  // ── 5. NSIS Sidebar BMP — 164×314 px ─────────────────────────────────────
  //    Fondo oscuro (#1C1C1C) con el ícono centrado en la parte superior
  const SIDEBAR_W = 164;
  const SIDEBAR_H = 314;
  const sideIconSize = 80;

  const iconForSidebar = await sharp(SOURCE)
    .resize(sideIconSize, sideIconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const sideLeft = Math.round((SIDEBAR_W - sideIconSize) / 2);
  const sideTop = Math.round(SIDEBAR_H * 0.12); // ~12% desde arriba

  const { data: sidebarRaw, info: sidebarInfo } = await sharp({
    create: { width: SIDEBAR_W, height: SIDEBAR_H, channels: 4, background: { r: 28, g: 28, b: 28, alpha: 1 } },
  })
    .composite([{ input: iconForSidebar, left: sideLeft, top: sideTop }])
    .flatten({ background: '#1C1C1C' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  fs.writeFileSync(path.join(BUILD_DIR, 'installerSidebar.bmp'), rawToBMP(sidebarRaw, sidebarInfo.width, sidebarInfo.height, sidebarInfo.channels));
  console.log('  ✔  build/installerSidebar.bmp generado (164×314)');

  console.log('\n✅  Todos los íconos generados en build/\n');
}

run().catch((err) => {
  console.error('\n❌  Error generando íconos:', err.message);
  process.exit(1);
});
