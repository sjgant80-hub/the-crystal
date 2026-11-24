// table.mjs — the bond-check's rule, written out as cases: [cell, reply, the ruling]. Both readers are held to this
// table: the bond-check (src/bond.mjs) must give the ruling, and the second reader (plainly, src/fuzz.mjs) must say
// yes exactly where the ruling is 'bonded'.
const pad = (n) => `26 ×${' '.repeat(n - '26 ×12 = 312'.length)}12 = 312`;
export const TABLE = [
  // the three forms
  ['26 × 12', '26 × 12 = 312', 'bonded'], ['26 × 12', '312 = 26 × 12', 'bonded'], ['26 × 12', '312', 'bonded'],
  // the two numbers of a product or a sum, either way round
  ['26 × 12', '12 × 26 = 312', 'bonded'], ['26 × 12', '312 = 12 × 26', 'bonded'], ['450 + 37', '37 + 450 = 487', 'bonded'], ['450 + 37', '487 = 37 + 450', 'bonded'],
  // every sign an operation is written with
  ['26 × 12', '26 x 12 = 312', 'bonded'], ['26 × 12', '26 X 12 = 312', 'bonded'], ['26 × 12', '26 * 12 = 312', 'bonded'], ['96 ÷ 2', '96 ÷ 2 = 48', 'bonded'], ['96 ÷ 2', '96 / 2 = 48', 'bonded'],
  ['494 - 228', '494 - 228 = 266', 'bonded'], ['494 - 228', '494 − 228 = 266', 'bonded'], ['21^2', '21^2 = 441', 'bonded'], ['21^2', '21 ^ 2 = 441', 'bonded'], ['26 x 12', '26 × 12 = 312', 'bonded'], ['96/2', '48', 'bonded'],
  // spaces or none, tabs, a full stop, white space at the ends, commas in the thousands
  ['26 × 12', '26×12=312', 'bonded'], ['26 × 12', '  26  ×  12  =  312  ', 'bonded'], ['26 × 12', '26\t×\t12\t=\t312', 'bonded'], ['26 × 12', '26 × 12 = 312.', 'bonded'], ['26 × 12', '312.', 'bonded'], ['26 × 12', ' 312. ', 'bonded'],
  ['26 × 12', '\n26 × 12 = 312\r\n', 'bonded'], ['26 × 12', '312 .', 'bonded'], ['300 × 40', '300 × 40 = 12,000', 'bonded'], ['300 × 40', '12,000', 'bonded'], ['300 × 40', '12000', 'bonded'], ['1000 × 1000', '1,000 × 1,000 = 1,000,000', 'bonded'],
  ['100000 + 23456', '123,456', 'bonded'], ['100000 + 23456.5', '123,456.5', 'bonded'], ['90 + 9', '90 + 9 = 99', 'bonded'], ['10 + 0', '10 + 0 = 10', 'bonded'], ['0 + 0', '0', 'bonded'],
  // decimals, and numbers below nothing
  ['0.5 × 26', '0.5 × 26 = 13', 'bonded'], ['0.5 × 26', '13.0', 'bonded'], ['0.5 × 26', '13.00.', 'bonded'], ['0.5 × 5', '2.5', 'bonded'], ['0.5 × 5', '0.5 × 5 = 2.50', 'bonded'], ['1 ÷ 4', '0.25', 'bonded'], ['026 × 12', '0312', 'bonded'],
  ['231 - 551', '231 - 551 = -320', 'bonded'], ['231 - 551', '231-551=-320', 'bonded'], ['231 - 551', '231 − 551 = −320', 'bonded'], ['231 - 551', '-320', 'bonded'], ['231 - 551', '−320', 'bonded'], ['231 - 551', '-320 = 231 - 551', 'bonded'],
  ['7 × -55', '7 × -55 = -385', 'bonded'], ['7 × -55', '7×-55=-385', 'bonded'], ['7 × -55', '-55 × 7 = -385', 'bonded'], ['7 × -55', '7 x −55 = −385', 'bonded'], ['-5 - 3', '-5 - 3 = -8', 'bonded'], ['-5 - 3', '-5-3=-8', 'bonded'], ['5 - -3', '5 - -3 = 8', 'bonded'], ['5 - -3', '5--3=8', 'bonded'],
  ['7 - 7', '-0', 'bonded'], ['0^2', '0', 'bonded'], ['0^2', '0^2 = 0', 'bonded'], ['0^0', '1', 'bonded'], ['2^-1', '0.5', 'bonded'], ['2^-1', '2^-1 = 0.5', 'bonded'], ['2^3', '-2^3 = 8', 'another step'],
  // exactly as long as a reply may be, and one more
  ['26 × 12', pad(200), 'bonded'], ['26 × 12', pad(201), 'too long'], ['26 × 12', `  ${pad(200)}\n\n`, 'bonded'], ['26 × 12', '9'.repeat(5000), 'too long'],
  // forty digits is a number; forty-one is not
  ['26 × 12', `26 × 12 = ${'0'.repeat(37)}312`, 'bonded'], ['26 × 12', `26 × 12 = ${'0'.repeat(38)}312`, 'not a statement'],
  // a wrong value
  ['26 × 12', '26 × 12 = 313', 'wrong value'], ['26 × 12', '313', 'wrong value'], ['26 × 12', '311', 'wrong value'], ['26 × 12', '312.5', 'wrong value'], ['26 × 12', '-312', 'wrong value'], ['26 × 12', '26 × 12 = -312', 'wrong value'], ['26 × 12', '3120', 'wrong value'],
  ['26 × 12', '31', 'wrong value'], ['26 × 12', '312 = 12 × 26.', 'bonded'], ['26 × 12', '313 = 26 × 12', 'wrong value'], ['231 - 551', '320', 'wrong value'], ['300 × 40', '1,200', 'wrong value'], ['300 × 40', '12,001', 'wrong value'], ['1 ÷ 3', '0.333', 'wrong value'], ['0.5 × 5', '2', 'wrong value'],
  // another step: not the cell's operation, not its numbers, or its numbers the other way round where that matters
  ['26 × 12', '26 + 12 = 312', 'another step'], ['26 × 12', '27 × 12 = 312', 'another step'], ['26 × 12', '26 × 13 = 312', 'another step'], ['26 × 12', '2 × 156 = 312', 'another step'], ['26 × 12', '312 × 1 = 312', 'another step'],
  ['26 × 12', '12 × 99 = 312', 'another step'], ['26 × 12', '99 × 26 = 312', 'another step'], ['26 × 12', '26 × 99 = 312', 'another step'], ['26 × 12', '99 × 12 = 312', 'another step'], ['26 × 12', '311 + 1 = 312', 'another step'], ['26 × 12', '2 + 2 = 4', 'another step'],
  ['26 × 12', '312 = 311 + 1', 'another step'], ['5 - 8', '8 - 5 = -3', 'another step'], ['5 - 8', '8 - 5 = 3', 'another step'], ['8 ÷ 2', '2 ÷ 8 = 4', 'another step'], ['2^3', '3^2 = 8', 'another step'], ['2 × 2', '2 + 2 = 4', 'another step'], ['2 + 2', '2 × 2 = 4', 'another step'],
  ['26 × 12', '-26 × 12 = 312', 'another step'], ['26 × 12', '26 × -12 = 312', 'another step'], ['26 × 12', '26 ÷ 12 = 312', 'another step'], ['26 × 12', '26 - 12 = 312', 'another step'], ['26 × 12', '26^12 = 312', 'another step'],
  // not one statement: no value, two values, working for a value, a second line, a second equals sign
  ['26 × 12', '', 'not a statement'], ['26 × 12', '   ', 'not a statement'], ['26 × 12', '.', 'not a statement'], ['26 × 12', '=', 'not a statement'], ['26 × 12', '26 × 12', 'not a statement'], ['26 × 12', '26 × 12 =', 'not a statement'], ['26 × 12', '= 312', 'not a statement'],
  ['26 × 12', '=312', 'not a statement'], ['26 × 12', '312 =', 'not a statement'], ['26 × 12', '312 = 312', 'not a statement'], ['26 × 12', '26 × 12 = 26 × 12', 'not a statement'], ['26 × 12', '26 × 12 = 312 = 312', 'not a statement'], ['26 × 12', '26 × 12 = 312 = 313', 'not a statement'],
  ['26 × 12', '26 × 12 = 313 = 312', 'not a statement'], ['26 × 12', '312 = 26 × 12 = 312', 'not a statement'], ['26 × 12', '26 × 12 = 300 + 12', 'not a statement'], ['26 × 12', '26 × 12 = 312 + 0', 'not a statement'], ['26 × 12', '26 × 12 × 1 = 312', 'not a statement'],
  ['26 × 12', '312 × 1', 'not a statement'], ['26 × 12', '312/1', 'not a statement'], ['26 × 12', '624/2', 'not a statement'], ['26 × 12', '26 × 12 = 312\n26 × 12 = 313', 'not a statement'], ['26 × 12', '26 × 12 = 313\n26 × 12 = 312', 'not a statement'],
  ['26 × 12', '26 × 12 = 312\n2 + 2 = 5', 'not a statement'], ['26 × 12', '26 × 12 = 312\n26 × 12 = 312', 'not a statement'], ['26 × 12', '312\n312', 'not a statement'], ['26 × 12', '312\n313', 'not a statement'], ['26 × 12', '312 313', 'not a statement'], ['26 × 12', '3 12', 'not a statement'],
  ['26 × 12', '26 × 12 = 3 12', 'not a statement'], ['26 × 12', '26 12 = 312', 'not a statement'], ['26 × 12', '26 12 5 = 312', 'not a statement'], ['26 × 12', '× = 312', 'not a statement'], ['26 × 12', '× × 12 = 312', 'not a statement'], ['26 × 12', '× 26 12 = 312', 'not a statement'],
  ['26 × 12', '26 × = 312', 'not a statement'], ['26 × 12', '- 26 × 12 = 312', 'not a statement'], ['26 × 12', '+312', 'not a statement'], ['26 × 12', '26 × 12 = +312', 'not a statement'], ['5 - 8', '5 - - 8 = -3', 'not a statement'], ['5 - 8', '- 3', 'not a statement'],
  // not a number written plainly
  ['26 × 12', '312..', 'not a statement'], ['26 × 12', '312,', 'not a statement'], ['26 × 12', '312;', 'not a statement'], ['26 × 12', '.312', 'not a statement'], ['0.5 × 5', '.5 × 5 = 2.5', 'not a statement'], ['0.5 × 5', '2.5.5', 'not a statement'], ['0.5 × 5', '2,5', 'not a statement'],
  ['300 × 40', '12,,000', 'not a statement'], ['300 × 40', '12.000,0', 'not a statement'], ['300 × 40', '12,000.', 'bonded'], ['300 × 40', '300, × 40 = 12000', 'not a statement'], ['300 × 40', '300. × 40 = 12000', 'not a statement'], ['0.5 × 5', '0..5 × 5 = 2.5', 'not a statement'],
  ['300 × 40', '12,00', 'not a statement'], ['300 × 40', '1,2000', 'not a statement'], ['300 × 40', '120,00', 'not a statement'], ['300 × 40', '12,000,', 'not a statement'], ['300 × 40', '012000,000', 'not a statement'], ['1000 × 1000', '1000,000', 'not a statement'],
  ['1000 × 1000', '1,000,00', 'not a statement'], ['26 × 12', '312e0', 'not a statement'], ['26 × 12', '0x138', 'not a statement'], ['26 × 12', '３１２', 'not a statement'], ['26 × 12', '3l2', 'not a statement'], ['26 × 12', '3:', 'not a statement'],
  // words, units, brackets, marks and characters that are not arithmetic
  ['26 × 12', 'I think it is 312', 'not a statement'], ['26 × 12', 'ANSWER: 312', 'not a statement'], ['26 × 12', 'So 26 × 12 = 312', 'not a statement'], ['26 × 12', '26 × 12 is 312', 'not a statement'], ['26 × 12', '26 × 12 ≈ 312', 'not a statement'],
  ['26 × 12', '312 m', 'not a statement'], ['26 × 12', '26 × 12 = 312 m', 'not a statement'], ['26 × 12', '(26 × 12) = 312', 'not a statement'], ['26 × 12', '26 × 12 = (312)', 'not a statement'], ['26 × 12', '$312', 'not a statement'], ['26 × 12', '**312**', 'not a statement'],
  ['26 × 12', '312?', 'not a statement'], ['26 × 12', '312!', 'not a statement'], ['26 × 12', 'Step 1: 26 × 12 = 312', 'not a statement'], ['26 × 12', '312​', 'not a statement'], ['26 × 12', '26 × 12 = 312', 'not a statement'], ['26 × 12', '\u0000312', 'not a statement'],
  ['26 × 12', '312\ud800', 'not a statement'], ['26 × 12', '26 · 12 = 312', 'not a statement'], ['26 × 12', '26 × 12 = 312 or 313', 'not a statement'], ['21^2', '21² = 441', 'not a statement'], ['0.5 × 26', '½ × 26 = 13', 'not a statement'],
  // a cell that is not one step with a value
  ['2 × 3 × 4', '24', 'not a step'], ['12', '12', 'not a step'], ['abc', '5', 'not a step'], ['', '', 'not a step'], ['5 ÷ 0', '0', 'not a step'], ['2^65', '1', 'not a step'], ['(2 × 3)', '6', 'not a step'], ['2 × 3 = 6', '6', 'not a step'], ['--5', '5', 'not a step'], ['26 × 12.', '312', 'not a step'], ['-3^2', '9', 'not a step'], ['-3^2', '-9', 'not a step'], ['-22^0', '1', 'not a step'], ['−3 ^ 2', '9', 'not a step'],
];
// replies and cells that are not text at all: nothing may throw on these
export const HOSTILE = [null, undefined, 7, 7n, true, {}, [], () => 1, Symbol('x'), { text: 5 }, { text: null }, { get text() { throw new Error('no'); } }, new Proxy({}, { get() { throw new Error('no'); } })];
