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

// Dev-94: portal constants/helpers that many extracted functions now lean on (side-game ids, live side-game picker).
// Every sandbox gets them as globals so a test only lists the functions it actually exercises.
import vm from 'vm';
import fs from 'fs';
if (!vm.__bfPatched) {
  vm.__bfPatched = true;
  const orig = vm.createContext;
  const portal = fs.readFileSync(_f2p(new URL('../portal.html', import.meta.url)), 'utf8');
  vm.createContext = function (o, ...rest) {
    const ctx = orig.call(vm, o || {}, ...rest);
    if (!('GAMES_FORM_SIDE_IDS' in ctx)) {
      ctx.GAMES_FORM_SIDE_IDS = ['altshot', 'matchplay'];
      ctx.LIVE_SIDE_GAMES = ['fourball', 'altshot', 'matchplay'];
      ctx.GAMES_FORM_REC_ALLOWANCE = { altshot: 50, matchplay: 100 };
      if (!('_gamesFormSide' in ctx)) ctx._gamesFormSide = {
        altshot: { dollar_per_player: null, basis: 'gross', net_mode: 'own', allowance: 50, period: 'round', win_by: 'strokes', scope: 'field', pairs: [] },
        matchplay: { dollar_per_player: null, basis: 'gross', net_mode: 'own', allowance: 100, period: 'round', matches: [] } };
      try { vm.runInContext(['liveSideGid', 'liveSideSides', 'sideMatchView', 'sideMatchStory', 'sideGroupResults', 'sideResultHeroHtml'].map(n => extractFn(portal, n)).join('\n'), ctx); } catch (e) {}
    }
    return ctx;
  };
}
