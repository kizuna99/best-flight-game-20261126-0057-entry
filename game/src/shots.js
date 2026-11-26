// SPDX-License-Identifier: MIT
// Copyright (c) 2026 kizuna99
//
// The screenshot scenes behind ?shot=start|play|end, and the demo pilot
// the title screen uses when nobody touches the controls. One simple
// autopilot flies all of them: aim at the current objective, keep a
// cruise speed on the way down the valley, and fly a gentle glide
// slope to the runway at the end. Because the world is seeded, the
// same seed always stages the same frame.

import { STEP } from './config.js';
import { PHASE_FLYING } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/** One autopilot decision for the world's current state. */
export function autopilotControls(world) {
  const { state } = world;
  const plane = state.plane;
  const objective = world.currentObjective();

  let targetAltitude = objective.altitude;
  let targetSpeed = 46;
  if (objective.kind === 'runway') {
    const toRunway = Math.max(0, objective.at - plane.distance);
    targetAltitude = clamp(toRunway * 0.095, 0, 110);
    targetSpeed = toRunway < 1100 ? 25 : 38;
  }
  if (objective.kind === 'farm') targetAltitude = 44;

  const controls = {
    bank: clamp((objective.x - plane.x) / 46, -0.85, 0.85),
    pitch: clamp((targetAltitude - plane.altitude) / 30, -0.7, 0.62),
    power: clamp((targetSpeed - plane.speed) / 18, -1, 1),
    drop: false,
  };

  // Release a bag as the farm passes under the nose.
  if (objective.kind === 'farm') {
    const lead = plane.speed * (plane.altitude / 26) * 0.92;
    if (objective.at - plane.distance <= lead + 4 && objective.at - plane.distance > 0) controls.drop = true;
  }
  return controls;
}

/** Fly the autopilot for up to `seconds` of game time. */
function flyFor(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.state.phase !== PHASE_FLYING) break;
    world.step(STEP, autopilotControls(world));
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: a few seconds in, still on the title. play: mid-sortie, rings
 * behind and a farm ahead. end: the whole sortie flown to its outcome.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    flyFor(world, 46);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    flyFor(world, 420);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  flyFor(world, 5);
  return { screen: SCREEN_TITLE, best: 0 };
}
