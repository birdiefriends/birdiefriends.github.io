import * as acorn from 'acorn';
const cache = new Map();
function index(src) {
  if (cache.has(src)) return cache.get(src);
  const map = new Map();
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m;
  const blocks = [];
  while ((m = re.exec(src))) blocks.push(m[1]);
  const code = blocks.length ? blocks.join('\n;\n') : src;
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowHashBang: true });
  for (const n of ast.body) if (n.type === 'FunctionDeclaration' && n.id) map.set(n.id.name, code.slice(n.start, n.end));
  cache.set(src, map); return map;
}
export function extractFn(src, name) {
  let map;
  try { map = index(src); } catch (e) { map = index(src.replace(/^(?!)/, '')); }
  const f = map.get(name); if (!f) throw new Error('not found ' + name); return f;
}

// Dev-88: the shared engine module (source/bf_engine.js), for sandboxes
// that run portal functions which now delegate to BFEngine.
import { createRequire } from 'module';
import { fileURLToPath as _f2p } from 'url';
export function loadEngine() {
  const req = createRequire(import.meta.url);
  return req(_f2p(new URL('../bf_engine.js', import.meta.url)));
}
