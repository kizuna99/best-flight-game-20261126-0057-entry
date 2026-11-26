# Skyline Courier — a flight game for make.fun

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/kizuna99/best-flight-game-20261126-0057-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/kizuna99/best-flight-game-20261126-0057-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Skyline Courier** is an original chase-view flight game. You fly a small
prop plane, the *Kestrel K-2*, over patchwork fields, a river and low hills,
delivering mail around the valley of Teluk Angin.

## Play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and visit
the local address it prints). No network, no build step.

- **Steer:** Arrow keys or A / D to bank, W / S or Up / Down for pitch
- **Throttle:** Shift to climb power, Ctrl or C to cut power — or hold Up/Down
- **Drop mail:** Space over a target farm
- **Pause:** P or Esc · **Start / restart:** Space, Enter or click

## The sortie

1. **Ring Run** — thread the golden rings over the river.
2. **Mail Drop** — drop three mail bags onto the marked farms.
3. **Final Approach** — slow down, line up on the runway and land gently.

Fuel burns faster at full throttle, birds and radio towers hurt, and a hard
or fast touchdown damages the plane. Score rewards centred rings, accurate
drops and a soft landing.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`.
- `game/src/world.js` — flight model, missions, fuel, damage and scoring.
- `game/src/render.js` — chase camera, terrain, aircraft, cockpit instruments
  and HUD.
- `game/src/input.js`, `game/src/config.js`, `game/src/random.js`,
  `game/src/audio.js`, `game/src/shots.js` — one job each.
- `vendor/makefun-game.ts` — the kit library, unchanged.

MIT licensed. Copyright (c) 2026 kizuna99.
