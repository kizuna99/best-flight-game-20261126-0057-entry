// SPDX-License-Identifier: MIT
// Copyright (c) 2026 kizuna99
//
// Boot and the one loop for Skyline Courier. Input is read every frame,
// the world advances in fixed 1/60 s steps, and the renderer paints
// what is there. The game moves between title, play, paused and over.
//
// If nobody touches the controls on the title screen for a few
// seconds, a demo pilot takes the Kestrel down the valley on its own,
// so the game plays itself in a window nobody is watching; any key or
// click hands it back. ?seed=N fixes the valley, and ?shot=start|play|
// end stages a screenshot scene and sets window.__shotReady.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_CRASHED, EVENT_HIT, EVENT_LANDED, EVENT_RING,
  PHASE_FLYING,
} from './world.js';
import { ACTION_CONFIRM, ACTION_DROP, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { autopilotControls, stageShot } from './shots.js';
import { createAudio } from './audio.js';

const MAX_FRAME = 0.25;
const DEMO_AFTER_MS = 6000;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private windows may refuse storage; the best score then lasts a visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let demo = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    demo = false;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Take off! Ring Run: thread the golden rings.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(world.state.phase === 'landed'
      ? `Delivery complete. Score ${world.state.score}.`
      : `Sortie over. ${world.state.message} Score ${world.state.score}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_LANDED) audio.landed();
    if (events & EVENT_CRASHED) audio.failed();
    if (world.state.phase !== PHASE_FLYING && screen === SCREEN_PLAY) endGame();
  }

  // One-shot presses are drained exactly once per frame into this
  // variable: the screen logic reads it first, then stepOnce reads the
  // drop flag from the same copy, so no press is lost between them.
  let frameActions = 0;

  function stepOnce() {
    if (screen === SCREEN_TITLE) {
      // The title backdrop is a live valley: the demo pilot flies it.
      if (input.idleMs() > DEMO_AFTER_MS) demo = true;
      if (demo) {
        const events = world.step(STEP, autopilotControls(world));
        if (world.state.phase !== PHASE_FLYING) world.reset();
        return events;
      }
      return 0;
    }
    const controls = input.controls();
    controls.drop = (frameActions & ACTION_DROP) !== 0;
    frameActions &= ~ACTION_DROP;
    return world.step(STEP, controls);
  }

  function handleActions() {
    if (frameActions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      frameActions = 0;
      startGame();
      return true;
    }
    if (frameActions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      frameActions = 0;
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return true;
    }
    if (frameActions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      frameActions = 0;
      screen = SCREEN_PLAY;
      announce('Flying again.');
      return true;
    }
    return false;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    frameActions |= input.takeActions();
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        handleEvents(stepOnce());
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.setEngine(world.state.plane.throttle, world.state.plane.speed * 1.94, screen === SCREEN_PLAY);
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Skyline Courier. Press Space or click to take off.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
