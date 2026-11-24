import { test } from 'node:test';
import assert from 'node:assert/strict';
import M from '../src/measure.mjs';
import G from '../src/grow.mjs';
import X from '../vendor/climb/src/exact.mjs';

const val = (t) => X.show(X.evaluate(t).value);
const task = (id, ask, tier = 'climb') => ({ id, sheet: 0, family: id.split(':')[0], tier, statement: `Work out ${ask}.`, ask, check: { type: 'value', value: val(ask) } });
const right = (cell) => `${cell} = ${val(cell)}`, wrong = (cell) => `${cell} = ${X.show(X.add(X.evaluate(cell).value, X.num('1')))}`;
const call = (rule) => async (m) => ({ text: rule(m[m.length - 1].content), ms: 500, prompt: 40, reply: 6 });

test('measure: the counts of a run are counts of what happened in its records', async () => {
  const tasks = [task('a:1', '26 × 21 + 26 × 7', 'climb'), task('b:1', '7 × 8 + 2 × 3', 'wall'), { id: 'factor:1', tier: 'wall', ask: null, check: { type: 'factors', n: '16637' } }, task('c:1', '5 × 6', 'easy'), task('d:1', '26 × 21 + 1', 'climb')];
  const out = await G.run(tasks, call((cell) => (cell === '7 × 8' || cell === '26 × 21' ? wrong(cell) : right(cell))), { mem: { probes: 12 } });
  const m = M.measure(out.records), all = out.records.flatMap((r) => r.events);
  assert.deepEqual([m.problems, m.grown, m.none, m.complete, m.wrong, m.dark, m.capped], [5, 4, 1, 3, 0, 1, 0]); assert.equal(m.share, 0.75);
  assert.deepEqual(m.events, { set: all.filter((e) => e.kind === 'set').length, bond: all.filter((e) => e.kind === 'bond').length, split: all.filter((e) => e.kind === 'split').length, dissolve: 1 });
  assert.equal(m.calls, out.records.reduce((a, r) => a + r.calls, 0)); assert.equal(m.asked, all.filter((e) => e.said !== null).length); assert.equal(m.asked, m.calls); assert.equal(m.repeats, 0);
  assert.equal(m.reused, m.events.set / (m.events.set + m.events.bond)); assert.ok(m.events.set >= 3, 'the last problem is handed what the first one grew');
  assert.deepEqual(m.depth, { deepest: Math.max(...out.records.map((r) => r.ticks)), complete: Math.max(...out.records.filter((r) => r.complete).map((r) => r.ticks)), mean: out.records.filter((r) => r.ask).reduce((a, r) => a + r.ticks, 0) / 4 });
  assert.equal(m.width.widest, 2); assert.ok(m.width.mean > 1 && m.width.mean <= 2);
  assert.deepEqual(m.tiers, { easy: { problems: 1, complete: 1 }, climb: { problems: 2, complete: 2 }, wall: { problems: 1, complete: 0 } });
  assert.deepEqual(m.tokens, { prompt: 40 * m.asked, reply: 6 * m.asked }); assert.equal(m.seconds, 0.5 * m.asked);
  // each kind of step: asked, and what became of it
  assert.deepEqual(m.classes['digit × digit'], { asked: 3, bonded: 2, split: 0, dissolved: 1 }); assert.deepEqual(m.classes['long product'], { asked: 2, bonded: 0, split: 2, dissolved: 0 }, 'asked once in each of the two problems that hold it');
  assert.equal(Object.values(m.classes).reduce((a, c) => a + c.asked, 0), m.asked); for (const c of Object.values(m.classes)) assert.equal(c.asked, c.bonded + c.split + c.dissolved);
});

test('measure: a completion that is not right, a cell asked twice and a run cut short are all counted, never hidden', () => {
  const recs = [
    { id: 'x:1', ask: '2 × 3', tier: 'easy', complete: true, home: false, ticks: 1, calls: 1, events: [{ tick: 1, kind: 'bond', canon: 'c', klass: 'digit × digit', said: 'x' }] },
    { id: 'y:1', ask: '2 × 3', tier: 'easy', complete: false, home: false, capped: true, ticks: 9, calls: 2, events: [{ tick: 1, kind: 'split', canon: 'c', klass: 'k', said: 'a' }, { tick: 2, kind: 'dissolve', canon: 'c', klass: 'k', said: 'b' }, { tick: 2, kind: 'other', canon: 'd', klass: 'k', said: null }] },
    { id: 'z:1', ask: '2 × 3', tier: 'none', complete: true, home: true, ticks: 0, calls: 0, events: [] },
  ];
  const m = M.measure(recs);
  assert.deepEqual([m.complete, m.wrong, m.dark, m.capped, m.repeats, m.asked, m.calls], [2, 1, 1, 1, 1, 3, 3]); assert.equal(m.share, 1 / 3);
  assert.deepEqual(m.tiers.easy, { problems: 2, complete: 0 }); assert.deepEqual(m.depth, { deepest: 9, complete: 1, mean: 10 / 3 }); assert.deepEqual(m.classes.k, { asked: 2, bonded: 0, split: 1, dissolved: 1 });
  assert.deepEqual(m.events, { set: 0, bond: 1, split: 1, dissolve: 1 }); assert.equal(m.width.widest, 2); assert.equal(m.reused, 0);
});

test('floor: the kinds of step the model got right nearly every time', () => {
  const classes = { a: { asked: 20, bonded: 19 }, b: { asked: 20, bonded: 18 }, c: { asked: 9, bonded: 9 }, d: { asked: 10, bonded: 10 }, e: { asked: 100, bonded: 95 }, f: { asked: 100, bonded: 94 } };
  assert.deepEqual(M.floor(classes), ['a', 'd', 'e']); assert.deepEqual(M.floor(classes, 5), ['a', 'c', 'd', 'e']); assert.deepEqual(M.floor(classes, 21), ['e']);
  assert.deepEqual(M.floor(null), []); assert.deepEqual(M.floor({}), []); assert.deepEqual(M.floor('x'), []);
});

test('against: the same problems under the crystal and under another loop', () => {
  const c = (id, ok, tier = 'climb', ask = '2 × 3') => ({ id, ask, tier, complete: ok, home: ok }), o = (id, homeAt) => ({ id, homeAt });
  const crystals = [c('a', true), c('b', true), c('c', false), c('d', false, 'wall'), c('e', true, 'wall'), c('f', true, 'wall', null), c('g', true)];
  const others = [o('a', 1), o('b', null), o('c', 2), o('d', null), o('e', null), o('f', 1), o('zzz', 1)];
  const r = M.against(crystals, others, (x) => x.homeAt !== null);
  assert.deepEqual([r.both, r.only, r.other, r.neither, r.compared], [1, 2, 1, 1, 5], 'a problem with no calculation, or in one run only, is not compared'); assert.equal(r.p, 1);
  assert.deepEqual(M.against(crystals, others, (x) => x.homeAt !== null, 'wall'), { both: 0, only: 1, other: 0, neither: 1, compared: 2, p: 1 });
  const many = M.against(Array.from({ length: 8 }, (_, i) => c(`p${i}`, true)), Array.from({ length: 8 }, (_, i) => o(`p${i}`, null)), (x) => x.homeAt !== null);
  assert.deepEqual([many.only, many.other], [8, 0]); assert.equal(many.p, 2 / 256);
  assert.deepEqual(M.against(null, null, () => true), { both: 0, only: 0, other: 0, neither: 0, compared: 0, p: 1 });
  // a crystal that completed wrong does not count as finished
  assert.equal(M.against([{ id: 'a', ask: '2 × 3', complete: true, home: false }], [o('a', null)], () => false).neither, 1);
});

test('nothing throws on a broken record', () => {
  const empty = M.measure(null);
  assert.deepEqual([empty.problems, empty.grown, empty.complete, empty.share, empty.reused, empty.depth.mean, empty.width.mean], [0, 0, 0, null, null, null, null]);
  for (const bad of [undefined, 7, 'x', {}, [null, 5, 'x', {}, { ask: '2 × 3', events: 7 }, { ask: '2 × 3', events: [null, 3, {}, { kind: 'bond' }] }]]) assert.doesNotThrow(() => M.measure(bad));
  assert.equal(M.measure([null, 5, {}, { ask: '2 × 3', events: [null, { kind: 'bond', said: 'x' }] }]).grown, 1);
  assert.deepEqual(M.TIERS, ['easy', 'climb', 'wall']);
});

test('measure: the bond-check\'s rulings are counted by reason, and calls that carried the conversation on are timed apart', async () => {
  const slow = { '26 × 21': 900, '546 + 182': 100, '7 × 8': 800, '2 × 3': 300, '56 + 6': 120, '5 × 6': 700 };
  const say = (cell) => (cell === '7 × 8' ? 'fifty-six' : cell === '26 × 7' ? '26 × 7 = 183' : cell === '20 × 7' ? '7 × 21 = 147' : right(cell));
  const out = await G.run([task('a:1', '26 × 21 + 26 × 7'), task('b:1', '7 × 8 + 2 × 3'), task('c:1', '5 × 6', 'easy')], async (m) => { const c = m[m.length - 1].content; return { text: say(c), ms: slow[c] ?? 200, prompt: 40, reply: 6 }; }, {});
  const m = M.measure(out.records), asked = out.records.flatMap((r) => r.events).filter((e) => e.said !== null);
  assert.deepEqual(m.whys, { bonded: asked.filter((e) => e.kind === 'bond').length, 'wrong value': 1, 'not a statement': 1, 'another step': 1 });
  assert.equal(Object.values(m.whys).reduce((a, b) => a + b, 0), m.asked);
  const warm = asked.filter((e) => e.carried === true).map((e) => e.ms).sort((a, b) => a - b), cold = asked.filter((e) => e.carried !== true).map((e) => e.ms).sort((a, b) => a - b);
  assert.ok(warm.length >= 3 && cold.length >= 4); assert.deepEqual(m.carried, { calls: warm.length, ms: warm[(warm.length - 1) >> 1], fresh: cold[(cold.length - 1) >> 1] });
  // the middle of an even list is the lower of its two middle values; of one value, that value; of none, nothing
  const rec = (ms, carried) => ({ id: 'x', ask: '2 × 3', events: ms.map((t, i) => ({ tick: 1, kind: 'bond', canon: `c${i}`, klass: 'k', said: 'x', why: 'bonded', carried, ms: t })) });
  assert.deepEqual(M.measure([rec([40, 10, 30, 20], true)]).carried, { calls: 4, ms: 20, fresh: null }); assert.deepEqual(M.measure([rec([40, 10, 30], false)]).carried, { calls: 0, ms: null, fresh: 30 });
  assert.deepEqual(M.measure([rec([7], true), rec([100, 9], false)]).carried, { calls: 1, ms: 7, fresh: 9 }); assert.deepEqual(M.measure([rec([5, 100, 9], true)]).carried.ms, 9);
  // a record made before the ruling was kept is counted as that, never as a bond
  assert.deepEqual(M.measure([{ id: 'x', ask: '2 × 3', events: [{ tick: 1, kind: 'bond', canon: 'a', klass: 'k', said: 'x' }, { tick: 1, kind: 'split', canon: 'b', klass: 'k', said: 'y', why: 7 }] }]).whys, { 'not recorded': 2 });
  assert.deepEqual(M.measure([]).whys, {}); assert.deepEqual(M.measure([]).carried, { calls: 0, ms: null, fresh: null });
});

test('measure: what is not a record is not counted as a problem', () => {
  const one = { id: 'x', tier: 'easy', ask: '2 × 3', complete: true, home: true, ticks: 1, calls: 1, events: [] };
  assert.deepEqual([M.measure([one, null, 7, 'x', undefined]).problems, M.measure([one, null, 7, 'x', undefined]).grown, M.measure([one, null]).none], [1, 1, 0]);
  assert.deepEqual([M.measure([one, {}, []]).problems, M.measure([one, {}, []]).grown, M.measure([one, {}, []]).none], [3, 1, 2]);
});
