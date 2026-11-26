// SPDX-License-Identifier: MIT
// Copyright (c) 2026 kizuna99
//
// Drawing only: the world state in, pixels out. A chase camera sits
// behind and above the Kestrel, looking down the valley. Distant things
// are projected toward the horizon point, so rings, towers, the river
// and the runway grow as the plane reaches them. The bottom of the
// frame is a cockpit panel with three lit dials — altimeter, airspeed
// and compass — under a text HUD that repeats the numbers plainly.

import { FONT, MISSIONS, PALETTE, VIEW } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FOCAL = 560;
const FIELD_COLOURS = [PALETTE.fieldA, PALETTE.fieldB, PALETTE.fieldC, PALETTE.fieldD];

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/** Project a valley point (lateral, altitude, metres ahead) to screen. */
function project(plane, lateral, altitude, ahead, out) {
  const dz = Math.max(8, ahead);
  const scale = FOCAL / dz;
  out.x = VIEW.width / 2 + (lateral - plane.x * 0.82) * scale - plane.bank * ahead * 0.012;
  out.y = VIEW.horizonY + (plane.altitude - altitude) * scale + plane.pitch * 26;
  out.scale = scale;
  return out;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const point = { x: 0, y: 0, scale: 1 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, colour, align = 'left', weight = 600) {
    const key = size + ':' + weight;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = colour;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawSky(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.horizonY + 90);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.62, PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.horizonY + 90);

    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(1058, 86, 34, 0, Math.PI * 2);
    ctx.fill();

    // Clouds drift slowly backwards as the plane advances.
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    for (let i = 0; i < 7; i += 1) {
      const base = (i * 263 - state.plane.distance * 0.14) % (VIEW.width + 260);
      const cx = base < -130 ? base + VIEW.width + 260 : base;
      const cy = 44 + (i % 3) * 52;
      const s = 0.7 + (i % 4) * 0.22;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 52 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 34 * s, cy + 4 * s, 38 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTerrain(state) {
    const plane = state.plane;
    ctx.fillStyle = PALETTE.hillFar;
    ctx.beginPath();
    ctx.moveTo(0, VIEW.horizonY);
    for (let x = 0; x <= VIEW.width; x += 64) {
      const h = 26 + 18 * Math.sin(x * 0.011 + 2) + 10 * Math.sin(x * 0.031);
      ctx.lineTo(x, VIEW.horizonY - h);
    }
    ctx.lineTo(VIEW.width, VIEW.horizonY);
    ctx.closePath();
    ctx.fill();

    // Ground: horizontal bands that rush closer, patchwork on each side
    // of a winding river, so speed reads at a glance.
    const bandDepth = 120;
    const firstBand = Math.floor(plane.distance / bandDepth);
    for (let i = 14; i >= 0; i -= 1) {
      const band = firstBand + i;
      const near = project(plane, 0, 0, (band + 1) * bandDepth - plane.distance, point);
      const yNear = near.y;
      const far = project(plane, 0, 0, band * bandDepth - plane.distance + 0.01, point);
      const yFar = far.y;
      if (yFar > VIEW.height || yNear < VIEW.horizonY - 4) continue;
      ctx.fillStyle = FIELD_COLOURS[Math.abs(band) % FIELD_COLOURS.length];
      ctx.fillRect(0, yFar, VIEW.width, Math.max(1, yNear - yFar));
      const riverX = VIEW.width / 2 + Math.sin(band * 0.55) * 190 * far.scale * 0.4 - plane.x * far.scale * 0.82;
      ctx.fillStyle = PALETTE.river;
      ctx.fillRect(riverX - 26 * far.scale, yFar, 52 * far.scale, Math.max(1, yNear - yFar));
      ctx.strokeStyle = 'rgba(60,80,40,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, yFar);
      ctx.lineTo(VIEW.width, yFar);
      ctx.stroke();
    }

    // Hills on the valley sides, from the world's own hill list.
    for (const hill of state.course.hills) {
      const ahead = hill.at - plane.distance;
      if (ahead < 10 || ahead > 1500) continue;
      const p = project(plane, hill.side * 210, 0, ahead, point);
      ctx.fillStyle = PALETTE.hillNear;
      ctx.beginPath();
      ctx.moveTo(p.x - 90 * p.scale, p.y);
      ctx.lineTo(p.x, p.y - hill.height * p.scale);
      ctx.lineTo(p.x + 90 * p.scale, p.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRunway(state) {
    const plane = state.plane;
    const ahead = state.course.runwayAt - plane.distance;
    if (ahead < -80 || ahead > 2600) return;
    const near = project(plane, 0, 0, Math.max(10, ahead - 160), { x: 0, y: 0, scale: 1 });
    const far = project(plane, 0, 0, ahead + 160, { x: 0, y: 0, scale: 1 });
    const nearHalf = 15 * near.scale;
    const farHalf = 15 * far.scale;
    ctx.fillStyle = PALETTE.runway;
    ctx.beginPath();
    ctx.moveTo(near.x - nearHalf, near.y);
    ctx.lineTo(far.x - farHalf, far.y);
    ctx.lineTo(far.x + farHalf, far.y);
    ctx.lineTo(near.x + nearHalf, near.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.runwayLine;
    ctx.lineWidth = Math.max(1, 1.6 * far.scale);
    ctx.beginPath();
    ctx.moveTo(far.x, far.y);
    ctx.lineTo(near.x, near.y);
    ctx.stroke();
    text('RUNWAY 09', far.x, far.y - 8 * far.scale, clamp(11 * far.scale, 9, 30), PALETTE.runwayLine, 'center');
  }

  function drawObjectives(state) {
    const plane = state.plane;
    // Golden rings still ahead, biggest last so nearer rings draw on top.
    const rings = state.course.rings.filter((r) => !r.passed && r.at - plane.distance > 6 && r.at - plane.distance < 2400);
    rings.sort((a, b) => b.at - a.at);
    for (const ring of rings) {
      const p = project(plane, ring.x, ring.altitude, ring.at - plane.distance, point);
      const radius = ring.radius * p.scale;
      ctx.strokeStyle = ring.scored ? PALETTE.good : PALETTE.ring;
      ctx.lineWidth = clamp(radius * 0.16, 2, 13);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.ringGlow;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 0.86, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Mail farms: a red target painted on the field.
    for (const farm of state.course.farms) {
      const ahead = farm.at - plane.distance;
      if (farm.dropped || ahead < 8 || ahead > 2400) continue;
      const p = project(plane, farm.x, 0, ahead, point);
      const radius = 17 * p.scale;
      ctx.fillStyle = PALETTE.target;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.target;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // Towers and birds.
    for (const tower of state.course.towers) {
      const ahead = tower.at - plane.distance;
      if (ahead < 8 || ahead > 2000) continue;
      const base = project(plane, tower.x, 0, ahead, { x: 0, y: 0, scale: 1 });
      const top = project(plane, tower.x, tower.height, ahead, point);
      ctx.strokeStyle = PALETTE.planeDark;
      ctx.lineWidth = clamp(3 * base.scale, 1.4, 7);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = PALETTE.bad;
      ctx.beginPath(); ctx.arc(top.x, top.y, clamp(3.4 * base.scale, 1.6, 8), 0, Math.PI * 2); ctx.fill();
    }
    for (const bird of state.course.birds) {
      const ahead = bird.at - plane.distance;
      if (ahead < 8 || ahead > 1600) continue;
      const p = project(plane, bird.x, bird.altitude, ahead, point);
      const wing = clamp(9 * p.scale, 2.5, 15);
      ctx.strokeStyle = PALETTE.planeDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - wing, p.y);
      ctx.quadraticCurveTo(p.x - wing * 0.4, p.y - wing * 0.55, p.x, p.y);
      ctx.quadraticCurveTo(p.x + wing * 0.4, p.y - wing * 0.55, p.x + wing, p.y);
      ctx.stroke();
    }
    // A falling mail bag.
    if (state.bag) {
      const p = project(plane, state.bag.x, state.bag.altitude, Math.max(9, state.bag.distance - plane.distance + 30), point);
      ctx.fillStyle = '#b07a3f';
      ctx.fillRect(p.x - 6, p.y - 5, 12, 10);
    }
  }

  function drawPlane(state) {
    const plane = state.plane;
    const cx = VIEW.width / 2 - plane.bank * 34;
    const cy = 486 + plane.pitch * 18;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(plane.bank * 0.42);
    // Wings, fuselage and tail of the Kestrel K-2, seen from behind-above.
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-118, 16); ctx.lineTo(-16, -6); ctx.lineTo(16, -6); ctx.lineTo(118, 16);
    ctx.lineTo(104, 30); ctx.lineTo(-104, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.ellipse(0, 4, 27, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.glass;
    ctx.beginPath();
    ctx.ellipse(0, -14, 14, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.fillRect(-34, 38, 68, 10);
    ctx.fillRect(-5, 30, 10, 26);
    // Spinning propeller blur at the nose.
    ctx.fillStyle = 'rgba(240,244,248,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, -48, 30, 6 + plane.throttle * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDial(cx, cy, radius, label, valueText, needleAngle, warn) {
    ctx.fillStyle = PALETTE.dialFace;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = warn ? PALETTE.bad : PALETTE.panelEdge;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i <= 8; i += 1) {
      const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
      ctx.strokeStyle = PALETTE.planeDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (radius - 9), cy + Math.sin(a) * (radius - 9));
      ctx.lineTo(cx + Math.cos(a) * (radius - 3), cy + Math.sin(a) * (radius - 3));
      ctx.stroke();
    }
    ctx.strokeStyle = PALETTE.needle;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (radius - 11), cy + Math.sin(needleAngle) * (radius - 11));
    ctx.stroke();
    text(label, cx, cy + radius * 0.52, 12, PALETTE.planeDark, 'center', 700);
    text(valueText, cx, cy + radius + 17, 15, PALETTE.hud, 'center', 700);
  }

  function drawCockpit(state) {
    const plane = state.plane;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 592, VIEW.width, 128);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, 592, VIEW.width, 4);

    const speedKt = Math.round(plane.speed * 1.94);
    const altFt = Math.round(plane.altitude * 3.28);
    const heading = Math.round(plane.heading);
    drawDial(150, 652, 40, 'SPEED', speedKt + ' kt', Math.PI * 0.75 + clamp(plane.speed / 85, 0, 1) * Math.PI * 1.5, plane.stalled);
    drawDial(330, 652, 40, 'ALTITUDE', altFt + ' ft', Math.PI * 0.75 + clamp(plane.altitude / 240, 0, 1) * Math.PI * 1.5, plane.altitude < 14 && state.phase === 'flying');
    drawDial(510, 652, 40, 'HEADING', String(heading).padStart(3, '0') + '°', (heading - 90) * (Math.PI / 180), false);

    // Throttle, fuel and hull bars with plain labels.
    const bars = [
      { label: 'THROTTLE', value: plane.throttle, colour: PALETTE.ring, x: 640 },
      { label: 'FUEL', value: state.fuel / 100, colour: state.fuel < 22 ? PALETTE.bad : PALETTE.good, x: 850 },
      { label: 'HULL', value: state.hull / 100, colour: state.hull < 40 ? PALETTE.bad : PALETTE.skyMid, x: 1060 },
    ];
    for (const bar of bars) {
      text(bar.label, bar.x, 632, 13, PALETTE.hudDim, 'left', 700);
      ctx.fillStyle = '#12151a';
      ctx.fillRect(bar.x, 642, 150, 16);
      ctx.fillStyle = bar.colour;
      ctx.fillRect(bar.x, 642, 150 * clamp(bar.value, 0, 1), 16);
      text(Math.round(bar.value * 100) + '%', bar.x, 684, 14, PALETTE.hud, 'left', 700);
    }
  }

  function drawHud(state, screen) {
    const plane = state.plane;
    const speedKt = Math.round(plane.speed * 1.94);
    const altFt = Math.round(plane.altitude * 3.28);
    ctx.fillStyle = 'rgba(16,22,30,0.62)';
    ctx.fillRect(18, 16, 520, 86);
    text(`ALT ${altFt} ft`, 34, 52, 27, PALETTE.hud, 'left', 800);
    text(`SPD ${speedKt} kt`, 218, 52, 27, PALETTE.hud, 'left', 800);
    text(`HDG ${String(Math.round(plane.heading)).padStart(3, '0')}°`, 388, 52, 27, PALETTE.hud, 'left', 800);
    const mission = MISSIONS[state.missionIndex];
    text(`Mission ${state.missionIndex + 1}/3 · ${mission.name}`, 34, 86, 18, PALETTE.hudDim, 'left', 600);

    ctx.fillStyle = 'rgba(16,22,30,0.62)';
    ctx.fillRect(952, 16, 310, 86);
    text(`Score ${state.score}`, 1262, 52, 27, PALETTE.hud, 'right', 800);
    text(`Rings ${state.ringsFlown} · Bags ${state.bagsOnTarget}/3`, 1262, 86, 18, PALETTE.hudDim, 'right', 600);

    if (screen === SCREEN_PLAY) {
      if (plane.stalled) text('STALL — nose down, add power!', VIEW.width / 2, 138, 28, PALETTE.bad, 'center', 800);
      else if (state.fuel < 22 && state.fuel > 0) text('LOW FUEL', VIEW.width / 2, 138, 24, PALETTE.warn, 'center', 800);
      if (state.message) {
        ctx.fillStyle = 'rgba(16,22,30,0.55)';
        ctx.fillRect(VIEW.width / 2 - 330, 540, 660, 36);
        text(state.message, VIEW.width / 2, 565, 18, PALETTE.hud, 'center', 600);
      }
    }
  }

  function drawPanel(title, lines, prompt) {
    ctx.fillStyle = 'rgba(18,24,34,0.86)';
    const width = 700;
    const height = 178 + lines.length * 32;
    const x = (VIEW.width - width) / 2;
    const y = 120;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = PALETTE.ring;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 66, 44, PALETTE.hud, 'center', 800);
    lines.forEach((line, index) => {
      text(line, VIEW.width / 2, y + 116 + index * 32, 20, PALETTE.hudDim, 'center', 500);
    });
    text(prompt, VIEW.width / 2, y + height - 26, 21, PALETTE.ring, 'center', 700);
  }

  /** Paint one frame for the given screen. */
  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    drawSky(state);
    drawTerrain(state);
    drawRunway(state);
    drawObjectives(state);
    drawPlane(state);
    drawCockpit(state);
    drawHud(state, screen);

    if (screen === SCREEN_TITLE) {
      drawPanel('SKYLINE COURIER', [
        'Fly the Kestrel K-2 down Teluk Angin valley.',
        'Rings, mail drops, then land on Runway 09.',
        'Arrows / WASD steer · Shift power · Space drops mail',
        `Best score ${best}`,
      ], 'Press Space or click to take off');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The valley waits below.'], 'Press P to keep flying');
    } else if (screen === SCREEN_OVER) {
      const landed = state.phase === 'landed';
      drawPanel(landed ? 'DELIVERY COMPLETE' : 'SORTIE OVER', [
        landed ? 'The mail is delivered and the Kestrel is home.' : state.message,
        `Score ${state.score} · Rings ${state.ringsFlown} · Bags on target ${state.bagsOnTarget}/3`,
        `Fuel left ${Math.round(state.fuel)}% · Hull ${Math.round(state.hull)}% · Best ${best}`,
      ], 'Press Space or click to fly again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
