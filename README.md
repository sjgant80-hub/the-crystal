# The Crystal

**Live: https://sjgant80-hub.github.io/the-crystal/** · open it, turn the crystal, press Enter, and watch one grow on
your own graphics chip.

Every lit facet is one step a small AI model got right, checked by exact arithmetic. A step it gets wrong is split
into smaller steps. A step it still cannot do shatters, and whatever needed it stays dark. Nothing else is on the
glass, and nothing leaves the browser.

The Crystal is the second build of [The Climb](https://sjgant80-hub.github.io/the-climb/), and it grows from it: it
does no arithmetic, reading or splitting of its own. It stands on The Climb's kernels, byte for byte as The Climb's
seal froze them (`vendor/climb/`, checked against that repository on every push), and its seed is every step The
Climb's sealed run checked (`data/seed.json`).

- [CLAIMS.md](CLAIMS.md) — the seven claims and their bars, committed before the model sees a sealed problem.
- [SEAL.md](SEAL.md) — what the build was tuned on, and the seal that froze every file that can change a result.
- `data/runs/` — the published runs, with every reply of the model and every event of every crystal.

## The law

A calculation is broken into cells: one operation on two numbers. Each round, every ready cell meets one law.

| | what happens | the glass |
|---|---|---|
| Set | the cell is already held, checked: it joins with no model call | the facet that holds it flashes |
| Bond | the model's whole reply is one plain statement of the cell's value, exactly right: it bonds | a facet lights |
| Split | the reply does not bond and the cell can be made smaller: smaller cells take its place | nothing yet: the cells come next round |
| Dissolve | the reply does not bond and there is nothing smaller | the cell shatters; what needed it stays dark |

A crystal that completes is right, because every bond is exact arithmetic on a value the model wrote. Growth always
stops, because a cell is asked once and every split is strictly smaller. Both are tested on every push.

## The watchers

The build is one stack of seven layers. Each watches the one beneath it, each is a small module tested alone, and each
has a limit it cannot run past. The page draws what each layer put out (`src/stack.mjs`), and nothing else.

| depth | the watcher | module | what it stops | its limit |
|---|---|---|---|---|
| 0 | The substrate | the 1B model in the tab | (the floor) | a reply is cut off at 24 tokens |
| 1 | The step watcher | `src/bond.mjs` | a made-up step | one reply, read once, 200 characters at most |
| 2 | The trajectory watcher | `vendor/climb/src/left.mjs`, `plan.mjs` | true lines that go nowhere, going round in circles | a cell is asked once and split again at most 8 times; 256 rounds |
| 3 | The topology watcher | `src/grow.mjs`, `src/lattice.mjs` | growing a thing twice, branches that cannot finish | 10,425 places; the glass draws 8,192 cells at most |
| 4 | The ceiling watcher | `src/fuzz.mjs` | a check that lets something false through | 108 replies for each cell, from a seed |
| 5 | The axiom-floor watcher | not built | a wall that never moves | parked: it would change the floor all the others stand on |
| 6 | The human | a person | the stack changing its own floor with nobody looking | always on |

The stack ends at both ends. The floor: nothing is kept that does not come down to a step the model was asked and a
check, which is code, bonded. The ceiling: a person. Nothing here changes the model; if a later build does, each
change stops at a person first.

Depth 4 was built before anything was grown on depth 1, because a leak in the check that makes bonds would be copied
into every cell above it. The harness takes three opinions on every reply: how the reply was made (a forgery or an
honest statement), the bond-check, and a second reader written apart from the bond-check with its own arithmetic. It
is then turned on twelve readers that each have a leak planted in them, and it has to find every one. One of the
twelve is this crystal's own first bond-check.

```bash
node --test test/bond.test.mjs test/fuzz.test.mjs
```

## What is in it

| path | what |
|---|---|
| `vendor/climb/` | The Climb's sealed kernels: exact arithmetic, the checker, the planner, the tracker, the memory, its loop and its problems (`PROVENANCE.json`) |
| `src/grow.mjs` | the growth law, round by round; replay with no model (gated) |
| `src/lattice.mjs` | where each cell stands: a diamond-type lattice, the memory's chambers for direction, depth for distance (gated) |
| `src/bond.mjs` | the bond-check: the one thing that can say a cell has bonded (gated) |
| `src/fuzz.mjs` | the attack on the bond-check: 23 ways of forging a reply, a second reader with its own arithmetic, 12 leaky readers it must catch (gated) |
| `src/stack.mjs` | the watcher stack: the seven layers, and what each put out in a run (gated) |
| `src/measure.mjs`, `src/claims.mjs` | every count and every verdict (gated) |
| `page/gem.js` | the glass: WebGL2, instanced octahedra, light split by colour, bloom. It draws a record and decides nothing |
| `page/`, `index.html` | the page: every kernel inlined, every published number baked in at build time |
| `scripts/` | vendor the seed, lay the seed crystal, build, gate, seal, publish |

## Run it

```bash
node --test test/*.test.mjs
```

```bash
node scripts/make-page.mjs
```

```bash
node scripts/vendor-climb.mjs --check
```

The model work happens in the browser: open the live page (or `index.html` from any static server) and press
**Grow it here**. It needs a browser with WebGPU. The record plays without one.

## Honest edges

- It is arithmetic. Nothing here measures the law on another kind of work.
- The attack on the bond-check is evidence, not a proof. It shows that many forged replies, made many ways, found no
  leak. It does not show that no forged reply exists.
- Depth 5 is not built. Nothing here trains the model on what the crystal proved.
- The checker holds the calculation, pairs the numbers and makes the splits. The model does every step.
- Cells of one round could be asked side by side. On one small GPU they are asked one after another, and the page
  reports how many were ready at once without claiming a speed it did not measure.
- Depth is the count of rounds, drawn as distance from the centre and as colour. It is not a fourth direction of space.
- The model's files come from the public WebLLM model library; this page does not pin their hashes.

Built by Kar. MIT licence, holder Simon Gant. Supplied by [AI Native Solutions](https://www.ai-nativesolutions.com);
support is agreed per deployment, in each deployment's agreement.
