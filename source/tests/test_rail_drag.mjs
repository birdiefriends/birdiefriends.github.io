import fs from 'fs'; import { extractFn } from './extract.mjs'; import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
const css = src.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
const fns = ['escapeHtml','atCourseLoadPos','atCourseSavePos','atCourseApplyPos','atCourseDragStart','toggleAtCourseRail','renderAtCourseRail'].map(n => extractFn(src, n)).join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=390"><style>${css}</style></head><body style="margin:0;background:#f3f1ea;height:2000px">
<script>var _atCourse = { evt: { id: 'g1', name: 'Jefferson' }, venue: {}, distM: 420, forced: false }, _atCourseTucked = false, _livePanelOpen = false, _atCoursePanelPeek = false, _atCourseJustDragged = false;
function isBFEBackedCard(){return false} function getLiveEvent(){return null}
${fns.replace(/<\/script>/g, '<\\/script>')}
renderAtCourseRail();</script></body></html>`;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const b = await chromium.launch({ executablePath: process.env.BF_CHROMIUM || '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 780 } });
await pg.route('https://bf.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
await pg.goto('https://bf.test/portal.html');
const rail = () => pg.evaluate(() => { const el = document.getElementById('at-course-rail'); const r = el.getBoundingClientRect(); return { cls: el.className, left: r.left, right: r.right, top: r.top, w: r.width, vw: innerWidth, pos: localStorage.getItem('bf_atcourse_pos') }; });
let r = await rail();
ok(Math.abs(r.right - r.vw) < 2 && !r.cls.includes('left'), 'starts on the right edge');
// tap the grip → tucks (not a drag)
let g = await pg.locator('.acr-grip').boundingBox();
await pg.mouse.click(g.x + g.width / 2, g.y + g.height / 2);
await pg.waitForTimeout(350); r = await rail();
ok(r.cls.includes('tucked') && !r.pos, 'tap tucks; no position saved');
g = await pg.locator('.acr-grip').boundingBox();
await pg.mouse.click(g.x + g.width / 2, g.y + g.height / 2); await pg.waitForTimeout(350);
ok(!(await rail()).cls.includes('tucked'), 'tap again untucks');
// drag the grip to the left side, upper area
g = await pg.locator('.acr-grip').boundingBox();
await pg.mouse.move(g.x + g.width / 2, g.y + 20); await pg.mouse.down();
for (let i = 1; i <= 10; i++) await pg.mouse.move(g.x - i * 30, g.y + 20 - i * 15);
await pg.mouse.up(); await pg.waitForTimeout(400); r = await rail();
ok(r.cls.includes('left') && r.cls.includes('placed') && r.left < 2, 'dropped on left half → snaps to left edge: ' + JSON.stringify(r));
ok(!r.cls.includes('tucked'), 'click after drag did not toggle tuck');
ok(JSON.parse(r.pos).side === 'left' && r.top < g.y, 'position saved + moved up: ' + r.pos);
// survives re-render (e.g. renderAll)
await pg.evaluate(() => renderAtCourseRail()); const r2 = await rail();
ok(r2.cls.includes('left') && Math.abs(r2.top - r.top) < 2, 'position survives re-render');
// tucked on the left slides off to the left
g = await pg.locator('.acr-grip').boundingBox();
await pg.mouse.click(g.x + g.width / 2, g.y + g.height / 2); await pg.waitForTimeout(350); r = await rail();
ok(r.cls.includes('tucked') && r.left < 0 && r.right <= 20, 'left + tucked → only the tab shows: ' + JSON.stringify(r));
g = await pg.locator('.acr-grip').boundingBox();
await pg.mouse.click(g.x + g.width / 2, g.y + g.height / 2); await pg.waitForTimeout(350);
ok(!(await rail()).cls.includes('tucked'), 'left: tap untucks');
// drag via the ⛳ chip back to the right, near the bottom → clamped above the nav
const st = await pg.locator('.acr-status').boundingBox();
await pg.mouse.move(st.x + 10, st.y + 5); await pg.mouse.down();
for (let i = 1; i <= 12; i++) await pg.mouse.move(st.x + 10 + i * 28, st.y + 5 + i * 60);
await pg.mouse.up(); await pg.waitForTimeout(400); r = await rail();
ok(!r.cls.includes('left') && Math.abs(r.right - r.vw) < 2, 'chip drag to right half → right edge');
const h = await pg.evaluate(() => document.getElementById('at-course-rail').offsetHeight);
ok(r.top + h <= 780 - 69, 'clamped above the bottom nav: top ' + r.top + ' h ' + h);

await b.close();
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
