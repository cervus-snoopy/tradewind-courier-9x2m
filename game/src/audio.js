// Tradewind Courier — every sound is synthesized with WebAudio. No audio files.
// Engine drone follows throttle, wind noise follows airspeed, plus chimes, thuds
// and a quiet pad for the menu. Starts only after the first user gesture.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._engine = null;
    this._wind = null;
    this._pad = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this._master = this.ctx.createGain();
    this._master.gain.value = 0.9;
    this._master.connect(this.ctx.destination);
    this._startEngine();
    this._startWind();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this._master) this._master.gain.value = muted ? 0 : 0.9;
  }

  _noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _startEngine() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = 55;
    const sub = ctx.createOscillator();
    sub.type = 'triangle'; sub.frequency.value = 28;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320; filter.Q.value = 2;
    const gain = ctx.createGain(); gain.gain.value = 0;
    osc.connect(filter); sub.connect(filter); filter.connect(gain); gain.connect(this._master);
    osc.start(); sub.start();
    this._engine = { osc, sub, filter, gain };
  }

  _startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2); src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 500; filter.Q.value = 0.6;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filter); filter.connect(gain); gain.connect(this._master);
    src.start();
    this._wind = { filter, gain };
  }

  // Called every frame while flying: throttle 0..1, speed m/s, onGround bool.
  updateFlight(throttle, speed, onGround) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (this._engine) {
      const rpm = 55 + throttle * 95 + (onGround ? 0 : 8);
      this._engine.osc.frequency.setTargetAtTime(rpm, t, 0.08);
      this._engine.sub.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
      this._engine.filter.frequency.setTargetAtTime(280 + throttle * 700, t, 0.1);
      this._engine.gain.gain.setTargetAtTime(0.05 + throttle * 0.075, t, 0.1);
    }
    if (this._wind) {
      const whoosh = Math.min(1, Math.max(0, (speed - 15) / 70));
      this._wind.gain.gain.setTargetAtTime(whoosh * 0.12, t, 0.15);
      this._wind.filter.frequency.setTargetAtTime(350 + speed * 9, t, 0.15);
    }
  }

  _tone(freq, dur, type, gainValue, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type; osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainValue, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(this._master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  ring() { this._tone(880, 0.35, 'sine', 0.22); this._tone(1318, 0.5, 'sine', 0.16, 0.09); }
  click() { this._tone(660, 0.08, 'square', 0.08); }
  warn() { this._tone(440, 0.16, 'square', 0.1); this._tone(440, 0.16, 'square', 0.1, 0.22); }
  land() {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.25);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 240;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    src.connect(filter); filter.connect(gain); gain.connect(this._master);
    src.start();
  }
  crash() {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.8);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
    src.connect(filter); filter.connect(gain); gain.connect(this._master);
    src.start();
  }
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.5, 'triangle', 0.18, i * 0.13));
  }
}
