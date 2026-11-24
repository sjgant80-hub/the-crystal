import { test } from 'node:test';
import assert from 'node:assert/strict';
import B from '../src/bond.mjs';
import X from '../vendor/climb/src/exact.mjs';
import { TABLE, HOSTILE } from './table.mjs';

const why = (cell, reply) => B.judge(reply, { text: cell }).why;

test('the rule, case by case: every reply in the table gets the ruling the table gives', () => {
  for (const [cell, reply, ruling] of TABLE) assert.equal(why(cell, reply), ruling, `${JSON.stringify(cell)} ← ${JSON.stringify(reply.slice(0, 60))}`);
  const said = new Set(TABLE.map((r) => r[2]));
  assert.deepEqual([...said].sort(), ['another step', 'bonded', 'not a statement', 'not a step', 'too long', 'wrong value']); assert.ok(TABLE.length >= 190, String(TABLE.length));
  assert.ok(TABLE.filter((r) => r[2] === 'bonded').length >= 60); assert.ok(TABLE.filter((r) => r[2] === 'not a statement').length >= 80);
});

test('a bond hands back the cell\'s exact value, worked out by code, and nothing when it does not bond', () => {
  assert.deepEqual(B.read('26 × 12 = 312', { text: '26 × 12' }), { n: 312n, d: 1n }); assert.deepEqual(B.read('312', { text: '26 × 12' }), { n: 312n, d: 1n });
  assert.deepEqual(B.read('0.25', { text: '1 ÷ 4' }), { n: 1n, d: 4n }); assert.deepEqual(B.read('-320', { text: '231 - 551' }), { n: -320n, d: 1n }); assert.deepEqual(B.read('13.0', { text: '0.5 × 26' }), { n: 13n, d: 1n });
  assert.deepEqual(B.judge('312', { text: '26 × 12' }), { value: { n: 312n, d: 1n }, why: 'bonded' }); assert.deepEqual(B.judge('313', { text: '26 × 12' }), { value: null, why: 'wrong value' });
  for (const [cell, reply, ruling] of TABLE) {
    const v = B.read(reply, { text: cell });
    if (ruling === 'bonded') assert.ok(X.same(v, X.evaluate(cell).value), `${cell} ← ${reply}`); else assert.equal(v, null, `${cell} ← ${reply}`);
  }
  // a value that does not end as a decimal can never be stated, so such a cell never bonds
  for (const reply of ['0.333', '0.3333333333', '1/3', '1 ÷ 3', '0.(3)']) assert.equal(B.read(reply, { text: '1 ÷ 3' }), null, reply);
});

test('every sign of every operation is read, and no other character is', () => {
  assert.deepEqual(B.SIGNS, { '*': '×xX*', '/': '÷/', '+': '+', '-': '-−', '^': '^' }); assert.equal(B.LIMIT, 200);
  const cells = { '*': ['6', '7', '42'], '/': ['42', '7', '6'], '+': ['6', '7', '13'], '-': ['16', '7', '9'], '^': ['6', '2', '36'] };
  for (const [op, [a, b, v]] of Object.entries(cells)) for (const sign of B.SIGNS[op]) for (const other of B.SIGNS[op]) assert.equal(why(`${a} ${sign} ${b}`, `${a}${other}${b}=${v}`), 'bonded', `${a}${sign}${b} ← ${other}`);
  // a sign of another operation is another step; a character that is no sign at all is no statement
  for (const [op, [a, b, v]] of Object.entries(cells)) for (const [o2, signs] of Object.entries(B.SIGNS)) if (o2 !== op) for (const sign of signs) assert.equal(why(`${a} ${B.SIGNS[op][0]} ${b}`, `${a} ${sign} ${b} = ${v}`), 'another step', `${op} ← ${sign}`);
  for (const ch of ['·', '∙', '%', '&', '|', '~', ':', ';', '_', '\\', '#', '@', '!', 'e', 'E', 'o', 'O', 'l', '²', '½', '∞', '​', ' ', '﻿0', '\n', '\r', '\v', '\f']) assert.equal(why('6 × 7', `6 ${ch} 7 = 42`), 'not a statement', JSON.stringify(ch));
  // each digit is a digit; the characters either side of the digits are not
  for (const d of '0123456789') assert.equal(why(`1${d} + 1`, `1${d} + 1 = ${10 + Number(d) + 1}`), 'bonded', d);
  assert.equal(why('6 × 7', '4/'), 'not a statement'); assert.equal(why('6 × 7', '4:'), 'not a statement'); assert.equal(why('6 × 7', '42/'), 'not a statement');
});

test('whatever it is handed, it gives a ruling and does not throw', () => {
  for (const reply of HOSTILE) for (const cell of HOSTILE) assert.doesNotThrow(() => B.judge(reply, cell));
  for (const reply of HOSTILE) assert.equal(B.judge(reply, { text: '26 × 12' }).why, 'not a statement');
  for (const cell of HOSTILE) assert.deepEqual(B.judge('312', cell), { value: null, why: 'not a step' });
  for (const reply of ['('.repeat(100000), '9'.repeat(100000), '-'.repeat(190), '='.repeat(190), '1,'.repeat(90), '1.'.repeat(90), '−'.repeat(50) + '5', '𐀀', '\udc00', '26 × 12 = ' + '9'.repeat(150)]) { assert.doesNotThrow(() => B.judge(reply, { text: '26 × 12' })); assert.equal(B.read(reply, { text: '26 × 12' }), null); }
  for (const cell of ['9'.repeat(100000), '9'.repeat(50) + ' × 2', '2^64', '10^60', '10^61', '99^64', '1 ÷ 0.000', '0^-1']) assert.doesNotThrow(() => B.judge('1', { text: cell }), cell);
  assert.equal(why('2^64', '18446744073709551616'), 'bonded'); assert.equal(why('10^61', '1'), 'not a step'); assert.equal(why('0^-1', '0'), 'not a step'); assert.equal(why('1 ÷ 0.000', '0'), 'not a step');
});
