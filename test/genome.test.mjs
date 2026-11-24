import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge, inLane, health } from '../genome/cell.mjs';

const seed = JSON.parse(readFileSync(new URL('../seed.json', import.meta.url), 'utf8'));

test('the judge tells the seed\'s good case from its bad one: a reply bonds only by stating the cell\'s own value', async () => {
  assert.equal(await judge(seed.judge.cases.good), 'verified');
  assert.equal(await judge(seed.judge.cases.bad), 'unverified', 'other working that comes to the same number does not bond');
  assert.equal(await judge({ cell: '26 × 12', reply: '312' }), 'verified'); assert.equal(await judge({ cell: '26 x 12', reply: '312 = 12 × 26' }), 'verified');
  assert.equal(await judge({ cell: '26 × 12', reply: '26 × 12 = 313' }), 'unverified'); assert.equal(await judge({ cell: '26 × 12', reply: '' }), 'unverified'); assert.equal(await judge({ cell: '26 × 12', reply: 'ANSWER: 312' }), 'unverified');
  for (const bad of [{ cell: 'pizza', reply: '1' }, { cell: '312', reply: '312' }, { cell: '2 × 3 × 4', reply: '24' }, { cell: '--5', reply: '5' }, { cell: '26 × 12', reply: 312 }, { cell: '26 × 12' }, { reply: '312' }, { cell: 26, reply: '312' }, null, '26 × 12 = 312', 7]) assert.equal(await judge(bad), 'refused', JSON.stringify(bad));
});

test('the lane takes a single step and refuses anything else', async () => {
  assert.equal(await inLane(seed.boundary.inLane), true); assert.equal(await inLane(seed.boundary.outOfLane), false);
  assert.equal(await inLane({ cell: '0.5 × 26' }), true); assert.equal(await inLane({ cell: '231 - 551' }), true); assert.equal(await inLane({ cell: '42' }), false);
  assert.equal(await inLane({ cell: '2 + 3 + 4' }), false); assert.equal(await inLane({ cell: 42 }), false); assert.equal(await inLane(null), false); assert.equal(await inLane({}), false); assert.equal(await inLane({ cell: '--5' }), false);
});

test('health says what the repository cannot see from inside itself', async () => {
  assert.deepEqual(await health(), { used: null, dependedOn: null, lastEarned: null });
  assert.equal(seed.name, 'the-crystal'); assert.equal(seed.genome, '1'); assert.equal(seed.provenance.repo, 'sjgant80-hub/the-crystal');
});
