// Tradewind Courier — keyboard and mouse input.
// Keyboard is primary; dragging the mouse steers as well. Every frame the game
// reads a single snapshot: throttle, pitch, roll, rudder, brake, and edge events.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, consumed each frame
    this.dragX = 0; // accumulated horizontal mouse drag, pixels
    this.dragY = 0; // accumulated vertical mouse drag, pixels
    this.dragging = false;
    this.onFirstGesture = null; // called once, to unlock audio
    this._gestured = false;
    this._lastX = 0;
    this._lastY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this._gesture();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.dragging = false; });

    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true; this._lastX = e.clientX; this._lastY = e.clientY;
      this._gesture();
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.dragX += e.clientX - this._lastX;
      this.dragY += e.clientY - this._lastY;
      this._lastX = e.clientX; this._lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => { this.dragging = false; });
  }

  _gesture() {
    if (!this._gestured) { this._gestured = true; if (this.onFirstGesture) this.onFirstGesture(); }
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  // Snapshot for this frame, then clear edges and drag accumulation.
  // pitch: +1 = nose up (ArrowDown pulls back, dragging down pulls back).
  // roll: +1 = bank right. rudder: +1 = yaw right.
  snapshot() {
    const s = {
      throttleUp: this.down('KeyW'),
      throttleDown: this.down('KeyS'),
      brake: this.down('Space'),
      camera: this.hit('KeyC'),
      pause: this.hit('KeyP') || this.hit('Escape'),
      restart: this.hit('KeyR'),
      mute: this.hit('KeyM'),
      confirm: this.hit('Enter') || this.hit('Space'),
    };
    const dragPitch = this.dragY / 240; // drag down = pull back = nose up
    const dragRoll = this.dragX / 240; // drag right = bank right
    s.pitch = (this.down('ArrowDown') ? 1 : 0) + (this.down('ArrowUp') ? -1 : 0) + dragPitch;
    s.roll = (this.down('ArrowRight') ? 1 : 0) + (this.down('ArrowLeft') ? -1 : 0) + dragRoll;
    s.rudder = (this.down('KeyD') ? 1 : 0) + (this.down('KeyA') ? -1 : 0);
    this.pressed.clear();
    this.dragX = 0; this.dragY = 0;
    return s;
  }
}
