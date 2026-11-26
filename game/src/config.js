// SPDX-License-Identifier: MIT
// Copyright (c) 2026 kizuna99
//
// Every tuning number for Skyline Courier in one place. The view is a
// fixed 1280x720 logical canvas; the renderer scales it to the window,
// so none of the flight rules below depend on the real screen size.

export const VIEW = { width: 1280, height: 720, horizonY: 252 };

/** The simulation advances in fixed steps of this many seconds. */
export const STEP = 1 / 60;

/** The valley the Kestrel flies: lateral and vertical room, in metres. */
export const VALLEY = {
  halfWidth: 130,
  ceiling: 230,
  ground: 0,
  length: 9200,
};

export const PLANE = {
  startSpeed: 38,
  minSpeed: 16,
  maxSpeed: 78,
  stallSpeed: 21,
  throttleRate: 0.55,
  accel: 15,
  drag: 0.055,
  bankRate: 1.65,
  turnRate: 0.62,
  pitchRate: 1.25,
  climbFactor: 15.5,
  sinkAtStall: 9,
  startAltitude: 96,
  startFuel: 100,
  startHull: 100,
};

export const FUEL = {
  idleBurn: 0.16,
  cruiseBurn: 0.34,
  fullBurn: 0.72,
  lowWarning: 22,
};

export const SCORING = {
  ringCentred: 140,
  ringEdge: 60,
  dropPerfect: 160,
  dropNear: 70,
  softLanding: 220,
  firmLanding: 90,
  secondBonus: 2,
};

export const MISSIONS = [
  { id: 'rings', name: 'Ring Run', brief: 'Thread 8 golden rings over the river' },
  { id: 'drops', name: 'Mail Drop', brief: 'Drop 3 mail bags on the marked farms' },
  { id: 'landing', name: 'Final Approach', brief: 'Slow down, line up and land on the runway' },
];

export const PALETTE = {
  skyTop: '#2e6db4',
  skyMid: '#7db6e6',
  skyLow: '#cfe8f7',
  sun: '#fff3b0',
  hillFar: '#5d8f6a',
  hillNear: '#3f734d',
  fieldA: '#79a84b',
  fieldB: '#a9bf57',
  fieldC: '#d9c26a',
  fieldD: '#8fae5f',
  river: '#4f9ec4',
  road: '#c9bfa5',
  runway: '#4a4d52',
  runwayLine: '#f5f2e6',
  ring: '#f6b73c',
  ringGlow: '#ffe9a8',
  target: '#e5534b',
  planeBody: '#e8e4da',
  planeTrim: '#c8402e',
  planeDark: '#2c313a',
  glass: '#9fd4e8',
  panel: '#20242c',
  panelEdge: '#3c434e',
  dialFace: '#f2ecd9',
  needle: '#c8402e',
  hud: '#eaf6ff',
  hudDim: '#9fc3d9',
  warn: '#ffb03a',
  bad: '#ff5a4e',
  good: '#7ee787',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'skyline-courier.best';
