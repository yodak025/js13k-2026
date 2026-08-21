// CI size gate for the js13kGames 2026 submission.
//
// Rules enforced here (stricter than the official limit, per project owner):
//   - build via the js13k-forge submodule must succeed;
//   - game.zip must exist and be strictly smaller than 13 KiB (zipBytes < 13,312);
//   - the forge report must agree with the measured size;
//   - index.html must be a top-level entry of the ZIP archive.
//   - the monolithic build must not leave local assets outside the ZIP.
//
// This test installs nothing itself. Prepare the submodule first:
//   git submodule update --init --recursive
//   npm ci --prefix tools/js13k-forge

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forgeCli = path.join(root, 'tools', 'js13k-forge', 'bin', 'js13k-forge.js');
const outDir = path.join(root, '.js13k');

// Official js13kGames limit: 13 * 1024 bytes. Our gate is strictly below it.
const LIMIT_BYTES = 13 * 1024; // 13,312
const LOCAL_ASSET_REFERENCE = /(?:["'=(])((?!data:|https?:|\/\/)[^"'()=\s]+\.(?:js|mjs|css|json|txt|bin|wasm|svg|avif|png|jpe?g|gif|webp|aac|m4a|mp3|ogg|wav|mp4|webm|woff2?|ttf|otf|glsl|vert|frag|wgsl))(?:[?#][^"'()\s]*)?/gi;

/** List file names stored in a ZIP archive by parsing its central directory. */
function zipEntryNames(zipPath) {
  const buf = fs.readFileSync(zipPath);
  // End of central directory record signature (PK\x05\x06).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  assert.notEqual(eocd, -1, `${zipPath} is not a readable ZIP archive`);
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(offset), 0x02014b50, 'corrupt ZIP central directory');
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    names.push(buf.toString('utf8', offset + 46, offset + 46 + nameLen));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

function human(bytes) {
  return `${bytes.toLocaleString('en-US')} bytes (${(bytes / 1024).toFixed(2)} KiB)`;
}

test('js13k size gate: game.zip builds and is strictly under 13 KiB', (t) => {
  assert.ok(
    fs.existsSync(forgeCli),
    'js13k-forge submodule is missing. Run: git submodule update --init --recursive',
  );

  // Run the forge CLI against the game project. Exit codes: 0 = fits budget,
  // 2 = built but over budget, 1 = build error. We handle the size verdict
  // ourselves (strictly below the limit), so accept 0 and 2.
  let status = 0;
  try {
    execFileSync(
      process.execPath,
      [forgeCli, 'build', root, '--entry', 'src/index.html', '--out', outDir],
      { stdio: 'pipe', encoding: 'utf8' },
    );
  } catch (err) {
    status = err.status ?? 1;
    if (status === 1) {
      t.diagnostic(String(err.stdout || ''));
      t.diagnostic(String(err.stderr || ''));
      assert.fail(
        'js13k-forge build failed (exit 1). If this is a module-resolution error, ' +
        'install the submodule dependencies with: npm ci --prefix tools/js13k-forge',
      );
    }
  }
  assert.ok(status === 0 || status === 2, `unexpected forge exit code ${status}`);

  const zipPath = path.join(outDir, 'game.zip');
  const reportPath = path.join(outDir, 'report.json');
  const htmlPath = path.join(outDir, 'index.html');
  assert.ok(fs.existsSync(zipPath), `game.zip was not produced at ${zipPath}`);
  assert.ok(fs.existsSync(reportPath), `report.json was not produced at ${reportPath}`);
  assert.ok(fs.existsSync(htmlPath), `monolithic index.html was not produced at ${htmlPath}`);

  const zipBytes = fs.statSync(zipPath).size;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const builtHtml = fs.readFileSync(htmlPath, 'utf8');

  // Human-readable size summary, shown in CI logs either way.
  const over = zipBytes - LIMIT_BYTES;
  t.diagnostic('--- js13k size summary ---');
  t.diagnostic(`game.zip size : ${human(zipBytes)}`);
  t.diagnostic(`budget        : ${human(LIMIT_BYTES)} (strict: zipBytes < ${LIMIT_BYTES})`);
  t.diagnostic(`verdict       : ${over < 0 ? `${-over} bytes remaining` : `${over} bytes over the limit`}`);
  if (report.best) {
    t.diagnostic(`best candidate: ${report.best.id} [${report.best.risk}]`);
  }

  // The report must agree with the artifact on disk.
  assert.ok(report.best, 'report.json has no best candidate');
  assert.equal(
    report.best.zipBytes,
    zipBytes,
    'report.zipBytes disagrees with the actual game.zip size',
  );

  // A tiny ZIP is a false positive if the browser still has to load local
  // files that forge did not inline. The official rules require every asset
  // to be contained in the archive.
  const unresolvedAssets = [...builtHtml.matchAll(LOCAL_ASSET_REFERENCE)].map((match) => match[1]);
  assert.deepEqual(
    unresolvedAssets,
    [],
    `monolithic index.html still references local assets outside the ZIP: ${unresolvedAssets.join(', ')}`,
  );
  const externalBuildWarnings = report.warnings.filter((warning) =>
    /external (?:asset|script)|self-contained build/i.test(warning));
  assert.deepEqual(
    externalBuildWarnings,
    [],
    `build relies on external resources forbidden by the js13kGames rules: ${externalBuildWarnings.join('; ')}`,
  );

  // index.html must sit at the archive root (official submission rule).
  assert.ok(
    zipEntryNames(zipPath).includes('index.html'),
    'game.zip has no index.html at its top level',
  );

  // The strict gate: strictly below 13 KiB, never weakened to <=.
  assert.ok(
    zipBytes < LIMIT_BYTES,
    `game.zip is ${human(zipBytes)} — must be strictly less than ${human(LIMIT_BYTES)} ` +
    `(${over} bytes over). Shrink the game; do not weaken this gate.`,
  );
});
