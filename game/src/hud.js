// Tradewind Courier — the instruments: a 2D canvas overlay draws the artificial
// horizon, speed and altitude tapes and the compass strip; the DOM shows the big
// numbers, bars and messages. Lit amber and cyan, like a real panel at dusk.
import { clamp } from './random.js';

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

export class Hud {
  constructor() {
    this.canvas = document.getElementById('instruments');
    this.ctx = this.canvas.getContext('2d');
    this.el = {
      spd: document.getElementById('hud-spd'),
      alt: document.getElementById('hud-alt'),
      hdg: document.getElementById('hud-hdg'),
      vsi: document.getElementById('hud-vsi'),
      gates: document.getElementById('hud-gates'),
      time: document.getElementById('hud-time'),
      score: document.getElementById('hud-score'),
      missionName: document.getElementById('hud-mission-name'),
      objective: document.getElementById('hud-objective'),
      thr: document.getElementById('bar-thr'),
      thrNum: document.getElementById('bar-thr-num'),
      fuel: document.getElementById('bar-fuel'),
      fuelNum: document.getElementById('bar-fuel-num'),
      hull: document.getElementById('bar-hull'),
      hullNum: document.getElementById('bar-hull-num'),
      wind: document.getElementById('hud-wind'),
      arrow: document.getElementById('hud-arrow'),
      nextDist: document.getElementById('hud-next-dist'),
      msg: document.getElementById('hud-msg'),
    };
    this._msgTimer = null;
    this._lastText = {};
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this._dpr = dpr;
  }

  _setText(key, el, text) {
    if (this._lastText[key] !== text) { this._lastText[key] = text; el.textContent = text; }
  }

  show() { document.getElementById('hud').classList.remove('hidden'); }
  hide() { document.getElementById('hud').classList.add('hidden'); }

  message(text, warn = false, holdMs = 2200) {
    this.el.msg.textContent = text;
    this.el.msg.classList.toggle('warn', warn);
    this.el.msg.classList.add('show');
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => this.el.msg.classList.remove('show'), holdMs);
  }

  setMission(mission) {
    this._setText('name', this.el.missionName, mission.name);
    this._setText('obj', this.el.objective, mission.brief);
  }

  // state: everything the panel needs, read from the flight model + mission.
  update(state) {
    const kt = Math.round(state.speed * MS_TO_KT);
    const ft = Math.max(0, Math.round(state.alt * M_TO_FT));
    const fpm = Math.round(state.verticalSpeed * M_TO_FT * 60);
    const hdg = Math.round(state.headingDeg);
    this._setText('spd', this.el.spd, String(kt));
    this._setText('alt', this.el.alt, String(ft));
    this._setText('hdg', this.el.hdg, String(hdg).padStart(3, '0'));
    this._setText('vsi', this.el.vsi, (fpm >= 0 ? '+' : '') + fpm);
    this._setText('gates', this.el.gates, state.gatesTotal > 0 ? `GATE ${state.gatesDone}/${state.gatesTotal}` : 'FREE FLIGHT');
    this._setText('time', this.el.time, state.timeText);
    this._setText('score', this.el.score, 'SCORE ' + state.score);
    this.el.thr.style.width = Math.round(state.throttle * 100) + '%';
    this._setText('thrNum', this.el.thrNum, Math.round(state.throttle * 100) + '%');
    this.el.fuel.style.width = Math.round(state.fuel) + '%';
    this.el.fuel.classList.toggle('low', state.fuel < 20);
    this._setText('fuelNum', this.el.fuelNum, String(Math.round(state.fuel)));
    this.el.hull.style.width = Math.round(state.hull) + '%';
    this.el.hull.classList.toggle('low', state.hull < 35);
    this._setText('hullNum', this.el.hullNum, String(Math.round(state.hull)));
    const w = state.wind;
    this._setText('wind', this.el.wind, w.speed < 1 ? 'CALM' : `${Math.round(w.speed * MS_TO_KT)} KT ${String(w.from).padStart(3, '0')}°`);
    if (state.nextGate) {
      const dx = state.nextGate.x - state.pos.x, dz = state.nextGate.z - state.pos.z;
      const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI; // compass bearing to gate
      const rel = ((bearing - state.headingDeg + 540) % 360) - 180;
      this.el.arrow.style.transform = `rotate(${rel}deg)`;
      const dist = Math.round(Math.hypot(dx, dz));
      this._setText('next', this.el.nextDist, dist > 999 ? (dist / 1000).toFixed(1) + ' km' : dist + ' m');
    } else {
      this.el.arrow.style.transform = 'rotate(0deg)';
      this._setText('next', this.el.nextDist, 'LAND · RWY ' + (state.destStrip === 'palm' ? '14' : '27'));
    }
    this._drawInstruments(state);
  }

  _drawInstruments(state) {
    const ctx = this.ctx, dpr = this._dpr;
    const W = window.innerWidth, H = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // --- artificial horizon, bottom-left ---
    const hx = 92, hy = H - 96, hr = 62;
    ctx.save();
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.clip();
    ctx.translate(hx, hy);
    ctx.rotate(-state.roll);
    const pitchPx = clamp(state.pitch, -0.5, 0.5) * hr * 1.6;
    ctx.translate(0, pitchPx);
    ctx.fillStyle = '#2f6fb2'; ctx.fillRect(-hr - 4, -hr - 4, (hr + 4) * 2, hr + 4); // sky
    ctx.fillStyle = '#7a5230'; ctx.fillRect(-hr - 4, 0, (hr + 4) * 2, hr + 4); // ground
    ctx.fillStyle = '#ffe9c4'; ctx.fillRect(-hr - 4, -1.5, (hr + 4) * 2, 3); // horizon line
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,179,71,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.moveTo(hx - 8, hy); ctx.lineTo(hx + 8, hy); ctx.lineTo(hx, hy + 6); ctx.closePath(); ctx.fill();
    // --- speed tape, left edge ---
    this._tape(14, H / 2 - 90, 44, 180, Math.round(state.speed * MS_TO_KT), 10, 'KT');
    // --- altitude tape, right edge ---
    this._tape(W - 58, H / 2 - 90, 44, 180, Math.round(state.alt * M_TO_FT), 100, 'FT');
    // --- compass strip, top centre ---
    const cw = 300, cx = W / 2 - cw / 2, cy = 74;
    ctx.fillStyle = 'rgba(8,20,30,0.72)';
    ctx.fillRect(cx, cy, cw, 26);
    ctx.strokeStyle = 'rgba(255,179,71,0.55)'; ctx.strokeRect(cx, cy, cw, 26);
    const hdg = state.headingDeg;
    ctx.fillStyle = '#ffe9c4'; ctx.font = 'bold 12px ui-monospace, Consolas, monospace'; ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 10) {
      const a = (Math.round(hdg / 10) * 10 + d + 360) % 360;
      const x = cx + cw / 2 + d * 2.4;
      if (x < cx + 8 || x > cx + cw - 8) continue;
      const label = a % 90 === 0 ? ['N', 'E', 'S', 'W'][a / 90] : String(a).padStart(3, '0');
      ctx.fillText(label, x, cy + 17);
      ctx.fillRect(x - 0.5, cy + 20, 1, 5);
    }
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.moveTo(W / 2 - 6, cy - 2); ctx.lineTo(W / 2 + 6, cy - 2); ctx.lineTo(W / 2, cy + 6); ctx.closePath(); ctx.fill();
    // --- stall warning ---
    if (state.stalled) {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 20px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STALL — NOSE DOWN, ADD POWER', W / 2, H - 150);
    }
  }

  _tape(x, y, w, h, value, step, unit) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,20,30,0.72)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,179,71,0.55)';
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ffe9c4'; ctx.font = '11px ui-monospace, Consolas, monospace'; ctx.textAlign = 'left';
    const mid = y + h / 2;
    for (let d = -2; d <= 2; d++) {
      const v = Math.round(value / step) * step + d * step;
      if (v < 0) continue;
      const yy = mid - d * 32;
      if (yy < y + 10 || yy > y + h - 8) continue;
      ctx.fillText(String(v), x + 5, yy + 4);
      ctx.fillRect(x + w - 8, yy, 6, 1);
    }
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(x, mid - 9, w, 18);
    ctx.fillStyle = '#1a1206'; ctx.font = 'bold 12px ui-monospace, Consolas, monospace';
    ctx.fillText(String(value), x + 5, mid + 4);
    ctx.fillStyle = '#9fb8c8'; ctx.font = '9px ui-monospace, Consolas, monospace';
    ctx.fillText(unit, x + 5, y + h - 6);
  }
}
