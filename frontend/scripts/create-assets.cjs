const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const root = path.join(__dirname, "../assets");
fs.mkdirSync(root, { recursive: true });
function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(name, buf) {
  const n = Buffer.from(name);
  const l = Buffer.alloc(4);
  l.writeUInt32BE(buf.length);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(Buffer.concat([n, buf])));
  return Buffer.concat([l, n, buf, c]);
}
const size = 1024,
  raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const dx = x - 512,
      dy = y - 512,
      r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const ray = r > 225 && r < 310 && Math.abs(Math.sin(a * 6)) < 0.13;
    const sun = (r > 145 && r < 180) || ray;
    const off = y * (size * 4 + 1) + 1 + x * 4;
    raw.set(sun ? [255, 203, 102, 255] : [6, 78, 59, 255], off);
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
fs.writeFileSync(
  path.join(root, "icon.png"),
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
fs.writeFileSync(
  path.join(root, "logo.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="32" fill="#064E3B"/><g stroke="#FFCB66" stroke-width="5" fill="none"><circle cx="64" cy="64" r="22"/>' +
    Array.from(
      { length: 12 },
      (_, i) => `<path d="M64 24v9" transform="rotate(${i * 30} 64 64)"/>`,
    ).join("") +
    "</g></svg>",
);
console.log("Original app icon and logo generated.");
