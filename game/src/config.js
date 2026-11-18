// Sunset Harbor — shared tuning, palette, city layout and story data.
// Every system reads from here so the whole game stays in one balance.
export const CFG = {
  worldSize: 250,          // playable square, half-extent 125
  roadGap: 45,             // distance between parallel streets
  roadWidth: 11,
  seaX: -128,              // the sea starts west of this line
  gravity: 26,
  walkSpeed: 7,
  runSpeed: 12,
  jumpSpeed: 9.5,
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 34,
  carReverseMax: 12,
  carTurn: 1.9,
  playerHealth: 100,
  maxWanted: 5,
  wantedDecaySeconds: 22,
  saveKey: 'sunset-harbor-save-v1',
  moneyStart: 250,
};

export const PALETTE = {
  skyTop: 0x2a1650, skyHorizon: 0xff7a3c, sun: 0xffb347,
  sea: 0x14425e, sand: 0xd9b380, asphalt: 0x2b2e38, sidewalk: 0x8d8578,
  buildingGlass: 0xffd27a, grass: 0x3f6b34,
};

export const ROAD_LINES = [-90, -45, 0, 45, 90]; // street centre-lines, both axes

export const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x7d3c98, 0x1abc9c, 0xe67e22, 0xecf0f1, 0x2c3e50, 0xd35400, 0x16a085];

// Mara Voss, the fixer, hands out four chained jobs. Each job is:
// id, title, briefing, waypoint (world x,z), kind, reward, and what completes it.
export const MISSIONS = [
  {
    id: 'pickup', title: 'Job 1 — The Pickup',
    briefing: 'Mara Voss needs a package lifted from the pier courier. Get to the gold marker at the west pier — no trouble, no heat.',
    target: { x: -108, z: -78 }, kind: 'reach', reward: 400,
    done: 'Package secured. Mara is impressed — $400 in your pocket.',
  },
  {
    id: 'wheels', title: 'Job 2 — Hot Wheels',
    briefing: 'Mara needs a getaway car: a coral-red coupe parked by the marina. Steal it (F) and bring it to the garage on Coral Row.',
    target: { x: -100, z: 40 }, kind: 'steal-deliver', reward: 650,
    done: 'Coupe delivered clean. Mara pays $650 — and the cops never knew.',
  },
  {
    id: 'run', title: 'Job 3 — The Harbor Run',
    briefing: 'The package has to cross town to the east docks — and harbor patrol is watching. Deliver it fast, and lose the heat on the way.',
    target: { x: 96, z: 84 }, kind: 'deliver', reward: 900,
    done: 'Delivery made under their noses. $900. You are Harbor royalty now.',
  },
  {
    id: 'score', title: 'Job 4 — The Big Score',
    briefing: 'One last job: the Harbor Trust vault case is guarded at the plaza. Take the guards down, grab the case, and escape to Mara’s hideout.',
    target: { x: 0, z: 0 }, kind: 'combat-escape', reward: 2000,
    done: 'THE BIG SCORE! $2,000. Sunset Harbor is yours, kid. Story complete — free roam forever.',
  },
];

export const STORY_INTRO =
  'Sunset Harbor — a sun-soaked port city where the tide brings in everything: fish, freight, and trouble. ' +
  'You are a nobody with a borrowed jacket and $250. Mara Voss, the fixer who runs the harbor from a back-room office, ' +
  'has four jobs for you. Run them clean, stay ahead of the Harbor Police, and the city is yours.';

// Deterministic seeded random so screenshot scenes pose the same way every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
