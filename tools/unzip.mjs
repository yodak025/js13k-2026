// Minimal ZIP extractor, no dependencies. Supports the formats js13k-forge
// emits: stored (method 0) and DEFLATE (method 8) entries.
//
// Usage: node tools/unzip.mjs <archive.zip> <target-directory>
// Idempotent: the target directory is deleted and recreated on every run,
// so it always mirrors exactly the archive contents.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { inflateRawSync } from 'node:zlib';

const [archive, target] = process.argv.slice(2);
if (!archive || !target) {
  console.error('usage: node tools/unzip.mjs <archive.zip> <target-directory>');
  process.exit(1);
}

const buf = readFileSync(archive);

// End of central directory record (PK\x05\x06).
let eocd = -1;
for (let i = buf.length - 22; i >= 0; i--) {
  if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd === -1) {
  console.error(`unzip: ${archive} is not a readable ZIP archive`);
  process.exit(1);
}

const out = path.resolve(target);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const count = buf.readUInt16LE(eocd + 10);
let offset = buf.readUInt32LE(eocd + 16);
for (let i = 0; i < count; i++) {
  if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error('corrupt ZIP central directory');
  const method = buf.readUInt16LE(offset + 10);
  const compressedSize = buf.readUInt32LE(offset + 20);
  const nameLen = buf.readUInt16LE(offset + 28);
  const extraLen = buf.readUInt16LE(offset + 30);
  const commentLen = buf.readUInt16LE(offset + 32);
  const localOffset = buf.readUInt32LE(offset + 42);
  const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);
  offset += 46 + nameLen + extraLen + commentLen;

  if (name.endsWith('/')) continue; // directory entry

  // Zip-slip guard: every entry must extract inside the target.
  const file = path.normalize(path.join(out, name));
  if (file !== out && !file.startsWith(out + path.sep)) {
    throw new Error(`ZIP entry escapes target directory: ${name}`);
  }

  // Local file header (PK\x03\x04) carries its own name/extra lengths.
  if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('corrupt ZIP local header');
  const dataStart = localOffset + 30
    + buf.readUInt16LE(localOffset + 26)
    + buf.readUInt16LE(localOffset + 28);
  const raw = buf.subarray(dataStart, dataStart + compressedSize);
  const data = method === 0 ? raw
    : method === 8 ? inflateRawSync(raw)
    : (() => { throw new Error(`unsupported compression method ${method} for ${name}`); })();

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`  ${name} (${data.length.toLocaleString('en-US')} bytes)`);
}

console.log(`Extracted ${archive} -> ${path.relative(process.cwd(), out) || '.'}`);
