import { test } from 'node:test';
import assert from 'node:assert/strict';
import LAT from '../src/lattice.mjs';
import G from '../src/grow.mjs';
import X from '../vendor/climb/src/exact.mjs';
import KEEP from '../vendor/climb/src/keep.mjs';
import { DODECA } from '../vendor/climb/vendor/memory.mjs';

const val = (t) => X.show(X.evaluate(t).value);
const task = (id, ask) => ({ id, sheet: 0, family: id.split(':')[0], tier: 'climb', statement: `Work out ${ask}.`, ask, check: { type: 'value', value: val(ask) } });
const right = (cell) => `${cell} = ${val(cell)}`, wrong = (cell) => `${cell} = ${X.show(X.add(X.evaluate(cell).value, X.num('1')))}`;
const call = (rule) => async (m) => ({ text: rule(m[m.length - 1].content), ms: 5, prompt: 40, reply: 6 });
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const shellOf = (p) => (Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2])) / 2;

test('the twelve directions are the faces of a dodecahedron, numbered as the memory numbers its chambers', () => {
  assert.equal(LAT.DIRS.length, 12);
  for (const d of LAT.DIRS) assert.ok(near(len(d), 1), String(d));
  for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) {
    const c = dot(LAT.DIRS[a], LAT.DIRS[b]);
    // a chamber, its five neighbours, the five beyond them, and the one opposite
    if (a === b) assert.ok(near(c, 1)); else if (DODECA[a].includes(b)) assert.ok(near(c, 1 / Math.sqrt(5)), `${a} and ${b} are neighbours`);
    else if (DODECA[a].some((n) => DODECA[n].includes(b))) assert.ok(near(c, -1 / Math.sqrt(5)), `${a} and ${b}`); else assert.ok(near(c, -1), `${a} and ${b} are opposite`);
  }
  assert.deepEqual(LAT.DIRS[0], [0, 0, 1]); assert.deepEqual(LAT.DIRS[11], [0, 0, -1]); assert.ok(LAT.DIRS[1][2] > 0 && LAT.DIRS[6][2] < 0);
});

test('chamberOf is the memory\'s own placing of a step', () => {
  for (const fact of ['26 × 21 = 546', '19 × 19 = 361', '8000 + 600 = 8600', '546 ÷ 2 = 273', '7 × 8 = 56']) {
    const M = KEEP.create(); KEEP.fold(M, { canon: X.evaluate(fact.split(' = ')[0]).canon, fact }, 't');
    assert.equal(M.kernel.distribution()[LAT.chamberOf(fact)], 1, fact);
  }
  for (const bad of [null, undefined, 7, '']) assert.ok(Number.isInteger(LAT.chamberOf(bad)) && LAT.chamberOf(bad) >= 0 && LAT.chamberOf(bad) <= 11);
});

test('the places of the crystal are the face-centred lattice, in shells that are the skins of an octahedron', () => {
  assert.equal(LAT.REACH, 12); assert.equal(LAT.SITES.length, 10425);
  const seen = new Set();
  for (const [i, s] of LAT.SITES.entries()) {
    assert.equal((((s.p[0] + s.p[1] + s.p[2]) % 2) + 2) % 2, 0, 'the three numbers of a place add up to an even number'); assert.equal(s.shell, shellOf(s.p)); assert.ok(s.shell <= 12);
    if (i > 0) { assert.ok(s.shell >= LAT.SITES[i - 1].shell, 'nearest the centre first'); assert.ok(near(len(s.dir), 1)); assert.ok(dot(s.dir, s.p) > 0); }
    seen.add(s.p.join(','));
  }
  assert.equal(seen.size, LAT.SITES.length); assert.deepEqual(LAT.SITES[0], { p: [0, 0, 0], shell: 0, dir: [0, 0, 0] });
  // shell n holds 16n² + 2 places, and every place has twelve nearest neighbours a step of (±1, ±1, 0) away
  for (const n of [1, 2, 3, 7, 12]) assert.equal(LAT.SITES.filter((s) => s.shell === n).length, 16 * n * n + 2);
  const at = new Set(LAT.SITES.map((s) => s.p.join(',')));
  for (const s of LAT.SITES.filter((x) => x.shell <= 6)) { let k = 0; for (const [dx, dy, dz] of [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]]) if (at.has([s.p[0] + dx, s.p[1] + dy, s.p[2] + dz].join(','))) k++; assert.equal(k, 12); }
});

test('floorOf: a cell never stands nearer the centre than its depth allows, and the floor only rises', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 8, 16, 25, 50, 99, 400, 100000].map(LAT.floorOf), [0, 1, 1, 2, 2, 3, 5, 6, 7, 8, 10, 10]);
  for (let d = 1; d < 600; d++) assert.ok(LAT.floorOf(d) >= LAT.floorOf(d - 1));
  for (const bad of [-3, 'x', null, undefined, NaN]) assert.equal(LAT.floorOf(bad), 0);
  assert.equal(LAT.floorOf('7'), LAT.floorOf(7)); assert.equal(LAT.floorOf(0.5), 0);
});

test('seat: a free place at or outside the floor, as near the floor and the chamber\'s own side as it can be', () => {
  for (let c = 0; c < 12; c++) for (const depth of [0, 1, 4, 16, 99]) {
    const taken = new Set(), seats = Array.from({ length: 60 }, () => LAT.seat(taken, c, depth));
    assert.equal(new Set(seats).size, 60, 'no place is taken twice'); assert.equal(taken.size, 60);
    for (const i of seats) { assert.ok(i >= 0); assert.ok(LAT.SITES[i].shell >= LAT.floorOf(depth), `chamber ${c} depth ${depth}`); assert.ok(LAT.SITES[i].shell <= LAT.floorOf(depth) + 3); }
    // the first cell of a chamber stands on that chamber's side of the crystal: nearer its line than any other chamber's
    const first = LAT.SITES[seats[0]];
    if (first.shell > 0) for (let o = 0; o < 12; o++) if (o !== c) assert.ok(dot(first.dir, LAT.DIRS[c]) >= dot(first.dir, LAT.DIRS[o]) - 1e-9, `chamber ${c} depth ${depth} sits on ${o}'s side`);
    // and each later one is no better placed than the one before it (the best place goes first)
    const score = (i) => (LAT.SITES[i].shell - LAT.floorOf(depth)) + 2.6 * (1 - (LAT.SITES[i].shell === 0 ? 1 : dot(LAT.SITES[i].dir, LAT.DIRS[c])));
    for (let k = 1; k < seats.length; k++) assert.ok(score(seats[k]) >= score(seats[k - 1]) - 1e-9);
  }
  // depth 0 with nothing taken is the centre; the centre taken, the nearest place on the chamber's side
  const t = new Set(); assert.equal(LAT.seat(t, 0, 0), 0); assert.deepEqual(LAT.SITES[LAT.seat(t, 0, 0)].p, [0, 0, 2]); assert.deepEqual(LAT.SITES[LAT.seat(new Set([0]), 11, 0)].p, [0, 0, -2]);
  // the same cells in the same order take the same places; a chamber number wraps
  const a = new Set(), b = new Set(); assert.deepEqual([3, 3, 7, 3].map((c) => LAT.seat(a, c, 2)), [3, 3, 7, 3].map((c) => LAT.seat(b, c, 2))); assert.equal(LAT.seat(new Set(), 13, 2), LAT.seat(new Set(), 1, 2)); assert.equal(LAT.seat(new Set(), -1, 2), LAT.seat(new Set(), 11, 2));
  // when every place is taken there is no place, and nothing is added
  const full = new Set(LAT.SITES.map((_, i) => i)); assert.equal(LAT.seat(full, 3, 2), -1); assert.equal(full.size, LAT.SITES.length);
});

test('lattice: a cell for every bond, a shattered cell for every dissolve, a dark cell for every step never reached, a crown for every completion', async () => {
  const tasks = [task('a:1', '26 × 21 + 26 × 7'), task('b:1', '26 × 21 + 5'), task('c:1', '7 × 8 + 2 × 3')];
  const rule = (cell) => (cell === '7 × 8' ? wrong(cell) : right(cell));
  const out = await G.run(tasks, call(rule), { seed: ['26 × 7 = 182'], mem: { probes: 12 } });
  const L = LAT.lattice(['26 × 7 = 182'], out.records);
  assert.deepEqual(L.cells.map((c) => `${c.kind} ${c.text} d${c.depth} p${c.problem}`), [
    'seed 26 × 7 = 182 d0 p-1', 'bond 26 × 21 = 546 d1 p0', 'bond 546 + 182 = 728 d2 p0', 'home 26 × 21 + 26 × 7 = 728 d3 p0',
    'bond 546 + 5 = 551 d2 p1', 'home 26 × 21 + 5 = 551 d3 p1', 'dissolve 7 × 8 d1 p2', 'bond 2 × 3 = 6 d1 p2', 'dark 7 × 8 d2 p2']);
  assert.deepEqual(L.counts, { seed: 1, bond: 4, set: 2, split: 0, dissolve: 1, dark: 1, home: 2, problems: 3, complete: 2, calls: out.records.reduce((a, r) => a + r.calls, 0), unplaced: 0 });
  // a cell stands on the cells that made its numbers: the seed and the first bond under the sum, the sum under the crown
  assert.deepEqual(L.links, [{ from: 1, to: 2, at: 3 }, { from: 0, to: 2, at: 3 }, { from: 2, to: 3, at: 4 }, { from: 1, to: 4, at: 6 }, { from: 4, to: 5, at: 7 }]);
  // what was already set and is used again shows as a pulse on the cell that holds it, never as a new cell
  assert.deepEqual(L.pulses, [{ cell: 0, at: 2 }, { cell: 1, at: 5 }]);
  assert.equal(L.span, 10); assert.equal(L.depth, 3); assert.deepEqual(L.cells.map((c) => c.at), [0, 1, 3, 4, 6, 7, 8, 9, 10]);
  // every cell has a place of its own, the seed at the centre, and none nearer the centre than its depth allows
  assert.equal(new Set(L.cells.map((c) => c.site)).size, L.cells.length); assert.deepEqual(L.cells[0].pos, [0, 0, 0]);
  for (const c of L.cells) { assert.deepEqual(c.pos, LAT.SITES[c.site].p); assert.ok(shellOf(c.pos) >= LAT.floorOf(c.depth)); assert.equal(c.chamber, c.kind === 'home' ? L.cells[L.links.find((l) => l.to === L.cells.indexOf(c)).from].chamber : LAT.chamberOf(c.text)); }
  assert.deepEqual(Object.keys(L.cells[1]), ['kind', 'text', 'value', 'canon', 'klass', 'chamber', 'depth', 'at', 'problem', 'site', 'pos']);
  assert.deepEqual({ ...L.cells[1], site: 0, pos: 0 }, { kind: 'bond', text: '26 × 21 = 546', value: '546', canon: '*(21,26)', klass: 'long product', chamber: LAT.chamberOf('26 × 21 = 546'), depth: 1, at: 1, problem: 0, site: 0, pos: 0 });
  // the same run again is the same lattice
  assert.deepEqual(LAT.lattice(['26 × 7 = 182'], (await G.replay(tasks, out.records, { seed: ['26 × 7 = 182'], mem: { probes: 12 } })).records), L);
});

test('lattice: every event is a moment, splits make no cell, and a problem with no calculation is not there', async () => {
  const SMALL = ['digit × digit', 'digit × digit, with noughts', 'digit + digit', 'sum, places apart', 'half', 'division'];
  const small = (cell) => (SMALL.includes(G.klass(cell)) ? right(cell) : wrong(cell));
  const out = await G.run([task('p:1', '26 × 12'), { id: 'factor:1', tier: 'wall', ask: null, check: { type: 'factors', n: '16637' } }, task('q:1', '26 × 12 + 1')], call(small), { mem: { probes: 12 } });
  const L = LAT.lattice([], out.records), events = out.records.reduce((a, r) => a + r.events.length, 0);
  assert.equal(L.counts.problems, 2); assert.equal(L.counts.complete, 2); assert.equal(L.span, events + 2, 'one moment for each event and one for each crown');
  assert.equal(L.counts.split, out.records.reduce((a, r) => a + r.events.filter((e) => e.kind === 'split').length, 0)); assert.ok(L.counts.split >= 6);
  assert.equal(L.cells.length, L.counts.bond + L.counts.home + L.counts.dissolve + L.counts.dark); assert.equal(L.cells.filter((c) => c.kind === 'bond').length, L.counts.bond);
  assert.equal(L.counts.set, out.records[2].events.filter((e) => e.kind === 'set').length); assert.equal(L.pulses.length, L.counts.set);
  // moments only go forward, and nothing stands on a cell that set after it
  for (let i = 1; i < L.cells.length; i++) assert.ok(L.cells[i].at > L.cells[i - 1].at);
  for (const l of L.links) { assert.ok(L.cells[l.from].at <= l.at && l.from !== l.to); assert.ok(L.cells[l.from].kind === 'bond' || L.cells[l.from].kind === 'seed'); }
  assert.equal(L.depth, Math.max(...out.records.map((r) => r.ticks)) + 1);
  // a seed fact that is listed twice, or is not working, is one cell or none
  assert.deepEqual(LAT.lattice(['2 × 3 = 6', '3 × 2 = 6', 'x', '6', null], []).cells.map((c) => c.text), ['2 × 3 = 6']);
  // a number below nothing still finds the cell that made it
  const neg = await G.run([task('n:1', '(4 - 100) × 2')], call(right), {}), N = LAT.lattice([], neg.records);
  assert.deepEqual(N.cells.map((c) => c.text), ['4 - 100 = -96', '-96 × 2 = -192', '(4 - 100) × 2 = -192']); assert.deepEqual(N.links.map((l) => [l.from, l.to]), [[0, 1], [1, 2]]);
});

test('nothing throws on a broken record', () => {
  const empty = { cells: [], links: [], pulses: [], span: 0, depth: 0, counts: { seed: 0, bond: 0, set: 0, split: 0, dissolve: 0, dark: 0, home: 0, problems: 0, complete: 0, calls: 0, unplaced: 0 } };
  for (const bad of [null, undefined, 7, 'x', {}, []]) assert.deepEqual(LAT.lattice(bad, bad), empty);
  const odd = LAT.lattice([7, {}], [null, 5, {}, { events: 7 }, { ask: '2 × 3', events: [null, 3, {}, { kind: 'bond' }, { kind: 'set' }, { kind: 'dissolve', tick: 'x' }, { kind: 'other' }], left: 'not arithmetic' }, { ask: '2 × 3', complete: true, events: [] }]);
  assert.equal(odd.counts.problems, 2); assert.equal(odd.counts.complete, 1); assert.ok(odd.cells.every((c) => c.pos.every(Number.isFinite) && c.site >= 0));
});

test('the places within a shell stand in one fixed order, so the same crystal is always drawn the same', () => {
  // shell 1: the eighteen places two steps from the centre, by their first number, then their second, then their third
  assert.deepEqual(LAT.SITES.slice(1, 19).map((s) => s.p.join(' ')), ['-2 0 0', '-1 -1 0', '-1 0 -1', '-1 0 1', '-1 1 0', '0 -2 0', '0 -1 -1', '0 -1 1', '0 0 -2', '0 0 2', '0 1 -1', '0 1 1', '0 2 0', '1 -1 0', '1 0 -1', '1 0 1', '1 1 0', '2 0 0']);
  for (let i = 1; i < LAT.SITES.length; i++) {
    const a = LAT.SITES[i - 1], b = LAT.SITES[i];
    if (a.shell !== b.shell) continue;
    const k = [0, 1, 2].find((j) => a.p[j] !== b.p[j]);
    assert.ok(a.p[k] < b.p[k], `${a.p} before ${b.p}`);
  }
});

test('seat: the place taken is the best free place there is, looked for the long way', () => {
  // the long way: every free place at or outside the floor is scored, and the first of the best is the one
  const best = (taken, c, depth) => {
    const d = LAT.DIRS[c], floor = LAT.floorOf(depth);
    let at = -1, low = Infinity;
    LAT.SITES.forEach((s, i) => { if (s.shell < floor || taken.has(i)) return; const score = (s.shell - floor) + 2.6 * (1 - (s.shell === 0 ? 1 : dot(s.dir, d))); if (score < low) { at = i; low = score; } });
    return at;
  };
  // one chamber filled until its cells spill four and more shells out, another crowding it, and a deep one
  const taken = new Set(), shells = new Set();
  for (let i = 0; i < 900; i++) {
    const c = i % 7 === 0 ? 5 : 0, depth = i % 11 === 0 ? 30 : 1, want = best(taken, c, depth), got = LAT.seat(taken, c, depth);
    assert.equal(got, want, `cell ${i}`); shells.add(LAT.SITES[got].shell - LAT.floorOf(depth));
  }
  assert.ok(Math.max(...shells) >= 4, `the crowded chamber reached ${Math.max(...shells)} shells out`);
  // two places that score the same: the first in the fixed order is taken
  const t = new Set([0]), first = LAT.seat(t, 0, 0), again = LAT.seat(new Set([0]), 0, 0); assert.equal(first, again); assert.deepEqual(LAT.SITES[first].p, [0, 0, 2]);
});

test('lattice: a crystal that stopped is as deep as the round after its last, where its dark cells stand', async () => {
  const dark = await G.run([task('c:1', '7 × 8 + 2 × 3')], call((cell) => (cell === '7 × 8' ? wrong(cell) : right(cell))), {});
  const L = LAT.lattice([], dark.records);
  assert.deepEqual(L.cells.map((c) => `${c.kind} d${c.depth}`), ['dissolve d1', 'bond d1', 'dark d2']); assert.equal(L.depth, 2); assert.equal(dark.records[0].ticks, 1);
  // a record that stopped with nothing left to read has no dark cell, and is no deeper for it
  const odd = LAT.lattice([], [{ ...dark.records[0], left: 'not arithmetic' }]); assert.deepEqual([odd.counts.dark, odd.depth], [0, 1]);
  const done = LAT.lattice([], [{ ...dark.records[0], left: '62' }]); assert.deepEqual([done.counts.dark, done.depth], [0, 1]);
  // a cell with no place left is counted, kept at the centre and never drawn as placed
  const many = LAT.lattice(Array.from({ length: 10430 }, (_, i) => `${i + 2} + 1 = ${i + 3}`), []);
  assert.deepEqual([many.counts.seed, many.counts.unplaced, many.cells.filter((c) => c.site === -1).length], [10430, 5, 5]);
  for (const c of many.cells.filter((x) => x.site === -1)) assert.deepEqual(c.pos, [0, 0, 0]);
  assert.deepEqual(many.cells[1].pos, LAT.SITES[many.cells[1].site].p); assert.notDeepEqual(many.cells[1].pos, [0, 0, 0]);
});
