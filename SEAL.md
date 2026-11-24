# The Crystal: the seal

`SEAL.json` holds a SHA-256 of every file that can change a result: this repository's kernels (`src/`), The Climb's
kernels as vendored (`vendor/climb/`), the settings (which hold the sealed seed and the attack's seed and budget, so
they fix the problems and the attack), the seed crystal (`data/seed.json`) and the claims (`CLAIMS.md`). It was made
and committed before the model was shown one sealed problem. `test/seal.test.mjs` fails if a sealed byte changes, and
a sealed run counts only when it records the hash of `SEAL.json` itself.

## What the build was shaped on before any model run

The growth law was first run against scripted stand-ins for the model: one that is always right, one that is always
wrong, and one that is right only on the smallest steps. They found four faults in the first version of the law, each
fixed before a model was asked anything:

1. A step that stood in two places in a calculation was split in only one of them, and the other was then counted as
   dissolved. A split now replaces the step wherever it stands.
2. Splitting `4 × 100` into `4 × 1 × 100` gives back `4 × 100`. Working that holds the cell itself is not smaller,
   and is refused: such a cell dissolves.
3. A taking-away had nothing smaller than one place at a time, so a wrong `456 - 300` dissolved. The crystal has its
   own smaller steps for taking away: digit against digit, borrowing ten, and turning round below nothing.
4. Cells of one round were chosen by their numbers alone, so a cell could be picked that only existed if another cell
   of the same round bonded. Cells are now paired by where they stand, and a cell whose numbers changed within the
   round waits for the next.

## The bond-check was attacked before anything was grown on it

The check that makes bonds was then pulled out into one module (`src/bond.mjs`) and attacked (`src/fuzz.mjs`) before
any model run. Three opinions are taken on every reply: how the reply was made, the bond-check, and a second reader
written apart from it with its own decimal arithmetic. The attack found two faults, both closed:

5. The crystal's first bond-check read a reply with The Climb's line reader, which lets words go and reads many lines.
   It let a line that contradicts itself bond (`26 × 12 = 312 = 313`), let the right line bond with a second, false
   line riding on it, and let the right value bond when it was followed by a unit or sat behind words. The new check
   reads one fixed shape and nothing else. The first one is kept as one of the twelve planted readers the harness
   must catch.
6. The new check and the second reader both read `-3^2` as a power of a number below nothing; The Climb's arithmetic
   reads it as two steps, `-(3^2)`. No cell the crystal makes has that shape. Both readers now refuse it.

On the 77 different cells the dev problems start from (and some awkward ones), with the seed in the tests: 7,876
replies, 0 forged replies bonded, 0 honest replies refused, 0 on which the two readers differed, 0 thrown; and the
harness found the leak in 12 of 12 planted readers. These are counts of the attack on code, with no model in them.

## The dev run

One dev run was made before the seal, on the 40 dev problems (seed 20261101), in a browser tab on an Intel
integrated GPU: the crystal on every problem, then The Climb's own loop on the same problems. It is published whole
(`data/runs/dev.json`), and `scripts/publish.mjs` grew all 40 crystals again identically from their recorded replies
with no model before it was published.

| tier | problems | carry a calculation | the crystal completed | one try right | The Climb's loop home |
|---|---|---|---|---|---|
| easy | 10 | 10 | 10 | 10 | 10 |
| climb | 20 | 20 | 20 | 5 | 19 |
| wall | 10 | 4 | 2 | 0 | 0 |

No completed crystal was wrong. 233 cells were asked of the model in 1,564 seconds for both halves; 180 replies
bonded, 53 stated a wrong value, none was anything but one plain statement. The crystal made 233 short calls where
The Climb's loop made 118 long passes. 150 of the 233 calls carried the last conversation on; their middle time was
1.2 seconds, against 2.3 seconds for a call that began afresh.

7. Both crystals that did not complete stopped on a sum of a long number and a short one (`94048 + 800`,
   `6280 + 9`) that the model got wrong and that had nothing smaller. A smaller step for such sums (set the long
   number's leading place aside, add the rest first) was written, tested and tried on the dev problems. It completed
   neither crystal: once the smaller sums were done, the calculation paired its numbers back into the same hard sum,
   which was then split again, eight times over, before it dissolved. The two crystals went 91 and 69 rounds deep
   instead of stopping within 24. It was taken out before the seal, and the published dev run is the run the sealed
   code made. A way to keep such a split from pairing back is not in this build.

## The gate

Every kernel in `src/` and the genome cell is mutation-gated (`scripts/gates.mjs`, witness v0.6), and CI fails if a
gate is not clean or its counts differ from `data/gates.json`. Four mutants are exempt, each with its reason written
in `src/witness.baseline.json`: a limit no input can reach, an early way out that only saves time, and two edges of
the McNemar bar that cannot occur.
