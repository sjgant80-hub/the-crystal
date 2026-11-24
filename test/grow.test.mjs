import { test } from 'node:test';
import assert from 'node:assert/strict';
import G from '../src/grow.mjs';
import B from '../src/bond.mjs';
import X from '../vendor/climb/src/exact.mjs';
import LEFT from '../vendor/climb/src/left.mjs';
import KEEP from '../vendor/climb/src/keep.mjs';

const val = (t) => X.show(X.evaluate(t).value);
const task = (id, ask, tier = 'climb') => ({ id, sheet: 0, family: id.split(':')[0], tier, statement: `Work out ${ask}.`, ask, check: { type: 'value', value: val(ask) } });
const cellOf = (m) => m[m.length - 1].content;
// scripted models: each sees every conversation it is asked
const model = (rule) => { const seen = []; return { seen, call: async (messages, maxTokens) => { seen.push({ messages: messages.map((x) => ({ ...x })), maxTokens }); return { text: rule(cellOf(messages)), ms: 5, prompt: 40, reply: 6 }; } }; };
const right = (cell) => `${cell} = ${val(cell)}`;
const wrong = (cell) => `${cell} = ${X.show(X.add(X.evaluate(cell).value, X.num('1')))}`;
const SMALL = ['digit × digit', 'digit × digit, with noughts', 'digit + digit', 'sum, places apart', 'half', 'division'];
// right only on the smallest steps: single digits, noughts, sums whose places do not meet, halves, a teen less a digit
const small = (cell) => (SMALL.includes(G.klass(cell)) || (G.klass(cell) === 'difference' && X.evaluate(cell).tree.args.every((a) => a.value.n >= 0n && a.value.n < 20n)) ? right(cell) : wrong(cell));
const kinds = (r) => r.events.map((e) => `${e.tick} ${e.kind} ${e.cell}`);

test('klass: the kind of step a cell is, by the size of its numbers', () => {
  const k = (t) => G.klass(t);
  assert.equal(k('7 × 8'), 'digit × digit'); assert.equal(k('40 × 300'), 'digit × digit, with noughts'); assert.equal(k('4 × 100'), 'digit × digit, with noughts'); assert.equal(k('7 × 10'), 'digit × digit, with noughts');
  assert.equal(k('26 × 7'), 'two digits × one'); assert.equal(k('7 × 26'), 'two digits × one'); assert.equal(k('26 × 70'), 'two digits × one'); assert.equal(k('260 × 7'), 'two digits × one', 'noughts at the end do not count');
  assert.equal(k('225 × 7'), 'three or more digits × one'); assert.equal(k('30 × 361'), 'three or more digits × one'); assert.equal(k('26 × 12'), 'long product'); assert.equal(k('225 × 37'), 'long product');
  assert.equal(k('0.5 × 26'), 'half'); assert.equal(k('26 × 0.5'), 'half'); assert.equal(k('1.5 × 20'), 'other'); assert.equal(k('7 × -8'), 'other');
  assert.equal(k('4 + 8'), 'digit + digit'); assert.equal(k('8000 + 600'), 'sum, places apart'); assert.equal(k('600 + 8000'), 'sum, places apart'); assert.equal(k('270 + 8'), 'sum, places apart');
  assert.equal(k('8400 + 200'), 'sum, places overlap'); assert.equal(k('63 + 27'), 'sum, places overlap'); assert.equal(k('274 + 8'), 'sum, places overlap'); assert.equal(k('40 + 8'), 'sum, places apart');
  assert.equal(k('494 - 228'), 'difference'); assert.equal(k('14 - 7'), 'difference'); assert.equal(k('546 ÷ 2'), 'division'); assert.equal(k('21^2'), 'other'); assert.equal(k('1.5 + 2'), 'other');
  for (const bad of ['12', '2 × 3 × 4', 'abc', '', null, undefined, 7, '-5', '--5']) assert.equal(k(bad), 'other', String(bad));
});

test('finer: taking away one place digit against digit, borrowing ten, turning round below nothing, a sign out of a product', () => {
  const f = (t) => G.finer(t);
  assert.equal(f('456 - 300'), '56 + (4 - 3) × 100'); assert.equal(f('400 - 300'), '(4 - 3) × 100'); assert.equal(f('47 - 3'), '40 + (7 - 3)'); assert.equal(f('456 - 50'), '406 + (5 - 5) × 10');
  assert.equal(f('1240 - 70'), '1100 + (14 - 7) × 10'); assert.equal(f('570 - 7'), '560 + (10 - 7)'); assert.equal(f('600 - 30'), '500 + (10 - 3) × 10'); assert.equal(f('100 - 1'), '90 + (10 - 1)');
  assert.equal(f('140 - 70'), '(14 - 7) × 10', 'nothing else in the first number'); assert.equal(f('20 - 5'), '10 + (10 - 5)');
  assert.equal(f('231 - 551'), '-(551 - 231)'); assert.equal(f('4 - 144'), '-(144 - 4)'); assert.equal(f('7 × -55'), '-(7 × 55)'); assert.equal(f('-7 × 55'), '-(7 × 55)'); assert.equal(f('-7 × -55'), '7 × 55'); assert.equal(f('0.5 × -6'), '-(0.5 × 6)'); assert.equal(f('0 × -5'), '-(0 × 5)'); assert.equal(f('-5 × 0'), '-(5 × 0)'); assert.equal(f('-0.5 × -0.5'), '0.5 × 0.5');
  // facts and things with nothing smaller
  for (const none of ['14 - 7', '9 - 4', '10 - 3', '7 - 7', '18 - 9', '1000 - 437', '456 - 123', '5 - 0', '15 - 0', '0 - 5', '0 - 0', '4.5 - 2', '5.5 - 2', '47.5 - 3', '5 - 2.5', '47 - 2.5', '47.5 - 2.5', '-5 - 3', '5 - -3', '-5 - -3', '10 - 3 - 2', '13 + 4', '94048 + 800', '6280 + 9', '7 × 55', '0 × 5', '5 × 0', '0 × 0', '12 ÷ -4', '-12 ÷ 4', '-(5 - 3)', '2 × 3 × 4', '12', '-5', '--5', 'abc', '', null, undefined, 7]) assert.equal(f(none), null, String(none));
  // every one is working that comes to exactly what the cell comes to, and never the result itself
  let s = 5, made = 0;
  const r = (lo, hi) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return lo + (s >>> 8) % (hi - lo + 1); };
  for (let i = 0; i < 1500; i++) {
    const a = r(0, 3) === 0 ? r(1, 30) : r(1, 9999), b = [r(1, 9), r(1, 9) * 10, r(1, 9) * 100, r(1, 9) * 1000, r(1, 999)][r(0, 4)], cell = i % 9 === 8 ? `${a} × -${b}` : `${a} - ${b}`;
    const way = f(cell);
    if (way === null) continue;
    made++;
    const e = X.evaluate(way);
    assert.ok(e !== null && e.ops >= 1, `${cell}: ${way}`); assert.ok(X.same(e.value, X.evaluate(cell).value), `${cell} = ${way}`); assert.notEqual(way, val(cell));
    // and it is smaller: the cell itself is not a step of it
    assert.ok(!LEFT.atoms(LEFT.start(way)).some((x) => x.canon === X.evaluate(cell).canon), `${cell} is inside ${way}`);
  }
  assert.ok(made > 900, String(made));
});

test('frontier: the cells of one tick share no number, and a dissolved cell is left out', () => {
  const f = (t, dead) => G.frontier(LEFT.start(t), dead).map((c) => c.text);
  assert.deepEqual(f('26 × 21 + 26 × 7'), ['26 × 21', '26 × 7']); assert.deepEqual(f('15 × 15 × 37'), ['15 × 15']); assert.deepEqual(f('0.5 × 26 × 21 × 21'), ['0.5 × 26', '21 × 21']);
  assert.deepEqual(f('9000 + 1800 + 30 + 2400 + 480 + 8'), ['9000 + 1800', '30 + 2400', '480 + 8']); assert.deepEqual(f('1 + 2 + 3'), ['1 + 2']); assert.deepEqual(f('8325'), []);
  assert.deepEqual(f('(19 + 38) × 20 ÷ 2'), ['19 + 38']); assert.deepEqual(f('13 × (12 × 38 - 19 × 16) - 26 × (19 × 38 - 12 × 13)'), ['12 × 38', '19 × 16', '19 × 38', '12 × 13']);
  assert.deepEqual(f('15 × 15 × 37', new Set(['*(15,15)'])), ['15 × 37'], 'with one way gone, another pair is tried'); assert.deepEqual(f('15 × 37', new Set(['*(15,37)'])), []);
  assert.deepEqual(f('15 × 15 × 37', 'not a set'), ['15 × 15']); assert.deepEqual(f('2 × 3 + 2 × 3'), ['2 × 3'], 'the same step standing twice is one cell');
  assert.deepEqual(f('1 + 2 + 3 + 4 + 5 + 6 + 7'), ['1 + 2', '3 + 4', '5 + 6'], 'paired by where the numbers stand, each number once'); assert.deepEqual(f('100 - 30 - 7 + 5'), ['100 - 30', '5 - 7']);
  assert.deepEqual(f('12 ÷ 4 + 2^3'), ['12 ÷ 4', '2^3']); assert.deepEqual(f('12 ÷ 4', new Set(['/(12,4)'])), []); assert.deepEqual(f('1 + 2 + 3', new Set(['+(1,2)'])), ['1 + 3']); assert.deepEqual(f('1 + 2 + 3', new Set(['+(1,2)', '+(1,3)'])), ['2 + 3']);
  assert.deepEqual(G.frontier(null), []); assert.deepEqual(G.frontier({}), []); assert.deepEqual(G.frontier('x', new Set()), []);
  assert.deepEqual(G.frontier(LEFT.start('26 × 21 + 5'), new Set())[0], { text: '26 × 21', canon: '*(21,26)' });
  // bonding every cell of a tick, in any order, is always possible: none stands on another's numbers
  for (const t of ['13 × (12 × 38 - 19 × 16) - 26 × (19 × 38 - 12 × 13) + 4 × (19 × 16 - 12 × 12)', '21 × 21 + 18 × 18 + 26 × 26', '1 + 2 + 3 + 4 + 5 + 6 + 7', '2 × 3 × 4 × 5 × 6']) {
    const x = LEFT.start(t), cells = G.frontier(x, new Set());
    assert.ok(cells.length >= 2, t);
    for (const order of [cells, [...cells].reverse()]) { let at = x; for (const c of order) { const got = LEFT.cross(at, c.text, X.evaluate(c.text).value); assert.ok(got !== null, `${c.text} in ${LEFT.left(at)}`); at = got.left; } assert.ok(LEFT.ops(at) <= LEFT.ops(x) - cells.length); }
  }
});

test('asking: the system line, the examples, the cells that have bonded with the replies that bonded them, then the cell', () => {
  const m = G.asking([['26 × 12', '26 × 12 = 312']], { text: '312 + 5' });
  assert.equal(m.length, 1 + 2 * G.SHOTS.length + 2 + 1); assert.deepEqual(m[0], { role: 'system', content: G.SYSTEM }); assert.deepEqual(m[m.length - 1], { role: 'user', content: '312 + 5' });
  assert.deepEqual(m.slice(-3, -1), [{ role: 'user', content: '26 × 12' }, { role: 'assistant', content: '26 × 12 = 312' }]);
  assert.deepEqual(m.slice(1, 1 + 2 * G.SHOTS.length).map((x) => x.content), G.SHOTS.flat()); assert.deepEqual(m.slice(1, 3).map((x) => x.role), ['user', 'assistant']);
  assert.equal(G.asking(null, { text: '1 + 1' }).length, 2 + 2 * G.SHOTS.length); assert.equal(G.asking(undefined, { text: '1 + 1' }).length, 2 + 2 * G.SHOTS.length);
  // every worked example is true and is a single cell said the way a reply bonds
  for (const [u, a] of G.SHOTS) { assert.equal(a, `${u} = ${val(u)}`); assert.equal(X.evaluate(u).ops, 1); assert.equal(B.judge(a, { text: u }).why, 'bonded'); }
  assert.equal(G.SHOTS.length, 5); assert.deepEqual(G.SETTINGS, { maxTicks: 256, maxTokens: 24 }); assert.equal(G.AGAIN, 8);
});

test('grow: every cell right, the crystal completes, tick by tick, and the answer is the problem\'s own', async () => {
  const m = model(right), r = await G.grow(task('momentum:1', '26 × 21 + 26 × 7 + 15 × 37'), m.call, {});
  assert.deepEqual(kinds(r), ['1 bond 26 × 21', '1 bond 26 × 7', '1 bond 15 × 37', '2 bond 546 + 182', '3 bond 728 + 555']);
  assert.deepEqual([r.id, r.tier, r.family, r.sheet, r.ask, r.ticks, r.calls, r.complete, r.answer, r.home, r.left, r.capped], ['momentum:1', 'climb', 'momentum', 0, '26 × 21 + 26 × 7 + 15 × 37', 3, 5, true, '1283', true, '1283', false]);
  assert.deepEqual(r.events[0], { tick: 1, cell: '26 × 21', canon: '*(21,26)', klass: 'long product', value: '546', into: null, said: '26 × 21 = 546', why: 'bonded', carried: false, ms: 5, prompt: 40, reply: 6, kind: 'bond', left: '546 + 26 × 7 + 15 × 37' });
  assert.deepEqual(r.events.map((e) => e.left), ['546 + 26 × 7 + 15 × 37', '546 + 182 + 15 × 37', '546 + 182 + 555', '728 + 555', '1283']);
  assert.equal(m.seen.length, 5); assert.equal(m.seen[0].maxTokens, 24);
  // the conversation is the crystal: each call holds every bond so far and nothing else, so it only ever grows
  assert.deepEqual(m.seen[0].messages, G.asking([], { text: '26 × 21' }));
  assert.deepEqual(m.seen[4].messages, G.asking([['26 × 21', '26 × 21 = 546'], ['26 × 7', '26 × 7 = 182'], ['15 × 37', '15 × 37 = 555'], ['546 + 182', '546 + 182 = 728']], { text: '728 + 555' }));
  for (let i = 1; i < 5; i++) assert.deepEqual(m.seen[i].messages.slice(0, m.seen[i - 1].messages.length), m.seen[i - 1].messages, 'the earlier turns are unchanged');
  // a problem with no calculation to hold has nothing to grow
  const none = await G.grow({ id: 'factor:1', tier: 'wall', ask: null, check: { type: 'factors', n: '16637' } }, m.call, {});
  assert.deepEqual([none.events, none.complete, none.home, none.calls, none.left, none.ask], [[], false, false, 0, null, null]);
  assert.deepEqual((await G.grow({ id: 'x' }, m.call, {})).events, []); assert.deepEqual((await G.grow(null, m.call, {})).events, []);
  const done = await G.grow(task('n:1', '5'), m.call, {});
  assert.deepEqual([done.complete, done.answer, done.home, done.ticks, done.calls], [true, '5', true, 0, 0], 'a number is its own answer');
});

test('grow: a wrong cell is split into smaller cells, and a wrong cell with nothing smaller dissolves', async () => {
  // right on small steps only: the long product is split until the cells are ones it gets right
  const m = model(small), r = await G.grow(task('p:1', '26 × 12'), m.call, {});
  assert.deepEqual(kinds(r), ['1 split 26 × 12', '2 split 26 × 10', '2 split 26 × 2', '3 bond 20 × 10', '3 bond 6 × 10', '3 bond 20 × 2', '3 bond 6 × 2', '4 bond 200 + 60', '4 split 40 + 12', '5 split 260 + 40', '5 bond 10 + 2', '6 bond 200 + 12', '6 bond 6 + 4', '7 bond 10 × 10', '8 split 212 + 100', '9 bond 2 + 1', '10 bond 3 × 100', '11 bond 12 + 300']);
  assert.deepEqual(r.events.filter((e) => e.kind === 'split').map((e) => e.into), ['26 × 12 = 26 × 10 + 26 × 2', '26 × 10 = 20 × 10 + 6 × 10', '26 × 2 = 20 × 2 + 6 × 2', '40 + 12 = 40 + 10 + 2', '260 + 40 = 200 + (6 + 4) × 10', '212 + 100 = 12 + (2 + 1) × 100']);
  assert.deepEqual([r.complete, r.answer, r.home, r.capped], [true, '312', true, false]);
  assert.deepEqual(r.events[0], { tick: 1, cell: '26 × 12', canon: '*(12,26)', klass: 'long product', value: null, into: '26 × 12 = 26 × 10 + 26 × 2', said: '26 × 12 = 313', why: 'wrong value', carried: false, ms: 5, prompt: 40, reply: 6, kind: 'split', left: '26 × 10 + 26 × 2' });
  // a wrong reply never enters the conversation: only bonds are carried
  for (const s of m.seen) for (const x of s.messages.slice(1 + 2 * G.SHOTS.length)) assert.ok(x.role === 'user' || B.read(x.content, { text: s.messages[s.messages.indexOf(x) - 1].content }) !== null);
  assert.equal(m.seen.filter((s) => s.messages.some((x) => x.content === '26 × 12 = 313')).length, 0);
  // always wrong: nothing bonds, every branch ends in a dissolve, and it stops
  const w = model(wrong), d = await G.grow(task('p:2', '26 × 12 + 7'), w.call, {});
  assert.deepEqual([d.complete, d.answer, d.home, d.capped], [false, null, false, false]); assert.equal(d.events.filter((e) => e.kind === 'bond' || e.kind === 'set').length, 0);
  assert.ok(d.events.some((e) => e.kind === 'dissolve') && d.events.some((e) => e.kind === 'split')); assert.ok(LEFT.ops(LEFT.start(d.left)) > 0);
  assert.ok(X.same(X.evaluate(d.left).value, X.evaluate('26 × 12 + 7').value), 'what is left dark still has the problem\'s value');
  assert.deepEqual(d.events.filter((e) => e.kind === 'dissolve').map((e) => [e.value, e.into]), d.events.filter((e) => e.kind === 'dissolve').map(() => [null, null]));
  // one digit by one digit, wrong: nothing smaller
  const one = await G.grow(task('p:3', '7 × 8'), w.call, {});
  assert.deepEqual(kinds(one), ['1 dissolve 7 × 8']); assert.deepEqual([one.complete, one.left, one.ticks, one.calls], [false, '7 × 8', 1, 1]);
  // working that holds the cell itself is not smaller: 4 × 100 is not split into 4 × 1 × 100
  assert.deepEqual(kinds(await G.grow(task('p:4', '4 × 100'), w.call, {})), ['1 dissolve 4 × 100']);
  assert.equal(G.smaller(LEFT.start('4 × 100'), { text: '4 × 100', canon: X.evaluate('4 × 100').canon }), null);
  assert.deepEqual(G.smaller(LEFT.start('40 × 300 + 1'), { text: '40 × 300', canon: X.evaluate('40 × 300').canon }).into, '40 × 300 = 4 × 3 × 1000');
  assert.equal(G.smaller(LEFT.start('7 × 8'), { text: '7 × 8', canon: '*(7,8)' }), null); assert.equal(G.smaller(LEFT.start('7 × 8'), { text: '9 × 9', canon: '*(9,9)' }), null, 'a cell that is not there');
});

test('grow: a cell that stands in more than one place is split in all of them, and what is set is never grown twice', async () => {
  // 19 × 16 stands twice; wrong once, it is split in both places and asked only once
  const m = model(small), r = await G.grow(task('g:1', '19 × 16 - 4 × (19 × 16 - 100)'), m.call, {});
  assert.equal(m.seen.filter((s) => cellOf(s.messages) === '19 × 16').length, 1); assert.equal(r.events.filter((e) => e.cell === '19 × 16').length, 1);
  assert.equal(r.events.find((e) => e.cell === '19 × 16').left, '19 × 10 + 19 × 6 - 4 × (19 × 10 + 19 × 6 - 100)');
  assert.deepEqual([r.complete, r.answer, r.home], [true, val('19 × 16 - 4 × (19 × 16 - 100)'), true]);
  // every cell is asked at most once in a problem
  const asked = m.seen.map((s) => X.evaluate(cellOf(s.messages)).canon); assert.equal(new Set(asked).size, asked.length);
  // a cell that bonded and comes up again is set, with no call
  const twice = model(right), t = await G.grow(task('g:2', '(3 + 4) × (3 + 4) + 3 + 4'), twice.call, {});
  assert.deepEqual(kinds(t), ['1 bond 3 + 4', '2 bond 7 × 7', '3 bond 49 + 7']);
  const again = await G.grow(task('g:3', '2 × 3 + 6 - (2 × 3)'), twice.call, {});
  assert.deepEqual(kinds(again), ['1 bond 2 × 3', '2 bond 6 + 6', '3 bond 12 - 6']);
  // a taking-away that goes below nothing is turned round, and the sign is carried
  const neg = await G.grow(task('g:4', '231 - 551'), model(small).call, {});
  assert.deepEqual([neg.complete, neg.answer, neg.home, neg.events[0].into], [true, '-320', true, '231 - 551 = 231 - 500 - 50 - 1']);
  const flip = await G.grow(task('g:6', '4 - 100'), model(small).call, {});
  assert.deepEqual([flip.complete, flip.answer, flip.home, flip.events[0].into, flip.events[0].left], [true, '-96', true, '4 - 100 = -(100 - 4)', '-(100 - 4)']);
  const sign = await G.grow(task('g:7', '7 × (3 - 58)'), model(small).call, {});
  assert.deepEqual([sign.complete, sign.answer, sign.home], [true, '-385', true]); assert.ok(sign.events.some((e) => e.into === '7 × -55 = -(7 × 55)'));
  // a cell whose numbers were changed by a split earlier in the same tick is not asked: it waits
  const wait = model((cell) => (cell === '12 + 34' ? wrong(cell) : right(cell))), wr = await G.grow(task('g:5', '12 + 34 + 56'), wait.call, {});
  assert.deepEqual([wr.complete, wr.answer], [true, '102']); for (const e of wr.events.filter((x) => x.said !== null)) assert.ok(LEFT.atoms(LEFT.start(wr.events[wr.events.indexOf(e) - 1] ? wr.events[wr.events.indexOf(e) - 1].left : '12 + 34 + 56')).some((a) => a.canon === e.canon), `${e.cell} was asked while it was not there`);
});

test('grow with a memory: a cell the memory holds is set without a call, and every bond is written in', async () => {
  const M = G.seeded(['26 × 21 = 546', '546 + 182 = 728']), m = model(right);
  const r = await G.grow(task('m:1', '26 × 21 + 26 × 7'), m.call, { memory: M, mem: { probes: 12 } });
  assert.deepEqual(kinds(r), ['1 set 26 × 21', '1 bond 26 × 7', '2 set 546 + 182']);
  assert.deepEqual(r.events[0], { tick: 1, cell: '26 × 21', canon: '*(21,26)', klass: 'long product', value: '546', into: null, said: null, why: null, carried: null, ms: 0, prompt: null, reply: null, kind: 'set', left: '546 + 26 × 7' });
  assert.deepEqual([r.calls, r.complete, r.answer, m.seen.length], [1, true, '728', 1]); assert.equal(M.floor.has('*(26,7)'), true); assert.equal(M.floor.get('*(26,7)').from, 'm:1'); assert.equal(M.floor.size, 3);
  // a split or a dissolve writes nothing in
  const W = KEEP.create(); await G.grow(task('m:2', '26 × 12'), model(wrong).call, { memory: W }); assert.equal(W.floor.size, 0);
  // the cap on ticks is a guard: hit, it is said
  const capped = await G.grow(task('m:3', '26 × 12 + 34 × 56'), model(small).call, { maxTicks: 2 });
  assert.deepEqual([capped.capped, capped.complete, capped.ticks], [true, false, 2]);
  assert.equal((await G.grow(task('m:4', '2 × 3'), model(right).call, { maxTicks: 1 })).capped, false, 'finished on the last tick allowed is not capped');
  for (const bad of [0, -1, 1.5, 'x', null]) assert.equal((await G.grow(task('m:5', '26 × 12'), model(small).call, { maxTicks: bad })).complete, true, `maxTicks ${bad} falls back to the setting`);
  const tok = model(right); await G.grow(task('m:6', '2 × 3'), tok.call, { maxTokens: 9 }); assert.equal(tok.seen[0].maxTokens, 9);
  for (const bad of [0, -1, 1.5, 'x']) { const t2 = model(right); await G.grow(task('m:7', '2 × 3'), t2.call, { maxTokens: bad }); assert.equal(t2.seen[0].maxTokens, 24); }
  // each event is told as it happens
  const told = []; await G.grow(task('m:8', '2 × 3 + 4'), model(right).call, { onEvent: (e, rec) => told.push([e.kind, e.cell, rec.events.length]) });
  assert.deepEqual(told, [['bond', '2 × 3', 1], ['bond', '6 + 4', 2]]);
});

test('seeded: the seed crystal is laid only from true facts, checked again as they are laid', () => {
  const M = G.seeded(['26 × 21 = 546', '26 × 21 = 547', '2 + 2 = 4', 'abc', '5 = 5', '7 × 8', '7 × 8 = x', null, 7, '12 x 12 = 144']);
  assert.deepEqual([...M.floor.keys()].sort(), ['*(12,12)', '*(21,26)', '+(2,2)']); assert.equal(M.floor.get('*(12,12)').fact, '12 × 12 = 144'); assert.equal(M.floor.get('+(2,2)').from, 'seed');
  assert.equal(G.seeded(null).floor.size, 0); assert.equal(G.seeded('x').floor.size, 0); assert.equal(G.seeded([]).floor.size, 0);
});

test('run and replay: crystals grown in order on one memory, and the same crystals again from the recorded replies alone', async () => {
  const tasks = [task('a:1', '26 × 12 + 7'), task('b:1', '26 × 12 + 9'), task('c:1', '15 × 15 × 37')];
  const m = model(small), done = [];
  const out = await G.run(tasks, m.call, { seed: ['15 × 15 = 225'], mem: { probes: 12 }, onDone: (rec, M) => done.push([rec.id, M.floor.size]) });
  assert.deepEqual(out.records.map((r) => [r.id, r.complete, r.answer, r.home]), [['a:1', true, '319', true], ['b:1', true, '321', true], ['c:1', true, '8325', true]]);
  assert.equal(out.seeds, 1); assert.deepEqual(done.map((d) => d[0]), ['a:1', 'b:1', 'c:1']); assert.ok(done[0][1] > 1 && done[1][1] >= done[0][1]);
  // the second problem is handed what the first one bonded, and the third starts from the seed
  assert.ok(out.records[1].calls < out.records[0].calls); assert.ok(out.records[1].events.filter((e) => e.kind === 'set').length >= 5);
  assert.deepEqual(out.records[2].events[0], { tick: 1, cell: '15 × 15', canon: '*(15,15)', klass: 'long product', value: '225', into: null, said: null, why: null, carried: null, ms: 0, prompt: null, reply: null, kind: 'set', left: '225 × 37' });
  assert.deepEqual([out.memory.facts > 10, out.memory.wanted > 0, out.memory.found, out.memory.recall], [true, true, out.memory.wanted, 1]);
  const again = await G.replay(tasks, out.records, { seed: ['15 × 15 = 225'], mem: { probes: 12 } });
  assert.deepEqual(again, out, 'grown again from the replies, with no model: the same crystals');
  // a reply changed by one digit no longer grows the same crystal
  const forged = JSON.parse(JSON.stringify(out.records)), i = forged[0].events.findIndex((e) => e.kind === 'bond');
  forged[0].events[i].said = forged[0].events[i].said.replace(/\d$/, (d) => String((Number(d) + 1) % 10));
  assert.notDeepEqual((await G.replay(tasks, forged, { seed: ['15 × 15 = 225'], mem: { probes: 12 } })).records[0].events.map((e) => e.kind), out.records[0].events.map((e) => e.kind));
  // without the seed the third problem has to grow what the seed held
  assert.notDeepEqual((await G.replay(tasks, out.records, { mem: { probes: 12 } })).records[2].events[0].kind, 'set');
  // a run picked up part-way: finished problems are grown from their records (no call, no onDone), the rest by the model
  const fresh = model(small), seen = [];
  const resumed = await G.run(tasks, fresh.call, { seed: ['15 × 15 = 225'], mem: { probes: 12 }, done: out.records.slice(0, 2), onDone: (rec) => seen.push(rec.id) });
  assert.deepEqual(resumed, out); assert.deepEqual(seen, ['c:1']); assert.equal(fresh.seen.length, out.records[2].calls);
  assert.deepEqual(await G.run(null, m.call, {}), { records: [], seeds: 0, memory: KEEP.stats(KEEP.create()) });
  assert.deepEqual((await G.replay(tasks.slice(0, 1), [], {})).records[0].complete, false, 'a missing record replays as empty replies');
});

test('the law is sound and it ends: whatever the model says, a complete crystal is right, and growth stops', async () => {
  let s = 11;
  const r = (lo, hi) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return lo + (s >>> 8) % (hi - lo + 1); };
  const numb = () => String(r(0, 2) === 0 ? r(2, 9) : r(0, 1) ? r(10, 99) : r(100, 999));
  const expr = (d) => { if (d === 0 || r(0, 3) === 0) return numb(); const a = expr(d - 1), b = expr(d - 1), op = ['×', '+', '-', '×', '+'][r(0, 4)]; return r(0, 3) === 0 ? `(${a} ${op} ${b})` : `${a} ${op} ${b}`; };
  // a model that is right some of the time, and when wrong is wrong in different ways, sometimes not even arithmetic
  const noisy = (p) => (cell) => { const roll = r(0, 99); if (roll < p) return right(cell); return [wrong(cell), val(cell) + '0', 'I think it is ' + val(cell), '', `${cell} = `, `${cell} = ${val(cell)}1`, 'ANSWER: ' + val(cell)][roll % 7]; };
  let complete = 0, dark = 0, events = 0;
  for (let i = 0; i < 160; i++) {
    const ask = expr(3);
    if (X.evaluate(ask).ops === 0) continue;
    const p = [0, 30, 60, 85, 100][i % 5], rec = await G.grow(task(`r:${i}`, ask), model(noisy(p)).call, {});
    events += rec.events.length;
    assert.equal(rec.capped, false, `${ask} did not stop`); assert.ok(rec.ticks <= 200);
    // what is left always has the problem's value, at every event
    for (const e of rec.events) assert.ok(X.same(X.evaluate(e.left).value, X.evaluate(ask).value), `${ask}: ${e.left}`);
    if (rec.complete) { complete++; assert.equal(rec.answer, val(ask), `${ask} completed wrong`); assert.equal(rec.home, true); assert.equal(rec.left, val(ask)); }
    else { dark++; assert.equal(rec.answer, null); assert.equal(rec.home, false); assert.ok(rec.events.some((e) => e.kind === 'dissolve'), `${ask} is dark with nothing dissolved`); assert.deepEqual(G.frontier(LEFT.start(rec.left), new Set(rec.events.filter((e) => e.kind === 'dissolve').map((e) => e.canon))).filter((c) => !rec.events.some((e) => e.canon === c.canon)), [], 'no cell was left unasked'); }
    if (p === 100) assert.equal(rec.complete, true, `${ask}: every cell right and not complete`);
    if (p === 0) assert.equal(rec.events.filter((e) => e.kind === 'bond').length, 0);
    // every bond is a true line the model said, every split a true line, and nothing is asked twice
    for (const e of rec.events) {
      if (e.kind === 'bond') { assert.equal(val(e.cell), e.value); assert.ok(B.read(e.said, { text: e.cell }) !== null); assert.equal(e.why, 'bonded'); }
      if (e.kind === 'split') { const [from, to] = e.into.split(' = '); assert.equal(from, e.cell); assert.ok(X.same(X.evaluate(from).value, X.evaluate(to).value), e.into); }
    }
    const asked = rec.events.filter((e) => e.said !== null).map((e) => e.canon); assert.equal(new Set(asked).size, asked.length, `${ask}: a cell was asked twice`);
    // and grown again from its own replies it is the same crystal
    assert.deepEqual((await G.replay([task(`r:${i}`, ask)], [rec], {})).records[0], rec);
  }
  assert.ok(complete > 30 && dark > 30 && events > 1500, `${complete} ${dark} ${events}`);
});

test('nothing throws on a reply or a record, whatever it is', async () => {
  for (const reply of [null, undefined, 7, {}, [], '', '\n\n', '= = =', '26 × 12 = ', '∞', 'x'.repeat(5000)]) {
    const r = await G.grow(task('t:1', '26 × 12'), async () => ({ text: reply }), {});
    assert.equal(r.complete, false); assert.equal(r.capped, false);
  }
  assert.equal((await G.grow(task('t:2', '2 × 3'), async () => null, {})).complete, false); assert.equal((await G.grow(task('t:3', '2 × 3'), async () => 'x', {})).complete, false);
  for (const rec of [null, 7, {}, { events: 5 }, { events: [null, 3, { said: 9 }, { said: '2 × 3 = 6' }] }]) assert.doesNotThrow(() => G.replay([task('t:4', '2 × 3')], [rec], {}));
  assert.equal((await G.replay([task('t:4', '2 × 3')], [{ id: 't:4', events: [null, 3, { said: 9 }, { said: '2 × 3 = 6' }] }], {})).records[0].complete, true);
});

test('frontier: a number is paired with another number, never with itself', () => {
  const f = (t) => G.frontier(LEFT.start(t), new Set()).map((c) => c.text);
  assert.deepEqual(f('5 × 5 × 3'), ['5 × 5'], 'the 3 waits: both fives are taken'); assert.deepEqual(f('5 × 5 × 5'), ['5 × 5']); assert.deepEqual(f('4 + 4 + 4'), ['4 + 4']);
  assert.deepEqual(f('7 + 7 + 7 + 2'), ['7 + 7', '7 + 2']); assert.deepEqual(f('2 × 2 × 2 × 2'), ['2 × 2']); assert.deepEqual(f('5 × 3'), ['5 × 3']); assert.deepEqual(f('5'), []);
});

test('grow: the bond-check\'s ruling is kept with every reply, and so is whether the conversation carried on', async () => {
  const lengths = [], say = { '26 × 7': 'no idea', '15 × 37': '15 × 37 = 556', '6 × 7': '42', '15 × 30': '450 = 30 × 15', '20 × 7': '21 × 7 = 147' };
  // the first sum it is asked, it answers rightly and adds a false line
  let rides = 1;
  const r = await G.grow(task('t:9', '26 × 21 + 26 × 7 + 15 × 37'), async (m) => { const c = cellOf(m); lengths.push(m.length); return { text: say[c] ?? (c.includes(' + ') && rides-- > 0 ? `${right(c)}\n2 + 2 = 5` : right(c)), ms: 3 }; }, {});
  const asked = r.events.filter((e) => e.said !== null);
  assert.deepEqual(asked.slice(0, 7).map((e) => [e.cell, e.kind, e.why, e.carried]), [
    ['26 × 21', 'bond', 'bonded', false], ['26 × 7', 'split', 'not a statement', true], ['15 × 37', 'split', 'wrong value', false],
    ['20 × 7', 'split', 'another step', false], ['6 × 7', 'bond', 'bonded', false], ['15 × 30', 'bond', 'bonded', true], ['15 × 7', 'bond', 'bonded', true],
  ]);
  // a true line with a false one riding on it does not bond, so the false line never reaches the conversation
  const rode = asked.filter((e) => e.said.includes('2 + 2 = 5')); assert.equal(rode.length, 1); assert.deepEqual([rode[0].kind === 'bond', rode[0].why, rode[0].cell.includes(' + ')], [false, 'not a statement', true]);
  // the conversation grows by one exchange for each bond and by nothing for anything else
  const base = 2 + 2 * G.SHOTS.length; let bonds = 0;
  asked.forEach((e, i) => { assert.equal(lengths[i], base + 2 * bonds, e.cell); assert.equal(e.carried, i > 0 && asked[i - 1].kind === 'bond', e.cell); if (e.kind === 'bond') bonds++; });
  // an event with no reply has no ruling and no carrying on
  for (const e of r.events.filter((x) => x.said === null)) assert.deepEqual([e.why, e.carried], [null, null]);
  assert.equal(asked.filter((e) => e.kind === 'bond').length, bonds); assert.ok(bonds >= 6);
});

test('grow: a step that keeps being met again is split the same way a few times, then it dissolves; so growth stops', async () => {
  // 26 × 12 is asked once and is wrong. Then each longer run of halvings comes down to 26 one round later than the
  // last, so 26 × 12 stands again in round after round.
  const chain = (k) => `${26 * 2 ** k}${' ÷ 2'.repeat(k)}`, ask = (n) => ['26 × 12', ...Array.from({ length: n }, (_, i) => `${chain(i + 1)} × 12`)].join(' + ');
  const m = () => model((c) => (X.evaluate(c).canon === '*(12,26)' ? wrong(c) : right(c)));
  const about = (r) => r.events.filter((e) => e.canon === '*(12,26)').map((e) => `${e.tick} ${e.kind}${e.said === null ? '' : ' asked'}`);
  const eight = await G.grow(task('t:10', ask(8)), m().call, {});
  assert.deepEqual(about(eight), ['1 split asked', '2 split', '3 split', '4 split', '5 split', '6 split', '7 split', '8 split', '9 split']);
  assert.deepEqual([eight.complete, eight.answer, eight.home], [true, val(ask(8)), true]); assert.equal(eight.events.filter((e) => e.kind === 'dissolve').length, 0);
  for (const e of eight.events.filter((x) => x.canon === '*(12,26)')) assert.equal(e.into, '26 × 12 = 26 × 10 + 26 × 2');
  const nine = await G.grow(task('t:11', ask(9)), m().call, {});
  assert.deepEqual(about(nine), ['1 split asked', '2 split', '3 split', '4 split', '5 split', '6 split', '7 split', '8 split', '9 split', '10 dissolve']);
  assert.deepEqual([nine.complete, nine.answer, nine.home, nine.capped], [false, null, false, false]); assert.equal(nine.left, '2808 + 26 × 12');
  assert.deepEqual(nine.events.filter((e) => e.kind === 'dissolve').map((e) => [e.cell, e.said, e.into]), [['26 × 12', null, null]]);
  // it was asked of the model exactly once in each
  for (const r of [eight, nine]) assert.equal(r.events.filter((e) => e.canon === '*(12,26)' && e.said !== null).length, 1);
});
