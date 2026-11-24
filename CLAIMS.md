# The Crystal: the claims, registered before the sealed run

This file is committed, with the seal (`SEAL.json`, [SEAL.md](SEAL.md)), before the model is shown one sealed
problem. The verdicts are worked out by `src/claims.mjs` from the recorded run, and the bars in that file are the bars
below, word for word (`test/claims.test.mjs` checks that on every push). A claim that fails stays on the page, failed,
in red. No bar is moved after the run.

## The question

The Climb showed that a small model gets further when something that is not the model checks each step. The Crystal
lets that go all the way down: every calculation is broken into single cells, each cell meets one law, and a cell that
fails is split until there is nothing smaller. Does that reach further than The Climb did, is a finished result always
right, and what does it cost?

## What is run

One model: Llama 3.2 1B Instruct at 4 bits (`Llama-3.2-1B-Instruct-q4f16_1-MLC`), in a browser tab through WebLLM
0.2.79 on WebGPU, always choosing its likeliest next word. The sealed problems are the 96 that The Climb's own
`tasks.mjs` (vendored, as sealed) makes from the sealed seed in `data/settings.json`. That seed is new: these are not
The Climb's sealed problems, which this crystal's seed was grown from and has therefore seen. The easy tier has few
possible problems (two single digits multiplied), so two of the 24 easy ones are, by chance, word for word problems
the seed has seen; they are left in and counted. No climb-tier or wall-tier problem has been seen before
(`test/seal.test.mjs` checks both statements).

Two things are run on every sealed problem:

- **The crystal** (`src/grow.mjs`). The calculation the problem asks for is held, and every round each ready cell
  (one operation on two numbers) is set from what is already held, or asked of the model. A reply bonds a cell only
  when the whole reply is one plain statement of that cell's value, exactly right (`src/bond.mjs`). Any other reply
  splits the cell into smaller cells, or dissolves it when there is nothing smaller. The crystal starts from the seed: the 554 steps The Climb's sealed run checked (`data/seed.json`).
- **The Climb's own loop**, with no memory, exactly as sealed in The Climb (`vendor/climb/`). Its first pass is **one
  try**.

A problem with no calculation to hold (find two primes, solve an equation by search) has nothing to grow. It is
counted as not grown, and is left out of every comparison.

## The claims

| | claim | the bar |
|---|---|---|
| K1 | A complete crystal is right | no crystal completes with a wrong answer: none, of every sealed problem |
| K2 | Growth always stops | no crystal runs into the limit on rounds, and every crystal that does not complete has a cell that dissolved |
| K3 | The bond-check holds | no forged reply bonds, of every forgery made for every cell the sealed run asked the model; no honest reply is refused; the bond-check and the second reader never rule differently on a reply; and nothing throws |
| K4 | The crystal reaches further than one try | the crystal completes more of the sealed problems than one try gets right, by an exact two-sided McNemar test, p < 0.05 |
| K5 | It reaches where the climb could not | on the sealed wall-tier problems that carry a calculation, the crystal completes at least one that The Climb did not bring home, and The Climb brings home none that the crystal did not complete |
| K6 | Nothing set is grown twice | no cell is asked of the model twice in one problem, and at least 1 cell in 10 of those that set was set from what was already held, with no model call |
| K7 | The harness can find a leak | the harness that attacks the bond-check finds the leak in every reader that has one planted in it |

K1 and K2 follow from the law and are tested on every push with scripted stand-ins for the model; the sealed run is
where they meet the real one. K3 and K7 are run by the page itself: K3 on the cells the sealed run asked, with the
seed and the number of replies for each cell fixed in `data/settings.json` before the run (108 replies a cell: 48
forged, 12 honest, 48 of noise); K7 by turning the same harness on the twelve leaky readers in `src/fuzz.mjs`, over eight cells, one of every
operation. K4 and K5 are the reach. K6 is the conservation.

## The bond-check was hardened first

A leak in the check that makes bonds would be copied into every cell grown on them, so the check was attacked before
anything was grown. It is one module (`src/bond.mjs`) with one rule: a reply bonds a cell only when the whole reply is
one plain statement of that cell's value (the step and its value, the value and the step, or the value alone). The
harness that attacks it (`src/fuzz.mjs`) takes three opinions on every reply: how the reply was made, the bond-check,
and a second reader written apart from it with its own arithmetic. While it was being built it found two things, both
closed before this seal. The crystal's first bond-check let a line that contradicts itself bond
(`26 × 12 = 312 = 313`). And the new one read `-3^2` as a power of a number below nothing, where The Climb's
arithmetic reads it as two steps; no cell has that shape, and the check now refuses it. The first build's bond-check
is kept as one of the twelve planted readers.

## What the dev run showed, before these bars were registered

The build was shaped on 40 other problems (the dev set, `data/runs/dev.json`, published with every reply). They are
not the sealed problems and their numbers are not the result. They are written here so that it is plain what was
known when the bars were set.

- 34 of the 40 carry a calculation. The crystal completed 32 of them and none was wrong: 10 of 10 easy, 20 of 20 on
  the climb tier, 2 of the 4 wall problems that carry a calculation. One try got 15 of the same 34 right; The Climb's
  loop brought 29 home, and none that the crystal did not complete.
- No crystal ran into the limit on rounds. The deepest took 24 rounds, and at most 6 cells were ready in one round.
- The model was asked 233 cells. Every one of its 233 replies was one plain statement: 180 bonded and 53 stated a
  wrong value. 35 of the 215 cells that set were set from what was already held (16.3%).
- Both crystals that did not complete stopped on a sum of a long number and a short one (`94048 + 800`,
  `6280 + 9`), which the model got wrong and which the planner has nothing smaller for. A smaller step for such
  sums was written and tried on the dev problems. It completed neither crystal and made both far deeper (91 and 69
  rounds, where they had stopped within 24), so it was taken out again before the seal. The sealed code is the code
  that made the published dev run, and the limit is left standing: there are steps this model cannot do that have
  nothing smaller.

So K1, K2, K4, K5 and K6 all held on the dev problems. They are registered for 96 problems the build has not been run
on, and they can fail there.

## What also goes on the page, whatever it shows

- How many crystals completed, how many are dark, and every dark one drawn where it stopped.
- For each kind of step, how often the model was asked it and how often it bonded: the measured floor.
- How many cells were ready in the same round (the width), which is how many could be asked side by side on
  hardware that can. On this hardware they are asked one after another, and no speed is claimed.
- Model calls, tokens and model time, against The Climb's loop on the same problems.
- The network requests made while the run worked.

## Rules for the run

- The sealed run is one run of the crystal and of The Climb's loop over all 96 problems, on one device, saved from
  the page. It may be made in more than one sitting; the number of sittings is recorded.
- The run is published only if `scripts/publish.mjs` finds it complete, made under this seal, and every crystal grows
  again identically from its recorded replies with no model.
- If the run cannot be completed, that is reported, and no partial result is shown as the result.
- A second sealed run is not made to get a better number.
