// SPDX-License-Identifier: MIT
// Copyright (c) 2026 kizuna99
//
// Keyboard and mouse input for the Kestrel. Held keys become a smooth
// control object (bank, pitch, throttle direction); one-shot presses
// (drop a bag, pause, confirm) are queued as flags and consumed once,
// so a tap between two frames is never lost or counted twice.

export const ACTION_DROP = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;

const BANK_LEFT = new Set(['ArrowLeft', 'KeyA']);
const BANK_RIGHT = new Set(['ArrowRight', 'KeyD']);
const PITCH_UP = new Set(['ArrowDown', 'KeyS']);
const PITCH_DOWN = new Set(['ArrowUp', 'KeyW']);
const POWER_UP = new Set(['ShiftLeft', 'ShiftRight', 'KeyE']);
const POWER_DOWN = new Set(['ControlLeft', 'KeyC', 'KeyQ']);
const DROP_KEYS = new Set(['Space']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const CONFIRM_KEYS = new Set(['Enter']);

export function createInput(target) {
  const held = new Set();
  let queued = 0;
  let mouseBank = 0;
  let mousePitch = 0;
  let lastActivityAt = performance.now();

  function noteActivity() {
    lastActivityAt = performance.now();
  }

  window.addEventListener('keydown', (event) => {
    noteActivity();
    if (DROP_KEYS.has(event.code)) {
      if (!event.repeat) queued |= ACTION_DROP | ACTION_CONFIRM;
    } else if (PAUSE_KEYS.has(event.code)) {
      if (!event.repeat) queued |= ACTION_PAUSE;
    } else if (CONFIRM_KEYS.has(event.code)) {
      if (!event.repeat) queued |= ACTION_CONFIRM;
    } else if (
      BANK_LEFT.has(event.code) || BANK_RIGHT.has(event.code)
      || PITCH_UP.has(event.code) || PITCH_DOWN.has(event.code)
      || POWER_UP.has(event.code) || POWER_DOWN.has(event.code)
    ) {
      held.add(event.code);
    } else {
      return;
    }
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });

  window.addEventListener('blur', () => {
    held.clear();
    mouseBank = 0;
    mousePitch = 0;
  });

  target.addEventListener('pointerdown', (event) => {
    noteActivity();
    queued |= ACTION_CONFIRM;
    const rect = target.getBoundingClientRect();
    mouseBank = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  });

  target.addEventListener('pointermove', (event) => {
    if (event.buttons === 0) return;
    noteActivity();
    const rect = target.getBoundingClientRect();
    mouseBank = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    mousePitch = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  target.addEventListener('pointerup', () => {
    mouseBank = 0;
    mousePitch = 0;
  });

  function axis(negative, positive) {
    let value = 0;
    for (const code of held) {
      if (negative.has(code)) value -= 1;
      if (positive.has(code)) value += 1;
    }
    return Math.max(-1, Math.min(1, value));
  }

  return {
    /** Smooth controls in -1..1: bank, pitch and throttle direction. */
    controls() {
      return {
        bank: Math.max(-1, Math.min(1, axis(BANK_LEFT, BANK_RIGHT) + mouseBank)),
        pitch: Math.max(-1, Math.min(1, axis(PITCH_DOWN, PITCH_UP) + mousePitch)),
        power: axis(POWER_DOWN, POWER_UP),
      };
    },
    /** One-shot ACTION_* flags gathered since the previous call. */
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
    /** Milliseconds since the player last touched a control. */
    idleMs() {
      return performance.now() - lastActivityAt;
    },
  };
}
