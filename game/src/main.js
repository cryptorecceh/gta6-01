// Sunset Harbor — bootstrap, game loop, camera, state machine and saves.
// States: menu → playing ⇄ paused → gameover → menu. Screenshot poses come
// from shots.js; everything else (world, traffic, police, missions, combat)
// lives in its own module and is wired together here.
import * as THREE from 'three';
import { CFG, STORY_INTRO, clamp, angleLerp } from './config.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildWorld } from './world.js';
import { Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Player } from './player.js';
import { Hud, showMenu, hideMenu } from './hud.js';
import { readShot, poseShot } from './shots.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(-60, 26, 60);

const G = {
  scene, camera, state: 'menu', shotCamera: null,
  save: loadSave(), input: new Input(canvas), audio: new AudioEngine(),
  hud: new Hud(), clock: new THREE.Clock(),
};
const world = buildWorld(scene);
G.colliders = world.colliders;
G.landmarks = world.landmarks;
G.player = new Player(scene, G.colliders, G.audio);
G.traffic = new Traffic(scene, G.colliders);
G.police = new Police(scene, G.colliders, G.audio);
G.missions = new Missions(scene, G.save);
G.combat = new Combat(scene, G.audio);
G.cameraYaw = 0; G.cameraPitch = 0.25; G.cameraDist = 9;

// Parked cars around the city, free to enter with E.
const parkedSpots = [
  [0xe67e22, -42, -3], [0x2e86c1, 48, 3], [0xecf0f1, 3, -48],
  [0x7d3c98, -3, 93], [0x16a085, 93, -3], [0xd35400, -48, 48],
];
for (const [color, x, z] of parkedSpots) {
  const car = new Car(scene, color, x, z, (x + z) % 2 === 0 ? 0 : Math.PI / 2, { headlight: true });
  G.player.addParkedCar(car);
}
// The coral-red coupe for Job 2, parked by the marina.
const coupe = new Car(scene, 0xff5a4e, -100, 40, Math.PI / 2, { headlight: true });
G.player.addParkedCar(coupe);
G.coupe = coupe;

function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return { money: CFG.moneyStart, missionIndex: 0, done: false };
    const s = JSON.parse(raw);
    return {
      money: typeof s.money === 'number' ? s.money : CFG.moneyStart,
      missionIndex: typeof s.missionIndex === 'number' ? s.missionIndex : 0,
      done: !!s.done,
    };
  } catch { return { money: CFG.moneyStart, missionIndex: 0, done: false }; }
}

function persistSave() {
  try { localStorage.setItem(CFG.saveKey, JSON.stringify(G.save)); } catch { /* private mode */ }
}

// ---- menu / state flow ----
function startGame(fresh) {
  if (fresh) { G.save = { money: CFG.moneyStart, missionIndex: 0, done: false }; persistSave(); }
  G.missions.destroy();
  G.missions = new Missions(scene, G.save);
  G.player.reset(-38, -38);
  G.police.clearAll();
  G.combat.clearEnemies();
  G.player.health = CFG.playerHealth;
  G.state = 'playing';
  hideMenu();
  G.hud.show(true);
  G.audio.ensure();
  const obj = G.missions.objectiveText();
  G.hud.toast(obj.title + ' — ' + obj.text, 5);
}

function gameOver(reason) {
  G.state = 'gameover';
  G.input.unlockPointer();
  G.audio.busted();
  G.police.clearAll();
  persistSave();
  G.hud.show(false);
  showMenu(null, 'gameover', {
    reason, money: G.save.money, missionsDone: Math.min(G.save.missionIndex, 4),
    onRetry: () => startGame(false),
    onMenu: () => showMainMenu(),
  });
}

function showMainMenu() {
  G.state = 'menu';
  G.input.unlockPointer();
  G.hud.show(false);
  const hasSave = G.save.missionIndex > 0 || G.save.money !== CFG.moneyStart;
  showMenu(null, 'start', {
    intro: STORY_INTRO, hasSave,
    saveMoney: G.save.money, saveMission: G.save.missionIndex,
    onNew: () => startGame(true),
    onContinue: () => startGame(false),
  });
}

function pauseGame() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  G.input.unlockPointer();
  persistSave();
  showMenu(null, 'pause', {
    money: G.save.money, mission: G.save.missionIndex, wanted: G.police.wanted,
    onResume: () => { G.state = 'playing'; hideMenu(); },
    onQuit: () => showMainMenu(),
  });
}

// ---- input wiring ----
G.input.onPauseKey = () => {
  if (G.state === 'playing') pauseGame();
  else if (G.state === 'paused') { G.state = 'playing'; hideMenu(); }
};
G.input.onInteractKey = () => {
  if (G.state !== 'playing') return;
  const r = G.player.tryEnterCar();
  if (r?.entered) { G.audio.pickup(); G.hud.toast('You are driving. W/S to drive, E to get out.'); }
  else if (r?.exited) G.hud.toast('On foot. Find a car and press E — or F to steal one.');
};
G.input.onStealKey = () => {
  if (G.state !== 'playing' || G.player.inCar) return;
  const r = G.player.trySteal(G.traffic, G.coupe);
  if (r?.stolen) {
    G.police.addHeat(1, 'stole a car');
    G.audio.pickup();
    if (r.mission) G.missions.hasCoupe = true;
    G.hud.toast(r.mission ? 'That is Mara’s coupe! Deliver it to the garage.' : 'Car stolen! The Harbor Police noticed — ★', 4);
  } else G.hud.toast('No car close enough to steal. Get nearer and press F.');
};
G.input.onReloadKey = () => { if (G.state === 'playing' && G.combat.reload()) G.hud.toast('Reloaded.'); };
G.input.onMuteKey = () => { G.audio.setMuted(!G.audio.muted); G.hud.toast(G.audio.muted ? 'Sound off.' : 'Sound on.'); };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- shooting ----
const _rayDir = new THREE.Vector3();
function playerShoot() {
  const p = G.player;
  const from = p.pos.clone(); from.y = p.inCar ? 1.4 : 1.6;
  camera.getWorldDirection(_rayDir);
  const res = G.combat.shoot(from, _rayDir.clone(), () => {
    G.missions.guardDown();
    G.hud.toast('Guard down!');
  });
  if (res?.hit) { /* kill handled in callback */ }
  if (res && !res.hit) { /* miss: nothing */ }
  if (G.combat.ammo === 0) G.hud.toast('Out of ammo — press R to reload.');
}

// ---- main loop ----
let _lastShotCheck = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(G.clock.getDelta(), 0.05);
  const p = G.player;

  if (G.state === 'playing') {
    // Foot / driving update.
    p.update(dt, G.input, G.traffic, null, null);
    // Read the trigger exactly once per frame: holding fires, a click fires once.
    const clicked = G.input.consumeClick();
    const firing = G.input.firing || clicked;
    const gunfire = firing ? p.pos : null;
    if (firing && !p.inCar) playerShoot();

    // Traffic + pedestrians, police, missions, combat.
    G.traffic.update(dt, p.pos, gunfire);
    const busted = { v: false };
    G.police.update(dt, p.pos, p.speed, p.inCar, () => { busted.v = true; });
    if (busted.v) { gameOver('BUSTED by the Harbor Police'); return; }
    const mres = G.missions.update(dt, {
      playerX: p.pos.x, playerZ: p.pos.z, inCar: p.inCar, stoleCoupe: G.missions.hasCoupe || p.car === G.coupe,
    });
    if (mres) {
      if (mres.spawnGuards) { G.combat.spawnEnemies(G.landmarks.plaza.x, G.landmarks.plaza.z, 4); G.police.addHeat(2, 'vault job'); }
      if (mres.completed) {
        G.audio.missionDone(); G.audio.cash(); persistSave();
        G.hud.toast(`★ ${mres.message}  (+$${mres.reward})`, 5);
      } else if (mres.message) G.hud.toast(mres.message, 4);
    }
    // Enemy return fire can kill the player.
    G.combat.update(dt, p.pos, p.health, (dmg) => {
      p.health -= dmg; G.audio.hurt();
      if (p.health <= 0) { gameOver('Taken down in the streets'); }
    });
    // Health regen, slow, only when not wanted.
    if (G.police.wanted === 0 && p.health > 0 && p.health < CFG.playerHealth) p.health = Math.min(CFG.playerHealth, p.health + dt * 2);
    // Engine sound follows speed.
    G.audio.setEngine(Math.abs(p.speed) / CFG.carMaxSpeed, p.inCar);
    // Wanted stars from gunfire near witnesses.
    _lastShotCheck += dt;
    if (gunfire && _lastShotCheck > 1.5) {
      _lastShotCheck = 0;
      G.police.addHeat(1, 'gunfire');
      G.hud.toast('Gunfire! Wanted level rising…', 2.5);
    }
    updateCamera(dt);
    const obj = G.missions.objectiveText();
    const wp = G.missions.waypoint();
    G.hud.update(dt, {
      money: G.save.money, health: p.health, missionLabel: 'Job ' + (G.missions.finished ? '4/4 ✓' : (G.missions.index + 1) + '/4'),
      stars: G.police.starString(), wanted: G.police.wanted,
      objTitle: obj.title, objText: obj.text,
      speedMph: p.inCar ? p.car.speedMph : 0, inCar: p.inCar,
      showCrosshair: !p.inCar, waypoint: wp,
      police: G.police.cruisers.map(c => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
      enemies: G.combat.enemies.map(e => ({ x: e.mesh.position.x, z: e.mesh.position.z })),
      playerX: p.pos.x, playerZ: p.pos.z, heading: p.heading,
    });
    if (G.state !== 'playing') return;
  } else if (G.state === 'menu' && G.shotCamera) {
    // Title-screen vista: slow orbit over the city.
    const t = performance.now() / 1000;
    camera.position.set(-60 + Math.sin(t * 0.05) * 8, 26, 60 + Math.cos(t * 0.05) * 8);
    camera.lookAt(40, 14, -40);
  } else if (G.state === 'menu') {
    const t = performance.now() / 1000;
    camera.position.set(-60 + Math.sin(t * 0.05) * 8, 26, 60);
    camera.lookAt(0, 10, 0);
  }
  // Idle world motion keeps the menu alive behind the title.
  if (G.state !== 'playing') {
    G.traffic.update(dt, null, null);
  }
  renderer.render(scene, camera);
}

function updateCamera(dt) {
  const p = G.player;
  const look = G.input.consumeLook();
  if (p.inCar) {
    G.cameraYaw = angleLerp(G.cameraYaw, p.car.heading, Math.min(1, dt * 4));
    const back = 12.5, up = 5.2;
    const tx = p.pos.x - Math.sin(G.cameraYaw) * back;
    const tz = p.pos.z - Math.cos(G.cameraYaw) * back;
    camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (up - camera.position.y) * Math.min(1, dt * 6);
    camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 6);
    camera.lookAt(p.pos.x + Math.sin(G.cameraYaw) * 6, 1.6, p.pos.z + Math.cos(G.cameraYaw) * 6);
  } else {
    G.cameraYaw = p.heading;
    const back = 7.5, up = 3.4 + p.pitch * 3;
    const tx = p.pos.x - Math.sin(p.heading) * back;
    const tz = p.pos.z - Math.cos(p.heading) * back;
    camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 10);
    camera.position.y += (up - camera.position.y) * Math.min(1, dt * 10);
    camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 10);
    camera.lookAt(p.pos.x, 1.5, p.pos.z);
  }
}

// ---- boot: screenshot pose or the title screen ----
const shot = readShot();
if (shot) {
  const mode = poseShot(G, shot.shot);
  if (mode === 'menu') showMainMenu();
  else { G.audio.ensure(); }
  // Keep the menu hidden for gameplay shots; title stays for ?shot=start.
  if (shot.shot !== 'start') hideMenu();
} else {
  showMainMenu();
}
animate();

// Expose a tiny debug handle for play-testing (no network, no cheating UI).
window.__sunsetHarbor = { G, startGame, gameOver };
