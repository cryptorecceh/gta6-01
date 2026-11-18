// Sunset Harbor — traffic cars cruising the road grid and pedestrians on the
// sidewalks. Traffic follows straight road lanes and wraps around the city;
// pedestrians stroll, wait at corners, and flee when gunfire goes off nearby.
import * as THREE from 'three';
import { CFG, CAR_COLORS, ROAD_LINES, mulberry32, clamp } from './config.js';
import { buildCarMesh } from './vehicles.js';

export class Traffic {
  constructor(scene, colliders) {
    this.scene = scene; this.colliders = colliders;
    this.cars = []; this.peds = [];
    const rand = mulberry32(777);
    // 10 traffic cars on the grid lanes.
    for (let i = 0; i < 10; i++) {
      const horizontal = i % 2 === 0;
      const line = ROAD_LINES[Math.floor(rand() * ROAD_LINES.length)];
      const dir = rand() < 0.5 ? 1 : -1;
      const colorHex = CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
      const mesh = buildCarMesh(colorHex);
      mesh.position.set(horizontal ? -110 + rand() * 220 : line + (dir > 0 ? 2.6 : -2.6), 0, horizontal ? line + (dir > 0 ? 2.6 : -2.6) : -110 + rand() * 220);
      mesh.rotation.y = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      scene.add(mesh);
      this.cars.push({ mesh, horizontal, line, dir, speed: 7 + rand() * 5, color: colorHex });
    }
    // 16 pedestrians wandering the sidewalks.
    const shirtColors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xe67e22];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: shirtColors[i % shirtColors.length] });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.1, 8), shirt);
      body.position.y = 1.0; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
      head.position.y = 1.8; head.castShadow = true; g.add(head);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      legs.position.y = 0.4; g.add(legs);
      const x = -110 + rand() * 220, z = -110 + rand() * 220;
      g.position.set(x, 0, z);
      scene.add(g);
      this.peds.push({ mesh: g, heading: rand() * Math.PI * 2, speed: 1 + rand() * 1.2, panic: 0, legSwing: rand() * 6 });
    }
  }

  update(dt, playerPos, gunfireAt) {
    for (const c of this.cars) {
      const step = c.speed * dt * c.dir;
      if (c.horizontal) {
        c.mesh.position.x += step;
        if (c.mesh.position.x > 118) c.mesh.position.x = -118;
        if (c.mesh.position.x < -118) c.mesh.position.x = 118;
      } else {
        c.mesh.position.z += step;
        if (c.mesh.position.z > 118) c.mesh.position.z = -118;
        if (c.mesh.position.z < -118) c.mesh.position.z = 118;
      }
      // Brake lightly when the player car is right ahead.
      if (playerPos) {
        const d = Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z);
        if (d < 7) c.mesh.position.x -= step * 0.6, c.mesh.position.z -= step * 0.6;
      }
    }
    for (const p of this.peds) {
      if (gunfireAt) {
        const d = Math.hypot(p.mesh.position.x - gunfireAt.x, p.mesh.position.z - gunfireAt.z);
        if (d < 26) p.panic = 3;
      }
      let speed = p.speed;
      if (p.panic > 0) { p.panic -= dt; speed = 5.5; p.heading = Math.atan2(p.mesh.position.x - (gunfireAt?.x ?? 0), p.mesh.position.z - (gunfireAt?.z ?? 0)); }
      else if (Math.random() < dt * 0.12) p.heading += (Math.random() - 0.5) * 1.6;
      p.mesh.position.x += Math.sin(p.heading) * speed * dt;
      p.mesh.position.z += Math.cos(p.heading) * speed * dt;
      p.mesh.position.x = clamp(p.mesh.position.x, -120, 120);
      p.mesh.position.z = clamp(p.mesh.position.z, -120, 120);
      p.mesh.rotation.y = p.heading;
      p.legSwing += dt * speed * 4;
      p.mesh.position.y = Math.abs(Math.sin(p.legSwing)) * 0.06;
    }
  }

  // Nearest parked-looking car to a point (for stealing): traffic cars count too.
  nearestCar(x, z, maxD) {
    let best = null, bestD = maxD;
    for (const c of this.cars) {
      const d = Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best ? { mesh: best.mesh, dist: bestD, traffic: best } : null;
  }
}
