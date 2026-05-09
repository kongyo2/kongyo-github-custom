// Pack the built dist/ directory into release/<name>-<version>.zip for store upload.
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { createDeflateRaw } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Buffer } from "node:buffer";
import { URL } from "node:url";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const dist = join(root, "dist");
const releaseDir = join(root, "release");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

if (!existsSync(dist)) {
  console.error("dist/ not found. Run `npm run build` first.");
  process.exit(1);
}

if (!existsSync(releaseDir)) mkdirSync(releaseDir);

const out = join(releaseDir, `${pkg.name}-${pkg.version}.zip`);

// Minimal zip writer (deflate). Avoids adding a dep just for packaging.
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else files.push(full);
  }
}
await walk(dist);

const localHeaders = [];
const centralHeaders = [];
let offset = 0;

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const deflateRaw = (input) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const z = createDeflateRaw();
    z.on("data", (c) => chunks.push(c));
    z.on("end", () => resolve(Buffer.concat(chunks)));
    z.on("error", reject);
    z.end(input);
  });

const enc = new TextEncoder();
for (const file of files) {
  const rel = relative(dist, file).split(sep).join("/");
  const data = readFileSync(file);
  const compressed = await deflateRaw(data);
  const useDeflate = compressed.length < data.length;
  const payload = useDeflate ? compressed : data;
  const method = useDeflate ? 8 : 0;
  const crc = crc32(data);
  const nameBuf = Buffer.from(enc.encode(rel));

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0, 6);
  lh.writeUInt16LE(method, 8);
  lh.writeUInt16LE(0, 10);
  lh.writeUInt16LE(0x21, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(payload.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  lh.writeUInt16LE(0, 28);
  localHeaders.push(Buffer.concat([lh, nameBuf, payload]));

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0, 8);
  ch.writeUInt16LE(method, 10);
  ch.writeUInt16LE(0, 12);
  ch.writeUInt16LE(0x21, 14);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(payload.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(nameBuf.length, 28);
  ch.writeUInt16LE(0, 30);
  ch.writeUInt16LE(0, 32);
  ch.writeUInt16LE(0, 34);
  ch.writeUInt16LE(0, 36);
  ch.writeUInt32LE(0, 38);
  ch.writeUInt32LE(offset, 42);
  centralHeaders.push(Buffer.concat([ch, nameBuf]));

  offset += 30 + nameBuf.length + payload.length;
}

const central = Buffer.concat(centralHeaders);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(centralHeaders.length, 8);
eocd.writeUInt16LE(centralHeaders.length, 10);
eocd.writeUInt32LE(central.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

const stream = createWriteStream(out);
await pipeline(async function* () {
  for (const lh of localHeaders) yield lh;
  yield central;
  yield eocd;
}, stream);

const size = statSync(out).size;
console.log(
  `✔ wrote ${out} (${(size / 1024).toFixed(1)} KB, ${files.length} files)`,
);
