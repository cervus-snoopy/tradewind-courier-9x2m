// Tradewind Courier — the mail plane, built from primitives: cream fuselage,
// teal stripe, orange tail, spinning prop, blinking nav lights. Original art.
import * as THREE from 'three';

export class Aircraft {
  constructor(scene) {
    this.group = new THREE.Group();
    const cream = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.55, metalness: 0.15 });
    const teal = new THREE.MeshStandardMaterial({ color: 0x2a7a8a, roughness: 0.5, metalness: 0.2 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe07b39, roughness: 0.55, metalness: 0.15 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3640, roughness: 0.4, metalness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1c3a4a, roughness: 0.15, metalness: 0.6 });

    // Fuselage: nose to tail along -Z (forward is -Z in model space).
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 5.6, 12), cream);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.castShadow = true;
    this.group.add(fuselage);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), teal);
    nose.position.set(0, 0, -2.8);
    nose.scale.set(1, 1, 0.7);
    this.group.add(nose);
    // Canopy.
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    canopy.position.set(0, 0.42, -0.9);
    canopy.scale.set(0.95, 0.9, 1.7);
    this.group.add(canopy);
    // Teal cheatline stripe along the fuselage.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 5.4), teal);
    stripe.position.set(0.86, 0.05, 0);
    this.group.add(stripe);
    const stripe2 = stripe.clone(); stripe2.position.x = -0.86;
    this.group.add(stripe2);
    // Main wing (slight dihedral) + tailplane + fin.
    const wing = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.22, 1.7), cream);
    wing.position.set(0, -0.1, -0.4);
    wing.rotation.z = 0; wing.castShadow = true;
    this.group.add(wing);
    const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 1.7), orange);
    wingTipL.position.set(-5.2, -0.1, -0.4); this.group.add(wingTipL);
    const wingTipR = wingTipL.clone(); wingTipR.position.x = 5.2; this.group.add(wingTipR);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.1), cream);
    tail.position.set(0, 0.15, 2.5); this.group.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 1.3), orange);
    fin.position.set(0, 0.75, 2.5); this.group.add(fin);
    // Propeller: hub + two blades, spins with throttle. Blades are
    // semi-transparent so a frozen frame never reads as a black stick.
    const propMat = new THREE.MeshStandardMaterial({ color: 0x2b3640, roughness: 0.4, metalness: 0.5, transparent: true, opacity: 0.6 });
    this.prop = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 10), dark);
    hub.rotation.x = Math.PI / 2;
    this.prop.add(hub);
    for (const s of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.1), propMat);
      blade.position.y = s * 1.8;
      this.prop.add(blade);
    }
    this.prop.position.set(0, 0, -3.35);
    this.group.add(this.prop);
    // Prop disc (faint, only visible when spinning fast).
    this.propDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.95, 32),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
    );
    this.propDisc.position.set(0, 0, -3.4);
    this.group.add(this.propDisc);
    // Landing gear: two mains + tail wheel.
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
      strut.position.set(s * 1.1, -0.95, -0.6);
      this.group.add(strut);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(s * 1.1, -1.45, -0.6);
      this.group.add(wheel);
    }
    // Nav lights: red left, green right, white tail — blink in flight.
    this.navL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    this.navL.position.set(-5.35, -0.05, -0.4);
    this.navR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2aff5a }));
    this.navR.position.set(5.35, -0.05, -0.4);
    this.strobe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.strobe.position.set(0, 0.3, 2.85);
    this.group.add(this.navL, this.navR, this.strobe);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);
  }

  // pose: position Vector3, heading math rad (forward = (cos h, 0, -sin h)),
  // pitch rad (nose up +), roll rad (right wing down +). throttle 0..1, time s.
  // cockpit: hide the solid prop blades (from the seat you see only the blur disc).
  update(pose, throttle, t, cockpit = false) {
    this.group.position.copy(pose.pos);
    // Model forward is -Z: yaw by (heading - 90deg) maps -Z onto the heading.
    this.group.rotation.set(0, 0, 0);
    this.group.rotateY(pose.heading - Math.PI / 2);
    this.group.rotateX(pose.pitch);
    this.group.rotateZ(-pose.roll);
    // Frame-rate independent spin: t is absolute seconds.
    const dt = Math.min(0.05, t - (this._lastT ?? t));
    this._lastT = t;
    const spin = 4 + throttle * 46;
    this.prop.rotation.z += spin * dt;
    this.prop.visible = !cockpit;
    // In the seat the prop is a blur you look straight through: hide the disc
    // too, or its 2 m circle fills the whole windscreen from 1.7 m away.
    this.propDisc.visible = !cockpit;
    this.propDisc.material.opacity = throttle > 0.05 ? Math.min(0.22, throttle * 0.3) : 0;
    const blink = (Math.sin(t * 6) > 0.6) ? 1 : 0.15;
    this.strobe.material.color.setScalar(0.4 + blink * 0.6);
    this.navL.material.color.setHex(0xff2a2a);
    this.navR.material.color.setHex(0x2aff5a);
  }
}
