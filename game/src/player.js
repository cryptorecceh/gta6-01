// Sunset Harbor — the player on foot: WASD + mouse-look third person, run,
// jump, gravity, building collision, and getting in and out of cars (E to
// enter, F to steal the nearest car — stealing raises the wanted level).
import * as THREE from 'three';
import { CFG, clamp } from './config.js';
import { collideCircle, Car } from './vehicles.js';

export class Player {
  constructor(scene, colliders, audio) {
    this.scene = scene; this.colliders = colliders; this.audio = audio;
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0xd94f30 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.05, 10), jacket);
    body.position.y = 1.05; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 12), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 1.85; head.castShadow = true; g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    cap.position.y = 2.05; g.add(cap);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.85, 0.32), new THREE.MeshLambertMaterial({ color: 0x22304a }));
    legs.position.y = 0.42; g.add(legs);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), jacket);
    armR.position.set(0.5, 1.15, 0.2); g.add(armR);
    this.mesh = g;
    this.mesh.position.set(-38, 0, -38);
    this.heading = Math.PI * 0.75;
    this.pitch = 0.12;
    this.vy = 0; this.grounded = true;
    this.health = CFG.playerHealth;
    this.car = null;       // Car instance currently driven, or null
    this.parked = [];      // parked cars the player can enter
    scene.add(g);
  }

  get pos() { return this.car ? this.car.mesh.position : this.mesh.position; }
  get inCar() { return !!this.car; }
  get speed() { return this.car ? this.car.speed : 0; }

  addParkedCar(car) { this.parked.push(car); }

  update(dt, input, traffic, onSteal, onEnter) {
    if (this.car) { this._drive(dt, input); return; }
    const look = input.consumeLook();
    this.heading -= look.dx * 0.0026;
    this.pitch = clamp(this.pitch + look.dy * 0.0022, -0.5, 0.6);
    const ax = input.axis();
    const speed = input.running ? CFG.runSpeed : CFG.walkSpeed;
    const sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    // Forward is (sin, cos); right is (-cos, sin) — D must move screen-right.
    let mx = (sin * ax.forward - cos * ax.strafe) * speed;
    let mz = (cos * ax.forward + sin * ax.strafe) * speed;
    const moving = Math.hypot(mx, mz) > 0.1;
    if (moving) {
      const hit = collideCircle(this.colliders, this.mesh.position.x + mx * dt, this.mesh.position.z + mz * dt, 0.55);
      this.mesh.position.x = hit.x; this.mesh.position.z = hit.z;
      this.mesh.rotation.y = Math.atan2(mx, mz);
      // Walk bob, only while on the ground (never fights the jump).
      if (this.grounded) this.mesh.position.y = Math.abs(Math.sin(performance.now() / 130)) * 0.05;
    }
    // Jump + gravity.
    if (input.jumping && this.grounded) { this.vy = CFG.jumpSpeed; this.grounded = false; }
    if (!this.grounded) {
      this.vy -= CFG.gravity * dt;
      this.mesh.position.y += this.vy * dt;
      if (this.mesh.position.y <= 0) { this.mesh.position.y = 0; this.vy = 0; this.grounded = true; }
    }
    this._cameraThirdPerson();
  }

  _drive(dt, input) {
    const ax = input.axis();
    const look = input.consumeLook();
    this.heading -= look.dx * 0.0026;
    const crashed = this.car.drive({ forward: ax.forward, steer: ax.strafe }, dt, this.colliders);
    if (crashed) { this.audio.crash(); this.health = Math.max(1, this.health - 4); }
    this.mesh.position.copy(this.car.mesh.position);
    this.mesh.visible = false;
  }

  _cameraThirdPerson() { /* camera is positioned in main.js from heading/pitch */ }

  tryEnterCar() {
    if (this.car) { // exit
      const c = this.car; this.car = null;
      this.mesh.visible = true;
      this.mesh.position.set(c.mesh.position.x + 2.2, 0, c.mesh.position.z + 1.5);
      this.heading = c.heading;
      return { exited: true };
    }
    // Nearest parked car within 4 m.
    let best = null, bestD = 4;
    for (const c of this.parked) {
      const d = Math.hypot(c.mesh.position.x - this.mesh.position.x, c.mesh.position.z - this.mesh.position.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) {
      this.car = best; this.mesh.visible = false; this.heading = best.heading;
      return { entered: true, car: best };
    }
    return null;
  }

  // F: steal the nearest traffic car (or the coral coupe for mission 2).
  trySteal(traffic, missionCar) {
    if (this.car) return null;
    const px = this.mesh.position.x, pz = this.mesh.position.z;
    if (missionCar) {
      const d = Math.hypot(missionCar.mesh.position.x - px, missionCar.mesh.position.z - pz);
      if (d < 5) { this.car = missionCar; this.mesh.visible = false; return { stolen: true, mission: true }; }
    }
    const near = traffic.nearestCar(px, pz, 5);
    if (near) {
      const idx = traffic.cars.indexOf(near.traffic);
      if (idx >= 0) traffic.cars.splice(idx, 1);
      const car = new Car(this.scene, near.traffic.color, near.mesh.position.x, near.mesh.position.z, near.mesh.rotation.y, { headlight: true });
      this.scene.remove(near.mesh);
      this.parked.push(car);
      this.car = car; this.mesh.visible = false;
      return { stolen: true, mission: false };
    }
    return null;
  }

  reset(x, z) {
    this.car = null; this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);
    this.health = CFG.playerHealth; this.vy = 0; this.grounded = true;
  }
}
