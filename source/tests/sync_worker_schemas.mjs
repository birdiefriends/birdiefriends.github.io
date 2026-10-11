// Dev-93 (spec §13) — the BFE Worker is a single paste-deploy file and cannot import bf_engine.js, so
// the game schemas and the shared validator are GENERATED into a marked block in
// bf_experiences_worker.js from the engine. Run `node sync_worker_schemas.mjs` after changing any
// game's config schema; `--check` (used by test_worker_game_configs.mjs) fails if the block is stale.
import fs from 'fs'; import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const E = require(fileURLToPath(new URL('../bf_engine.js', import.meta.url)));
const WORKER = fileURLToPath(new URL('../bf_experiences_worker.js', import.meta.url));
const BEGIN = '// <GAME_SCHEMAS:begin>', END = '// <GAME_SCHEMAS:end>';
export function buildBlock() {
  return [
    BEGIN + ' GENERATED from bf_engine.js ' + E.ENGINE_VERSION + ' by source/tests/sync_worker_schemas.mjs — do not edit by hand',
    'const GAME_SCHEMAS = ' + JSON.stringify(E.gameSchemas(), null, 2) + ';',
    E.validateFields.toString(),
    E.cleanFields.toString(),
    END
  ].join('\n');
}
export function apply(src) {
  const block = buildBlock();
  const i = src.indexOf(BEGIN), j = src.indexOf(END);
  if (i >= 0 && j > i) return src.slice(0, i) + block + src.slice(j + END.length);
  return src.replace(/^export default \{/m, block + '\n\nexport default {');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const src = fs.readFileSync(WORKER, 'utf8');
  const next = apply(src);
  if (process.argv.includes('--check')) { console.log(next === src ? 'worker schemas up to date' : 'worker schemas STALE'); process.exit(next === src ? 0 : 1); }
  fs.writeFileSync(WORKER, next); console.log(next === src ? 'no change' : 'worker schemas written');
}
