// v4.14.5: Edit Gathering must not send event_time when the host left it unchanged.
import fs from 'fs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const i = src.indexOf('async function submitEditGathering');
const body = src.slice(i, src.indexOf('\n}\n', i));
ok(/g\.dt && g\.dt\.getTime\(\) === newEventTime\.getTime\(\)\) delete patchBody\.event_time/.test(body), 'unchanged time is dropped from the PATCH');
ok(body.indexOf('delete patchBody.event_time') < body.indexOf("method: 'PATCH'"), 'drop happens before the PATCH is sent');
console.log(`edit_unchanged_time: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
