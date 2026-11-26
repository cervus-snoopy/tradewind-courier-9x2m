// Tradewind Courier — boot, game loop and screen flow (menu → flying → paused
// → complete / crashed). Wires input, physics, world, renderer, HUD and sound.
// Also serves ?shot= poses so screenshots are reproducible renders of the game.
import * as THREE from 'three';
import { MISSIONS, FREE_FLIGHT } from './config.js';
import { mulberry32 } from './random.js';
import { World } from './world.js';
import { Aircraft } from './aircraft.js';
import { FlightModel } from './physics.js';
import { RenderView } from './render.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { MissionRunner, loadBest } from './missions.js';
import { parseShot, poseForShot } from './shots.js';

const canvas = document.getElementById('scene');
const view = new RenderView(canvas);
const world = new World(view.scene, 20261126);
const aircraft = new Aircraft(view.scene);
const flight = new FlightModel(world);
const hud = new Hud();
const input = new Input(canvas);
const sound = new SoundBank();
const runner = new MissionRunner(world, flight, sound, hud);

const statusEl = document.getElementById('status');
function announce(text) { statusEl.textContent = text; }

// ---- menus ----
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause-menu');
const endEl = document.getElementById('end-menu');
let selectedMission = MISSIONS[0];

function buildMissionList() {
  const list = document.getElementById('mission-list');
  list.innerHTML = '';
  const best = loadBest();
  runner.missionList().forEach((m) => {
    const row = document.createElement('div');
    row.className = 'mission-row' + (m === selectedMission ? ' selected' : '');
    const b = best[m.id];
    row.innerHTML = `<span class="m-num">${m.id === 5 ? '✦' : m.id + 1}</span>` +
      `<span class="m-body"><span class="m-name">${m.name}</span><br><span class="m-desc">${m.desc}</span></span>` +
      `<span class="m-best">${b ? 'BEST ' + b.score + (b.medal ? ' · ' + b.medal.toUpperCase() : '') : ''}</span>`;
    row.addEventListener('click', () => {
      selectedMission = m;
      sound.unlock(); sound.click();
      buildMissionList();
    });
    row.addEventListener('dblclick', () => startGame(m));
    list.appendChild(row);
  });
  // Big start button under the list.
  const startBtn = document.createElement('button');
  startBtn.className = 'btn';
  startBtn.textContent = 'FLY ' + selectedMission.name;
  startBtn.addEventListener('click', () => startGame(selectedMission));
  list.appendChild(startBtn);
}

function showOnly(el) {
  for (const m of [menuEl, pauseEl, endEl]) m.classList.add('hidden');
  if (el) el.classList.remove('hidden');
  document.getElementById('cockpit-frame').classList.add('hidden');
}

function startGame(mission) {
  sound.unlock();
  buildMissionList();
  runner.start(mission);
  showOnly(null);
  hud.show();
  announce('Flying ' + mission.name + '. ' + mission.brief);
}

function showEnd(result) {
  const title = document.getElementById('end-title');
  const sub = document.getElementById('end-sub');
  const stats = document.getElementById('end-stats');
  const medal = document.getElementById('end-medal');
  const nextBtn = document.getElementById('btn-next');
  if (result.type === 'complete') {
    title.textContent = 'ROUTE COMPLETE';
    sub.textContent = runner.mission.name + ' — the mail is through' + (result.isBest ? ', and a new best score!' : '.');
    stats.innerHTML = result.breakdown.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
    medal.textContent = result.medal === 'gold' ? '🥇' : result.medal === 'silver' ? '🥈' : result.medal === 'bronze' ? '🥉' : '✈️';
    const next = MISSIONS[(runner.mission.id + 1) % MISSIONS.length];
    nextBtn.style.display = '';
    nextBtn.textContent = 'NEXT: ' + next.name;
    nextBtn.onclick = () => startGame(next);
  } else {
    title.textContent = 'DOWN SHE GOES';
    sub.textContent = result.reason + '. The courier service sends another plane.';
    stats.innerHTML = `<div>Gates cleared<b>${runner.gatesDone} / ${runner.mission.gates.length}</b></div>` +
      `<div>Score<b>${runner.ringScore} pts</b></div>`;
    medal.textContent = '💥';
    nextBtn.style.display = 'none';
  }
  document.getElementById('btn-retry').onclick = () => startGame(runner.mission);
  document.getElementById('btn-menu').onclick = () => { runner.quitToMenu(); buildMissionList(); showOnly(menuEl); };
  showOnly(endEl);
  hud.hide();
}

document.getElementById('btn-resume').addEventListener('click', () => { runner.resume(); showOnly(null); hud.show(); });
document.getElementById('btn-quit').addEventListener('click', () => { runner.quitToMenu(); buildMissionList(); showOnly(menuEl); });

// ---- ?shot= poses (screenshots) ----
const shot = parseShot();
let shotPose = null;
if (shot) {
  const posed = poseForShot(null, shot.shot);
  selectedMission = posed.mission;
  if (posed.pose === 'fly' && posed.place) {
    shotPose = posed;
    runner.start(posed.mission);
    const f = flight, p = posed.place;
    f.pos.set(p.x, p.y, p.z);
    f.heading = ((90 - p.heading) * Math.PI) / 180;
    f.pitch = p.pitch; f.roll = p.roll;
    f.speed = p.speed; f.throttle = p.throttle;
    f.onGround = false;
    runner.gateIndex = p.gateIndex; runner.gatesDone = p.gateIndex;
    for (let i = 0; i < p.gateIndex; i++) world.setGatePassed(i);
    if (posed.camera === 'cockpit' && view.cameraMode !== 'cockpit') view.toggleCamera();
    view.snapCamera({ pos: flight.pos, heading: flight.heading, pitch: flight.pitch, roll: flight.roll });
    showOnly(null);
    hud.show();
  } else {
    buildMissionList();
    showOnly(menuEl);
    world.setLighting(posed.mission.light);
  }
} else {
  buildMissionList();
  showOnly(menuEl);
  world.setLighting('day');
}

// Expose a tiny debug handle for play-testing (read-only state, no cheats).
window.__tradewind = { runner, flight, world };

// ---- main loop ----
input.onFirstGesture = () => sound.unlock();
let last = performance.now();
let hudClock = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const snap = input.snapshot();
  const t = now / 1000;

  if (snap.mute) { sound.setMuted(!sound.muted); }
  if (snap.camera && runner.state === 'flying') {
    const mode = view.toggleCamera();
    document.getElementById('cockpit-frame').classList.toggle('hidden', mode !== 'cockpit');
  }
  if (snap.pause) {
    if (runner.state === 'flying') { runner.pause(); showOnly(pauseEl); hud.hide(); }
    else if (runner.state === 'paused') { runner.resume(); showOnly(null); hud.show(); }
  }
  if (snap.restart && (runner.state === 'flying' || runner.state === 'paused' || runner.state === 'crashed')) {
    startGame(runner.mission);
  }

  if (runner.state === 'flying') {
    const prevPos = flight.pos.clone();
    const events = flight.step(snap, runner.mission.wind, dt);
    runner.update(dt, prevPos);
    const result = runner.onFlightEvent(events);
    if (result && (result.type === 'complete' || result.type === 'crashed')) showEnd(result);
    sound.updateFlight(flight.throttle, flight.speed, flight.onGround);
    hudClock += dt;
    if (hudClock > 0.1) { hud.update(runner.hudState()); hudClock = 0; }
  }

  // Keep the plane mesh on the flight model; the world ambience follows it.
  aircraft.update({ pos: flight.pos, heading: flight.heading, pitch: flight.pitch, roll: flight.roll }, flight.throttle, t, view.cameraMode === 'cockpit');
  world.update(dt, t, flight.pos, runner.mission ? runner.mission.wind : { from: 270, speed: 0, gust: 0 });
  view.update({ pos: flight.pos, heading: flight.heading, pitch: flight.pitch, roll: flight.roll }, dt);
  view.render();
}

requestAnimationFrame(frame);
