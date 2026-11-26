// Tradewind Courier — mission flow: one route at a time, gates in order, then a
// landing that is scored. Score = gates + landing softness + time + fuel left.
// Medals per route; best scores persist in localStorage.
import { MISSIONS, FREE_FLIGHT, TUNE, WORLD } from './config.js';
import { formatTime } from './random.js';

const BEST_KEY = 'tradewind-courier-best-v1';

export function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); } catch { return {}; }
}
export function saveBest(best) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* private mode */ }
}

export class MissionRunner {
  constructor(world, flight, sound, hud) {
    this.world = world;
    this.flight = flight;
    this.sound = sound;
    this.hud = hud;
    this.mission = null;
    this.state = 'menu'; // menu | flying | paused | complete | crashed
    this.gateIndex = 0;
    this.gatesDone = 0;
    this.score = 0;
    this.ringScore = 0;
    this.time = 0;
    this.leg = 1; // Island Hop has two legs
    this._warnedFuel = false;
    this._warnedStall = false;
    this.best = loadBest();
  }

  missionList() { return [...MISSIONS, FREE_FLIGHT]; }

  start(mission) {
    this.mission = mission;
    this.world.setLighting(mission.light);
    this.world.setGates(mission.gates, 0);
    this.flight.reset(mission.start, mission.fuel);
    this.gateIndex = 0; this.gatesDone = 0;
    this.score = 0; this.ringScore = 0;
    this.time = 0; this.leg = 1;
    this._warnedFuel = false; this._warnedStall = false;
    this.state = 'flying';
    this.hud.setMission(mission);
    this.hud.show();
    this.hud.message(mission.name, false, 2600);
  }

  quitToMenu() {
    this.state = 'menu';
    this.hud.hide();
  }

  pause() { if (this.state === 'flying') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'flying'; }

  // Called every frame while flying. Returns nothing; sets state on finish.
  update(dt, prevPos) {
    if (this.state !== 'flying') return;
    this.time += dt;
    const m = this.mission;
    const f = this.flight;
    // --- gates ---
    const gate = m.gates[this.gateIndex];
    if (gate && f.crossedGate(gate, prevPos)) {
      this.world.setGatePassed(this.gateIndex);
      this.gateIndex++;
      this.gatesDone++;
      this.ringScore += TUNE.ringScore;
      this.sound.ring();
      const left = m.gates.length - this.gateIndex;
      this.hud.message(left > 0 ? `GATE ${this.gatesDone} CLEARED · +${TUNE.ringScore}` : 'ALL GATES · LAND HER NOW', false, 1800);
    }
    // --- fuel warnings ---
    if (!this._warnedFuel && f.fuel < 20 && f.fuel > 0) {
      this._warnedFuel = true;
      this.sound.warn();
      this.hud.message('LOW FUEL — GET HER DOWN', true, 2600);
    }
    if (f.engineOut && !this._warnedStall) {
      this._warnedStall = true;
      this.hud.message('ENGINE OUT — GLIDE TO THE STRIP', true, 3000);
    }
    if (f.stalled && !this._warnedStall) {
      this._warnedStall = true;
      setTimeout(() => { this._warnedStall = false; }, 4000);
    }
    // --- landing / crash are reported by the caller via events ---
  }

  // Called by main.js with the flight model's step events.
  onFlightEvent(events) {
    const f = this.flight, m = this.mission;
    if (events.crashed) {
      this.state = 'crashed';
      this.sound.crash();
      return { type: 'crashed', reason: events.crashed.reason };
    }
    if (events.fuelEmpty) {
      this.hud.message('FUEL EMPTY — ENGINE OUT', true, 3000);
    }
    if (events.roughLanding) {
      f.hull = Math.max(0, f.hull - TUNE.roughLandingDamage);
      this.sound.land();
      this.hud.message('ROUGH FIELD LANDING — HULL -' + TUNE.roughLandingDamage, true, 2200);
      if (f.hull <= 0) { this.state = 'crashed'; return { type: 'crashed', reason: 'Hull gave out on a rough landing' }; }
    }
    if (events.touchedDown) {
      const strip = events.touchedDown.strip;
      const destStrip = this.mission.dest === 'palm' ? WORLD.palmStrip : WORLD.homeStrip;
      const onTarget = strip === destStrip;
      const gatesComplete = this.gateIndex >= m.gates.length;
      if (onTarget && gatesComplete) {
        if (m.returnLeg && this.leg === 1) {
          // Island Hop leg 1: refuel, brief, fly the return gates.
          this.leg = 2;
          f.fuel = TUNE.tank; f.hull = 100;
          this.gateIndex = 0; this.gatesDone = 0;
          this.world.setGates(this._returnGates(), 0);
          this.mission = { ...m, gates: this._returnGates(), dest: 'home' };
          this.sound.fanfare();
          this.hud.message('PALM ISLE MAIL DELIVERED · REFUELLED · FLY HOME', false, 3200);
          return { type: 'leg' };
        }
        return this._finish(events.touchedDown);
      }
      if (onTarget && !gatesComplete) {
        this.hud.message('LANDED EARLY — GATES STILL OPEN', true, 2400);
        return { type: 'landed-early' };
      }
      // Landed on the wrong strip: fine, take off again.
      this.sound.land();
      this.hud.message(events.touchedDown.soft ? 'TOUCHDOWN — WRONG STRIP, TAKE OFF AGAIN' : 'HARD LANDING — WRONG STRIP', !events.touchedDown.soft, 2200);
      if (!events.touchedDown.soft) {
        f.hull = Math.max(0, f.hull - TUNE.hardLandingDamage);
        if (f.hull <= 0) { this.state = 'crashed'; return { type: 'crashed', reason: 'Hull gave out on a hard landing' }; }
      }
      return { type: 'landed-wrong' };
    }
    return null;
  }

  _returnGates() {
    return [
      { x: 1200, y: 90, z: -600 }, { x: 600, y: 100, z: -300 },
      { x: 0, y: 90, z: -500 }, { x: -300, y: 70, z: -350 },
    ];
  }

  _finish(touchdown) {
    const f = this.flight, m = this.mission;
    const landingPts = touchdown.soft ? TUNE.landingMax : Math.round(TUNE.landingMax * 0.5);
    const timeBonus = m.par > 0 ? Math.max(0, Math.round((m.par - this.time) * TUNE.timeBonusRate)) : 0;
    const fuelBonus = Math.round(f.fuel * TUNE.fuelBonusRate);
    const total = this.ringScore + landingPts + timeBonus + fuelBonus;
    this.score = total;
    this.state = 'complete';
    this.sound.fanfare();
    const medal = total >= m.medals.gold ? 'gold' : total >= m.medals.silver ? 'silver' : total >= m.medals.bronze ? 'bronze' : null;
    const prevBest = this.best[m.id];
    const isBest = !prevBest || total > prevBest.score;
    if (isBest) { this.best[m.id] = { score: total, medal, time: this.time }; saveBest(this.best); }
    return {
      type: 'complete',
      breakdown: [
        ['Gates', this.ringScore + ' pts'],
        ['Landing', landingPts + ' pts' + (touchdown.soft ? ' (soft)' : ' (firm)')],
        ['Time bonus', timeBonus + ' pts'],
        ['Fuel bonus', fuelBonus + ' pts'],
        ['TOTAL', total + ' pts'],
      ],
      medal, isBest, time: this.time, total,
    };
  }

  hudState() {
    const f = this.flight, m = this.mission;
    return {
      speed: f.speed, alt: Math.max(0, f.pos.y), verticalSpeed: f.verticalSpeed,
      headingDeg: f.headingDeg(), throttle: f.throttle, fuel: f.fuel, hull: f.hull,
      gatesDone: this.gatesDone, gatesTotal: m ? m.gates.length : 0,
      timeText: formatTime(this.time), score: this.ringScore,
      wind: m ? m.wind : { from: 270, speed: 0, gust: 0 },
      nextGate: m && this.gateIndex < m.gates.length ? m.gates[this.gateIndex] : null,
      destStrip: m ? m.dest : 'home',
      pos: f.pos, stalled: f.stalled, pitch: f.pitch, roll: f.roll,
    };
  }
}
