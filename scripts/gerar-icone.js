'use strict';
// Gera src/icone.png (512x512): quadrado verde-azulado com cruz branca.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const T = 512;
const raio = 96;
const linhas = [];
for (let y = 0; y < T; y++) {
  const linha = Buffer.alloc(1 + T * 4);
  for (let x = 0; x < T; x++) {
    const dx = Math.max(raio - x, x - (T - 1 - raio), 0);
    const dy = Math.max(raio - y, y - (T - 1 - raio), 0);
    const dentro = dx * dx + dy * dy <= raio * raio;
    const cruz = (x >= 206 && x < 306 && y >= 106 && y < 406) || (y >= 206 && y < 306 && x >= 106 && x < 406);
    const cor = !dentro ? [0, 0, 0, 0] : cruz ? [255, 255, 255, 255] : [15, 118, 110, 255];
    Buffer.from(cor).copy(linha, 1 + x * 4);
  }
  linhas.push(linha);
}

function bloco(tipo, dados) {
  const t = Buffer.from(tipo);
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, dados])));
  return Buffer.concat([tam, t, dados, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(T, 0);
ihdr.writeUInt32BE(T, 4);
ihdr[8] = 8; // profundidade
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  bloco('IHDR', ihdr),
  bloco('IDAT', zlib.deflateSync(Buffer.concat(linhas))),
  bloco('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(path.join(__dirname, '..', 'src', 'icone.png'), png);
