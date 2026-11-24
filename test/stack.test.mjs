import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import S from '../src/stack.mjs';
import M from '../src/measure.mjs';
import F from '../src/fuzz.mjs';
import LAT from '../src/lattice.mjs';
import G from '../src/grow.mjs';
import B from '../src/bond.mjs';
import X from '../vendor/climb/src/exact.mjs';

const val = (t) => X.show(X.evaluate(t).value);
const task = (id, ask, tier = 'climb') => ({ id, sheet: 0, family: 't', tier, statement: ask, ask, check: { type: 'value', value: val(ask) } });
const emit = (rows, depth) => Object.fromEntries(rows[depth].emits.map((e) => [e.label, e.value]));

test('the stack is seven layers, floor to ceiling, each with one module, one job and a limit it cannot run past', () => {
  assert.deepEqual(S.LAYERS.map((l) => l.depth), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(S.LAYERS.map((l) => l.name), ['The substrate', 'The step watcher', 'The trajectory watcher', 'The topology watcher', 'The ceiling watcher', 'The axiom-floor watcher', 'The human']);
  assert.deepEqual(S.LAYERS.map((l) => l.status), ['built', 'built', 'built', 'built', 'built', 'parked', 'always on']);
  for (const l of S.LAYERS) { assert.deepEqual(Object.keys(l), ['depth', 'name', 'module', 'job', 'stops', 'ends', 'status']); for (const k of ['name', 'module', 'job', 'ends']) assert.ok(typeof l[k] === 'string' && l[k].length > 5, `${l.depth} ${k}`); }
  assert.equal(S.LAYERS[0].stops, null, 'the floor watches nothing'); for (const l of S.LAYERS.slice(1)) assert.ok(typeof l.stops === 'string' && l.stops.length > 10);
  // every limit a layer names is the limit the code holds
  assert.equal(S.LAYERS[0].ends, `a reply is cut off at ${G.SETTINGS.maxTokens} tokens`); assert.equal(S.LAYERS[1].ends, `one reply, read once, ${B.LIMIT} characters at most`);
  assert.equal(S.LAYERS[2].ends, `a cell is asked once and split again at most ${G.AGAIN} times; a crystal has ${G.SETTINGS.maxTicks} rounds at most`);
  assert.equal(S.LAYERS[3].ends, `${LAT.SITES.length} places in the lattice; the glass draws 8192 cells at most and slows to 12 frames a second while the model works`);
  assert.equal(S.LAYERS[4].ends, `${F.BUDGET.forged + F.BUDGET.honest + F.BUDGET.noise} replies for each cell, from a seed`); assert.equal(S.LAYERS[4].ends, '108 replies for each cell, from a seed');
  const gem = readFileSync(new URL('../page/gem.js', import.meta.url), 'utf8');
  assert.ok(gem.includes('const MAX = 8192,'), 'the glass draws 8192 cells at most'); assert.ok(gem.includes('S.busy ? 1000 / 12 :'), 'and slows to 12 frames a second while the model works');
  // the modules the built layers name are files that are there
  for (const l of S.LAYERS) for (const file of l.module.split(', ').filter((m) => m.includes('/'))) assert.doesNotThrow(() => readFileSync(new URL(`../${file.startsWith('vendor') || file.startsWith('src') ? file : `vendor/climb/src/${file}`}`, import.meta.url)), file);
});

test('with nothing measured, every layer says so and none says nought', () => {
  for (const F0 of [null, undefined, {}, 7, { m: null, fuzz: null, teeth: null, counts: null, seal: null }, { m: 5, fuzz: 'x', teeth: [], counts: 3, seal: 9 }]) {
    const rows = S.stack(F0);
    assert.equal(rows.length, 7); assert.deepEqual(rows.map((r) => r.emits.length), [2, 2, 4, 5, 4, 0, 1]);
    for (const r of rows) for (const e of r.emits) { assert.equal(typeof e.label, 'string'); assert.equal(e.value, null, `${r.depth} ${e.label}`); }
    assert.deepEqual(rows.map(({ emits, ...layer }) => layer), S.LAYERS);
  }
});

test('each layer puts out what the run counted, and nothing else', async () => {
  const say = (c) => (c === '7 × 8' ? 'fifty-six' : c === '26 × 7' ? '26 × 7 = 183' : `${c} = ${val(c)}`);
  const out = await G.run([task('a:1', '26 × 21 + 26 × 7'), task('b:1', '7 × 8 + 2 × 3'), task('c:1', '26 × 21 + 5')], async (m) => ({ text: say(m[m.length - 1].content), ms: 100 }), { mem: { probes: 12 } });
  const m = M.measure(out.records), L = LAT.lattice([], out.records), cells = ['26 × 12', '4 + 8'], fz = F.fuzz(cells, { seed: 3 }), th = F.teeth(cells, { seed: 3, budget: { forged: 96, honest: 12, noise: 12 } });
  const rows = S.stack({ m, fuzz: fz, teeth: th, counts: L.counts, seal: 'abcdef0123456789abcdef' });
  assert.deepEqual(emit(rows, 0), { 'replies it gave': m.asked, 'kinds of step it gets right at least 19 times in 20': 'none yet' });
  assert.deepEqual(emit(rows, 1), { 'replies that bonded': `${m.events.bond} of ${m.asked} (${((m.events.bond / m.asked) * 100).toFixed(1)}%)`, 'replies refused, by the reason': 'not a statement 1, wrong value 1' });
  assert.deepEqual(emit(rows, 2), { 'steps split smaller': m.events.split, 'steps washed away': 1, 'rounds in the deepest crystal': m.depth.deepest, 'crystals that ran into the limit on rounds': 0 });
  const d3 = emit(rows, 3), placed = L.cells.length;
  assert.equal(d3['cells set from what was already held, with no model call'], `${m.events.set} of ${m.events.set + m.events.bond} (${((m.events.set / (m.events.set + m.events.bond)) * 100).toFixed(1)}%)`); assert.ok(m.events.set >= 1);
  assert.equal(d3['calls that carried the last conversation on'], `${m.carried.calls} of ${m.calls} (${((m.carried.calls / m.calls) * 100).toFixed(1)}%)`); assert.equal(d3['middle time of a call carried on, and of one begun afresh'], '100 ms, 100 ms');
  assert.equal(d3['cells ready in one round, at the widest'], m.width.widest); assert.equal(d3['places filled in the lattice'], `${placed} of 10425 (${((placed / 10425) * 100).toFixed(1)}%)`);
  assert.equal(placed, L.counts.bond + L.counts.dissolve + L.counts.dark + L.counts.home);
  assert.deepEqual(emit(rows, 4), { 'forged replies that bonded': `0 of ${fz.forged.tried} (0.0%)`, 'honest replies refused': '0 of 24 (0.0%)', 'replies the two readers ruled differently on': `0 of ${fz.tried} (0.0%)`, 'planted leaks found': '12 of 12 (100.0%)' });
  assert.deepEqual(emit(rows, 5), {}); assert.deepEqual(emit(rows, 6), { 'the seal this page was built under': 'abcdef012345' });
  // the floor is named once the model has been asked a kind of step ten times and got it right nineteen times in twenty
  const held = S.stack({ m: { ...m, classes: { 'digit × digit': { asked: 20, bonded: 19 }, 'long product': { asked: 20, bonded: 18 }, half: { asked: 10, bonded: 10 } } } });
  assert.equal(emit(held, 0)['kinds of step it gets right at least 19 times in 20'], 'digit × digit, half');
  // cells with no place left are not counted as filled; a count of nought is a count, and is said
  assert.equal(emit(S.stack({ counts: { seed: 10, bond: 5, dissolve: 1, dark: 2, home: 1, unplaced: 4 } }), 3)['places filled in the lattice'], '15 of 10425 (0.1%)');
  assert.equal(emit(S.stack({ counts: {} }), 3)['places filled in the lattice'], '0 of 10425 (0.0%)');
  const none = S.stack({ m: M.measure([]), fuzz: { tried: 0, split: 0, forged: { tried: 0, bonded: 0 }, honest: { tried: 0, refused: 0 } }, teeth: { planted: 0, caught: 0 } });
  assert.deepEqual(emit(none, 1), { 'replies that bonded': '0 of 0', 'replies refused, by the reason': 'none' }); assert.equal(emit(none, 4)['planted leaks found'], '0 of 0'); assert.equal(emit(none, 3)['middle time of a call carried on, and of one begun afresh'], null);
  assert.equal(emit(S.stack({ seal: '' }), 6)['the seal this page was built under'], null);
  // half a count is no count: a number with nothing to set it against, or one time without the other, is not shown
  assert.equal(emit(S.stack({ m: { asked: 5, events: {} } }), 1)['replies that bonded'], null); assert.equal(emit(S.stack({ m: { events: { bond: 3 } } }), 1)['replies that bonded'], null);
  assert.equal(emit(S.stack({ teeth: { caught: 3 } }), 4)['planted leaks found'], null); assert.equal(emit(S.stack({ teeth: { planted: 12 } }), 4)['planted leaks found'], null);
  assert.equal(emit(S.stack({ m: { carried: { calls: 1, ms: 100, fresh: null } } }), 3)['middle time of a call carried on, and of one begun afresh'], null);
  assert.equal(emit(S.stack({ m: { carried: { calls: 0, ms: null, fresh: 80 } } }), 3)['middle time of a call carried on, and of one begun afresh'], null);
  assert.equal(emit(S.stack({ m: { carried: { calls: 2, ms: 99.6, fresh: 80.4 } } }), 3)['middle time of a call carried on, and of one begun afresh'], '100 ms, 80 ms');
});
