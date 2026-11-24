import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import CL from '../src/claims.mjs';

// a crystal record and a record of The Climb's loop for the same problem, as counts need them
const cry = (id, tier, ok, more = {}) => ({ id, tier, ask: '2 × 3', complete: ok, home: ok, ticks: 2, calls: 2, capped: false, events: ok ? [{ tick: 1, kind: 'bond', canon: `${id}a`, klass: 'k', said: 'x' }, { tick: 2, kind: 'set', canon: `${id}b`, klass: 'k', said: null }] : [{ tick: 1, kind: 'dissolve', canon: `${id}a`, klass: 'k', said: 'x' }], ...more });
const clm = (id, tier, first, homeAt) => ({ id, tier, homeAt, passes: [{ home: first }] });
const n = (count, f) => Array.from({ length: count }, (_, i) => f(i));
// 20 easy (all complete; one try gets them), 40 climb (crystal 36, one try 8, climb 34), 20 wall with a calculation (crystal 6, climb 0)
const GOOD = () => ({
  crystals: [...n(20, (i) => cry(`e${i}`, 'easy', true)), ...n(40, (i) => cry(`c${i}`, 'climb', i < 36)), ...n(20, (i) => cry(`w${i}`, 'wall', i < 6))],
  climb: [...n(20, (i) => clm(`e${i}`, 'easy', true, 1)), ...n(40, (i) => clm(`c${i}`, 'climb', i < 8, i < 34 ? 2 : null)), ...n(20, (i) => clm(`w${i}`, 'wall', false, null))],
  fuzz: { seed: 9, cells: 20, tried: 2160, forged: { tried: 950, bonded: 0, unsound: 0, outside: 0 }, honest: { tried: 240, refused: 0 }, split: 0, threw: 0 },
  teeth: { planted: 12, caught: 12 },
});
const by = (v) => Object.fromEntries(v.map((x) => [x.id, x]));

test('every bar is the one CLAIMS.md registered, and every claim has a name', () => {
  const md = readFileSync(new URL('../CLAIMS.md', import.meta.url), 'utf8');
  for (const [id, bar] of Object.entries(CL.BARS)) assert.ok(md.includes(bar), `${id}: ${bar}`);
  assert.deepEqual(Object.keys(CL.BARS), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7']); assert.deepEqual(Object.keys(CL.NAMES), Object.keys(CL.BARS));
});

test('without the evidence every claim is pending, never passed or failed', () => {
  for (const F of [null, undefined, {}, { crystals: [] }, { crystals: 'x', climb: 7 }, { crystals: [{ id: 'f', ask: null, events: [] }] }]) { const v = CL.evaluate(F); assert.deepEqual(v.map((x) => x.id), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7']); assert.ok(v.every((x) => x.pass === null && x.result.startsWith('pending: ')), JSON.stringify(F)); }
  const G = GOOD(), only = by(CL.evaluate({ crystals: G.crystals }));
  assert.deepEqual([only.K1.pass, only.K2.pass, only.K3.pass, only.K4.pass, only.K5.pass, only.K6.pass, only.K7.pass], [true, true, null, null, null, true, null]);
  assert.deepEqual([only.K3.result, only.K4.result, only.K7.result], ['pending: needs the attack on the cells of the sealed run', 'pending: needs the crystal and one try on the same sealed problems', 'pending: needs the harness turned on the planted readers']);
  // the crystal with nothing grown, or The Climb's loop with nothing in it: still pending, in the same words
  for (const F of [{ ...G, crystals: [] }, { ...G, climb: [] }, { ...G, crystals: [{ id: 'f', ask: null, events: [] }] }, { ...G, climb: null }, { ...G, crystals: null }]) { const v = by(CL.evaluate(F)); assert.deepEqual([v.K4.pass, v.K4.result, v.K5.pass], [null, 'pending: needs the crystal and one try on the same sealed problems', null]); }
  const noWall = by(CL.evaluate({ ...G, crystals: G.crystals.filter((r) => r.tier !== 'wall') }));
  assert.deepEqual([noWall.K4.pass, noWall.K5.pass, noWall.K5.result], [true, null, 'pending: needs the crystal and The Climb on the sealed wall problems']);
  assert.equal(by(CL.evaluate({ ...G, climb: [clm('other', 'easy', true, 1)] })).K4.pass, null, 'no problem in both runs');
  for (const a of [{ tried: 0 }, { tried: 'x' }, {}, null, 7]) assert.equal(by(CL.evaluate({ ...G, fuzz: a })).K3.pass, null);
  for (const t of [{ planted: 0, caught: 0 }, { planted: 'x' }, {}, null, 7]) assert.equal(by(CL.evaluate({ ...G, teeth: t })).K7.pass, null);
});

test('the verdicts on a run where the crystal works', () => {
  const v = by(CL.evaluate(GOOD()));
  assert.deepEqual(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.pass])), { K1: true, K2: true, K3: true, K4: true, K5: true, K6: true, K7: true });
  assert.equal(v.K1.result, '62 crystals completed, 0 of them with a wrong answer');
  assert.equal(v.K2.result, '0 of 80 crystals ran into the limit on rounds; 18 did not complete, 0 of them with no dissolved cell; the deepest took 2 rounds');
  assert.equal(v.K3.result, '0 of 950 forged replies bonded (0 that would have been false, 0 outside the three forms); 0 of 240 honest replies were refused; the two readers ruled differently on 0 of 2160 replies; 0 threw. 20 cells, seed 9');
  assert.equal(v.K7.result, '12 of 12 planted leaks were found');
  assert.match(v.K4.result, /^one try 35\.0%, the crystal 77\.5% of 80 problems; 34 only the crystal finished, 0 only the one try, p = /);
  assert.equal(v.K5.result, 'of 20 wall problems that carry a calculation: the crystal completed 6, The Climb brought home 0; 6 only the crystal, 0 only The Climb');
  assert.equal(v.K6.result, '0 cells were asked twice; 62 of the 124 cells that set were set from what was held (50.0%), and 62 were bonded by the model in 160 calls');
});

test('each bar, at and just past its edge', () => {
  const put = (change) => { const F = GOOD(); change(F); return by(CL.evaluate(F)); };
  // K1: one wrong completion fails it
  assert.equal(put((F) => { F.crystals[0] = cry('e0', 'easy', true, { home: false }); }).K1.pass, false);
  // K2: a crystal that ran into the limit, or stopped with nothing dissolved
  assert.equal(put((F) => { F.crystals[39] = cry('c19', 'climb', false, { capped: true }); }).K2.pass, false);
  assert.equal(put((F) => { F.crystals[79] = cry('w19', 'wall', false, { events: [{ tick: 1, kind: 'split', canon: 'z', klass: 'k', said: 'x' }] }); }).K2.pass, false);
  assert.equal(put((F) => { F.crystals[79] = cry('w19', 'wall', false, { events: 7 }); }).K2.pass, false);
  // K3: one forgery bonding, or one honest reply refused
  assert.equal(put((F) => { F.fuzz.forged.bonded = 1; }).K3.pass, false); assert.equal(put((F) => { F.fuzz.honest.refused = 1; }).K3.pass, false); assert.equal(put((F) => { F.fuzz.split = 1; }).K3.pass, false); assert.equal(put((F) => { F.fuzz.threw = 1; }).K3.pass, false);
  assert.equal(put((F) => { delete F.fuzz.forged; }).K3.pass, false, 'a count that is missing is not a count of none'); assert.equal(put((F) => { delete F.fuzz.honest; }).K3.pass, false);
  // K7: every planted leak found
  assert.equal(put((F) => { F.teeth.caught = 11; }).K7.pass, false); assert.equal(put((F) => { F.teeth.caught = 11; }).K7.result, '11 of 12 planted leaks were found'); assert.equal(put((F) => { F.teeth = { planted: 1, caught: 1 }; }).K7.pass, true);
  // K4: more than one try, by the test
  assert.equal(put((F) => { F.crystals = F.crystals.map((r, i) => cry(r.id, r.tier, F.climb[i].passes[0].home)); }).K4.pass, false, 'the same as one try');
  assert.equal(put((F) => { F.crystals = F.crystals.map((r, i) => cry(r.id, r.tier, F.climb[i].passes[0].home || (i >= 28 && i < 33))); }).K4.pass, false, 'five more is not enough for the test');
  assert.equal(put((F) => { F.crystals = F.crystals.map((r, i) => cry(r.id, r.tier, F.climb[i].passes[0].home || (i >= 28 && i < 34))); }).K4.pass, true, 'six more, none lost');
  assert.equal(put((F) => { F.crystals = F.crystals.map((r) => cry(r.id, r.tier, false)); }).K4.pass, false, 'fewer than one try');
  // K5: at least one wall problem only the crystal finished, and none only The Climb did
  assert.equal(put((F) => { F.crystals = F.crystals.map((r) => (r.tier === 'wall' ? cry(r.id, 'wall', r.id === 'w0') : r)); }).K5.pass, true, 'exactly one');
  assert.equal(put((F) => { F.crystals = F.crystals.map((r) => (r.tier === 'wall' ? cry(r.id, 'wall', false) : r)); }).K5.pass, false, 'none');
  assert.equal(put((F) => { F.climb[79] = clm('w19', 'wall', false, 3); }).K5.pass, false, 'The Climb brought one home that the crystal did not complete');
  assert.equal(put((F) => { F.climb[60] = clm('w0', 'wall', false, 3); }).K5.pass, true, 'one both finished changes nothing');
  // K6: no cell asked twice, and one in ten set from what was held
  const sets = (k, b) => [{ id: 'a', tier: 'easy', ask: '2 × 3', complete: true, home: true, ticks: 1, calls: b, events: [...n(b, (i) => ({ tick: 1, kind: 'bond', canon: `b${i}`, klass: 'k', said: 'x' })), ...n(k, (i) => ({ tick: 1, kind: 'set', canon: `s${i}`, klass: 'k', said: null }))] }];
  assert.equal(by(CL.evaluate({ crystals: sets(1, 9) })).K6.pass, true, 'exactly 1 in 10'); assert.equal(by(CL.evaluate({ crystals: sets(1, 10) })).K6.pass, false, '1 in 11');
  assert.equal(by(CL.evaluate({ crystals: [{ ...sets(5, 5)[0], events: [...sets(5, 5)[0].events, { tick: 2, kind: 'split', canon: 'b0', klass: 'k', said: 'again' }] }] })).K6.pass, false, 'a cell asked twice');
  assert.equal(by(CL.evaluate({ crystals: [{ id: 'a', tier: 'easy', ask: '2 × 3', complete: false, home: false, ticks: 1, calls: 1, events: [{ tick: 1, kind: 'dissolve', canon: 'c', klass: 'k', said: 'x' }] }] })).K6.pass, null, 'nothing set: nothing to take a share of');
});
