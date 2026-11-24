// vendor-climb.mjs — the seed this crystal grows from. The Crystal does no arithmetic, reading or splitting of its
// own: it stands on The Climb's kernels, byte for byte, as they were SEALED (the commit that froze them by hash before
// The Climb's sealed run). This script copies them from that commit and writes down where each came from.
//   node scripts/vendor-climb.mjs <path to a checkout of the-climb>     copy the files out of that commit
//   node scripts/vendor-climb.mjs --check                              fetch the same files from GitHub at that
//                                                                      commit and compare every byte (CI does this)
// A file is taken only if its hash is the one The Climb's own SEAL.json at that commit gives it.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

export const SEED = { repo: 'sjgant80-hub/the-climb', commit: '9eafa1d' };
export const FILES = ['src/exact.mjs', 'src/checker.mjs', 'src/plan.mjs', 'src/left.mjs', 'src/keep.mjs', 'src/tasks.mjs', 'src/loop.mjs', 'src/score.mjs', 'src/sha256.mjs', 'vendor/memory.mjs', 'vendor/stats.mjs'];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const raw = async (commit, path) => { const r = await fetch(`https://raw.githubusercontent.com/${SEED.repo}/${commit}/${path}`); if (!r.ok) throw new Error(`${path}: ${r.status}`); return Buffer.from(await r.arrayBuffer()); };

if (process.argv[1] && process.argv[1].endsWith('vendor-climb.mjs')) {
  if (process.argv[2] === '--check') {
    const prov = JSON.parse(readFileSync('vendor/climb/PROVENANCE.json', 'utf8'));
    const seal = JSON.parse((await raw(prov.commit, 'SEAL.json')).toString('utf8'));
    let bad = 0;
    for (const f of prov.files) {
      const theirs = await raw(prov.commit, f.path), ours = readFileSync(`vendor/climb/${f.path}`);
      const ok = sha(theirs) === sha(ours) && sha(ours) === f.sha256 && seal.files[f.path] === f.sha256;
      if (!ok) { bad++; console.error(`DIFFERS ${f.path}`); }
    }
    if (sha(await raw(prov.commit, 'SEAL.json')) !== prov.sealSha256) { bad++; console.error('DIFFERS SEAL.json'); }
    console.log(bad ? `${bad} files differ from ${SEED.repo}@${prov.commit}` : `same: ${prov.files.length} files = ${SEED.repo}@${prov.commit.slice(0, 7)}, each as its seal froze it`);
    process.exitCode = bad ? 1 : 0;
  } else {
    const from = process.argv[2];
    if (!from) { console.error('usage: node scripts/vendor-climb.mjs <path to the-climb> | --check'); process.exit(2); }
    const git = (...args) => execFileSync('git', ['-C', from, ...args], { maxBuffer: 64 << 20 });
    const commit = git('rev-parse', SEED.commit).toString('utf8').trim();
    const sealBytes = git('show', `${commit}:SEAL.json`), seal = JSON.parse(sealBytes.toString('utf8'));
    const files = [];
    for (const path of FILES) {
      const bytes = git('show', `${commit}:${path}`), h = sha(bytes);
      if (seal.files[path] !== h) throw new Error(`${path} at ${commit.slice(0, 7)} is not the file The Climb's seal froze`);
      mkdirSync(dirname(`vendor/climb/${path}`), { recursive: true });
      writeFileSync(`vendor/climb/${path}`, bytes);
      files.push({ path, sha256: h });
    }
    writeFileSync('vendor/climb/PROVENANCE.json', JSON.stringify({ v: 'the-crystal-seed/1', note: 'The Climb\'s kernels as its seal froze them, byte for byte; every hash here is the hash The Climb\'s own SEAL.json gives the file', repo: SEED.repo, commit, sealSha256: sha(sealBytes), files }, null, 1) + '\n');
    console.log(`vendored ${files.length} files from ${SEED.repo}@${commit.slice(0, 7)} · seal ${sha(sealBytes).slice(0, 12)}`);
  }
}
