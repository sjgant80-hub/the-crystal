import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const at = (p) => new URL(`../${p}`, import.meta.url);
const rd = (p) => JSON.parse(readFileSync(at(p), 'utf8'));

test('the seed is The Climb as its seal froze it: every vendored file has the hash its own seal gives it', () => {
  const p = rd('vendor/climb/PROVENANCE.json');
  assert.equal(p.repo, 'sjgant80-hub/the-climb'); assert.match(p.commit, /^[0-9a-f]{40}$/); assert.match(p.sealSha256, /^[0-9a-f]{64}$/);
  const have = [...readdirSync(at('vendor/climb/src/')).map((f) => `src/${f}`), ...readdirSync(at('vendor/climb/vendor/')).map((f) => `vendor/${f}`)].sort();
  assert.deepEqual(p.files.map((f) => f.path).sort(), have, 'every file in vendor/climb is recorded, and nothing else is');
  for (const f of p.files) assert.equal(sha(readFileSync(at(`vendor/climb/${f.path}`))), f.sha256, f.path);
  assert.ok(p.files.length >= 11);
});

test('the sealed problems are new: not the dev problems, and not the problems the seed was grown from', async () => {
  const T = (await import('../vendor/climb/src/tasks.mjs')).default, s = rd('data/settings.json');
  const sealed = T.set(s.sets.sealed.seed, s.sets.sealed.sheets), dev = T.set(s.sets.dev.seed, s.sets.dev.sheets), climbSealed = T.set(20261124, 12);
  assert.equal(sealed.length, 96); assert.equal(dev.length, 40);
  const seen = new Set([...dev, ...climbSealed].map((t) => t.statement));
  // the easy tier has few possible problems (two single digits multiplied), so two of them come up again by chance;
  // CLAIMS.md says so. No climb-tier or wall-tier problem has been seen before.
  const again = sealed.filter((t) => seen.has(t.statement));
  assert.deepEqual(again.map((t) => t.tier), ['easy', 'easy']); assert.deepEqual(again.map((t) => t.id), ['weight:20261134-1', 'volts:20261134-7']);
  assert.ok(![20261101, 20261124].includes(s.sets.sealed.seed)); assert.equal(s.sets.sample.seed, s.sets.dev.seed);
  assert.deepEqual([s.maxTicks, s.maxTokens, s.depth, s.climbTokens], [256, 24, 8, 128]);
});

test('once the seal is made, every sealed file still has the bytes it froze, and a sealed run was made under it', () => {
  if (!existsSync(at('SEAL.json'))) { assert.equal(rd('data/published.json').sealed, null, 'a sealed run cannot be published before the seal exists'); return; }
  const seal = rd('SEAL.json');
  assert.equal(seal.v, 'the-crystal-seal/1');
  for (const [f, h] of Object.entries(seal.files)) { assert.equal(sha(readFileSync(at(f))), h, `${f} changed after the seal`); assert.ok(!readFileSync(at(f)).includes(13), `${f} holds a carriage return`); }
  const mine = readdirSync(at('src/')).filter((f) => f.endsWith('.mjs')).map((f) => `src/${f}`), seedFiles = rd('vendor/climb/PROVENANCE.json').files.map((f) => `vendor/climb/${f.path}`);
  assert.deepEqual(Object.keys(seal.files).sort(), [...mine, ...seedFiles, 'data/settings.json', 'data/seed.json', 'CLAIMS.md'].sort());
  const pub = rd('data/published.json');
  if (pub.sealed) { const r = rd(pub.sealed); assert.deepEqual([r.set, r.complete, r.sealSha256], ['sealed', true, sha(readFileSync(at('SEAL.json')))]); }
});
