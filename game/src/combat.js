// Sunset Harbor — combat: hitscan shooting with tracers and muzzle flash,
// enemy gunmen who fight back, hit particles, and player/enemy health.
import * as THREE from 'three';
import { clamp, mulberry32 } from './config.js';

export class Combat {
  constructor(scene, audio) {
    this.scene = scene; this.audio = audio;
    this.ammo = 12; this.ammoMax = 12;
    this._cool = 0; this._tracers = []; this._particles = [];
    this.enemies = [];
    this._enemyCool = 0;
    this._muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 })
    );
    scene.add(this._muzzle);
  }

  reload() {
    if (this.ammo === this.ammoMax) return false;
    this.ammo = this.ammoMax;
    return true;
  }

  spawnEnemies(x, z, n) {
    const rand = mulberry32(99 + n * 7 + Math.floor(x));
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.15, 8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      body.position.y = 1.0; body.castShadow = true; g.add(body);
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.4), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
      vest.position.y = 1.15; g.add(vest);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), new THREE.MeshLambertMaterial({ color: 0xc98a5a }));
      head.position.y = 1.82; g.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.3, 1.3, 0.4); g.add(gun);
      const a = rand() * Math.PI * 2;
      g.position.set(x + Math.sin(a) * (4 + rand() * 6), 0, z + Math.cos(a) * (4 + rand() * 6));
      this.scene.add(g);
      this.enemies.push({ mesh: g, hp: 3, shootTimer: 1 + rand() * 2, strafe: rand() < 0.5 ? 1 : -1 });
    }
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  // Fire one hitscan shot from `from` along `dir`. Returns hit info.
  shoot(from, dir, onKill) {
    if (this._cool > 0 || this.ammo <= 0) return null;
    this._cool = 0.22; this.ammo--;
    this.audio.gunshot();
    this._muzzle.position.copy(from).addScaledVector(dir, 0.9);
    this._muzzle.material.opacity = 1;
    const end = from.clone().addScaledVector(dir, 60);
    let hitEnemy = null, hitD = 60;
    for (const e of this.enemies) {
      const to = new THREE.Vector3().subVectors(e.mesh.position, from);
      to.y = 0;
      const along = to.dot(dir);
      if (along < 0 || along > 60) continue;
      const perp = to.clone().addScaledVector(dir, -along).length();
      if (perp < 1.1 && along < hitD) { hitD = along; hitEnemy = e; }
    }
    if (hitEnemy) {
      end.copy(from).addScaledVector(dir, hitD);
      hitEnemy.hp--;
      this._burst(end, 0xff5544);
      if (hitEnemy.hp <= 0) {
        this.scene.remove(hitEnemy.mesh);
        this.enemies.splice(this.enemies.indexOf(hitEnemy), 1);
        onKill?.(hitEnemy);
      }
    }
    this._addTracer(from.clone(), end);
    return { hit: !!hitEnemy, dist: hitD };
  }

  _addTracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this._tracers.push({ line, life: 0.12 });
  }

  _burst(p, color) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshBasicMaterial({ color }));
      m.position.copy(p);
      m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8);
      this.scene.add(m);
      this._particles.push({ mesh: m, life: 0.5 });
    }
  }

  skidMark(x, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z);
    this.scene.add(m);
    this._particles.push({ mesh: m, life: 9, fade: true });
  }

  update(dt, playerPos, playerHealth, onPlayerHit) {
    this._cool = Math.max(0, this._cool - dt);
    this._muzzle.material.opacity = Math.max(0, this._muzzle.material.opacity - dt * 8);
    for (const t of [...this._tracers]) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.12);
      if (t.life <= 0) { this.scene.remove(t.line); this._tracers.splice(this._tracers.indexOf(t), 1); }
    }
    for (const p of [...this._particles]) {
      p.life -= dt;
      if (p.fade) { p.mesh.material.opacity = clamp(p.life / 9, 0, 0.55); p.mesh.position.y = 0.06; }
      else p.mesh.position.addScaledVector(p.mesh.userData.v, dt);
      if (p.life <= 0) { this.scene.remove(p.mesh); this._particles.splice(this._particles.indexOf(p), 1); }
    }
    // Enemies strafe, close in, and shoot back.
    this._enemyCool -= dt;
    for (const e of this.enemies) {
      const dx = playerPos.x - e.mesh.position.x, dz = playerPos.z - e.mesh.position.z;
      const d = Math.hypot(dx, dz) || 1;
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (d > 9) { e.mesh.position.x += (dx / d) * 3.2 * dt; e.mesh.position.z += (dz / d) * 3.2 * dt; }
      else { e.mesh.position.x += Math.cos(e.mesh.rotation.y) * e.strafe * 1.6 * dt; e.mesh.position.z -= Math.sin(e.mesh.rotation.y) * e.strafe * 1.6 * dt; }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 34) {
        e.shootTimer = 1.1 + Math.random() * 1.2;
        this.audio.enemyShot();
        const from = e.mesh.position.clone(); from.y = 1.4;
        const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
        const dir = to.clone().sub(from).normalize();
        this._addTracer(from, to);
        if (Math.random() < 0.45) onPlayerHit(6 + Math.floor(Math.random() * 7));
      }
    }
  }
}
