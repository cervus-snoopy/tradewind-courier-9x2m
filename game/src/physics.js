// Tradewind Courier — arcade flight model with just enough discipline to be a
// game: throttle and turns matter, stalls bite, fuel runs out, landings are judged.
// State lives here; the renderer only reads pose. Angles: heading 0 = facing +X
// (runway 09), increasing counter-clockwise seen from above; pitch + = nose up.
import * as THREE from 'three';
import { TUNE, WORLD } from './config.js';
import { clamp, wrapAngle } from './random.js';

export class FlightModel {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = TUNE.tank;
    this.hull = 100;
    this.onGround = true;
    this.verticalSpeed = 0;
    this.stalled = false;
    this.engineOut = false;
  }

  reset(start, fuel) {
    this.pos.set(start.x, start.y, start.z);
    // Snap onto the strip surface: a spawn a hair above the ground would read
    // as airborne and stall-drop into a crash on the first frames.
    this.pos.y = this.world.terrainHeight(start.x, start.z) + 1.5;
    // Compass heading h (0 = north/-Z, 90 = east/+X) to math heading:
    // forward = (cos t, 0, -sin t), so t = (90 - h) degrees.
    this.heading = ((90 - start.heading) * Math.PI) / 180;
    this.speed = 0; this.throttle = 0;
    this.fuel = fuel; this.hull = 100;
    this.onGround = true; this.verticalSpeed = 0;
    this.stalled = false; this.engineOut = false;
  }

  headingDeg() {
    // Math heading (0 = +X/east) back to compass degrees (0 = north/-Z, clockwise).
    const deg = (90 - (this.heading * 180) / Math.PI) % 360;
    return (deg + 360) % 360;
  }

  // input: { throttleUp, throttleDown, pitch, roll, rudder, brake } (from Input).
  // wind: { from (deg wind blows FROM), speed m/s, gust }. dt seconds.
  // Returns events: { touchedDown, hardLanding, crashed, reason } (at most one set).
  step(input, wind, dt) {
    const events = {};
    // --- throttle ---
    const target = this.throttle + ((input.throttleUp ? 1 : 0) - (input.throttleDown ? 1 : 0)) * dt * 0.7;
    this.throttle = clamp(target, 0, 1);
    if (this.engineOut) this.throttle = 0;
    // --- fuel ---
    if (!this.onGround || this.speed > 1) {
      this.fuel -= (TUNE.fuelBase + TUNE.fuelBurn * this.throttle) * dt;
      if (this.fuel <= 0) { this.fuel = 0; if (!this.engineOut) { this.engineOut = true; events.fuelEmpty = true; } }
    }
    // --- attitude ---
    const pitchTarget = clamp(input.pitch * 0.5, -0.42, 0.5);
    this.pitch += (pitchTarget - this.pitch) * Math.min(1, dt * 3.2);
    const rollTarget = clamp(input.roll * 0.85, -1.1, 1.1);
    this.roll += (rollTarget - this.roll) * Math.min(1, dt * 3.5);
    if (Math.abs(input.roll) < 0.05) this.roll *= Math.max(0, 1 - TUNE.autoLevel * dt);
    // Coordinated turn: heading follows bank; rudder adds a little direct yaw.
    const turnRate = -Math.tan(this.roll) * 9.81 / Math.max(22, this.speed);
    this.heading = wrapAngle(this.heading + (turnRate + input.rudder * TUNE.rudderRate * 0.4) * dt);
    // --- speed ---
    const thrust = this.throttle * TUNE.accel * (this.onGround ? 1.6 : 1);
    const drag = TUNE.dragK * this.speed * this.speed + (input.brake ? 6 : 0) + (this.onGround ? 1.2 : 0);
    this.speed = Math.max(0, this.speed + (thrust - drag) * dt);
    if (this.speed > TUNE.maxSpeed) this.speed = TUNE.maxSpeed;
    // --- stall ---
    this.stalled = !this.onGround && this.speed < TUNE.stallSpeed;
    // --- velocity ---
    // Wind: `from` is the compass direction the wind blows FROM; the air moves
    // toward from+180. Compass c maps to (x, z) = (sin c, -cos c).
    const windNow = wind.speed + (wind.gust ? Math.sin(performance.now() / 1700) * wind.gust : 0);
    const windToward = ((wind.from + 180) * Math.PI) / 180;
    const wx = Math.sin(windToward) * windNow, wz = -Math.cos(windToward) * windNow;
    const climb = this.onGround ? 0 : this.speed * Math.sin(this.pitch) * 0.92;
    const sink = this.stalled ? (TUNE.stallSpeed - this.speed) * 0.55 : 0;
    this.verticalSpeed = climb - sink;
    const vx = Math.cos(this.heading) * this.speed + wx * (this.onGround ? 0.15 : 0.6);
    const vz = -Math.sin(this.heading) * this.speed + wz * (this.onGround ? 0.15 : 0.6);
    this.pos.x += vx * dt;
    this.pos.z += vz * dt;
    this.pos.y += this.verticalSpeed * dt;
    // --- ground / terrain / water ---
    const ground = this.world.terrainHeight(this.pos.x, this.pos.z);
    const gearY = ground + 1.5;
    // Air-to-ground transition: the takeoff roll starts on the strip and
    // re-enters the touchdown branch every frame, so a landing event must
    // only fire when the plane was actually airborne.
    const wasAirborne = !this.onGround;
    if (this.pos.y <= gearY) {
      const strip = this.world.stripAt(this.pos.x, this.pos.z);
      const vy = this.verticalSpeed;
      if (strip && Math.abs(vy) < 4.5 && this.speed < 52) {
        // Touchdown on a strip.
        this.pos.y = strip.elevation + 1.5;
        this.onGround = true;
        this.pitch *= 0.4; this.roll *= 0.3;
        if (wasAirborne) events.touchedDown = { strip, soft: Math.abs(vy) < 2.2, vy };
      } else if (this.onGround && this.speed < TUNE.rotateSpeed && Math.abs(this.pitch) < 0.15) {
        // Rolling along the ground (takeoff roll or taxi).
        this.pos.y = gearY;
        this.onGround = true;
      } else if (ground > 0.5 && Math.abs(vy) < 3 && this.speed < 40) {
        // Rough field landing.
        this.pos.y = gearY;
        this.onGround = true;
        this.pitch *= 0.4; this.roll *= 0.3;
        if (wasAirborne) events.roughLanding = { vy };
      } else if (this.onGround && this.speed >= TUNE.rotateSpeed && this.pitch > 0.08) {
        // Liftoff: rotate and climb away.
        this.onGround = false;
      } else {
        // Impact.
        events.crashed = { reason: ground <= 0.5 ? 'Ditched in the sea' : 'Hit the terrain' };
      }
      // Leaving the ground: enough speed and a pull on the stick.
      if (this.onGround && this.speed >= TUNE.rotateSpeed && this.pitch > 0.12) {
        this.onGround = false;
        this.pos.y = gearY + 0.5;
      }
    } else {
      this.onGround = false;
    }
    // World edge: turn back gently instead of flying into the void.
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > 3400) {
      const back = Math.atan2(-this.pos.z, -this.pos.x);
      this.heading = wrapAngle(this.heading + wrapAngle(back - this.heading) * dt * 0.8);
      events.edge = true;
    }
    return events;
  }

  // Distance to a point, and whether the plane just crossed a gate's plane
  // inside its radius. Call every frame with the next gate.
  crossedGate(gate, prevPos) {
    const dx = this.pos.x - gate.x, dy = this.pos.y - gate.y, dz = this.pos.z - gate.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > TUNE.ringRadius + 6) return false;
    // Crossing check: previous frame on one side of the gate plane, now the other.
    // Gate faces its previous waypoint; approximate the plane by distance shrink:
    const pdx = prevPos.x - gate.x, pdy = prevPos.y - gate.y, pdz = prevPos.z - gate.z;
    const prevDist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
    return dist < TUNE.ringRadius && prevDist > dist;
  }
}
