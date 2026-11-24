// cell.mjs — The Crystal's three answers for the estate genome's birth check (seed.json, genome/).
//
// judge  the bond-check's own ruling on one reply to one cell { cell, reply }: verified when the reply states that
//        cell's value exactly (it would bond); unverified when it does not; refused when the cell is not a single
//        step of arithmetic on two numbers.
// lane   a cell is in lane when it is one operation on two numbers: that is all the crystal ever asks the model.
// health the repository cannot see its page's visitors or callers from inside it, so it says so.
import { judge as rule } from '../src/bond.mjs';

const cellOf = (input) => (input !== null && typeof input === 'object' && typeof input.cell === 'string' ? { text: input.cell } : null);

export async function judge(input) {
  const cell = cellOf(input), why = cell === null || typeof input.reply !== 'string' ? 'not a step' : rule(input.reply, cell).why;
  return why === 'not a step' ? 'refused' : why === 'bonded' ? 'verified' : 'unverified';
}

export async function inLane(input) {
  const cell = cellOf(input);
  return cell !== null && rule('', cell).why !== 'not a step';
}

export async function health() {
  return { used: null, dependedOn: null, lastEarned: null };
}
