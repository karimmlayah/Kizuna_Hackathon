const fs = require('node:fs');
const path = require('node:path');
const { toQR } = require('toqr');

const url = process.argv[2] || 'exp://172.17.12.112:8081';
const data = toQR(url);
const size = Math.round(Math.sqrt(data.length));
const pad = 4;
const total = size + pad * 2;
const scale = 12;
const svgDim = total * scale;

let rects = [];
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    if (data[y * size + x]) {
      const rx = (x + pad) * scale;
      const ry = (y + pad) * scale;
      rects.push(`<rect x="${rx}" y="${ry}" width="${scale}" height="${scale}" fill="#000000"/>`);
    }
  }
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgDim} ${svgDim}" width="${svgDim}" height="${svgDim}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  ${rects.join('\n  ')}
</svg>
`;

const outPath = path.resolve(__dirname, '..', 'assets', 'expo-qr.svg');
fs.writeFileSync(outPath, svg, 'utf8');
console.log(`Generated QR code SVG at: ${outPath}`);
