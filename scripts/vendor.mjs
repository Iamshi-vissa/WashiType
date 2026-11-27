// Keeps the copied ReactBits components honest.
//
//   npm run vendor:check   fails if a copied file changed without its change being recorded
//                          (run in CI)
//   npm run vendor:record  after you deliberately edit a copied file: refreshes the patch in
//                          vendor/patches/ and the hashes in vendor/manifest.json
//
// vendor/manifest.json lists every copied file, where it came from (ReactBits commit and
// path, or the version pasted into this project), and the hash of the file as it is here.
// vendor/originals/ keeps the untouched originals of the files that carry local changes, and
// vendor/patches/ the difference, so an upgrade is: copy the new upstream file, then
// `git apply` its patch.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const manifestUrl = new URL('vendor/manifest.json', root);
const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');

const mode = process.argv[2];
let problems = 0;

for (const file of manifest.files) {
  const current = sha(file.local);
  if (mode === 'record') {
    if (file.original) {
      let patch = '';
      try {
        execFileSync('diff', ['-u', '--label', `a/${file.name}`, '--label', `b/${file.name}`, file.original, file.local], {
          cwd: root
        });
      } catch (error) {
        patch = error.stdout.toString(); // diff exits 1 when files differ
      }
      writeFileSync(new URL(file.patch, root), patch);
    }
    file.sha256 = current;
  } else if (current !== file.sha256) {
    problems += 1;
    console.error(
      `✗ ${file.local} changed. If that was on purpose, run "npm run vendor:record" and describe the change in vendor/manifest.json.`
    );
  }
}

if (mode === 'record') {
  writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Recorded ${manifest.files.length} copied files.`);
} else if (problems) {
  process.exit(1);
} else {
  console.log(`✓ ${manifest.files.length} copied files match vendor/manifest.json`);
}
