// app.js — the page. The kernels above it are the gated code, inlined byte for byte; this file shows what they
// compute, drives the model in the tab, and hands each record to the glass. Every number it writes is a count of
// what happened in a recorded run, through MEASURE and CLAIMS.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bind = (k, html) => { for (const el of document.querySelectorAll(`[data-bind="${k}"]`)) el.innerHTML = html; };
const getJSON = async (p) => { try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch { return null; } };
const NM = '<span class="pend">not measured yet</span>';
const WEBLLM = 'https://esm.run/@mlc-ai/web-llm@0.2.79', MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
const S = { data: null, engine: null, gpu: null, canRun: false, busy: false, gem: null, L: null, time: 0, target: 0, live: false, local: null, view: 'published' };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const tasksOf = (set) => { const s = S.data.settings.sets[set]; return s ? TASKS.set(s.seed, s.sheets) : []; };
const seedFacts = () => (S.data.seed && Array.isArray(S.data.seed.facts) ? S.data.seed.facts : []);
const recordsOf = (run, part) => (run && run[part] && Array.isArray(run[part].records) ? run[part].records : []);
const covers = (run, part, tasks) => { const ids = new Set(recordsOf(run, part).map((r) => r.id)); return tasks.length > 0 && tasks.every((t) => ids.has(t.id)); };
const sourceOf = (run) => (run ? `Llama 3.2 1B, 4-bit, in a browser tab (WebLLM 0.2.79), ${esc(run.gpu || 'GPU not reported')}, ${String(run.at).slice(0, 10)}` : 'not measured yet');
// the run the page is showing: the visitor's own once they have made one, else the published sealed run, else the dev run
const shown = () => (S.view === 'mine' && S.local ? { run: S.local, what: `your run on this device (${S.local.set} set)` } : S.data.runs.sealed ? { run: S.data.runs.sealed, what: 'the published sealed run' } : S.data.runs.dev ? { run: S.data.runs.dev, what: 'the published dev run (the problems the build was tuned on)' } : { run: null, what: null });
// every cell the run put to the model: what the bond-check is attacked on
const askedCells = (records) => [...new Set(records.flatMap((r) => (r.events || []).filter((e) => typeof e.said === 'string').map((e) => e.cell)))];
// the attack on the bond-check (FUZZ), with the seed and the budget the settings fixed. It is the same for the same
// cells, so it is worked out once for each set of cells.
const memo = new Map();
const fuzzOpts = () => { const f = S.data.settings.fuzz || {}; return { seed: f.seed, budget: f.budget }; };
const fuzzOf = (cells) => { const key = cells.join('|'); if (!memo.has(key)) memo.set(key, FUZZ.fuzz(cells, fuzzOpts())); return memo.get(key); };
const teethOf = () => { if (!memo.has('teeth')) memo.set('teeth', FUZZ.teeth([], fuzzOpts())); return memo.get('teeth'); };
const pc = (n, d) => (d > 0 ? `${((100 * n) / d).toFixed(1)}%` : '');

// ── the glass ──
function show(L, jump) {
  S.L = L;
  if (S.gem) S.gem.setLattice(L);
  S.target = L.span + 2;
  if (jump) S.time = S.target;
  if (S.gem) S.gem.setTime(S.time);
}
function tick() {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tick);
  if (!S.gem || !S.L || Math.abs(S.target - S.time) < 0.001) return;
  // the moment shown follows the record: quickly when it is far behind, a cell or two a second when it is close
  const gap = S.target - S.time, step = Math.sign(gap) * Math.min(Math.abs(gap), Math.max(0.04, Math.abs(gap) * 0.02));
  S.time += step; S.gem.setTime(S.time);
  if (!S.scrubbing) $('scrub').value = String(Math.round((1000 * Math.min(S.time, S.L.span)) / Math.max(1, S.L.span)));
}
function play() { if (!S.L) return; S.time = 0; S.target = S.L.span + 2; if (S.gem) S.gem.setTime(0); }
function tip(e) {
  if (!S.gem) return;
  const r = e.target.getBoundingClientRect(), hit = S.gem.pick(e.clientX - r.left, e.clientY - r.top), t = $('tip');
  if (!hit) { t.style.transform = 'translate(-999px,-999px)'; return; }
  const c = hit.cell, what = { seed: 'held before the run began', bond: 'the model stated this, and the step watcher bonded it', home: 'a crystal completed: its answer', dissolve: 'not bonded, and nothing smaller: dissolved', dark: 'never reached' }[c.kind];
  t.innerHTML = `<b>${esc(c.text)}</b><br>${what}${c.depth ? ` · round ${c.depth}` : ''}`;
  t.style.transform = `translate(${Math.min(e.clientX + 14, innerWidth - 300)}px, ${e.clientY + 14}px)`;
}

// the watcher stack: what each layer put out in the run shown. Depths 0 to 3 are counts of the run; depth 4 is the
// attack on the bond-check, worked out on this page.
function drawStack(m, counts, fz, th, cells, what) {
  const cell = (v) => (v === null ? NM : esc(v)), mark = { built: 'pass', parked: 'pend', 'always on': 'pass' };
  $('stackTable').innerHTML = `<table><thead><tr><th>depth</th><th>the watcher</th><th>what it does, and where it must stop</th><th>what it put out</th></tr></thead><tbody>${STACK.stack({ m, fuzz: fz, teeth: th, counts: m ? counts : null, seal: S.data.seal }).map((l) => `<tr><td class="num">${l.depth}</td><td><b>${esc(l.name)}</b><br><span class="small">${esc(l.module)} · <span class="${mark[l.status]}">${esc(l.status)}</span></span></td><td>${esc(l.job)}${l.stops ? ` <span class="small">Stops: ${esc(l.stops)}.</span>` : ''}<br><span class="small">Its limit: ${esc(l.ends)}.</span></td><td>${l.emits.length ? l.emits.map((e) => `<span class="small">${esc(e.label)}</span><br><b class="num">${cell(e.value)}</b>`).join('<br>') : '<span class="small">nothing: it is not built</span>'}</td></tr>`).join('')}</tbody></table><p class="small">${m ? `Depths 0 to 3 are counted from ${esc(what)}.` : 'Depths 0 to 3 are not measured until a run is recorded.'} Depth 4 is worked out on this page each time it loads: ${cells.length ? `the ${cells.length} different cells that run put to the model` : 'eight cells, one of every operation, until a run is recorded'}, ${fz.tried} replies, seed ${fz.seed}.</p>`;
}

// ── what the record says ──
function render() {
  const { run, what } = shown(), crystals = recordsOf(run, 'crystal'), climb = recordsOf(run, 'climb'), seed = seedFacts();
  const L = LATTICE.lattice(seed, crystals), m = crystals.length ? MEASURE.measure(crystals) : null, cells = askedCells(crystals);
  const fz = fuzzOf(cells.length ? cells : FUZZ.EVERY), th = teethOf(), G = S.data.gates && S.data.gates.files ? S.data.gates.files : {};
  bind('n.bonds', m ? String(m.events.bond) : NM); bind('n.reused', m ? String(m.events.set) : NM); bind('n.dissolved', m ? String(m.events.dissolve) : NM);
  bind('n.depth', m ? String(m.depth.deepest) : NM); bind('n.complete', m ? `${m.complete - m.wrong} of ${m.grown}` : NM);
  $('status').innerHTML = run ? `Showing ${esc(what)}: ${sourceOf(run)}.` : `No crystal has been grown and recorded yet. ${seed.length ? `The glass shows the seed: ${seed.length} steps The Climb's sealed run checked.` : 'Press the button to grow one here.'}`;
  bind('h.seed', seed.length ? `The seed on this page is ${seed.length} checked steps, from ${esc(S.data.seed.from)}.` : 'The seed is not laid yet: The Climb\'s sealed run has to be published first.');
  bind('h.law', m ? `In ${esc(what)}: ${m.complete} crystals completed and ${m.wrong} of them were wrong; ${m.capped} ran into the limit on rounds; the widest round had ${m.width.widest} cells ready at once.` : 'Both are tested on every push; the run that measures them on the model is not made yet.');
  bind('h.source', run ? `From ${esc(what)}: ${sourceOf(run)}; ${run.seconds} s in ${run.segments} sitting${run.segments === 1 ? '' : 's'}; ${run.privacy ? run.privacy.requests : '?'} network requests while it worked.` : 'The sealed run has not been made yet. The claims below are registered and waiting.');
  // the claims: judged on the published sealed run only
  const sealed = S.data.runs.sealed, sc = recordsOf(sealed, 'crystal'), V = CLAIMS.evaluate({ crystals: sc, climb: recordsOf(sealed, 'climb'), fuzz: sc.length ? fuzzOf(askedCells(sc)) : null, teeth: sc.length ? th : null });
  const badge = (v) => (v.pass === true ? '<span class="pass">PASS</span>' : v.pass === false ? '<span class="fail">FAIL</span>' : '<span class="pend">NOT MEASURED YET</span>');
  $('claimsTable').innerHTML = `<table><thead><tr><th>claim</th><th>the bar, registered before the run</th><th>on the sealed run</th><th></th></tr></thead><tbody>${V.map((v) => `<tr><td><b>${v.id}</b> ${esc(CLAIMS.NAMES[v.id])}</td><td>${esc(CLAIMS.BARS[v.id])}</td><td>${esc(v.result.replace(/^pending: /, 'Not measured yet: '))}</td><td>${badge(v)}</td></tr>`).join('')}</tbody></table>`;
  $('floor').innerHTML = m && m.asked ? `<table><thead><tr><th>kind of step</th><th>asked</th><th>bonded</th><th>split</th><th>dissolved</th></tr></thead><tbody>${Object.entries(m.classes).sort((a, b) => b[1].asked - a[1].asked).map(([k, c]) => `<tr><td>${esc(k)}</td><td class="num">${c.asked}</td><td class="num">${c.bonded} (${((100 * c.bonded) / c.asked).toFixed(0)}%)</td><td class="num">${c.split}</td><td class="num${c.dissolved ? ' fail' : ''}">${c.dissolved}</td></tr>`).join('')}</tbody></table><p class="small">Right nearly every time it was asked (at least 19 in 20, asked at least 10 times): ${esc(MEASURE.floor(m.classes).join(', ') || 'none')}. From ${esc(what)}.</p>` : NM;
  drawStack(m, L.counts, fz, th, cells, what);
  $('attackTable').innerHTML = `<p>${fz.tried} replies were put to the bond-check on ${fz.cells} cells (${cells.length ? `every different cell ${esc(what)} asked the model` : 'eight cells, one of every operation, until a run is recorded'}), from seed ${fz.seed}. <b class="${fz.forged.bonded ? 'fail' : 'pass'}">${fz.forged.bonded} of ${fz.forged.tried} forged replies bonded.</b> <b class="${fz.honest.refused ? 'fail' : 'pass'}">${fz.honest.refused} of ${fz.honest.tried} honest replies were refused.</b> The bond-check and the second reader ruled differently on <b class="${fz.split ? 'fail' : 'pass'}">${fz.split}</b> replies, and ${fz.threw} threw. ${fz.noise.bonded} of ${fz.noise.tried} noise replies bonded, each one because the noise had left it an honest statement: both readers said so. ${fz.forged.own} forgeries came out as the cell's own statement and were not tried.</p><table><thead><tr><th>how the reply was forged</th><th>a bond would be</th><th>tried</th><th>bonded</th></tr></thead><tbody>${fz.forged.rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.kind === 'unsound' ? 'false' : 'outside the three forms'}</td><td class="num">${r.tried}</td><td class="num${r.bonded ? ' fail' : ''}">${r.bonded}</td></tr>`).join('')}</tbody></table>${fz.found.length ? `<p class="fail">Replies the three opinions did not agree on:</p><ul>${fz.found.map((f) => `<li><code>${esc(f.cell)}</code> ← <code>${esc(JSON.stringify(f.reply))}</code> (${esc(f.way)}): bond-check ${f.bond}, second reader ${f.second}</li>`).join('')}</ul>` : ''}<h3>Some of what it tried</h3><table><thead><tr><th>made as</th><th>the reply</th><th>bonded</th></tr></thead><tbody>${fz.sample.map((x) => `<tr><td>${esc(x.arm === 'forged' ? x.way : x.arm)}</td><td><code>${esc(JSON.stringify(x.reply))}</code></td><td>${x.bond ? 'yes' : 'no'}</td></tr>`).join('')}</tbody></table><h3>Can the harness find a leak at all?</h3><p>The same harness was turned on ${th.planted} readers that each have one leak planted in them. <b class="${th.caught === th.planted ? 'pass' : 'fail'}">It found ${th.caught} of ${th.planted}.</b> One of them is this crystal's own first bond-check, which let a line that contradicts itself bond.</p><table><thead><tr><th>the planted reader</th><th>found</th><th>the first reply that gave it away</th></tr></thead><tbody>${th.rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="${r.caught ? 'pass' : 'fail'}">${r.caught ? 'yes' : 'NO'}</td><td>${r.reply === null ? '' : `<code>${esc(JSON.stringify(r.reply))}</code> <span class="small">(${esc(r.way)})</span>`}</td></tr>`).join('')}</tbody></table>`;
  $('cost').innerHTML = m && m.asked ? `<p>${m.calls} model calls for ${m.grown} crystals (${(m.calls / m.grown).toFixed(1)} each), ${m.tokens.reply} tokens written and ${m.tokens.prompt} read, ${m.seconds.toFixed(0)} s of model time. ${climb.length ? `The Climb's own loop on the same problems made ${climb.reduce((a, r) => a + r.passes.length, 0)} calls and wrote ${climb.reduce((a, r) => a + r.passes.reduce((b, p) => b + (p.reply || 0), 0), 0)} tokens.` : ''} The widest round had ${m.width.widest} cells ready at once and the mean round ${m.width.mean.toFixed(2)}: that is how many could be asked side by side on hardware that can. Here they were asked one after another.</p>` : NM;
  const gate = (files) => { const got = files.map((f) => G[f]); if (got.some((g) => !g)) return '<span class="pend">built; its mutation gate is not recorded yet</span>'; const k = got.reduce((a, g) => a + g.killed, 0), n = got.reduce((a, g) => a + g.total, 0), ig = got.reduce((a, g) => a + (g.ignored || 0), 0); return got.every((g) => g.clean === true) ? `<span class="pass">built, gated ${k}/${n}${ig ? ` (${ig} equivalent, with the reason written down)` : ''}</span>` : `<span class="fail">built, gate not clean: ${k}/${n}</span>`; };
  bind('bp.grow', gate(['src/grow.mjs'])); bind('bp.lattice', gate(['src/lattice.mjs'])); bind('bp.bond', gate(['src/bond.mjs'])); bind('bp.fuzz', gate(['src/fuzz.mjs'])); bind('bp.measure', gate(['src/measure.mjs', 'src/claims.mjs', 'src/stack.mjs']));
  bind('bp.seed', S.data.provenance ? `the-climb at ${esc(String(S.data.provenance.commit).slice(0, 7))}, ${S.data.provenance.files.length} files, each with the hash its seal gives it` : NM);
  bind('b.what', m ? `In ${esc(what)} it completed ${m.complete - m.wrong} of ${m.grown} problems, none of them wrong, and left ${m.dark} dark.` : 'The result is not measured yet.');
  bind('b.cost', m ? `${(m.calls / m.grown).toFixed(1)} small calls per problem in ${esc(what)}.` : 'The cost is not measured yet.');
  bind('b.slow', m ? `${m.seconds.toFixed(0)} s in all spent waiting on the model, for ${m.grown} problems on ${esc(run.gpu || 'this GPU')}, asked one cell at a time.` : 'The time is not measured yet.');
  bind('b.dark', m ? `${m.dark} of ${m.grown} in ${esc(what)}.` : 'The count is not measured yet.');
  bind('b.board', m ? `In ${esc(what)}: ${m.complete - m.wrong} of ${m.grown} finished, ${m.wrong} finished wrong, ${m.dark} stopped and said where.` : 'The result is not measured yet.');
  const w = S.data.walk;
  $('walk').innerHTML = w ? `<h3>A simulated buyer walk</h3><p class="small">${esc(w.note)}</p>${w.personas.map((p) => `<details><summary>${esc(p.who)}: ${esc(p.verdict)}</summary><ul>${p.gaps.map((g) => `<li>${esc(g.gap)} → ${esc(g.fix)}</li>`).join('')}</ul></details>`).join('')}` : '';
  return L;
}

// ── the model in the tab ──
async function device() {
  if (typeof navigator === 'undefined' || !navigator.gpu) { $('device').innerHTML = '<span class="fail">This browser has no WebGPU, so the model cannot run here.</span> The record still plays, and steps 3 and 4 still work.'; return; }
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) throw new Error('no adapter');
    const info = a.info || (a.requestAdapterInfo ? await a.requestAdapterInfo() : {});
    S.gpu = [info.vendor, info.architecture].filter(Boolean).join(' ') || 'WebGPU'; S.canRun = true;
    $('device').innerHTML = `<span class="pass">WebGPU is available</span> (${esc(S.gpu)}).`;
  } catch { $('device').innerHTML = '<span class="fail">WebGPU did not start on this device.</span> The record still plays.'; }
}
async function load(out) {
  if (S.engine) return true;
  if (!S.canRun) { out.innerHTML = '<span class="fail">No WebGPU on this device, so the model cannot run here.</span>'; return false; }
  try {
    const webllm = await import(WEBLLM);
    S.engine = await webllm.CreateMLCEngine(MODEL, { initProgressCallback: (p) => { out.textContent = p.text; } });
    out.textContent = 'The model is loaded and running on this device.';
    return true;
  } catch (e) { out.innerHTML = `<span class="fail">The model did not load:</span> ${esc(e && e.message)}`; return false; }
}
async function ask(messages, maxTokens) {
  const t0 = performance.now();
  const r = await S.engine.chat.completions.create({ messages, temperature: 0, max_tokens: maxTokens });
  const u = r.usage || {};
  return { text: r.choices[0].message.content || '', ms: performance.now() - t0, prompt: u.prompt_tokens ?? null, reply: u.completion_tokens ?? null, cut: r.choices[0].finish_reason === 'length' };
}
const setBusy = (b) => { S.busy = b; if (S.gem) S.gem.setBusy(b); for (const id of ['grow', 'run']) $(id).disabled = b; };

// grow a few crystals in front of the visitor: the sample problems, on the seed, each cell on the glass as it sets
async function growLive() {
  if (S.busy || !(await load($('status')))) return;
  setBusy(true); S.live = true;
  const tasks = tasksOf('sample'), seed = seedFacts(), done = [];
  let calls = 0;
  const onEvent = (e, rec) => { if (typeof e.said === 'string') calls++; show(LATTICE.lattice(seed, [...done, rec]), false); $('status').textContent = `Live on this device: problem ${done.length + 1} of ${tasks.length}, round ${e.tick}, ${calls} model calls. ${e.kind === 'bond' ? `${e.cell} = ${e.value} ✓` : e.kind === 'split' ? `${e.cell}: ${e.why || 'met again'}, split` : e.kind === 'dissolve' ? `${e.cell}: ${e.why || 'met again'}, dissolved` : `${e.cell} was already set`}`; };
  try {
    const out = await GROW.run(tasks, ask, { ...S.data.settings, seed, onEvent, onDone: (rec) => { done.push(rec); drawStack(MEASURE.measure(done), LATTICE.lattice(seed, done).counts, fuzzOf(FUZZ.EVERY), teethOf(), [], `the ${done.length} crystal${done.length === 1 ? '' : 's'} grown live on this device so far`); } });
    const m = MEASURE.measure(out.records);
    show(LATTICE.lattice(seed, out.records), false);
    $('status').innerHTML = `<b>Grown live on this device</b> (${esc(S.gpu || 'WebGPU')}): ${m.complete - m.wrong} of ${m.grown} crystals complete, ${m.wrong} wrong, ${m.dark} dark, ${m.calls} model calls.`;
    bind('n.bonds', String(m.events.bond)); bind('n.reused', String(m.events.set)); bind('n.dissolved', String(m.events.dissolve)); bind('n.depth', String(m.depth.deepest)); bind('n.complete', `${m.complete - m.wrong} of ${m.grown}`);
  } catch (e) { $('status').innerHTML = `<span class="fail">It stopped:</span> ${esc(e && e.message)}`; }
  setBusy(false);
}

// ── the measurement: every problem as a crystal, then under The Climb's own loop, saved as it goes ──
const sealCache = {};
async function sealHash() {
  if (sealCache.v === undefined) { try { const r = await fetch('SEAL.json'); sealCache.v = r.ok ? SHA.sha256((await r.text()).split('\r\n').join('\n')) : ''; } catch { sealCache.v = ''; } }
  return sealCache.v || null;
}
const runKey = (set) => `crystal-run-${set}`;
async function runSet({ set = 'sample', ui = true } = {}) {
  const tasks = tasksOf(set), key = runKey(set), seed = seedFacts(), st = S.data.settings;
  let R = store.get(key);
  if (!R || R.set !== set || R.complete) R = { v: 'the-crystal-run/1', venue: 'tab (WebLLM 0.2.79, WebGPU)', model: MODEL, gpu: S.gpu, ua: navigator.userAgent, set, sealSha256: await sealHash(), at: new Date().toISOString(), seconds: 0, segments: 0, privacy: { requests: 0 }, crystal: { records: [], seeds: 0, memory: null }, climb: { records: [] }, complete: false };
  R.segments++;
  if (ui) { S.local = R; S.view = 'mine'; }
  const before = performance.getEntriesByType('resource').length, baseReq = R.privacy.requests || 0, t0 = Date.now(), base = R.seconds, total = tasks.length * 2;
  const note = async (part) => {
    R.seconds = base + Math.round((Date.now() - t0) / 1000); R.privacy = { requests: baseReq + performance.getEntriesByType('resource').length - before }; store.set(key, R);
    const n = R.crystal.records.length + R.climb.records.length;
    if (ui) { $('runOut').textContent = `${n} of ${total} (${part}) · ${R.seconds} s`; if (n % 4 === 0) show(LATTICE.lattice(seed, R.crystal.records), false); }
  };
  if (!covers(R, 'crystal', tasks)) {
    const done = R.crystal.records.slice();
    R.crystal.records = done;
    const out = await GROW.run(tasks, ask, { maxTicks: st.maxTicks, maxTokens: st.maxTokens, mem: st.mem, seed, done, onDone: async (rec) => { R.crystal.records.push(rec); await note('the crystal'); } });
    R.crystal = { records: out.records, seeds: out.seeds, memory: out.memory };
  }
  if (!covers(R, 'climb', tasks)) {
    const done = R.climb.records.slice();
    R.climb.records = done;
    const out = await LOOP.run(tasks, 'climb-alone', LOOP.caller(ask), { depth: st.depth, maxTokens: st.climbTokens, done, onDone: async (rec) => { R.climb.records.push(rec); await note('The Climb\'s loop'); } });
    R.climb = { records: out.records };
  }
  R.complete = covers(R, 'crystal', tasks) && covers(R, 'climb', tasks);
  await note('done');
  return R;
}
async function runUI() {
  if (S.busy || !(await load($('runOut')))) return;
  setBusy(true);
  try {
    const R = await runSet({ set: $('runWhich').value || 'sample', ui: true });
    window.__crystalRun = R;
    show(render(), true);
    $('runOut').innerHTML = `<b>Done</b> in ${R.segments} sitting${R.segments === 1 ? '' : 's'}, ${R.seconds} s; ${R.privacy.requests} network requests while it ran. The page now shows this device's numbers.`;
    $('save').disabled = false;
  } catch (e) { $('runOut').innerHTML = `<span class="fail">It stopped:</span> ${esc(e && e.message)}. Press Run it to carry on from where it saved.`; }
  setBusy(false);
}
function save() {
  if (!S.local) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S.local)], { type: 'application/json' }));
  a.download = `the-crystal-${S.local.set}-${String(S.local.at).slice(0, 10)}.json`;
  a.click();
}
// the published crystal, grown again from its recorded replies with no model
async function rejudge() {
  const { run, what } = shown();
  if (!run) { $('rejudgeOut').innerHTML = NM; return; }
  const tasks = tasksOf(run.set), st = S.data.settings, again = await GROW.replay(tasks, recordsOf(run, 'crystal'), { maxTicks: st.maxTicks, maxTokens: st.maxTokens, mem: st.mem, seed: seedFacts() });
  const same = again.records.filter((r, i) => JSON.stringify(r) === JSON.stringify(run.crystal.records[i])).length, n = run.crystal.records.length;
  $('rejudgeOut').innerHTML = `${same} of ${n} crystals of ${esc(what)} grew again identically ${same === n ? '<span class="pass">✓</span>' : '<span class="fail">✗</span>'}. The checker, the planner, the memory and the law ran for real; only the model's replies came from the record.`;
}
// a new attack each press: the same cells, a seed taken from the clock, so it is not the attack the page was built with
function attackUI() {
  const { run, what } = shown(), cells = askedCells(recordsOf(run, 'crystal')), all = cells.length ? cells : FUZZ.EVERY, seed = Date.now() % 4294967296;
  const A = FUZZ.fuzz(all, { ...fuzzOpts(), seed }), T = FUZZ.teeth([], { ...fuzzOpts(), seed });
  $('attackOut').innerHTML = `Seed ${A.seed}, made just now: ${A.tried} replies on ${A.cells} cells${cells.length ? ` (every cell ${esc(what)} asked)` : ' (one of every operation)'}. <span class="${A.forged.bonded ? 'fail' : 'pass'}">${A.forged.bonded} of ${A.forged.tried} forged replies bonded</span>; <span class="${A.honest.refused ? 'fail' : 'pass'}">${A.honest.refused} of ${A.honest.tried} honest replies refused</span>; the two readers differed on <span class="${A.split ? 'fail' : 'pass'}">${A.split}</span>; ${A.threw} threw. The harness found ${T.caught} of ${T.planted} planted leaks.${A.found.length ? ` First disagreement: ${esc(A.found[0].cell)} ← ${esc(JSON.stringify(A.found[0].reply))}.` : ''}`;
}

// ── start ──
const ready = (async function start() {
  const [settings, published, gates, provenance] = await Promise.all(['data/settings.json', 'data/published.json', 'data/gates.json', 'vendor/climb/PROVENANCE.json'].map(getJSON));
  const P = published || {}, runs = {};
  for (const k of ['sealed', 'dev']) runs[k] = P[k] ? await getJSON(P[k]) : null;
  S.data = { settings: settings || { maxTicks: GROW.SETTINGS.maxTicks, maxTokens: GROW.SETTINGS.maxTokens, depth: 8, climbTokens: 128, mem: {}, sets: {} }, runs, gates, provenance, seed: P.seed ? await getJSON(P.seed) : null, walk: P.walk ? await getJSON(P.walk) : null, seal: await sealHash() };
  const saved = store.get(runKey('sealed')) || store.get(runKey('dev')) || store.get(runKey('sample'));
  S.local = saved && saved.crystal ? saved : null;
  const canvas = $('gem');
  try { S.gem = typeof canvas.getContext === 'function' ? GEM.createGem(canvas) : null; } catch (e) { S.gem = null; $('status').innerHTML = `<span class="fail">The glass could not start on this device (${esc(e && e.message)}).</span> The numbers below still read.`; }
  show(render(), false);
  play();
  $('grow').addEventListener('click', growLive);
  $('play').addEventListener('click', () => { S.live = false; show(render(), false); play(); });
  $('run').addEventListener('click', runUI);
  $('save').addEventListener('click', save);
  $('rejudge').addEventListener('click', rejudge);
  $('attack').addEventListener('click', attackUI);
  $('scrub').addEventListener('input', (e) => { S.scrubbing = true; if (S.L) { S.target = S.time = (S.L.span * Number(e.target.value)) / 1000 + (e.target.value === '1000' ? 2 : 0); if (S.gem) S.gem.setTime(S.time); } });
  $('scrub').addEventListener('change', () => { S.scrubbing = false; });
  canvas.addEventListener('pointermove', tip);
  canvas.addEventListener('pointerleave', () => { $('tip').style.transform = 'translate(-999px,-999px)'; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !S.busy && !(e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(e.target.tagName))) growLive(); });
  tick();
  device();
  if (typeof navigator !== 'undefined' && navigator.serviceWorker && typeof location !== 'undefined' && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
window.__crystal = { ready, S, runSet, load, render, show, play, rejudge, attackUI, tasksOf };
