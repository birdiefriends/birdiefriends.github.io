// BF Cup — BFE-Admin 4b: tee by handicap (tier rows copied from the Venue Manager into the Cup) and the host code field (real page in jsdom, fake Worker).
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
let html = fs.readFileSync(HERE('../../docs/BFE-Admin.html'), 'utf8');
html = html.replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine.replace(/<\/script>/g, '<\\/script>') + '</script>');

const PARS = [4, 4, 3, 4, 5, 4, 5, 3, 4, 3, 5, 4, 4, 4, 3, 4, 5, 3];
const SI = {
  Green: [11, 1, 13, 5, 9, 3, 7, 17, 15, 12, 10, 2, 4, 6, 16, 14, 8, 18],
  'Green/Gold': [13, 3, 11, 7, 1, 9, 17, 5, 15, 10, 18, 4, 2, 8, 14, 12, 6, 16],
  Gold: [9, 1, 13, 3, 7, 5, 11, 15, 17, 8, 16, 2, 6, 4, 14, 12, 10, 18],
};
const mkTee = (name, rating, slope) => ({ tee_name: name, gender: 'male', course_rating: rating, slope_rating: slope, par_total: 71, holes: SI[name].map((h, i) => ({ par: PARS[i], yardage: 300, handicap: h })) });
const TEES = [mkTee('Gold', 66.8, 115), mkTee('Green', 71.2, 132), mkTee('Green/Gold', 69, 128)];   // the Venue Manager's order is not the tier order
const posts = []; let stored = null;
const json = (o, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => o });
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/BFE-Admin.html',
  beforeParse(w) {
    w.fetch = async (u, o) => {
      if (o && o.method === 'POST') { posts.push({ u, body: JSON.parse(o.body) }); stored = JSON.parse(o.body).config; return json({ ok: true }); }
      if (/\/bfe\/venue-tees/.test(u)) return json({ ok: true, tees: TEES });
      if (/\/bfe\/players/.test(u)) return json({ ok: true, players: [] });
      if (/\/bfe\/events\?event=/.test(u)) return json({ config: null });
      if (/\/bfe\/cup\?/.test(u)) return stored ? json({ config: JSON.parse(JSON.stringify(stored)) }) : json({}, 404);
      return json({ ok: true });
    };
    w.alert = () => {}; w.confirm = () => true;
  } });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(200);
const en = d.getElementById('cupEnabled'); en.checked = true; en.dispatchEvent(new w.Event('change'));
const setEngine = (tr, v) => { tr.querySelector('.r-engine').value = v; tr.querySelector('.r-engine').dispatchEvent(new w.Event('change', { bubbles: true })); };
const layout = (tr, v) => { tr._detail.querySelector('.r-layout').value = v; tr._detail.querySelector('.r-layout').dispatchEvent(new w.Event('change', { bubbles: true })); };
w.addRoundRow('Cup Sat'); w.addRoundRow('Cup Sun');
const all = [...d.querySelectorAll('#roundsBody tr.roundRow')], sat = all[all.length - 2], sun = all[all.length - 1];
setEngine(sat, 'cup_match'); setEngine(sun, 'cup_match'); layout(sat, 'fb_fs'); layout(sun, 'si18'); await wait(30);
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));

// ---- the tier UI is off until chosen; one tee is the default ----
ok(d.getElementById('cupTeeMode').value === 'one' && d.getElementById('cupTierBox').style.display === 'none' && d.getElementById('cupTeeOne').style.display !== 'none', 'one tee for everyone is the default');
w.eval("venueList = [{ id: 7, name: 'Blue Shamrock' }]"); w.cupVenueRender();
d.getElementById('cupVenue').value = '7'; fire(d.getElementById('cupVenue'), 'change'); await wait(60);

// ---- switch to tees by handicap: the BFSeries preset picks Green / Green-Gold / Gold by name, in tier order ----
d.getElementById('cupTeeMode').value = 'tiers'; fire(d.getElementById('cupTeeMode'), 'change'); await wait(30);
ok(d.getElementById('cupTierBox').style.display !== 'none' && d.getElementById('cupTeeOne').style.display === 'none', 'tier rows show, the single tee picker hides');
ok(d.querySelectorAll('#cupTierRows [data-f="label"]').length === 3, 'three tier rows');
let t = JSON.parse(JSON.stringify(w.eval('cupState.handicap.tiers')));
ok(Array.isArray(t) && t.length === 3, 'the tiers are copied into the Cup record');
ok(t.map(x => x.label).join() === 'Green,Combo,Gold' && t.map(x => x.tee).join() === 'Green,Green/Gold,Gold', 'labels and venue tees: Green, Combo = the venue\'s Green/Gold, Gold');
ok(t.map(x => x.maxHcp).join() === '10,18,' && t[2].maxHcp === null, 'limits: under 10, under 18, no limit');
ok(t.map(x => x.slope + '/' + x.rating + '/' + x.par).join() === '132/71.2/71,128/69/71,115/66.8/71', 'each tier carries its own slope, rating and par');
ok(JSON.stringify(t[0].strokeIndex) === JSON.stringify(SI.Green) && JSON.stringify(t[1].strokeIndex) === JSON.stringify(SI['Green/Gold']) && JSON.stringify(t[2].strokeIndex) === JSON.stringify(SI.Gold), 'each tier carries ITS tee\'s hole handicaps');
ok(JSON.stringify(t[0].pars) === JSON.stringify(PARS), 'pars come along');
ok(JSON.stringify(w.eval('cupState.handicap.strokeIndex')) === JSON.stringify(SI.Green) && w.eval('cupState.handicap.slope') === 132, 'the first tier also stands in as the Cup\'s single tee (pars, a player with no Index)');
ok(/Tees saved into the Cup/.test(d.getElementById('cupTierHint').textContent), 'the screen says the tees are saved in');
// the engine reads them
const rule = w.BFEngine.cupHandicapRule({ handicap: w.eval('cupState.handicap') });
ok(rule.tiers && rule.tiers.length === 3 && w.BFEngine.cupCourseHcp(12.7, rule) === 12, 'the engine reads the saved tiers (12.7 Index plays Combo: 12)');

// ---- editing a row: the limit and the tee follow ----
const lim = d.querySelectorAll('#cupTierRows [data-f="maxHcp"]')[0]; lim.value = '9.5'; fire(lim, 'input');
ok(w.eval('cupState.handicap.tiers[0].maxHcp') === 9.5, 'changing a limit updates the Cup');
lim.value = '10'; fire(lim, 'input');
const lab = d.querySelectorAll('#cupTierRows [data-f="label"]')[1]; lab.value = 'Middle'; fire(lab, 'input');
ok(w.eval('cupState.handicap.tiers[1].label') === 'Middle' && w.eval('cupState.handicap.tiers[1].slope') === 128, 'renaming a tier keeps its tee numbers');
lab.value = 'Combo'; fire(lab, 'input');
// a missing limit in a middle tier is a problem the screen names, and save is refused
const lim2 = d.querySelectorAll('#cupTierRows [data-f="maxHcp"]')[1]; lim2.value = ''; fire(lim2, 'input');
ok(/needs an Index limit/.test(d.getElementById('cupTierHint').textContent), 'a middle tier with no limit is flagged');
lim2.value = '18'; fire(lim2, 'input');
// limits must rise
lim2.value = '8'; fire(lim2, 'input');
ok(/must go up/.test(d.getElementById('cupTierHint').textContent), 'limits that do not rise are flagged');
lim2.value = '18'; fire(lim2, 'input');
ok(!/needs an Index limit|must go up|Pick a tee/.test(d.getElementById('cupTierHint').textContent), 'a clean setup shows no problem');

// ---- host code ----
d.getElementById('cupHostCodeGen').click();
const code = d.getElementById('cupHostCode').value;
ok(/^[A-HJ-NP-Z2-9]{6}$/.test(code), 'Generate makes a 6 character code with no look-alike characters (' + code + ')');
w.cupSyncFromInputs();
ok(w.eval('cupState.host_code') === code, 'the code is held in the Cup state');

// ---- save: tiers and the code go to the Worker; a bad code is refused first ----
d.getElementById('eventName').value = '2026 BF Cup'; d.getElementById('cupNameA').value = 'Team Jake'; d.getElementById('cupNameB').value = 'Team Nate';
d.getElementById('cupHostCode').value = 'a!'; d.getElementById('cupSaveBtn').click(); await wait(50);
ok(posts.length === 0 && /host code needs 4 to 24/.test(d.getElementById('cupStatus').textContent), 'a bad host code blocks the save');
d.getElementById('cupHostCode').value = code; d.getElementById('cupSaveBtn').click(); await wait(80);
ok(posts.length === 1, 'saved');
const cfg = posts[0] && posts[0].body.config;
ok(cfg && cfg.host_code === code && cfg.handicap.tiers.length === 3 && cfg.handicap.tiers[1].slope === 128, 'the saved document carries the host code and the three tiers');
ok(cfg && cfg.handicap.tiers.every(x => Array.isArray(x.strokeIndex) && x.strokeIndex.length === 18), 'every tier carries its hole handicaps');

// ---- a venue change throws away tiers from the old course; a reload brings a saved Cup back as tiers ----
d.getElementById('cupTeeMode').value = 'one'; fire(d.getElementById('cupTeeMode'), 'change');
ok(w.eval('cupState.handicap.tiers') === null && d.getElementById('cupTierBox').style.display === 'none', 'back to one tee clears the tiers');
stored.host_code = 'KEEP123';
d.getElementById('cupLoadBtn').click(); await wait(80);
ok(d.getElementById('cupTeeMode').value === 'tiers' && d.querySelectorAll('#cupTierRows [data-f="label"]').length === 3, 'loading a saved Cup with tiers shows tees by handicap with its rows');
ok(d.getElementById('cupHostCode').value === 'KEEP123', 'loading brings back the Cup\'s host code');
ok(w.eval('cupState.handicap.tiers.length') === 3, 'the loaded tiers are kept as saved, not rebuilt from the Venue Manager');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
