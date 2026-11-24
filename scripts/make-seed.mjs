// make-seed.mjs — lay the seed crystal. The seed is every step The Climb's SEALED run checked: every line, in any of
// its four loops, that the checker found true and that states a value ("26 × 21 = 546"). The Climb's run is read
// from its repository at a commit, the lines are checked again here with the vendored checker, and each step is kept
// once. Nothing is taken on trust: a line is a seed only because exact arithmetic says so, twice.
//   node scripts/make-seed.mjs <path to a checkout of the-climb> <commit>     write data/seed.json
//   node scripts/make-seed.mjs --check                                        make it again from GitHub and compare
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { claimsOf } from '../vendor/climb/src/checker.mjs';

const REPO = 'sjgant80-hub/the-climb', RUN = 'data/runs/sealed.json';
const sha = (b) => createHash('sha256').update(b).digest('hex');
// factsOf(run) → every checked step in a run of The Climb, once each, in the order the run reached them
export function factsOf(run) {
  const seen = new Set(), facts = [];
  for (const arm of ['retry', 'naive', 'climb-alone', 'climb']) for (const rec of (run.arms && run.arms[arm] && run.arms[arm].records) || []) for (const p of rec.passes || []) {
    const text = typeof p.said === 'string' ? (p.cut === true ? p.said.split('\n').slice(0, -1).join('\n') : p.said) : '';
    for (const c of claimsOf(text)) if (c.ok && c.fact !== null && !seen.has(c.canon)) { seen.add(c.canon); facts.push(c.fact); }
  }
  return facts;
}
const build = (bytes, commit) => ({ v: 'the-crystal-seed-facts/1', from: `${REPO} ${RUN} at ${commit.slice(0, 7)}`, repo: REPO, commit, runSha256: sha(bytes), facts: factsOf(JSON.parse(bytes.toString('utf8'))) });

if (process.argv[1] && process.argv[1].endsWith('make-seed.mjs')) {
  if (process.argv[2] === '--check') {
    const ours = JSON.parse(readFileSync('data/seed.json', 'utf8'));
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${ours.commit}/${RUN}`);
    if (!r.ok) { console.error(`cannot read The Climb's sealed run at ${ours.commit}: ${r.status}`); process.exit(1); }
    const same = JSON.stringify(build(Buffer.from(await r.arrayBuffer()), ours.commit)) === JSON.stringify(ours);
    console.log(same ? `same: ${ours.facts.length} seed steps = every checked step of ${ours.from}` : 'DIFFERS: data/seed.json is not what The Climb\'s sealed run gives');
    process.exitCode = same ? 0 : 1;
  } else {
    const [from, commitish] = process.argv.slice(2);
    if (!from || !commitish) { console.error('usage: node scripts/make-seed.mjs <path to the-climb> <commit> | --check'); process.exit(2); }
    const git = (...a) => execFileSync('git', ['-C', from, ...a], { maxBuffer: 256 << 20 });
    const commit = git('rev-parse', commitish).toString('utf8').trim(), seed = build(git('show', `${commit}:${RUN}`), commit);
    writeFileSync('data/seed.json', JSON.stringify(seed, null, 1) + '\n');
    console.log(`data/seed.json: ${seed.facts.length} checked steps from ${seed.from}`);
  }
}
