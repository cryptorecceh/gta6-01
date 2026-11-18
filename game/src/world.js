// Sunset Harbor — the city itself: dusk sky, sea and beach, a road grid, lit
// towers, palm-lined avenues, streetlights, the pier, the marina and the plaza.
// Returns colliders (building footprints) and named landmark positions.
import * as THREE from 'three';
import { CFG, PALETTE, ROAD_LINES, mulberry32 } from './config.js';

function windowTexture(rand) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#232030'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      const lit = rand() < 0.55;
      g.fillStyle = lit ? (rand() < 0.7 ? '#ffd27a' : '#9fd8ff') : '#12101c';
      g.fillRect(x, y, 6, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(scene) {
  const rand = mulberry32(20261117);
  const colliders = [];
  const landmarks = {
    pier: { x: -108, z: -78 }, marina: { x: -100, z: 40 },
    garage: { x: 40, z: 45 }, docks: { x: 96, z: 84 },
    plaza: { x: 0, z: 0 }, hideout: { x: -45, z: -45 }, maraOffice: { x: -45, z: -45 },
  };

  // Dusk sky: gradient dome + low sun + warm fog.
  scene.background = new THREE.Color(0x3a1c52);
  scene.fog = new THREE.Fog(0x5a2a4a, 90, 320);
  const skyGeo = new THREE.SphereGeometry(420, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(PALETTE.skyTop) }, mid: { value: new THREE.Color(0xff6a3c) }, bot: { value: new THREE.Color(0x2a1030) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(mid, bot, smoothstep(0.12, -0.08, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 20), new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }));
  sun.position.set(-260, 42, -160); scene.add(sun);
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(22, 20, 20), new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.35, fog: false }));
  sunGlow.position.copy(sun.position); scene.add(sunGlow);

  const hemi = new THREE.HemisphereLight(0xff9a6a, 0x241a33, 0.75); scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb347, 1.6);
  sunLight.position.set(-120, 90, -60);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -140; sunLight.shadow.camera.right = 140;
  sunLight.shadow.camera.top = 140; sunLight.shadow.camera.bottom = -140;
  sunLight.shadow.camera.far = 400;
  scene.add(sunLight);

  // Ground: grass/urban base, then sand beach and sea to the west.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshLambertMaterial({ color: 0x4a5d3a }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 520), new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-152, 0.02, 0); sand.receiveShadow = true; scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 520), new THREE.MeshPhongMaterial({ color: PALETTE.sea, shininess: 120, specular: 0xff9a5a }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-310, 0.05, 0); scene.add(sea);

  // Road grid: asphalt strips + sidewalks + dashed centre lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd94a });
  for (const c of ROAD_LINES) {
    for (const [w, l, x, z] of [[CFG.roadWidth, 260, c, 0], [260, CFG.roadWidth, 0, c]]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.03, z); r.receiveShadow = true; scene.add(r);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w + 7, l), walkMat);
      s.rotation.x = -Math.PI / 2; s.position.set(x, 0.015, z); scene.add(s);
    }
    for (let d = -110; d <= 110; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.05, d); scene.add(dash);
      const dash2 = dash.clone(); dash2.rotation.z = Math.PI / 2; dash2.position.set(d, 0.05, c); scene.add(dash2);
    }
  }

  // Buildings: one or two towers per city block. Blocks sit BETWEEN the roads,
  // so block centres are at (bx + 0.5) * roadGap — never on a street.
  const winTex = windowTexture(rand);
  const hues = [0x8a7f9a, 0x9a7f6a, 0x6a7f9a, 0xb08a6a, 0x7a6a8a, 0x5a6a7a];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3340 });
  for (let bx = -3; bx <= 2; bx++) {
    for (let bz = -3; bz <= 2; bz++) {
      const cx = (bx + 0.5) * CFG.roadGap, cz = (bz + 0.5) * CFG.roadGap;
      if (Math.abs(cx) < 8 && Math.abs(cz) < 8) continue; // the plaza stays open
      const n = 1 + Math.floor(rand() * 2);
      for (let k = 0; k < n; k++) {
        const w = 11 + rand() * 7, d = 11 + rand() * 7;
        const h = 10 + rand() * rand() * 34;
        const ox = cx + (k === 0 ? -6 : 6) + (rand() - 0.5) * 2;
        const oz = cz + (rand() - 0.5) * 10;
        if (ox < -118 || ox > 118 || oz < -118 || oz > 118) continue;
        const mat = new THREE.MeshLambertMaterial({ color: hues[Math.floor(rand() * hues.length)], emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 0.55, map: winTex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(ox, h / 2, oz); b.castShadow = true; b.receiveShadow = true;
        scene.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
        roof.position.set(ox, h + 0.4, oz); scene.add(roof);
        // Rooftop beacon on tall towers.
        if (h > 30) {
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
          beacon.position.set(ox, h + 1.6, oz); scene.add(beacon);
        }
        colliders.push({ minX: ox - w / 2 - 0.4, maxX: ox + w / 2 + 0.4, minZ: oz - d / 2 - 0.4, maxZ: oz + d / 2 + 0.4 });
      }
    }
  }

  // Palm trees along the avenues and the beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 7, 6), trunkMat);
    trunk.position.y = 3.5; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.4, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z); scene.add(g);
  }
  for (const c of ROAD_LINES) {
    for (let d = -100; d <= 100; d += 30) {
      if (Math.abs(c) < 8 && Math.abs(d) < 8) continue;
      // Never plant a palm inside a building footprint.
      const clear = (x, z) => !colliders.some(b => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ);
      if (clear(c + 9, d + 3)) palm(c + 9, d + 3);
      if (clear(c - 9, d - 6)) palm(c - 9, d - 6);
    }
  }
  for (let z = -110; z <= 110; z += 18) palm(-122, z);

  // Streetlights with warm pools of light along every avenue.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe1a0 });
  for (const c of ROAD_LINES) {
    for (let d = -100; d <= 100; d += 30) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.5, 6), poleMat);
      pole.position.set(c + 6.5, 3.25, d); scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), poleMat);
      arm.position.set(c + 5.8, 6.4, d); scene.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bulbMat);
      bulb.position.set(c + 5.1, 6.3, d); scene.add(bulb);
      const pt = new THREE.PointLight(0xffc06a, 12, 22, 1.8);
      pt.position.set(c + 5.1, 6.1, d); scene.add(pt);
    }
  }

  // The west pier (mission 1) and the marina (mission 2).
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 10), pierMat);
  pier.position.set(-128, 0.6, -78); pier.castShadow = true; scene.add(pier);
  colliders.push({ minX: -141, maxX: -115, minZ: -83, maxZ: -73 });
  const marina = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 14), pierMat);
  marina.position.set(-104, 0.5, 40); scene.add(marina);
  // Moored boats: simple hulls bobbing by the marina.
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  for (let i = 0; i < 3; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 8), hullMat);
    hull.position.y = 0.4; boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), poleMat);
    mast.position.y = 3; boat.add(mast);
    boat.position.set(-128 - i * 7, 0.1, 28 + i * 12); scene.add(boat);
  }

  // Central plaza: fountain + Mara's hideout door glow.
  const plazaMat = new THREE.MeshLambertMaterial({ color: 0x9a8a72 });
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.3, 24), plazaMat);
  plaza.position.set(0, 0.15, 0); plaza.receiveShadow = true; scene.add(plaza);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 1.2, 16), new THREE.MeshPhongMaterial({ color: 0x3a6a9a, shininess: 140 }));
  fountain.position.set(0, 0.8, 0); scene.add(fountain);
  const hideoutGlow = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  hideoutGlow.position.set(-45, 2, -38); scene.add(hideoutGlow);

  return { colliders, landmarks, sunLight };
}
