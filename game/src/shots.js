// Sunset Harbor — deterministic screenshot poses (?shot=…&seed=1).
// Each pose drops the player into a composed, readable scene with the HUD on:
// start = title over a city vista; drive = driving among traffic; chase =
// police pursuit at 3 stars; mission = a job in progress with its waypoint.
// A bogus ?shot= value is ignored and the game loads normally.
import { MISSIONS } from './config.js';
import { Car } from './vehicles.js';

export function readShot() {
  try {
    const q = new URLSearchParams(window.location.search);
    const shot = q.get('shot');
    const seed = Number(q.get('seed') || 1);
    if (shot && ['start', 'drive', 'chase', 'mission'].includes(shot)) return { shot, seed };
    return null;
  } catch { return null; }
}

// Pose the world for a screenshot. G is the game state built by main.js.
// Returns 'menu' (leave the title screen up) or 'playing'.
export function poseShot(G, shot) {
  const { player, traffic, police, missions, combat, hud, audio } = G;
  if (shot === 'start') {
    // Vista: camera looks down the main avenue toward the sunset and towers.
    G.shotCamera = { pos: [-60, 26, 60], look: [40, 14, -40] };
    return 'menu';
  }
  // All gameplay shots start the game immediately, no pointer lock.
  G.state = 'playing';
  hud.show(true);
  if (shot === 'drive') {
    const car = new Car(G.scene, 0xf1c40f, -20, 45, Math.PI / 2, { headlight: true });
    player.addParkedCar(car);
    player.mesh.position.set(-20, 0, 42);
    player.heading = Math.PI / 2;
    player.car = car; player.mesh.visible = false; car.speed = 16;
    G.shotCamera = null;
    return 'playing';
  }
  if (shot === 'chase') {
    const car = new Car(G.scene, 0xc0392b, 10, 0, Math.PI / 2, { headlight: true });
    player.addParkedCar(car);
    player.mesh.position.set(10, 0, -3);
    player.heading = Math.PI / 2;
    player.car = car; player.mesh.visible = false; car.speed = 22;
    police.addHeat(3, 'screenshot chase');
    // Exactly 3 cruisers: police.update() keeps the count at the wanted level,
    // so these three stay in frame right behind the player.
    for (let i = 0; i < 3; i++) {
      const c = new Car(G.scene, 0x11131a, 10 - (i + 1) * 9, -8 - i * 3, Math.PI / 2, { police: true, headlight: true });
      c.speed = 20;
      police.cruisers.push(c);
    }
    hud.toast('WANTED ★★★ — Lose the Harbor Police!', 6);
    return 'playing';
  }
  if (shot === 'mission') {
    missions.jumpTo(2); // The Harbor Run: delivery across town under heat.
    // Down the central avenue (x = 0) toward the plaza: the widest, clearest
    // stretch, towers on both sides, no palm in the camera line.
    player.mesh.position.set(0, 0, -57);
    player.heading = 0;
    const car = new Car(G.scene, 0x2e86c1, 0, -60, 0, { headlight: true });
    player.addParkedCar(car);
    player.car = car; player.mesh.visible = false; car.speed = 8;
    police.addHeat(2, 'screenshot mission');
    hud.toast('JOB 3 — THE HARBOR RUN: deliver the package to the east docks!', 6);
    return 'playing';
  }
  return 'playing';
}

export { MISSIONS };
