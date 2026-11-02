// Portal home: the 2026 Series story banner (top of Home, dismissible, switchable off), plus the Results link and the landing-page card.
import fs from 'fs'; import vm from 'vm';
import { JSDOM } from 'jsdom';
import { extractFn } from './extract.mjs';
const R = new URL('../../', import.meta.url);
const src = fs.readFileSync(new URL('source/portal.html', R), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const dom = new JSDOM('<div id="home-series-wrap"></div>', { url: 'https://birdiefriends.com/portal.html' });
const w = dom.window; const opened = []; w.open = u => opened.push(u);
const ctx = vm.createContext({ document: w.document, localStorage: w.localStorage, window: w, console });
vm.runInContext(src.match(/const SERIES_WRAP = .*;/)[0] + '\n' + ['renderSeriesWrapBanner', 'openSeriesWrap', 'hideSeriesWrap'].map(n => extractFn(src, n)).join('\n') + '; this.SW = SERIES_WRAP;', ctx);
const el = () => w.document.getElementById('home-series-wrap');
ctx.renderSeriesWrapBanner();
ok(/The 2026 Series is a wrap/.test(el().textContent), 'banner shows');
ctx.openSeriesWrap(); ok(opened[0] === '/series-2026-wrap.html', 'opens the story');
ctx.hideSeriesWrap(); ok(el().innerHTML === '', 'dismiss hides it');
ctx.renderSeriesWrapBanner(); ok(el().innerHTML === '', 'stays hidden after re-render');
w.localStorage.clear(); ctx.SW.on = false; ctx.renderSeriesWrapBanner(); ok(el().innerHTML === '', 'off switch hides it');
ok(src.indexOf('id="home-series-wrap"') > src.indexOf('id="home-live-banner"') && src.indexOf('id="home-series-wrap"') < src.indexOf('id="home-cup-banner"'), 'slot sits under the live banner, above the Cup/Trip banners');
ok(/renderHome\(\);\s*renderSeriesWrapBanner\(\);/.test(src), 'rendered with the home screen');
const rs = src.slice(src.indexOf('id="screen-results"')); ok(rs.indexOf('/series-2026-wrap.html') > 0 && rs.indexOf('/series-2026-wrap.html') < rs.indexOf('/wally-cup-results.html'), 'Results screen lists the story first');
for (const f of ['docs/index.html', 'docs/series.html']) { const t = fs.readFileSync(new URL(f, R), 'utf8'); ok(/Read the Season Story/.test(t) && !/Live Series Standings/.test(t), f + ' landing card updated'); }
ok(fs.readFileSync(new URL('docs/portal.html', R), 'utf8') === src, 'docs/portal.html matches source');
console.log('portal_series_wrap: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
