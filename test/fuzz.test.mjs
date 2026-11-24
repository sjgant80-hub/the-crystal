import { test } from 'node:test';
import assert from 'node:assert/strict';
import F from '../src/fuzz.mjs';
import B from '../src/bond.mjs';
import X from '../vendor/climb/src/exact.mjs';
import LEFT from '../vendor/climb/src/left.mjs';
import T from '../vendor/climb/src/tasks.mjs';
import { sha256 } from '../vendor/climb/src/sha256.mjs';
import { TABLE, HOSTILE } from './table.mjs';

// every single step that the dev problems hold at the start, and some awkward ones
const ODD = ['7 - 7', '311 + 1', '0.5 × 26', '26 × 0.5', '231 - 551', '312 + 0', '4 - 5', '1 × 1', '2 + 2', '0 + 0', '12 ÷ 4', '2^3', '7 × -55', '96 ÷ 2', '300 × 40', '0 × 5', '312 × 1', '1 × 312', '21^2', '5 - -3'];
const CELLS = (() => { const out = new Set(ODD); for (const t of T.set(20261101, 5)) { const x = LEFT.start(t.ask || ''); if (x !== null) for (const a of LEFT.atoms(x)) out.add(a.text); } return [...out]; })();
const c26 = F.parts({ text: '26 × 12' });
// a source that always gives the same number: every choice a forgery makes is then its k-th
const fixed = (k) => () => k;

test('the bond-check, attacked: no forgery bonds, no honest reply is refused, the two readers never differ', () => {
  const r = F.fuzz(CELLS, { seed: 20261124 });
  assert.ok(CELLS.length >= 70, String(CELLS.length)); assert.equal(r.cells, CELLS.length); assert.equal(r.seed, 20261124); assert.deepEqual(r.budget, { forged: 48, honest: 12, noise: 48 }); assert.deepEqual(F.BUDGET, r.budget);
  assert.deepEqual([r.forged.bonded, r.forged.unsound, r.forged.outside, r.honest.refused, r.split, r.threw], [0, 0, 0, 0, 0, 0], JSON.stringify(r.found));
  assert.deepEqual(r.found, []); assert.equal(r.clean, true);
  assert.equal(r.honest.tried, CELLS.length * 12); assert.equal(r.noise.tried, CELLS.length * 48); assert.ok(r.forged.tried > CELLS.length * 40, String(r.forged.tried)); assert.ok(r.forged.own > 0);
  assert.equal(r.tried, r.forged.tried + r.honest.tried + r.noise.tried); assert.equal(r.forged.tried, r.forged.rows.reduce((a, x) => a + x.tried, 0));
  // every way of forging was used, and every one of them many times
  assert.deepEqual(r.forged.rows.map((x) => x.name), Object.keys(F.FORGERIES)); assert.equal(r.forged.rows.length, 23);
  for (const row of r.forged.rows) { assert.ok(row.tried >= 10, `${row.name}: ${row.tried}`); assert.equal(row.bonded, 0); assert.equal(row.kind, F.FORGERIES[row.name][0]); assert.ok(['unsound', 'outside'].includes(row.kind)); }
  assert.equal(r.forged.rows.filter((x) => x.kind === 'outside').length, 5);
  // some noise does bond, where the noise left the reply honest: both readers said so, or it would be a split
  assert.ok(r.noise.bonded > 0 && r.noise.bonded < r.noise.tried / 2, String(r.noise.bonded));
  // the sample is the first eight replies of each arm, all made for the first cell
  assert.equal(r.sample.length, 24); for (const arm of ['forged', 'honest', 'noise']) assert.equal(r.sample.filter((s) => s.arm === arm).length, 8, arm);
  for (const s of r.sample) { assert.deepEqual(Object.keys(s), ['cell', 'arm', 'way', 'reply', 'bond']); assert.equal(s.cell, F.parts({ text: CELLS[0] }).w); assert.equal(typeof s.bond, 'boolean'); }
  assert.deepEqual(r.sample.filter((s) => s.arm === 'honest').map((s) => s.bond), new Array(8).fill(true)); assert.deepEqual(r.sample.filter((s) => s.arm === 'forged').map((s) => s.bond), new Array(8).fill(false));
});

test('the same seed makes the same run again, to the last reply; another seed makes another', () => {
  const some = CELLS.slice(0, 12), a = F.fuzz(some, { seed: 7 }), b = F.fuzz(some, { seed: 7 }), c = F.fuzz(some, { seed: 8 });
  assert.deepEqual(a, b); assert.notDeepEqual(a.sample, c.sample); assert.equal(c.clean, true);
  assert.deepEqual([F.rng(1)(), F.rng(2)(), F.rng(0)(), F.rng('x')(), F.rng(-1)()], [2693262067, 3153583793, 1144304738, 1144304738, 3850105811]);
  const R = F.rng(20261124); assert.deepEqual([R(), R(), R()], [789656694, 4142447772, 2721962107]);
  // every reply of a small run, in order: any change to how replies are made shows here
  const seen = [], spy = (reply, cell) => { seen.push(`${cell.text}|${reply}`); return B.read(reply, cell); };
  const r = F.fuzz(['26 × 12', '231 - 551', '0.5 × 5', '96 ÷ 2', '21^2', '7 × -55', '0 + 0', '90 + 9'], { seed: 20261124, read: spy });
  assert.equal(seen.length, r.tried); assert.equal(r.clean, true);
  assert.equal(sha256(JSON.stringify(seen)), 'cd34ad62a92fdb5b05cc491dd558928a7f705373185728c76a8727da0904dd7c');
});

test('the second reader keeps the same rule as the table, with numbers of its own', () => {
  for (const [cell, reply, ruling] of TABLE) assert.equal(F.plainly(reply, { text: cell }), ruling === 'bonded', `${JSON.stringify(cell)} ← ${JSON.stringify(reply.slice(0, 60))}`);
  for (const reply of HOSTILE) for (const cell of HOSTILE) assert.equal(F.plainly(reply, cell), false);
  // its arithmetic against The Climb's exact fractions, on steps of every kind: the two were written apart and agree
  const R = F.rng(99), lit = () => { const whole = R() % [10, 100, 1000, 100000][R() % 4], part = R() % 4 === 0 ? `.${R() % 100}` : ''; return `${R() % 7 === 0 ? '-' : ''}${whole}${part}`; };
  let ended = 0, endless = 0;
  for (let i = 0; i < 4000; i++) {
    const a = lit(), b = i % 9 === 0 ? String(R() % 6) : lit(), sign = ['×', '÷', '+', '-', '^'][i % 5], text = `${a} ${sign} ${b}`, e = X.evaluate(text), c = F.parts({ text });
    // a power of a number below nothing is not a cell for either reader (-3^2 means -(3^2), two steps)
    if (sign === '^' && a.startsWith('-')) { assert.equal(c, null, text); assert.equal(B.judge('1', { text }).why, 'not a step', text); continue; }
    if (e === null || X.show(e.value).includes('/')) { assert.equal(c, null, text); endless++; continue; }
    if (X.show(e.value).replace(/[-.]/g, '').length > 40) { assert.equal(c, null, text); continue; }
    assert.ok(c !== null, text); assert.equal(c.v, X.show(e.value), text); assert.equal(B.judge(c.v, { text }).why, 'bonded', text); ended++;
  }
  assert.ok(ended > 2500 && endless > 100, `${ended} ${endless}`);
  assert.deepEqual(F.dec('-12,000.50'), { m: -120005n, s: 1 }); assert.deepEqual(F.dec('−0.250'), { m: -25n, s: 2 }); assert.deepEqual(F.dec('0'), { m: 0n, s: 0 }); assert.deepEqual(F.dec('-0.0'), { m: 0n, s: 0 }); assert.deepEqual(F.dec('100'), { m: 100n, s: 0 });
  for (const bad of ['', '.5', '5.', '1,2', '12,34', '1234,567', '+5', '--5', '5e3', ' 5', '5 ', '５', null, 5, '9'.repeat(41), `0.${'1'.repeat(40)}`]) assert.equal(F.dec(bad), null, String(bad));
  assert.ok(F.dec('9'.repeat(40)) !== null); assert.ok(F.dec(`0.${'1'.repeat(39)}`) !== null);
  assert.deepEqual(['0', '-0.5', '12000', '0.05', '-12.5'].map((t) => F.spell(F.dec(t))), ['0', '-0.5', '12000', '0.05', '-12.5']); assert.equal(F.spell({ m: 5n, s: 3 }), '0.005'); assert.equal(F.spell({ m: -1234n, s: 2 }), '-12.34');
  const A = (op, a, b) => { const v = F.ARITH[op](F.dec(a), F.dec(b)); return v === null ? null : F.spell(v); };
  assert.deepEqual([A('+', '0.5', '0.5'), A('-', '1', '0.25'), A('*', '0.5', '4'), A('/', '1', '8'), A('/', '1', '3'), A('/', '5', '0'), A('/', '0.3', '0.1'), A('/', '-6', '4')], ['1', '0.75', '2', '0.125', null, null, '3', '-1.5']);
  assert.deepEqual([A('^', '2', '10'), A('^', '0.5', '2'), A('^', '2', '-2'), A('^', '2', '0.5'), A('^', '2', '64'), A('^', '2', '65'), A('^', '2', '-65'), A('^', '0', '-1'), A('^', '7', '0'), A('^', '-2', '3')], ['1024', '0.25', '0.25', null, '18446744073709551616', null, null, null, '1', '-8']);
  assert.equal(A('/', '1', `0.${'0'.repeat(38)}1`), `1${'0'.repeat(39)}`); assert.equal(F.ARITH['/'](F.dec('1'), { m: 2n ** 41n, s: 0 }), null); assert.ok(F.ARITH['/'](F.dec('1'), { m: 2n ** 40n, s: 0 }) !== null);
});

test('a cell, as the second reader sees it; and a cell that is not one step with a value is not attacked', () => {
  assert.deepEqual(c26, { op: '*', A: { m: 26n, s: 0 }, B: { m: 12n, s: 0 }, V: { m: 312n, s: 0 }, a: '26', b: '12', v: '312', w: '26 × 12', text: '26 × 12' });
  assert.deepEqual(['26 x 12', '96/2', '21^2', ' 5 - -3 ', '0.50 × 4', '1,000 × 2', '−5 − 3'].map((text) => { const c = F.parts({ text }); return `${c.w} = ${c.v}`; }), ['26 × 12 = 312', '96 ÷ 2 = 48', '21^2 = 441', '5 - -3 = 8', '0.5 × 4 = 2', '1000 × 2 = 2000', '-5 - 3 = -8']);
  for (const bad of ['2 × 3 × 4', '12', 'abc', '', '5 ÷ 0', '1 ÷ 3', '2^65', '(2 × 3)', '2 × 3 = 6', '26 × 12.', '9'.repeat(30) + ' × ' + '9'.repeat(30), `${'9'.repeat(41)} × 2`, `2 × ${'9'.repeat(41)}`, `${'9'.repeat(41)} × ${'9'.repeat(41)}`, '-3^2']) assert.equal(F.parts({ text: bad }), null, bad);
  assert.equal(F.parts({ text: '0^2' }).v, '0'); assert.equal(F.parts({ text: '0^0' }).v, '1'); assert.equal(F.parts({ text: '2^-2' }).v, '0.25'); assert.equal(F.parts({ text: '2^-0' }).v, '1');
  for (const bad of HOSTILE) assert.equal(F.parts(bad), null);
  const none = F.fuzz(['2 × 3 × 4', '12', 'abc', null, 7, '1 ÷ 3', '5 ÷ 0'], { seed: 1 });
  assert.deepEqual([none.cells, none.tried, none.forged.tried, none.honest.tried, none.noise.tried, none.clean, none.sample.length], [0, 0, 0, 0, 0, true, 0]);
  for (const bad of [null, undefined, 7, 'x', {}]) assert.equal(F.fuzz(bad, null).tried, 0);
  // the budget can be set, arm by arm; anything that is not a whole number of replies leaves the arm as it was
  const small = F.fuzz(['26 × 12', '4 + 8'], { seed: 3, budget: { forged: 5, honest: 2, noise: 0 } });
  assert.deepEqual([small.honest.tried, small.noise.tried, small.budget], [4, 0, { forged: 5, honest: 2, noise: 0 }]); assert.ok(small.forged.tried + small.forged.own <= 10 && small.forged.tried >= 6);
  assert.deepEqual(F.fuzz(['26 × 12'], { budget: { forged: -1, honest: 1.5, noise: '3' } }).budget, F.BUDGET); assert.equal(F.fuzz(['26 × 12'], {}).seed, 0); assert.equal(F.fuzz(['26 × 12'], { seed: -1 }).seed, 4294967295);
});

test('each way of forging is what its name says, and none of them is the cell\'s own statement', () => {
  const made = (k) => Object.fromEntries(Object.entries(F.FORGERIES).map(([name, [, make]]) => [name, make(fixed(k), c26)]));
  assert.deepEqual(made(0), {
    'a wrong value': '26 × 12 = 313', 'a wrong value, alone': '313', 'a wrong value, value first': '313 = 26 × 12', 'the value below nothing': '26 × 12 = -312', 'other working that comes to the value': '312 + 0 = 312',
    'another step, true': '2 + 2 = 4', 'another step, given the value': '27 × 12 = 312', 'the other operation on the same numbers': '26 + 12 = 312', 'the same numbers the other way round': null, 'the numbers and signs shuffled': '× 12 = 312 26',
    'the right value after a wrong one': '26 × 12 = 313\n26 × 12 = 312', 'a wrong value after the right one': '26 × 12 = 312\n26 × 12 = 313', 'two values': '312\n313', 'a chain that does not hold': '26 × 12 = 312 = 313', 'no value': '26 × 12 =',
    'a true rewrite that states no value': '26 × 12 = 26 × 12 + 0', 'a false line riding on a true one': '26 × 12 = 312\n2 + 2 = 5', 'a space inside the value': '26 × 12 = 3 12', 'the value in a sentence': 'I think it is 312',
    'the value with a unit or a mark': '312 m', 'a second line after the right one': '26 × 12 = 312\n2 + 2 = 4', 'the value in look-alike characters': '26 × 12 = ３１２', 'too long, or built to break a reader': `26 × ${' '.repeat(200)}12 = 312`,
  });
  assert.deepEqual(made(1), {
    'a wrong value': '26 × 12 = 310', 'a wrong value, alone': '310', 'a wrong value, value first': '310 = 26 × 12', 'the value below nothing': '-312', 'other working that comes to the value': '312 × 1 = 312',
    'another step, true': '3 × 3 = 9', 'another step, given the value': '28 × 12 = 312', 'the other operation on the same numbers': '26 - 12 = 312', 'the same numbers the other way round': null, 'the numbers and signs shuffled': '26 12 = 312 ×',
    'the right value after a wrong one': '26 × 12 = 310\n26 × 12 = 312', 'a wrong value after the right one': '26 × 12 = 312\n26 × 12 = 310', 'two values': '312 310', 'a chain that does not hold': '26 × 12 = 310 = 312', 'no value': '26 × 12',
    'a true rewrite that states no value': '26 × 12 = 312 × 1', 'a false line riding on a true one': '26 × 12 = 312, 2 + 2 = 5', 'a space inside the value': '26 × 12 = 31 2', 'the value in a sentence': 'The answer is 312.',
    'the value with a unit or a mark': '26 × 12 = 312 m', 'a second line after the right one': '26 × 12 = 312\n26 × 12 = 312', 'the value in look-alike characters': '３１２', 'too long, or built to break a reader': `${'('.repeat(600)}26 × 12${')'.repeat(600)} = 312`,
  });
  // the other way round, where that is another step: a taking away, a division, a power
  const back = (text, k) => F.FORGERIES['the same numbers the other way round'][1](fixed(k), F.parts({ text }));
  assert.deepEqual([back('231 - 551', 0), back('231 - 551', 1), back('96 ÷ 2', 1), back('96 ÷ 3', 1), back('2^3', 1), back('450 + 37', 1)], ['551 - 231 = -320', '551 - 231 = 320', '2 ÷ 96 = 48', '3 ÷ 96 = 0.03125', '3^2 = 9', null]);
  assert.equal(F.FORGERIES['a space inside the value'][1](fixed(0), F.parts({ text: '6 × 8' })), '6 × 8 = 4 8', 'a value of two digits has one place for a space'); assert.equal(F.FORGERIES['a space inside the value'][1](fixed(1), F.parts({ text: '6 × 8' })), null);
  assert.equal(F.FORGERIES['the value in look-alike characters'][1](fixed(1), F.parts({ text: '90 + 9' })), '９９'); assert.equal(F.FORGERIES['the value in look-alike characters'][1](fixed(1), F.parts({ text: '1000 + 23456.789' })), '２４４５６.７８９');
  assert.equal(F.FORGERIES['the value below nothing'][1](fixed(0), F.parts({ text: '7 - 7' })), null); assert.equal(F.FORGERIES['a space inside the value'][1](fixed(0), F.parts({ text: '2 + 2' })), null);
  assert.equal(F.FORGERIES['a space inside the value'][1](fixed(2), c26), null, 'a space after the last digit is no space inside');
  // near() never gives the value itself, whatever it draws
  for (const text of CELLS) { const c = F.parts({ text }), R = F.rng(5); for (let i = 0; i < 40; i++) { const n = F.near(R, c); assert.notEqual(n, c.v, text); assert.ok(F.dec(n) !== null, `${text}: ${n}`); assert.equal(F.spell(F.dec(n)), n); } }
  assert.deepEqual(Array.from({ length: 18 }, (_, k) => F.near(fixed(k), c26)), ['313', '310', '313', '311', '3120', '322', '338', '26', '12', '38', '313', '14', '31', '3120', '313', '2612', '0', '321']);
  assert.deepEqual(Array.from({ length: 18 }, (_, k) => F.near(fixed(k), F.parts({ text: '0 + 0' }))), ['1', '-2', '1', '-1', '1', '10', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '9']);
  // own(): the cell's own statements, by spelling alone
  for (const t of ['312', '26 × 12 = 312', '12 × 26 = 312', '312 = 26 × 12', '312 = 12 × 26', ' 312. ', '26 × 12 = 312.']) assert.equal(F.own(t, c26), true, t);
  for (const t of ['313', '26 × 12 = 313', '26 + 12 = 312', '26 × 12', '', '312 = 312', '26 × 12 = 312..', '26 × 12 = 3 12', '311 + 1 = 312', '26×12=312', null]) assert.equal(F.own(t, c26), false, String(t));
  const pw = F.parts({ text: '21^2' }), df = F.parts({ text: '5 - 8' });
  assert.deepEqual(['21^2 = 441', '21 ^ 2 = 441', '441 = 21 ^ 2', '2^21 = 441', '2 ^ 21 = 441'].map((t) => F.own(t, pw)), [true, true, true, false, false]); assert.deepEqual(['5 - 8 = -3', '8 - 5 = -3', '-3'].map((t) => F.own(t, df)), [true, false, true]);
  // on an odd cell a forgery may come out as the cell's own statement: it is then counted apart and not tried
  const odd = F.fuzz(['311 + 1', '312 + 0', '7 - 7', '1 × 312', '2 + 2'], { seed: 11, budget: { forged: 400, honest: 0, noise: 0 } });
  assert.ok(odd.forged.own >= 10, String(odd.forged.own)); assert.equal(odd.clean, true); assert.equal(odd.forged.bonded, 0);
});

test('an honest reply is one plain statement, written every way the rule allows; noise is an honest reply damaged', () => {
  const R = F.rng(12), seen = new Set();
  for (const text of ['26 × 12', '231 - 551', '300 × 40', '7 × -55', '96 ÷ 2', '21^2', '0.5 × 5']) for (let i = 0; i < 300; i++) {
    const c = F.parts({ text }), h = F.honest(R, c); seen.add(h);
    assert.ok(B.read(h, { text }) !== null, JSON.stringify(h)); assert.equal(F.plainly(h, { text }), true, JSON.stringify(h));
  }
  const all = [...seen];
  for (const part of ['26 x 12', '26X12', '26 * 12', '12 × 26', '312 = ', '12,000', '−320', '96/2', '96 ÷ 2', '21 ^ 2', '\t', '.\n', '\r\n']) assert.ok(all.some((h) => h.includes(part)), JSON.stringify(part));
  assert.ok(all.includes('312') && all.includes('312.') && all.some((h) => h.startsWith('\n')) && all.some((h) => h.startsWith('312')), 'the value alone, first, with a stop');
  assert.equal(F.honest(fixed(0), c26), '12 × 26 = 312'); assert.equal(F.honest(fixed(1), c26), '26 x 12 = 312'); assert.equal(F.honest(fixed(2), F.parts({ text: '300 × 40' })), ' 12,000=40X300. '); assert.equal(F.honest(fixed(3), F.parts({ text: '231 - 551' })), '\n−320\n');
  // noise: replayable, mostly not honest, and never a reason for the two readers to differ
  const N = F.rng(4), n = Array.from({ length: 400 }, () => F.noise(N, c26)), M = F.rng(4);
  assert.deepEqual(n, Array.from({ length: 400 }, () => F.noise(M, c26)));
  const kept = n.filter((x) => B.read(x, { text: '26 × 12' }) !== null).length; assert.ok(kept > 5 && kept < 200, String(kept)); assert.ok(new Set(n).size > 350);
  for (const x of n) assert.equal(B.read(x, { text: '26 × 12' }) !== null, F.plainly(x, { text: '26 × 12' }), JSON.stringify(x));
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((k) => F.noise(fixed(k), c26)), ['', '2116 x 12 = 312', ' 322=12X26. ', '\n31\n2', '4444', '26 x = 312.', '312 = 612 X 26']);
});

test('the harness has teeth: every reader with a leak planted in it is caught', () => {
  const t = F.teeth(CELLS.slice(0, 6), { seed: 7 });
  assert.equal(t.planted, 12); assert.equal(t.caught, 12, JSON.stringify(t.rows.filter((r) => !r.caught))); assert.deepEqual(t.rows.map((r) => r.name), Object.keys(F.PLANTED));
  for (const row of t.rows) { assert.equal(row.caught, true, row.name); assert.equal(typeof row.way, 'string'); assert.equal(typeof row.reply, 'string'); }
  // each leak is the leak its name says: one reply that the planted reader takes and the bond-check does not
  const leak = { 'takes the value wherever it stands in the reply': 'I think it is 312', 'takes any true line that comes to the value': '311 + 1 = 312', 'lets the first line about the step decide': '26 × 12 = 312 = 313', 'takes the last number in the reply': '2 + 310 = 312',
    'takes a value that is nearly right': '26 × 12 = 313', 'does not look at the step': '99 + 1 = 312', 'takes a step either way round': null, 'reads the sign off the value': '26 × 12 = -312', 'reads the first line only': '26 × 12 = 312\n2 + 2 = 5', 'lets words go': 'So 26 × 12 = 312', 'refuses everything': null, 'throws on a reply it cannot read': null };
  for (const [name, reply] of Object.entries(leak)) if (reply !== null) { assert.ok(F.PLANTED[name](reply, { text: '26 × 12' }) !== null, name); assert.equal(B.read(reply, { text: '26 × 12' }), null, name); }
  assert.ok(F.PLANTED['takes a step either way round']('8 - 5 = 3', { text: '5 - 8' }) !== null); assert.equal(B.read('8 - 5 = 3', { text: '5 - 8' }), null);
  assert.equal(F.PLANTED['refuses everything']('312', { text: '26 × 12' }), null); assert.throws(() => F.PLANTED['throws on a reply it cannot read']('３１２', { text: '26 × 12' })); assert.doesNotThrow(() => F.PLANTED['throws on a reply it cannot read']('313', { text: '26 × 12' }));
  // each planted reader, on replies that are nothing: it takes none of them, and does not throw
  for (const name of Object.keys(F.PLANTED)) for (const reply of ['', 'abc', '=', '26 × 12 =', 'abc = x', '26 × 12 = abc', '26 × 12']) assert.equal(F.PLANTED[name](reply, { text: '26 × 12' }), null, `${name} ← ${reply}`);
  for (const name of Object.keys(F.PLANTED)) assert.doesNotThrow(() => F.PLANTED[name]('abc = 312', { text: '26 × 12' }), name);
  for (const name of Object.keys(F.PLANTED)) for (const reply of ['2 + 2 = 4', '4', 'abc']) assert.equal(F.PLANTED[name](reply, { text: 'abc' }), null, `${name}, no cell ← ${reply}`);
  // and each leak has its edge
  const P = F.PLANTED, c26b = { text: '26 × 12' };
  assert.equal(P['takes any true line that comes to the value']('26 × 12 = 312 = 312', c26b), null, 'a line is two sides'); assert.equal(P['takes any true line that comes to the value']('2 + 2 = 4', c26b), null, 'a true line that does not come to the value');
  assert.equal(P['lets the first line about the step decide']('26 × 12 = 300 + 12', c26b), null, 'a true rewrite states no value'); assert.equal(P['lets the first line about the step decide']('313', c26b), null); assert.ok(P['lets the first line about the step decide']('312', c26b) !== null);
  assert.equal(P['lets the first line about the step decide']('26 × 12 = 313', c26b), null);
  assert.ok(P['takes a value that is nearly right']('99 + 1 = 101', { text: '99 + 1' }) !== null, 'one in a hundred out, exactly'); assert.equal(P['takes a value that is nearly right']('99 + 1 = 102', { text: '99 + 1' }), null); assert.equal(P['takes a value that is nearly right']('26 × 12 = 316', c26b), null);
  assert.equal(P['takes the last number in the reply']('312 or 313', c26b), null); assert.ok(P['takes the last number in the reply']('313 or 312', c26b) !== null);
  assert.equal(P['does not look at the step']('312 = 99 + 1', c26b), null); assert.ok(P['does not look at the step']('312', c26b) !== null);
  // apart from its leak, each planted reader still takes the plain statement (so it is its leak that gives it away)
  for (const name of Object.keys(F.PLANTED)) if (name !== 'refuses everything') assert.ok(F.PLANTED[name]('26 × 12 = 312', { text: '26 × 12' }) !== null, name);
  for (const name of Object.keys(F.PLANTED)) for (const bad of HOSTILE) assert.doesNotThrow(() => F.PLANTED[name](bad, bad), name);
  // a reader that throws is counted, not hidden; and a leak shows as a forgery bonded, an honest reply refused or a split
  const thrown = F.fuzz(['26 × 12'], { seed: 1, read: () => { throw new Error('x'); } });
  assert.deepEqual([thrown.threw, thrown.clean, thrown.split, thrown.found.length, thrown.found[0].bond], [thrown.tried, false, 0, 12, null]);
  const lax = F.fuzz(['26 × 12'], { seed: 1, read: () => 1 }), strict = F.fuzz(['26 × 12'], { seed: 1, read: () => null });
  assert.deepEqual([lax.forged.bonded, lax.honest.refused, lax.clean, lax.forged.unsound + lax.forged.outside], [lax.forged.tried, 0, false, lax.forged.tried]); assert.ok(lax.forged.unsound > 0 && lax.forged.outside > 0 && lax.split >= lax.forged.tried);
  assert.deepEqual([strict.forged.bonded, strict.honest.refused, strict.clean, strict.split >= 12], [0, 12, false, true]);
  assert.deepEqual(Object.keys(lax.found[0]), ['cell', 'reply', 'arm', 'way', 'bond', 'second', 'label']); assert.ok(lax.found[0].reply.length <= 120);
  // what the run is given for a seed and a budget is what each planted reader is attacked with, and nothing else of it
  const seeded = F.teeth([], { seed: 9, budget: { forged: 60, honest: 6, noise: 6 }, read: () => 1 }); assert.equal(seeded.caught, 12);
  assert.deepEqual(seeded.rows[10], { name: 'refuses everything', caught: true, way: 'honest', reply: F.fuzz(F.EVERY, { seed: 9, budget: { forged: 60, honest: 6, noise: 6 }, read: () => null }).found[0].reply });
  assert.notDeepEqual(F.teeth([], { seed: 10 }).rows, F.teeth([], { seed: 11 }).rows); for (const bad of [null, 7, 'x', new Proxy({}, { get() { throw new Error('no'); } })]) assert.equal(F.teeth([], bad).planted, 12);
  // it is turned on one cell of every operation whatever else it is given, so every leak has a cell to show on
  assert.deepEqual(F.EVERY, ['26 × 12', '450 + 37', '494 - 228', '231 - 551', '96 ÷ 2', '21^2', '0.5 × 26', '7 × -55']); for (const text of F.EVERY) assert.ok(F.parts({ text }) !== null, text);
  assert.deepEqual(new Set(F.EVERY.map((text) => F.parts({ text }).op)), new Set(['*', '+', '-', '/', '^']));
  for (const given of [null, ['2 + 2']]) { const alone = F.teeth(given, { seed: 2 }); assert.deepEqual([alone.planted, alone.caught], [12, 12], JSON.stringify(alone.rows.filter((r) => !r.caught))); }
  assert.equal(F.fuzz(F.EVERY, { seed: 2 }).clean, true, 'and the bond-check itself is clean on the same cells');
});
