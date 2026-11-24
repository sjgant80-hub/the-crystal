// gates.mjs (the-crystal) — run the witness mutation gate on every gated file and record the result in data/gates.json.
//   node scripts/gates.mjs --witness <path to witness.mjs> [--check] [--only <file>]
// --check (CI): every gate must be CLEAN and match the committed counts, or this exits 1. Nothing is exempted:
// a file listed under "nothing to mutate" is listed with its reason, and is never counted as a pass.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const GATED = [
  ['src/bond.mjs', ['test/bond.test.mjs']],
  ['src/fuzz.mjs', ['test/fuzz.test.mjs']],
  ['src/grow.mjs', ['test/grow.test.mjs']],
  ['src/lattice.mjs', ['test/lattice.test.mjs']],
  ['src/measure.mjs', ['test/measure.test.mjs']],
  ['src/claims.mjs', ['test/claims.test.mjs']],
  ['src/stack.mjs', ['test/stack.test.mjs']],
  ['genome/cell.mjs', ['test/genome.test.mjs']],
];
export const NOTHING_TO_MUTATE = {
  'genome/io.mjs, judge.mjs, lane.mjs, health.mjs, tombstone.mjs': "the estate genome's hook template, byte for byte; gated in estate-genome (template/genome), exercised here by the birth check in CI",
  'vendor/climb/**': "The Climb's kernels, byte for byte as its seal froze them; gated in the-climb (data/gates.json there) and compared with that repository on every push (scripts/vendor-climb.mjs --check)",
  'page/gem.js': 'the glass: it draws a record and decides nothing; its geometry and camera are tested (test/gem.test.mjs), its drawing is checked in a browser',
};

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const witness = opt('--witness'), only = opt('--only'), checkMode = args.includes('--check');
if (!witness || !existsSync(witness)) { console.error('usage: node scripts/gates.mjs --witness <witness.mjs> [--check] [--only <file>]'); process.exit(2); }

const committed = existsSync('data/gates.json') ? JSON.parse(readFileSync('data/gates.json', 'utf8')) : { files: {} };
// a file that is no longer gated (renamed or removed) is dropped from the record, never kept as a pass or a fail
const files = Object.fromEntries(Object.entries(committed.files).filter(([f]) => GATED.some(([g]) => g === f)));
let bad = 0;
for (const [file, tests] of GATED) {
  if (only && only !== file) continue;
  const r = spawnSync(process.execPath, [witness, 'mutate', file, '--cap', '100000', '--timeout', '120000', '--test', 'node', '--test', ...tests], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const out = r.stdout || '';
  let j = null;
  try { j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)); } catch { j = null; }
  const got = j ? { total: j.total, killed: j.killed, ignored: (j.ignored || []).length, clean: j.clean === true } : { total: 0, killed: 0, ignored: 0, clean: false };
  const was = committed.files[file];
  const drift = checkMode && (!was || was.total !== got.total || was.killed !== got.killed || (was.ignored || 0) !== got.ignored);
  if (!got.clean || drift) bad++;
  console.log(`${got.clean ? 'CLEAN' : 'NOT CLEAN'} ${got.killed}/${got.total}  ${file}${drift ? '  (differs from data/gates.json)' : ''}`);
  if (j && !got.clean) for (const s of j.survived || []) console.log('  survivor: ' + JSON.stringify(s).slice(0, 200));
  files[file] = got;
}
if (!checkMode) {
  const total = Object.values(files).reduce((a, f) => a + f.total, 0), killed = Object.values(files).reduce((a, f) => a + f.killed, 0);
  writeFileSync('data/gates.json', JSON.stringify({ witness: 'v0.6', total, killed, clean: Object.values(files).every((f) => f.clean), files, nothingToMutate: NOTHING_TO_MUTATE }, null, 1) + '\n');
}
process.exit(bad ? 1 : 0);
