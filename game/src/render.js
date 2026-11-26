// Tradewind Courier — renderer and cameras. One WebGL renderer, two views:
// a chase camera that trails the plane and a cockpit camera on the nose.
// The camera never fights the pilot: it eases, never snaps, and always looks
// where the plane is going.
import * as THREE from 'three';

export class RenderView {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 12000);
    this.cameraMode = 'chase';
    this._camPos = new THREE.Vector3(0, 40, -60);
    this._camLook = new THREE.Vector3();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  toggleCamera() {
    this.cameraMode = this.cameraMode === 'chase' ? 'cockpit' : 'chase';
    return this.cameraMode;
  }

  // Put the chase camera exactly on its target (no ease-in): used for
  // deterministic ?shot= screenshots so the plane is framed on the first frame.
  snapCamera(pose) {
    const fwd = new THREE.Vector3(Math.cos(pose.heading), 0, -Math.sin(pose.heading));
    const up = new THREE.Vector3(0, 1, 0);
    this._camPos.copy(pose.pos).addScaledVector(fwd, -15).addScaledVector(up, 4.6);
    this._camLook.copy(pose.pos).addScaledVector(fwd, 26).addScaledVector(up, 1.2);
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);
  }

  // pose: { pos, heading, pitch, roll }; dt seconds.
  update(pose, dt) {
    const fwd = new THREE.Vector3(Math.cos(pose.heading), 0, -Math.sin(pose.heading));
    const up = new THREE.Vector3(0, 1, 0);
    if (this.cameraMode === 'chase') {
      const target = new THREE.Vector3()
        .copy(pose.pos).addScaledVector(fwd, -15).addScaledVector(up, 4.6);
      // Ease: fast enough to feel attached, slow enough to feel like flight.
      const k = 1 - Math.exp(-dt * 4.5);
      this._camPos.lerp(target, k);
      this._camLook.lerp(new THREE.Vector3().copy(pose.pos).addScaledVector(fwd, 26).addScaledVector(up, 1.2), 1 - Math.exp(-dt * 7));
      this.camera.position.copy(this._camPos);
      this.camera.lookAt(this._camLook);
      this.camera.rotation.z += pose.roll * 0.22; // gentle roll with the plane
    } else {
      // Cockpit: just behind the prop, above the nose, looking over it.
      const eye = new THREE.Vector3().copy(pose.pos).addScaledVector(fwd, 1.7).addScaledVector(up, 1.3);
      const look = new THREE.Vector3().copy(pose.pos).addScaledVector(fwd, 60);
      look.y += Math.sin(pose.pitch) * 40;
      this.camera.position.copy(eye);
      this.camera.lookAt(look);
      this.camera.rotation.z += pose.roll * 0.35;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
