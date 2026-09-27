import fs from 'fs'; import vm from 'vm';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(process.argv[2] || HERE('../portal.html'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, i = 0, bad = 0;
while ((m = re.exec(src))) { i++; try { new vm.Script(m[1]); } catch (e) { bad++; console.log('block', i, e.message); } }
console.log(`${i} inline script blocks, ${bad} with syntax errors`);
