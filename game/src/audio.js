// SPDX-License-Identifier: MIT
// Copyright (c) 2026 kizuna99
//
// Pocket sound, made in code: a soft propeller hum whose pitch follows
// the throttle, and short chimes for rings, drops and touchdowns. No
// audio files, no network. Sound starts only after a user gesture, and
// every failure is silent — a browser that refuses audio must never
// break the flight.

export function createAudio() {
  let context = null;
  let humOscillator = null;
  let humGain = null;

  function ensureContext() {
    if (context !== null) return context;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      context = new AudioCtor();
      humOscillator = context.createOscillator();
      humGain = context.createGain();
      humOscillator.type = 'sawtooth';
      humOscillator.frequency.value = 62;
      humGain.gain.value = 0;
      humOscillator.connect(humGain).connect(context.destination);
      humOscillator.start();
    } catch {
      context = null;
    }
    return context;
  }

  function chime(frequency, seconds, volume) {
    const ctx = ensureContext();
    if (ctx === null) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + seconds);
    } catch {
      // A chime is a garnish, never a reason to crash.
    }
  }

  return {
    /** Call from a click or key press so the browser allows sound. */
    unlock() {
      const ctx = ensureContext();
      if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    /** Keep the propeller hum matched to throttle and speed. */
    setEngine(throttle, speedKnots, flying) {
      if (context === null || humOscillator === null || humGain === null) return;
      const pitch = 48 + throttle * 46 + speedKnots * 0.12;
      humOscillator.frequency.setTargetAtTime(pitch, context.currentTime, 0.08);
      humGain.gain.setTargetAtTime(flying ? 0.012 + throttle * 0.02 : 0, context.currentTime, 0.12);
    },
    ring() { chime(880, 0.22, 0.05); setTimeout(() => chime(1318, 0.3, 0.05), 70); },
    drop() { chime(520, 0.18, 0.045); },
    hit() { chime(140, 0.3, 0.07); },
    landed() { chime(659, 0.25, 0.05); setTimeout(() => chime(988, 0.4, 0.05), 110); },
    failed() { chime(220, 0.5, 0.06); },
  };
}
