// SPDX-License-Identifier: MIT
// Copyright (c) 2026 kizuna99
//
// Hand-in program for Skyline Courier (Node 22, standard library only).
//
// The game itself is the static site in game/ — plain files a desktop
// browser opens offline. This program is only the courier: it copies
// game/ and screenshots/ into the output directory and then asks the
// vendored make.fun library to write dossier.json, the summary the
// judges read, from exactly those copied files.
//
// Run it the way the grader does, from the repository root:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// With no MAKEFUN_OUTPUT_DIR it writes to /output, as in the grader.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps, mirrored here so a bad hand-in fails loudly at build
// time instead of quietly at grading time.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(fromName: string, toName: string): void {
  const from = join(repoRoot, fromName);
  if (!existsSync(from)) return;
  cpSync(from, join(outputDir, toName), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree('game', 'game');
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
copyTree('screenshots', 'screenshots');

const dossier = buildDossier(outputDir, DOSSIER_LIMITS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Skyline Courier handed in to ${outputDir}`);
