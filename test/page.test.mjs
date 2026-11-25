import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build, page, KERNELS, BAKED, rewrite, body } from '../scripts/make-page.mjs';

const root = new URL('..', import.meta.url);
const ROOT = fileURLToPath(root).replace(/[\\/]$/, '');
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const LF = (s) => s.split('\r\n').join('\n');
const html = LF(read('index.html'));
const visible = html.slice(html.indexOf('<body>'), html.indexOf('<script type="module">'));

test('index.html is exactly the build of page/ and the kernels, baked from the published runs', async () => {
  assert.equal(html, await page(ROOT));
});

test('every kernel is inlined byte for byte, its imports read from the scopes above it', () => {
  for (const [ns, file] of KERNELS) {
    const { code } = body(read(file), file);
    assert.ok(html.includes(`const ${ns} = (() => {\n${code}\n`), `${file} is not inlined as built`);
    for (const line of LF(read(file)).split('\n')) {
      if (line.startsWith('import ')) assert.ok(rewrite(line, file), `${file}: an import the page cannot inline: ${line}`);
      else if (!line.startsWith('export default ')) assert.ok(code.includes(line.replace(/^export /, '')), `${file}: a line changed: ${line}`);
    }
  }
  // no two kernels share a file name, or an import by name could not tell them apart
  assert.equal(new Set(KERNELS.map(([, f]) => f.split('/').pop())).size, KERNELS.length);
  // the house kit comes first, then The Climb's kernels, each as vendored, and the glass comes last
  assert.ok(KERNELS.slice(0, 3).every(([, f]) => f.startsWith('vendor/house/'))); assert.ok(KERNELS.slice(3, 13).every(([, f]) => f.startsWith('vendor/climb/'))); assert.deepEqual(KERNELS[KERNELS.length - 1], ['GEM', 'page/gem.js']);
});

test('the page code runs: the inlined kernels decide as the modules do', async () => {
  const built = build(ROOT);
  const kernels = built.slice(built.indexOf('<script type="module">') + 22, built.indexOf('// app.js'));
  const mod = await import('data:text/javascript;base64,' + Buffer.from(kernels + '\nexport { EXACT, LEFT, TASKS, LOOP, BOND, GROW, LATTICE, FUZZ, MEASURE, STACK, CLAIMS, GEM };').toString('base64'));
  const G = (await import('../src/grow.mjs')).default, LAT = (await import('../src/lattice.mjs')).default, A = (await import('../src/fuzz.mjs')).default, B = (await import('../src/bond.mjs')).default, ST = (await import('../src/stack.mjs')).default, M = (await import('../src/measure.mjs')).default, C = (await import('../src/claims.mjs')).default;
  const tasks = mod.TASKS.set(20261101, 2), val = (t) => mod.EXACT.show(mod.EXACT.evaluate(t).value);
  // right on single digits and noughts only, so the crystals split, bond and dissolve
  const rule = (cell) => `${cell} = ${['digit × digit', 'digit × digit, with noughts', 'digit + digit', 'sum, places apart', 'half'].includes(G.klass(cell)) ? val(cell) : mod.EXACT.show(mod.EXACT.add(mod.EXACT.evaluate(cell).value, mod.EXACT.num('1')))}`;
  const call = async (m) => ({ text: rule(m[m.length - 1].content), ms: 1 });
  const a = await mod.GROW.run(tasks, call, { seed: ['21 × 21 = 441'], mem: { probes: 12 } }), b = await G.run(tasks, call, { seed: ['21 × 21 = 441'], mem: { probes: 12 } });
  assert.deepEqual(a, b); assert.ok(a.records.some((r) => r.complete) && a.records.some((r) => r.events.some((e) => e.kind === 'dissolve')));
  assert.deepEqual(mod.LATTICE.lattice(['21 × 21 = 441'], a.records), LAT.lattice(['21 × 21 = 441'], b.records));
  assert.deepEqual(mod.MEASURE.measure(a.records), M.measure(b.records)); assert.deepEqual(mod.FUZZ.fuzz(['26 × 12', '4 + 8', '231 - 551'], { seed: 5 }), A.fuzz(['26 × 12', '4 + 8', '231 - 551'], { seed: 5 })); assert.deepEqual(mod.FUZZ.teeth([], { seed: 5 }), A.teeth([], { seed: 5 }));
  for (const reply of ['26 × 12 = 312', '312', '313', '26 × 12 = 312 = 313', 'I think it is 312', '']) assert.deepEqual(mod.BOND.judge(reply, { text: '26 × 12' }), B.judge(reply, { text: '26 × 12' }), reply);
  const F0 = { m: M.measure(b.records), fuzz: A.fuzz(['26 × 12'], { seed: 5 }), teeth: A.teeth([], { seed: 5 }), counts: LAT.lattice([], b.records).counts, seal: 'abc' }; assert.deepEqual(mod.STACK.stack(F0), ST.stack(F0));
  assert.deepEqual(mod.CLAIMS.evaluate({ crystals: a.records }), C.evaluate({ crystals: b.records })); assert.deepEqual(mod.CLAIMS.evaluate(null).map((v) => v.pass), new Array(7).fill(null));
  assert.equal(mod.GEM.stone().count, 24); assert.equal(typeof mod.GEM.createGem, 'function'); assert.equal(typeof mod.LOOP.run, 'function');
});

test('nothing ships as a bare placeholder: every fill target is baked, and an unmeasured value says so', () => {
  assert.ok(!/>\s*…\s*</.test(visible), 'an element whose whole content is an ellipsis is on the page');
  for (const id of BAKED) assert.ok(new RegExp(`<([a-z0-9]+)\\b[^>]*\\sid="${id}"[^>]*>`).test(visible), `#${id} is on the page`);
  const tpl = read('page/template.html');
  for (const k of [...tpl.matchAll(/data-bind="([^"]+)"/g)].map((m) => m[1])) {
    const key = k.replace(/[.$]/g, '\\$&'), inTpl = tpl.match(new RegExp(`data-bind="${key}"[^>]*>([^<]*)<`))[1];
    const m = visible.match(new RegExp(`data-bind="${key}"[^>]*>([\\s\\S]*?)</(?:span|b|p|td)>`));
    assert.ok(m, `data-bind="${k}" is on the built page`);
    if (m[1] === inTpl) assert.match(m[1], /not measured yet/, `data-bind="${k}" was not baked and does not say it is unmeasured`);
  }
});

test('every id and binding the page script uses is on the page, and every binding is filled by the script', () => {
  const tpl = read('page/template.html'), app = read('page/app.js');
  const ids = new Set([...tpl.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(m[1]), `#${m[1]} is used by the script but not on the page`);
  const bound = new Set([...tpl.matchAll(/data-bind="([^"]+)"/g)].map((m) => m[1]));
  const set = new Set([...app.matchAll(/bind\('([^']+)'/g)].map((m) => m[1]));
  for (const k of bound) assert.ok(set.has(k), `data-bind="${k}" is never filled`);
  for (const k of set) assert.ok(bound.has(k), `the script fills "${k}", which is not on the page`);
  for (const k of [...BAKED.map((id) => `id="${id}"`), ...[...bound].map((b) => `data-bind="${b}"`)]) assert.match(tpl, new RegExp(`<([a-z0-9]+)\\b[^>]*\\s${k.replace(/[.$]/g, '\\$&')}[^>]*>[^<]*</\\1>`), `${k} must hold plain text in the template`);
  const seen = new Map(); for (const m of tpl.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  assert.deepEqual([...seen].filter(([, n]) => n > 1).map(([id]) => id), [], 'no two elements share an id');
});

test('the page says what it is and how to use it, in the house identity, with no private symbols and no price list', () => {
  const tpl = read('page/template.html');
  for (const h of ['id="top"', 'id="start"', 'id="how"', 'id="stack"', 'id="numbers"', 'id="limits"', 'id="blueprint"', 'id="buyers"', 'id="gem"']) assert.ok(tpl.includes(h), h);
  for (const mark of ['#02070c', "'Fraunces'", "'Hanken Grotesk'", "'JetBrains Mono'", 'It <em>crystallises.</em>', "Don't trust us.", 'Re-run it.', 'Nothing leaves your browser.', 'What this does not prove', '<canvas id="crystal"', 'id="hsReceipts"', 'id="hsClaims"', '<details class="honest ']) assert.ok(tpl.includes(mark), mark);
  // no font or script is fetched from a font host or a tracker: the fonts are the house kit's, in the repository
  const kit = read('vendor/house/house.css');
  assert.ok(!/fonts\.googleapis|fonts\.gstatic|googletagmanager|analytics/.test(tpl + kit)); const fonts = [...kit.matchAll(/url\('([^']+\.woff2)'\)/g)].map((m) => m[1]); assert.equal(fonts.length, 4); for (const f of fonts) assert.ok(readFileSync(new URL(f, root)).length > 10000, f);
  const shape = ['to', 'rus'].join('');
  for (const f of ['page/template.html', 'page/app.js', 'page/gem.js', 'README.md', 'CLAIMS.md', 'SEAL.md', 'NOTICE', 'seed.json', ...readdirSync(new URL('src/', root)).map((x) => `src/${x}`), ...readdirSync(new URL('scripts/', root)).map((x) => `scripts/${x}`)]) {
    const text = read(f);
    assert.ok(!/[\u25ca\u03ba\u03c6]/.test(text), `${f}: a private symbol`); assert.ok(!text.toLowerCase().includes(shape), `${f}: the private shape-word`);
  }
  assert.ok(/supplied by <a href="https:\/\/www\.ai-nativesolutions\.com">AI Native Solutions<\/a>/i.test(tpl)); assert.ok(/agreed per deployment, in each deployment's agreement/.test(tpl));
  assert.ok(!/[$£€]\s?\d/.test(tpl), 'no price is on the page');
});

test('the watcher stack is on the page, floor to ceiling, with what each layer put out or a plain not measured yet', async () => {
  const ST = (await import('../src/stack.mjs')).default, table = visible.slice(visible.indexOf('id="stackTable"'), visible.indexOf('</section>', visible.indexOf('id="stackTable"')));
  let at = 0;
  for (const l of ST.LAYERS) { const i = table.indexOf(`<b>${l.name}</b>`, at); assert.ok(i > at, `${l.name} is in the table, in order`); at = i; assert.ok(table.includes(`Its limit: ${l.ends.replace(/&/g, '&amp;')}.`), l.ends); }
  assert.ok(table.includes('nothing: it is not built'), 'depth 5 says it is not built'); assert.ok(/planted leaks found<\/span><br><b class="num">12 of 12 \(100\.0%\)<\/b>/.test(table), 'depth 4 is worked out at build time, with no run needed');
  assert.ok(/forged replies that bonded<\/span><br><b class="num">0 of \d+ \(0\.0%\)<\/b>/.test(table)); assert.ok(/replies the two readers ruled differently on<\/span><br><b class="num">0 of \d+ \(0\.0%\)<\/b>/.test(table));
  // the attack table names every way of forging and every planted reader, and shows no disagreement
  const A = (await import('../src/fuzz.mjs')).default, attack = visible.slice(visible.indexOf('id="attackTable"'), visible.indexOf('</details>', visible.indexOf('id="attackTable"')));
  for (const name of [...Object.keys(A.FORGERIES), ...Object.keys(A.PLANTED)]) assert.ok(attack.includes(name.replace(/'/g, '&#39;')), name);
  assert.ok(attack.includes('It found 12 of 12.')); assert.ok(!attack.includes('Replies the three opinions did not agree on')); assert.ok(!/class="num fail"/.test(attack));
  // the settings fix the attack before any run: its seed and how many replies each cell gets
  assert.deepEqual(JSON.parse(read('data/settings.json')).fuzz, { seed: 20261134, budget: A.BUDGET });
});

test('no private repository name is in anything this repository ships (checked by hash: the names are not listed here)', () => {
  const banned = new Set(JSON.parse(read('data/private-names.sha256.json')).sha256);
  assert.ok(banned.size >= 50);
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const files = ['index.html', 'README.md', 'CLAIMS.md', 'SEAL.md', 'NOTICE', 'seed.json', 'sw.js', 'manifest.webmanifest', 'data/published.json', 'data/settings.json', 'vendor/climb/PROVENANCE.json'];
  for (const dir of ['src', 'scripts', 'test', 'page', 'genome', 'vendor/climb/src', 'vendor/climb/vendor', '.github/workflows']) for (const f of readdirSync(new URL(`${dir}/`, root))) files.push(`${dir}/${f}`);
  const seen = new Set();
  for (const f of files) for (const tok of read(f).toLowerCase().match(/[a-z0-9_]+(?:-[a-z0-9_]*)*/g) || []) {
    if (seen.has(tok)) continue;
    seen.add(tok);
    const parts = tok.split('-');
    for (let i = 0; i < parts.length; i++) for (let k = i + 1; k <= parts.length; k++) { const run = parts.slice(i, k).join('-'); if (run.length >= 5) assert.ok(!banned.has(sha(run)), `${f} carries a private repository name (a ${run.length}-letter run in "${tok.slice(0, 4)}…")`); }
  }
});

test('the page meets the house standard: the ship gate, and the kit it vendors is the house kit', async () => {
  const STANDARD = (await import('../vendor/house/standard.mjs')).default;
  const r = STANDARD.check(html);
  assert.equal(r.pass, true, r.rules.filter((x) => !x.pass).map((x) => `${x.id} ${x.name}: ${x.why}`).join(' | '));
  assert.ok(r.measured.viewWords <= 1250 && r.measured.longest <= 45, 'no wall of text greets a visitor');
  // every word the page had before the rebuild is still on it: the old sections sit behind a click, none was dropped
  for (const id of ['start', 'how', 'stack', 'numbers', 'limits', 'blueprint', 'buyers']) assert.ok(new RegExp(`<details class="honest reveal" id="${id}"`).test(html), `the ${id} section is on the page, folded`);
  for (const f of ['house.css', 'crystal.js', 'house.js', 'receipts.mjs', 'standard.mjs']) assert.ok(read(`vendor/house/${f}`).length > 500, f);
});
