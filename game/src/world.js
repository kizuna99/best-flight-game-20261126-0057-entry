// SPDX-License-Identifier: MIT
// Copyright (c) 2026 kizuna99
//
// The flight itself, with no drawing and no browser in it: a light
// flight model (throttle, bank, pitch, stall), the valley's rings,
// mail targets, towers and birds, fuel and hull, and the three-mission
// sortie that ends with a landing on the valley runway.
//
// step() advances one fixed step under a control object and returns
// what happened as EVENT_* flags, so the caller can play sounds and
// announce results without the world knowing about either.

import { FUEL, MISSIONS, PLANE, SCORING, VALLEY } from './config.js';
import { range } from './random.js';

export const EVENT_RING = 1;
export const EVENT_DROP = 2;
export const EVENT_HIT = 4;
export const EVENT_LANDED = 8;
export const EVENT_CRASHED = 16;
export const EVENT_MISSION = 32;
export const EVENT_STALL = 64;

export const PHASE_FLYING = 'flying';
export const PHASE_LANDED = 'landed';
export const PHASE_CRASHED = 'crashed';
export const PHASE_OUT_OF_FUEL = 'out-of-fuel';

/** Build the sortie's scenery and objectives from the seeded source. */
function buildCourse(random) {
  const rings = [];
  for (let i = 0; i < 8; i += 1) {
    rings.push({
      at: 700 + i * 620 + range(random, -90, 90),
      x: range(random, -72, 72),
      altitude: range(random, 52, 168),
      radius: 21,
      passed: false,
      scored: false,
    });
  }
  const farms = [];
  for (let i = 0; i < 3; i += 1) {
    farms.push({
      at: 5900 + i * 640 + range(random, -70, 70),
      x: range(random, -84, 84),
      altitude: 0,
      dropped: false,
      hit: false,
    });
  }
  const towers = [];
  for (let i = 0; i < 7; i += 1) {
    towers.push({
      at: range(random, 900, 8400),
      x: range(random, -115, 115),
      height: range(random, 34, 88),
      struck: false,
    });
  }
  const birds = [];
  for (let i = 0; i < 6; i += 1) {
    birds.push({
      at: range(random, 1200, 8600),
      x: range(random, -95, 95),
      altitude: range(random, 60, 190),
      drift: range(random, -7, 7),
      struck: false,
    });
  }
  const hills = [];
  for (let i = 0; i < 26; i += 1) {
    hills.push({ at: i * 380 + range(random, -60, 60), side: i % 2 === 0 ? -1 : 1, height: range(random, 26, 74) });
  }
  return { rings, farms, towers, birds, hills, runwayAt: 8800 };
}

export function createWorld(random) {
  const course = buildCourse(random);
  const plane = {
    x: 0,
    altitude: PLANE.startAltitude,
    distance: 0,
    speed: PLANE.startSpeed,
    throttle: 0.55,
    bank: 0,
    pitch: 0,
    heading: 0,
    verticalSpeed: 0,
    stalled: false,
  };
  const state = {
    plane,
    course,
    phase: PHASE_FLYING,
    missionIndex: 0,
    score: 0,
    fuel: PLANE.startFuel,
    hull: PLANE.startHull,
    ringsFlown: 0,
    bagsDropped: 0,
    bagsOnTarget: 0,
    elapsed: 0,
    message: '',
    touchdown: null,
    bag: null,
  };

  function reset() {
    plane.x = 0;
    plane.altitude = PLANE.startAltitude;
    plane.distance = 0;
    plane.speed = PLANE.startSpeed;
    plane.throttle = 0.55;
    plane.bank = 0;
    plane.pitch = 0;
    plane.heading = 0;
    plane.verticalSpeed = 0;
    plane.stalled = false;
    for (const ring of course.rings) { ring.passed = false; ring.scored = false; }
    for (const farm of course.farms) { farm.dropped = false; farm.hit = false; }
    for (const tower of course.towers) tower.struck = false;
    for (const bird of course.birds) bird.struck = false;
    state.phase = PHASE_FLYING;
    state.missionIndex = 0;
    state.score = 0;
    state.fuel = PLANE.startFuel;
    state.hull = PLANE.startHull;
    state.ringsFlown = 0;
    state.bagsDropped = 0;
    state.bagsOnTarget = 0;
    state.elapsed = 0;
    state.message = MISSIONS[0].brief;
    state.touchdown = null;
    state.bag = null;
  }

  /** The objective the HUD and autopilot should aim at right now. */
  function currentObjective() {
    if (state.missionIndex === 0) {
      const ring = course.rings.find((item) => !item.passed);
      if (ring) return { kind: 'ring', at: ring.at, x: ring.x, altitude: ring.altitude, radius: ring.radius };
    }
    if (state.missionIndex === 1) {
      const farm = course.farms.find((item) => !item.dropped);
      if (farm) return { kind: 'farm', at: farm.at, x: farm.x, altitude: 42, radius: 26 };
    }
    return { kind: 'runway', at: course.runwayAt, x: 0, altitude: 0, radius: 16 };
  }

  function advanceMissionIfDone() {
    // Five centred-or-clipped rings complete the run early; if every
    // ring is behind the plane the sortie moves on regardless, so a
    // rough run can never soft-lock the mail mission.
    const everyRingPassed = course.rings.every((ring) => ring.passed);
    if (state.missionIndex === 0 && (state.ringsFlown >= 5 || everyRingPassed)) {
      state.missionIndex = 1;
      state.message = MISSIONS[1].brief;
      return true;
    }
    if (state.missionIndex === 1 && state.bagsDropped >= 3) {
      state.missionIndex = 2;
      state.message = MISSIONS[2].brief;
      return true;
    }
    return false;
  }

  function damage(amount, why) {
    state.hull = Math.max(0, state.hull - amount);
    state.message = why;
    if (state.hull <= 0) state.phase = PHASE_CRASHED;
  }

  function checkRings(events) {
    for (const ring of course.rings) {
      if (ring.passed || plane.distance < ring.at) continue;
      ring.passed = true;
      const offset = Math.hypot(plane.x - ring.x, plane.altitude - ring.altitude);
      if (state.missionIndex === 0 && offset <= ring.radius) {
        ring.scored = true;
        state.ringsFlown += 1;
        const centred = offset <= ring.radius * 0.45;
        state.score += centred ? SCORING.ringCentred : SCORING.ringEdge;
        state.message = centred ? 'Ring centred! +' + SCORING.ringCentred : 'Ring clipped. +' + SCORING.ringEdge;
        events |= EVENT_RING;
      } else if (state.missionIndex === 0) {
        state.message = 'Ring missed — keep going, five rings still count.';
      }
    }
  }

  function checkObstacles(events) {
    for (const tower of course.towers) {
      if (tower.struck || Math.abs(plane.distance - tower.at) > 9) continue;
      if (Math.abs(plane.x - tower.x) < 7 && plane.altitude < tower.height + 4) {
        tower.struck = true;
        damage(26, 'Clipped a radio tower! Hull damaged.');
        events |= EVENT_HIT;
      }
    }
    for (const bird of course.birds) {
      if (bird.struck || Math.abs(plane.distance - bird.at) > 10) continue;
      if (Math.abs(plane.x - bird.x) < 6 && Math.abs(plane.altitude - bird.altitude) < 6) {
        bird.struck = true;
        damage(12, 'Bird strike! The Kestrel shudders.');
        events |= EVENT_HIT;
      }
    }
  }

  function updateBag(dt, events) {
    if (state.bag === null) return;
    const bag = state.bag;
    bag.distance += plane.speed * dt * 0.92;
    bag.altitude -= 26 * dt;
    if (bag.altitude > 0) return;
    const farm = course.farms[state.bagsDropped - 1];
    if (farm && Math.abs(bag.distance - farm.at) < 30 && Math.abs(bag.x - farm.x) < 16) {
      farm.hit = true;
      state.bagsOnTarget += 1;
      const centred = Math.abs(bag.x - farm.x) < 7;
      state.score += centred ? SCORING.dropPerfect : SCORING.dropNear;
      state.message = centred ? 'Mail away — right on the farm! +' + SCORING.dropPerfect : 'Mail delivered near the farm. +' + SCORING.dropNear;
    } else {
      state.message = 'That bag landed in a field. The farmer will find it… eventually.';
    }
    state.bag = null;
    events |= EVENT_DROP;
    if (advanceMissionIfDone()) events |= EVENT_MISSION;
  }

  function tryDrop() {
    if (state.missionIndex !== 1 || state.bag !== null || state.bagsDropped >= 3) return false;
    const farm = course.farms[state.bagsDropped];
    farm.dropped = true;
    state.bagsDropped += 1;
    state.bag = { x: plane.x, altitude: plane.altitude, distance: plane.distance };
    state.message = 'Bag away!';
    if (advanceMissionIfDone()) { /* mission flag is raised on landing of the bag */ }
    return true;
  }

  function judgeTouchdown(events) {
    const sink = Math.abs(plane.verticalSpeed);
    const centred = Math.abs(plane.x);
    if (plane.speed > 34 || sink > 6.5 || centred > 18) {
      damage(45, 'Hard arrival! Too fast, too steep or off the centreline.');
      state.phase = state.hull <= 0 ? PHASE_CRASHED : PHASE_LANDED;
      state.touchdown = { quality: 'hard', sink, speed: plane.speed };
      events |= EVENT_HIT | EVENT_LANDED;
      return;
    }
    const soft = sink <= 3.2 && plane.speed <= 27;
    state.score += soft ? SCORING.softLanding : SCORING.firmLanding;
    state.score += Math.max(0, Math.round(state.fuel * SCORING.secondBonus));
    state.phase = PHASE_LANDED;
    state.touchdown = { quality: soft ? 'soft' : 'firm', sink, speed: plane.speed };
    state.message = soft ? 'A feather-soft touchdown. The valley applauds.' : 'Down safely, with a firm thump.';
    events |= EVENT_LANDED;
  }

  /**
   * One fixed step. controls: { bank, pitch, power } each in -1..1,
   * plus drop: true on the step the player releases a mail bag.
   */
  function step(dt, controls) {
    let events = 0;
    if (state.phase !== PHASE_FLYING) return events;
    state.elapsed += dt;

    plane.throttle = Math.max(0, Math.min(1, plane.throttle + controls.power * PLANE.throttleRate * dt));
    plane.bank += (controls.bank - plane.bank) * Math.min(1, PLANE.bankRate * dt * 3);
    plane.pitch += (controls.pitch - plane.pitch) * Math.min(1, PLANE.pitchRate * dt * 3);

    const gravityDrag = plane.pitch * 6.5;
    plane.speed += (plane.throttle * PLANE.accel - PLANE.drag * plane.speed - gravityDrag * 0.35) * dt;
    plane.speed = Math.max(6, Math.min(PLANE.maxSpeed, plane.speed));
    plane.stalled = plane.speed < PLANE.stallSpeed;
    if (plane.stalled) events |= EVENT_STALL;

    plane.heading = (plane.heading + plane.bank * PLANE.turnRate * dt * 57.3 + 360) % 360;
    plane.x += plane.bank * plane.speed * 0.62 * dt;
    plane.x = Math.max(-VALLEY.halfWidth, Math.min(VALLEY.halfWidth, plane.x));

    let climb = plane.pitch * PLANE.climbFactor * (plane.speed / PLANE.startSpeed);
    if (plane.stalled) climb -= PLANE.sinkAtStall;
    plane.verticalSpeed = climb;
    plane.altitude += climb * dt;
    plane.distance += plane.speed * dt;

    // A full tank flies the whole valley with a small reserve at
    // cruise power; holding full throttle the whole way still runs
    // dry, which is the decision the fuel gauge exists to create.
    const burn = FUEL.idleBurn + (FUEL.fullBurn - FUEL.idleBurn) * plane.throttle;
    state.fuel = Math.max(0, state.fuel - burn * dt * 1.45);
    if (state.fuel <= 0) {
      plane.throttle = 0;
      if (plane.altitude <= 1.2) {
        state.phase = PHASE_OUT_OF_FUEL;
        state.message = 'Out of fuel, down in a field. So close to home.';
        events |= EVENT_CRASHED;
      }
    }

    for (const bird of course.birds) bird.x += bird.drift * dt;

    checkRings(events);
    if (advanceMissionIfDone()) events |= EVENT_MISSION;
    checkObstacles(events);
    updateBag(dt, events);
    if (controls.drop && tryDrop()) events |= EVENT_DROP;

    // The wheels count as down at gear height over the runway strip,
    // not only at exactly zero over a single point on it.
    const overRunwayStrip = plane.distance >= course.runwayAt - 170 && plane.distance <= course.runwayAt + 190;
    if (plane.altitude <= (overRunwayStrip ? 2.2 : 0)) {
      plane.altitude = 0;
      if (overRunwayStrip) judgeTouchdown(events);
      else {
        state.phase = PHASE_CRASHED;
        state.message = 'Down in the fields, far from the runway.';
        events |= EVENT_CRASHED;
      }
    }
    if (plane.altitude > VALLEY.ceiling) plane.altitude = VALLEY.ceiling;
    if (state.phase === PHASE_FLYING && plane.distance > course.runwayAt + 420) {
      state.phase = PHASE_CRASHED;
      state.message = 'You flew past the valley and the light gave out.';
      events |= EVENT_CRASHED;
    }
    return events;
  }

  reset();
  return { state, reset, step, currentObjective };
}
