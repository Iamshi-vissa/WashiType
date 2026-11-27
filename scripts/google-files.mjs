// Snapshot of which font files each Google Fonts family has in the google/fonts repository,
// so "Download font" can fetch the real TTF files (the ones Google serves for desktop use).
//
// Run: npm run google-files   (needs git and network; takes about a minute)
//
// It reads the repository's file list only (no font files are downloaded) and writes
// data/google-files.json, pinned to the commit it read, so download links never move.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = 'https://github.com/google/fonts.git';
const dir = mkdtempSync(join(tmpdir(), 'google-fonts-'));
const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });

try {
  execFileSync('git', ['clone', '--quiet', '--filter=blob:none', '--no-checkout', '--depth', '1', REPO, dir], {
    stdio: 'inherit'
  });
  const commit = git('rev-parse', 'HEAD').trim();
  const families = {};
  for (const path of git('ls-tree', '-r', '--name-only', 'HEAD').split('\n')) {
    const parts = path.split('/');
    // <licence folder>/<family folder>/<file>: font files and the licence text only.
    if (parts.length !== 3 || !['ofl', 'apache', 'ufl'].includes(parts[0])) continue;
    const [folder, family, file] = parts;
    const isFont = /\.(ttf|otf)$/i.test(file);
    const isLicence = /^(OFL|LICENSE|UFL)\.txt$/i.test(file);
    if (!isFont && !isLicence) continue;
    (families[family] ??= { folder, fonts: [], licence: null });
    if (isFont) families[family].fonts.push(file);
    else families[family].licence = file;
  }
  for (const [name, family] of Object.entries(families)) {
    if (!family.fonts.length) delete families[name];
    else family.fonts.sort();
  }
  const snapshot = {
    about: 'Font and licence files per family in github.com/google/fonts (scripts/google-files.mjs).',
    commit,
    date: new Date().toISOString().slice(0, 10),
    families
  };
  writeFileSync(new URL('../data/google-files.json', import.meta.url), JSON.stringify(snapshot) + '\n');
  console.log(`google/fonts @ ${commit.slice(0, 7)}: ${Object.keys(families).length} families`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
