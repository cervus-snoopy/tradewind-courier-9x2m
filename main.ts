// Tradewind Courier — hand-in program (Node 22+, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules, three.js vendored as a
// *.min.js under game/vendor/, no network request). The program copies game/
// and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with any static server over game/, e.g.
//   python3 -m http.server --directory game 8080

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: the game is not built');
}
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => !f.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The platform collects /output as another user than the one this program runs
// as, so every file it writes must be readable by all (0644) and every folder
// traversable (0755) before the program exits.
function makeReadable(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) { chmodSync(p, 0o755); makeReadable(p); }
    else if (entry.isFile()) chmodSync(p, 0o644);
  }
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
chmodSync(join(out, 'dossier.json'), 0o644);
makeReadable(out);
