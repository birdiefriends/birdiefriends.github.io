// Runs every test_*.mjs in this folder plus the portal.html syntax check.
// Usage (from source/tests):  npm install  &&  node run_all.mjs
// test_rail_drag.mjs needs a Chromium; set BF_CHROMIUM to its path if it
// isn't at /opt/pw-browsers/chromium, or it is reported as SKIPPED.
import { spawnSync } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
const dir = fileURLToPath(new URL('.', import.meta.url));
const files = ['syntax_check.mjs', ...fs.readdirSync(dir).filter(f => /^test_.*\.mjs$/.test(f)).sort()];
const chromium = process.env.BF_CHROMIUM || '/opt/pw-browsers/chromium';
let failed = 0;
for (const f of files) {
  if (f === 'test_rail_drag.mjs' && !fs.existsSync(chromium)) { console.log(`SKIPPED  ${f} (no Chromium at ${chromium})`); continue; }
  const r = spawnSync(process.execPath, [f], { cwd: dir, encoding: 'utf8' });
  const lines = (r.stdout + r.stderr).trim().split('\n').filter(l => !/agent-proxy|google\.com|For details/.test(l));
  const summary = lines.filter(l => /passed|syntax errors|FAIL/.test(l)).join(' | ') || lines.slice(-1)[0];
  const ok = r.status === 0 && !/[1-9]\d* with syntax errors/.test(summary);
  if (!ok) failed++;
  console.log(`${ok ? 'OK      ' : 'FAILED  '} ${f}  —  ${summary}`);
}
console.log(failed ? `\n${failed} file(s) failed` : '\nAll test files passed');
process.exit(failed ? 1 : 0);
