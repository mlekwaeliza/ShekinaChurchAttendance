const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size, outputPath) {
  const half = size / 2;
  const iconR = size * 0.35;
  const headR = size * 0.1;
  const headY = half - iconR * 0.3;
  const bodyTop = half - iconR * 0.05;
  const bodyBottom = half + iconR * 0.85;

  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0);
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const t = (dx + dy) / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        rawData.push(0, 0, 0, 0);
        continue;
      }

      const bgR = Math.round(79 + (124 - 79) * t);
      const bgG = Math.round(70 + (58 - 70) * t);
      const bgB = Math.round(229 + (237 - 229) * t);

      const centerDist = Math.sqrt((x - half) ** 2 + (y - half) ** 2);
      const headDist = Math.sqrt((x - half) ** 2 + (y - headY) ** 2);
      const bodyW = iconR * 0.7 * (1 - (y - bodyTop) / (bodyBottom - bodyTop) * 0.3);

      if (centerDist < iconR && (headDist < headR || (y > bodyTop && y < bodyBottom && Math.abs(x - half) < bodyW))) {
        rawData.push(255, 255, 255, 255);
      } else {
        rawData.push(bgR, bgG, bgB, 255);
      }
    }
  }

  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(size, 8);
  ihdr.writeUInt32BE(size, 12);
  ihdr[16] = 8;
  ihdr[17] = 6;
  ihdr[18] = 0;
  ihdr[19] = 0;
  ihdr[20] = 0;
  const ihdrCrc = crc32(ihdr.slice(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);

  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);

  const iend = Buffer.alloc(12);
  iend.writeUInt32BE(0, 0);
  iend.write('IEND', 4);
  const iendCrc = crc32(Buffer.from('IEND'));
  iend.writeUInt32BE(iendCrc, 8);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  fs.writeFileSync(outputPath, Buffer.concat([signature, ihdr, idat, iend]));
}

function crc32(buf) {
  let c = 0xffffffff;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let k = n;
    for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
    table[n] = k >>> 0;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const iconsDir = path.join(__dirname, '..', 'client', 'public', 'icons');
createPNG(192, path.join(iconsDir, 'icon-192.png'));
createPNG(512, path.join(iconsDir, 'icon-512.png'));
createPNG(96, path.join(iconsDir, 'shortcut-attendance.png'));
createPNG(96, path.join(iconsDir, 'shortcut-dashboard.png'));
console.log('Icons generated successfully');
