// Sunset Harbor — Mara Voss's four chained jobs, waypoint beacons and rewards.
// The mission controller owns the current objective, the floating waypoint
// marker, and completion checks; main.js feeds it the player state each frame.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export class Missions {
  constructor(scene, save) {
    this.scene = scene;
    this.save = save; // { money, missionIndex, done }
    this.index = save.missionIndex || 0;
    this.phase = 'go'; // go | combat | escape | done
    this.guardsNeeded = 0;
    this.guardsDown = 0;
    this.hasPackage = false;
    this.hasCoupe = false;
    this._beacon = null;
    this._ring = null;
    this._buildBeacon();
    this._refreshObjective();
  }

  get current() { return MISSIONS[this.index] || null; }
  get finished() { return this.index >= MISSIONS.length; }

  _buildBeacon() {
    const geo = new THREE.CylinderGeometry(0.12, 0.12, 26, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.5 });
    this._beacon = new THREE.Mesh(geo, mat);
    this.scene.add(this._beacon);
    const ringGeo = new THREE.RingGeometry(2.2, 3.2, 32);
    this._ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd94a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    this._ring.rotation.x = -Math.PI / 2; this._ring.position.y = 0.15;
    this.scene.add(this._ring);
  }

  _refreshObjective() {
    const m = this.current;
    if (!m) { this._beacon.visible = false; this._ring.visible = false; return; }
    const wp = this.waypoint();
    this._beacon.visible = true; this._ring.visible = true;
    this._beacon.position.set(wp.x, 13, wp.z);
    this._ring.position.set(wp.x, 0.15, wp.z);
  }

  // Remove the beacon meshes (startGame builds a fresh controller each run).
  destroy() {
    this.scene.remove(this._beacon);
    this.scene.remove(this._ring);
  }

  objectiveText() {
    const m = this.current;
    if (!m) return { title: 'Free Roam', text: 'Story complete. Sunset Harbor is yours — explore, steal cars, dodge the police.' };
    if (m.id === 'wheels' && this.hasCoupe) return { title: m.title, text: 'Coupe stolen! Now deliver it to the garage on Coral Row (gold marker).' };
    if (m.id === 'score' && this.phase === 'combat') return { title: m.title, text: `Take down the vault guards (${this.guardsDown}/${this.guardsNeeded}) — then grab the case.` };
    if (m.id === 'score' && this.phase === 'escape') return { title: m.title, text: 'Case grabbed! Escape to Mara’s hideout — gold marker, lose the cops.' };
    if (m.id === 'run' && this.phase === 'go') return { title: m.title, text: 'Deliver the package to the east docks. Harbor patrol is watching…' };
    return { title: m.title, text: m.briefing };
  }

  waypoint() {
    const m = this.current;
    if (!m) return null;
    if (m.id === 'wheels' && this.hasCoupe) return { x: 40, z: 45 };
    if (m.id === 'score' && this.phase === 'escape') return { x: -45, z: -45 };
    return m.target;
  }

  // Called every frame with live state; returns {completed, failed, message} or null.
  update(dt, s) {
    const m = this.current;
    if (!m) return null;
    const wp = this.waypoint();
    const d = Math.hypot(s.playerX - wp.x, s.playerZ - wp.z);
    this._beacon.rotation.y += dt;
    this._beacon.position.y = 13 + Math.sin(performance.now() / 500) * 1.2;
    if (m.id === 'pickup' && d < 4) return this._complete('Package secured.');
    if (m.id === 'wheels') {
      if (!this.hasCoupe && s.stoleCoupe) { this.hasCoupe = true; this._refreshObjective(); return { message: 'Coupe stolen! Deliver it to the garage.', completed: false }; }
      if (this.hasCoupe && s.inCar && d < 6) return this._complete('Coupe delivered.');
    }
    if (m.id === 'run' && d < 5) return this._complete('Package delivered.');
    if (m.id === 'score') {
      if (this.phase === 'go' && d < 8) { this.phase = 'combat'; this.guardsNeeded = 4; this.guardsDown = 0; return { message: 'Guards! Take them down.', completed: false, spawnGuards: true }; }
      if (this.phase === 'combat' && this.guardsDown >= this.guardsNeeded) { this.phase = 'escape'; this._refreshObjective(); return { message: 'Case grabbed! Run to the hideout!', completed: false }; }
      if (this.phase === 'escape' && d < 5) return this._complete('The Big Score — you made it!');
    }
    return null;
  }

  guardDown() { this.guardsDown++; }

  _complete(prefix) {
    const m = this.current;
    this.save.money += m.reward;
    this.save.missionIndex = this.index + 1;
    this.index++;
    this.phase = 'go'; this.hasPackage = false; this.hasCoupe = false;
    this.guardsDown = 0; this.guardsNeeded = 0;
    this._refreshObjective();
    return { completed: true, message: `${prefix} ${m.done}`, reward: m.reward };
  }

  // Shot modes / debug: jump straight to a mission.
  jumpTo(i) {
    this.index = Math.max(0, Math.min(i, MISSIONS.length - 1));
    this.phase = 'go'; this.hasCoupe = false; this.guardsDown = 0;
    this._refreshObjective();
  }
}
