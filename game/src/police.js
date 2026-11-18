// Sunset Harbor — the wanted system and the Harbor Police.
// Stars rise on crimes (stealing, shooting, killing near witnesses) and decay
// when the player stays clean and unseen. Police cruisers spawn, chase, ram,
// and bust the player when they pin them down at low speed.
import * as THREE from 'three';
import { CFG, clamp, angleLerp } from './config.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, colliders, audio) {
    this.scene = scene; this.colliders = colliders; this.audio = audio;
    this.wanted = 0;
    this.cruisers = [];
    this._decayTimer = 0;
    this._sirenTimer = 0;
    this._bustTimer = 0;
    this._flash = 0;
  }

  addHeat(n, reason) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, CFG.maxWanted);
    if (this.wanted > before) { this._decayTimer = 0; return { raised: true, reason }; }
    return { raised: false };
  }

  get wantedCount() { return this.wanted; }

  update(dt, playerPos, playerSpeed, playerInCar, onBusted) {
    // Decay: stay clean and out of sight and the heat fades.
    if (this.wanted > 0) {
      this._decayTimer += dt;
      const nearest = this.cruisers.length ? Math.min(...this.cruisers.map(c => Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z))) : 999;
      if (this._decayTimer > CFG.wantedDecaySeconds && nearest > 30) {
        this.wanted--; this._decayTimer = 0;
      }
    }
    // Spawn cruisers up to the wanted level (1 star = 1 cruiser, up to 5).
    const want = this.wanted >= 4 ? 4 : this.wanted >= 2 ? 3 : this.wanted;
    while (this.cruisers.length < want) {
      const a = Math.random() * Math.PI * 2;
      const x = clamp(playerPos.x + Math.sin(a) * 55, -115, 115);
      const z = clamp(playerPos.z + Math.cos(a) * 55, -115, 115);
      const car = new Car(this.scene, 0x11131a, x, z, a, { police: true, headlight: true });
      this.cruisers.push(car);
    }
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
    // Chase: steer toward the player, ram, and keep pace.
    let close = false;
    for (const c of this.cruisers) {
      const dx = playerPos.x - c.mesh.position.x, dz = playerPos.z - c.mesh.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      c.heading = angleLerp(c.heading, targetHeading, Math.min(1, dt * 2.2));
      const chaseSpeed = Math.min(CFG.carMaxSpeed * (0.82 + this.wanted * 0.05), CFG.carMaxSpeed + 2);
      c.speed = Math.min(chaseSpeed, c.speed + 18 * dt);
      const nx = c.mesh.position.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.mesh.position.z + Math.cos(c.heading) * c.speed * dt;
      const hit = { x: nx, z: nz };
      // Cheap building avoidance: if the next step is inside a building, slide along.
      let blocked = false;
      for (const b of this.colliders) {
        if (nx > b.minX && nx < b.maxX && nz > b.minZ && nz < b.maxZ) { blocked = true; break; }
      }
      if (!blocked) { c.mesh.position.x = nx; c.mesh.position.z = nz; }
      else { c.speed *= 0.5; c.heading += dt * 2; }
      c.mesh.rotation.y = c.heading;
      if (c.mesh.userData.lightbar) {
        this._flash += dt;
        c.mesh.userData.lightbar.material.color.setHex(Math.floor(this._flash * 4) % 2 === 0 ? 0xff2222 : 0x2244ff);
      }
      if (d < 6) close = true;
      // Ram: shove the player's car.
      if (d < 3.4 && playerInCar) {
        playerPos.x += (dx / d) * -1.2; playerPos.z += (dz / d) * -1.2;
      }
    }
    // Siren wail while any cruiser is near.
    this._sirenTimer -= dt;
    if (close && this._sirenTimer <= 0) { this.audio.sirenBurst(); this._sirenTimer = 1.4; }
    // Bust: a cruiser sits on the player while they crawl.
    if (close && Math.abs(playerSpeed) < 2.5 && this.wanted > 0) {
      this._bustTimer += dt;
      if (this._bustTimer > 2.2) { this._bustTimer = 0; onBusted(); }
    } else this._bustTimer = Math.max(0, this._bustTimer - dt * 2);
  }

  clearAll() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers = []; this.wanted = 0; this._bustTimer = 0;
  }

  starString() {
    let s = '';
    for (let i = 0; i < CFG.maxWanted; i++) s += i < this.wanted ? '★' : '☆';
    return s;
  }
}
