// Tradewind Courier — deterministic poses for screenshots: ?shot=start|play|
// rings|cockpit|land&seed=N. The game itself renders these states in a browser;
// nothing is edited or composited afterwards. Used by shots.json and by hand.
import { MISSIONS } from './config.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  const seed = Number(q.get('seed') || '1') || 1;
  return { shot, seed };
}

// Put the game in the named pose and return the mission to start.
export function poseForShot(game, shot) {
  const dusk = MISSIONS[1]; // Sunset Mail: prettiest light for the cover
  const first = MISSIONS[0];
  switch (shot) {
    case 'start':
      return { mission: first, pose: 'menu' };
    case 'play': {
      // Mid-course: gate 4 of Sunset Mail dead ahead, Palm Isle beyond, the
      // low dusk sun behind the camera so the plane's lit side faces us.
      return {
        mission: dusk,
        pose: 'fly',
        place: { x: 800, y: 140, z: -350, heading: 70, pitch: -0.02, roll: 0.15, speed: 62, throttle: 0.72, gateIndex: 4 },
      };
    }
    case 'rings': {
      // Right behind a gate, ring dead ahead, sea and Gull Rock beyond.
      return {
        mission: first,
        pose: 'fly',
        place: { x: -420, y: 105, z: -260, heading: 250, pitch: 0.02, roll: -0.12, speed: 58, throttle: 0.68, gateIndex: 1 },
      };
    }
    case 'cockpit': {
      // Final approach in cockpit view: runway 27 ahead, instruments lit.
      return {
        mission: first,
        pose: 'fly',
        place: { x: 620, y: 55, z: -350, heading: 270, pitch: -0.06, roll: 0, speed: 48, throttle: 0.35, gateIndex: 4 },
        camera: 'cockpit',
      };
    }
    case 'land': {
      // Short final to Palm Isle's runway 14, gear down, threshold lights
      // ahead, dusk light. Over the sea north-east of Palm Isle, so the plane
      // reads against the sky and the strip is dead ahead (HUD agrees: RWY 14).
      return {
        mission: dusk,
        pose: 'fly',
        place: { x: 1250, y: 45, z: -1336, heading: 140, pitch: -0.07, roll: 0.04, speed: 44, throttle: 0.3, gateIndex: 6 },
      };
    }
    default:
      return { mission: first, pose: 'menu' };
  }
}
