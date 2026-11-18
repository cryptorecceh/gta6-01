// Sunset Harbor — cars: build a boxy low-poly car mesh, and drive it.
// Drive model: arcade — throttle, brake/reverse, steering that bites with speed,
// simple circle-vs-building collision shared with the player on foot.
import * as THREE from 'three';
import { CFG, clamp, angleLerp } from './config.js';

export function collideCircle(colliders, x, z, r) {
  let px = x, pz = z;
  for (const c of colliders) {
    const nx = clamp(px, c.minX, c.maxX), nz = clamp(pz, c.minZ, c.maxZ);
    const dx = px - nx, dz = pz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * r; pz = nz + (dz / d) * r;
      } else {
        px = c.maxX + r; // centre inside the box: push out east
      }
    }
  }
  const lim = CFG.worldSize / 2 - 2;
  px = clamp(px, -CFG.worldSize / 2 + 2, lim);
  pz = clamp(pz, -CFG.worldSize / 2 + 2, lim);
  return { x: px, z: pz };
}

export function buildCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0x888888 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x18242e, shininess: 160, specular: 0xffffff });
  const dark = new THREE.MeshLambertMaterial({ color: 0x151515 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paint);
  body.position.y = 0.55; body.castShadow = true; group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.1), glass);
  cabin.position.set(0, 1.12, -0.25); cabin.castShadow = true; group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.5), paint);
  nose.position.set(0, 0.5, 2.3); group.add(nose);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.28, 0.3), dark);
  bumper.position.set(0, 0.32, 2.32); group.add(bumper);
  const bumperR = bumper.clone(); bumperR.position.z = -2.32; group.add(bumperR);
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 12);
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); w.castShadow = true;
    group.add(w); wheels.push(w);
  }
  // Headlights: emissive lenses, plus a real spotlight on the player's cars.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lampMat);
    lamp.position.set(s, 0.62, 2.56); group.add(lamp);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const s of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMat);
    lamp.position.set(s, 0.62, -2.56); group.add(lamp);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.55, -0.25); group.add(bar);
    group.userData.lightbar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 4.42), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.75; group.add(stripe);
  }
  if (opts.headlight) {
    const spot = new THREE.SpotLight(0xffeebb, 60, 42, 0.55, 0.45, 1.4);
    spot.position.set(0, 0.8, 2.4);
    const tgt = new THREE.Object3D(); tgt.position.set(0, 0, 14);
    group.add(tgt); spot.target = tgt; group.add(spot);
  }
  group.userData.wheels = wheels;
  return group;
}

export class Car {
  constructor(scene, color, x, z, heading, opts = {}) {
    this.mesh = buildCarMesh(color, opts);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.speed = 0; this.heading = heading; this.steer = 0;
    this.opts = opts;
    this.color = color;
    scene.add(this.mesh);
  }

  // Arcade drive step. input: {forward:-1..1, steer:-1..1}, dt seconds.
  drive(input, dt, colliders) {
    const accel = input.forward > 0 ? CFG.carAccel : CFG.carBrake;
    this.speed += input.forward * accel * dt;
    if (input.forward === 0) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
    this.speed = clamp(this.speed, -CFG.carReverseMax, CFG.carMaxSpeed);
    const steerTarget = input.steer * (this.speed >= 0 ? 1 : -1);
    this.steer = angleLerp(this.steer, steerTarget, Math.min(1, dt * 6));
    const turnRate = CFG.carTurn * this.steer * clamp(Math.abs(this.speed) / 8, 0, 1) * (this.speed >= 0 ? 1 : -1);
    this.heading -= turnRate * dt;
    const nx = this.mesh.position.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.mesh.position.z + Math.cos(this.heading) * this.speed * dt;
    const hit = collideCircle(colliders, nx, nz, 1.7);
    const crashed = (hit.x !== nx || hit.z !== nz) && Math.abs(this.speed) > 6;
    if (hit.x !== nx || hit.z !== nz) this.speed *= 0.45;
    this.mesh.position.x = hit.x; this.mesh.position.z = hit.z;
    this.mesh.rotation.y = this.heading;
    // Body roll and wheel spin sell the speed.
    this.mesh.rotation.z = -this.steer * clamp(Math.abs(this.speed) / CFG.carMaxSpeed, 0, 1) * 0.05;
    const spin = this.speed * dt / 0.38;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    if (this.mesh.userData.wheels[0]) this.mesh.userData.wheels[0].rotation.y = this.steer * 0.3;
    if (this.mesh.userData.wheels[1]) this.mesh.userData.wheels[1].rotation.y = this.steer * 0.3;
    return crashed;
  }

  get speedMph() { return Math.round(Math.abs(this.speed) * 2.2); }
}
