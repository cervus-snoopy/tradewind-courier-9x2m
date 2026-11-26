// Tradewind Courier — tuning constants and the five mail routes.
// Units: metres, seconds, metres per second. HUD converts to knots / feet.

export const TUNE = {
  maxSpeed: 85,        // m/s, full throttle level flight (~165 kt)
  cruiseSpeed: 62,     // m/s, comfortable cruise
  stallSpeed: 26,      // m/s, below this the wing quits
  rotateSpeed: 30,     // m/s, enough lift to leave the strip
  maxClimb: 9,         // m/s vertical at best climb
  accel: 16,           // m/s^2 at full throttle on the ground
  dragK: 0.0021,       // quadratic drag, tuned so top speed ~ maxSpeed
  pitchRate: 0.85,     // rad/s at full elevator
  rollRate: 1.7,       // rad/s at full aileron
  rudderRate: 0.35,    // rad/s at full rudder
  autoLevel: 0.55,     // roll damping toward wings level, 1/s
  fuelBurn: 0.55,      // fuel units per second at full throttle
  fuelBase: 0.05,      // fuel units per second at idle
  tank: 100,           // fuel units
  ringScore: 100,      // points per gate
  landingMax: 500,     // points for a perfect touchdown
  timeBonusRate: 2,    // points per second under par
  fuelBonusRate: 3,    // points per fuel unit left
  hardLandingDamage: 30,
  roughLandingDamage: 15,
  ringRadius: 18,      // metres, gate torus radius
};

// World layout: one archipelago, three islands, two strips.
export const WORLD = {
  seaLevel: 0,
  mainIsland: { x: 0, z: 0, radius: 950, height: 95 },
  palmIsle: { x: 1700, z: -800, radius: 480, height: 55 },
  gullRock: { x: -1500, z: 1000, radius: 220, height: 90 },
  // Home strip: along X, heading 090 / 270. Palm strip: heading 140.
  homeStrip: { x: 0, z: -350, length: 700, width: 34, elevation: 6, heading: 90 },
  palmStrip: { x: 1700, z: -800, length: 420, width: 26, elevation: 4, heading: 140 },
};

// A route: name, light, wind, fuel, gates, start pose, destination strip, par time, medals.
export const MISSIONS = [
  {
    id: 0, name: 'FIRST FLIGHT', desc: '4 gates home · calm air · full tank',
    brief: 'Gentle first run: thread four gates over the bay and put her down on runway 27.',
    light: 'day', wind: { from: 270, speed: 0, gust: 0 }, fuel: 100,
    start: { x: 330, y: 8, z: -350, heading: 270 },
    gates: [
      { x: -100, y: 80, z: -450 }, { x: -600, y: 100, z: -100 },
      { x: -500, y: 90, z: 400 }, { x: 100, y: 70, z: 350 },
    ],
    dest: 'home', par: 150, medals: { gold: 1050, silver: 850, bronze: 650 },
  },
  {
    id: 1, name: 'SUNSET MAIL', desc: '6 gates to Palm Isle · dusk · crosswind 12 kt',
    brief: 'The evening post to Palm Isle. Six gates, a crosswind off the sea, and the sun going down.',
    light: 'dusk', wind: { from: 200, speed: 6, gust: 2 }, fuel: 100,
    start: { x: 330, y: 8, z: -350, heading: 270 },
    gates: [
      { x: -100, y: 80, z: -450 }, { x: -700, y: 110, z: -200 },
      { x: -200, y: 100, z: 300 }, { x: 600, y: 90, z: -100 },
      { x: 1200, y: 80, z: -500 }, { x: 1500, y: 60, z: -700 },
    ],
    dest: 'palm', par: 210, medals: { gold: 1300, silver: 1050, bronze: 800 },
  },
  {
    id: 2, name: 'STORM RUNNER', desc: '8 gates round Gull Rock · rain · gusts 25 kt',
    brief: 'A squall is sitting on Gull Rock. Eight gates in the rain — hold your line and watch the fuel.',
    light: 'storm', wind: { from: 320, speed: 11, gust: 6 }, fuel: 85,
    start: { x: 330, y: 8, z: -350, heading: 270 },
    gates: [
      { x: -200, y: 90, z: -200 }, { x: -800, y: 110, z: 200 },
      { x: -1300, y: 120, z: 700 }, { x: -1500, y: 130, z: 1150 },
      { x: -1100, y: 110, z: 1350 }, { x: -600, y: 100, z: 1100 },
      { x: -300, y: 90, z: 700 }, { x: 100, y: 70, z: 350 },
    ],
    dest: 'home', par: 300, medals: { gold: 1600, silver: 1300, bronze: 1000 },
  },
  {
    id: 3, name: 'ISLAND HOP', desc: 'Two landings · home to Palm Isle and back',
    brief: 'Two legs, two landings: drop the Palm Isle mail, refuel, and bring the home post back.',
    light: 'day', wind: { from: 180, speed: 4, gust: 1 }, fuel: 100,
    start: { x: 330, y: 8, z: -350, heading: 270 },
    gates: [
      { x: -100, y: 80, z: -450 }, { x: 500, y: 100, z: -100 },
      { x: 1100, y: 90, z: -500 }, { x: 1500, y: 60, z: -700 },
    ],
    dest: 'palm', returnLeg: true, par: 330,
    medals: { gold: 1900, silver: 1550, bronze: 1200 },
  },
  {
    id: 4, name: 'NIGHT OWL', desc: '7 gates by night · lit strip · instruments',
    brief: 'The night mail. Seven glowing gates, a lit strip, and nothing but your instruments between them.',
    light: 'night', wind: { from: 250, speed: 3, gust: 1 }, fuel: 100,
    start: { x: 330, y: 8, z: -350, heading: 270 },
    gates: [
      { x: -200, y: 90, z: -400 }, { x: -700, y: 110, z: -100 },
      { x: -400, y: 100, z: 400 }, { x: 200, y: 90, z: 500 },
      { x: 800, y: 100, z: 100 }, { x: 500, y: 80, z: -300 },
      { x: 100, y: 70, z: 350 },
    ],
    dest: 'home', par: 270, medals: { gold: 1500, silver: 1200, bronze: 900 },
  },
];

export const FREE_FLIGHT = {
  id: 5, name: 'FREE FLIGHT', desc: 'No gates · no clock · just the sky',
  brief: 'No gates, no clock. Take her up, buzz the islands, and practise your landings.',
  light: 'day', wind: { from: 270, speed: 2, gust: 1 }, fuel: 100,
  start: { x: 330, y: 8, z: -350, heading: 270 },
  gates: [], dest: 'home', par: 0, medals: { gold: 0, silver: 0, bronze: 0 },
};

// Lighting presets: sky, fog, sun, ambient.
export const LIGHTING = {
  day:   { sky: 0x87b5d6, horizon: 0xcfe5ef, fog: [0xcfe5ef, 900, 5200], sun: 0xfff2d8, sunI: 1.15, hemi: 0xbfd9e8, hemiI: 0.75, sunPos: [800, 900, 400], cloud: 0xffffff },
  dusk:  { sky: 0x5a5a8a, horizon: 0xff9e5e, fog: [0xe8976a, 700, 4200], sun: 0xffb36b, sunI: 1.0, hemi: 0xe8a06a, hemiI: 0.7, sunPos: [-900, 220, 600], cloud: 0xffd9b0 },
  storm: { sky: 0x4a5560, horizon: 0x7d8894, fog: [0x7d8894, 250, 2400], sun: 0xd8dee8, sunI: 0.7, hemi: 0x8a97a3, hemiI: 0.6, sunPos: [500, 800, -300], cloud: 0x9aa5b0 },
  night: { sky: 0x0a1226, horizon: 0x1c2f52, fog: [0x1c2f52, 400, 3600], sun: 0xbfd0ff, sunI: 0.35, hemi: 0x33456e, hemiI: 0.4, sunPos: [-600, 700, 200], cloud: 0x5a6a8a },
};
