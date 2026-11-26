// SPDX-License-Identifier: MIT
// Copyright (c) 2026 kizuna99
//
// A tiny seeded random source (splitmix style). One seed always builds
// the same valley, the same rings and the same birds, which is what
// makes the screenshot scenes and a fair replay possible.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function nextRandom() {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z = (z ^ (z >>> 15)) >>> 0;
    return z / 4294967296;
  };
}

/** A random float between low and high, drawn from the seeded source. */
export function range(random, low, high) {
  return low + random() * (high - low);
}

/** A random whole number between low and high, both included. */
export function rangeInt(random, low, high) {
  return low + Math.floor(random() * (high - low + 1));
}
