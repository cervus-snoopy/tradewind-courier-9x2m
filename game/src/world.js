// Tradewind Courier — the archipelago: procedural islands, sea, sky, strips,
// gates, trees, buildings, clouds, birds and weather. All art is generated here
// from code: no image, model or sound files are loaded.
import * as THREE from 'three';
import { WORLD, LIGHTING } from './config.js';
import { mulberry32, makeNoise, clamp, lerp } from './random.js';

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export class World {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rand = mulberry32(seed);
    this.noise = makeNoise(seed * 7 + 3);
    this.ringMeshes = [];
    this.clouds = [];
    this.birds = [];
    this.rain = null;
    this.windsock = null;
    this._buildSky();
    this._buildSea();
    this._buildTerrain();
    this._buildStrips();
    this._buildTrees();
    this._buildBuildings();
    this._buildClouds();
    this._buildBirds();
    this._buildRain();
  }

  // ---- heightfield (shared with physics) ----
  terrainHeight(x, z) {
    const n = this.noise;
    let h = -6; // seabed
    const dome = (cx, cz, r, amp) => {
      const dx = x - cx, dz = z - cz;
      const d = Math.sqrt(dx * dx + dz * dz) / r;
      if (d >= 1) return 0;
      return amp * Math.pow(1 - d * d, 1.35);
    };
    h += dome(WORLD.mainIsland.x, WORLD.mainIsland.z, WORLD.mainIsland.radius, WORLD.mainIsland.height);
    h += dome(WORLD.palmIsle.x, WORLD.palmIsle.z, WORLD.palmIsle.radius, WORLD.palmIsle.height);
    h += dome(WORLD.gullRock.x, WORLD.gullRock.z, WORLD.gullRock.radius, WORLD.gullRock.height);
    // Rolling detail, stronger on land.
    const land = clamp((h + 6) / 40, 0, 1);
    h += (n(x * 0.004, z * 0.004) - 0.5) * 16 * land;
    h += (n(x * 0.02 + 40, z * 0.02 + 40) - 0.5) * 3 * land;
    // Flatten the ground under each strip so the runway sits level.
    // Strip-local axes: u along the strip (compass heading h -> (sin h, -cos h)
    // in (x, z)), v across it.
    for (const strip of [WORLD.homeStrip, WORLD.palmStrip]) {
      const a = (strip.heading * Math.PI) / 180;
      const dx = x - strip.x, dz = z - strip.z;
      const u = dx * Math.sin(a) - dz * Math.cos(a);
      const v = dx * Math.cos(a) + dz * Math.sin(a);
      const outside = Math.max(Math.abs(u) - strip.length / 2, Math.abs(v) - strip.width / 2);
      const blend = 1 - smoothstep(0, 90, outside);
      if (blend > 0) h = lerp(h, strip.elevation, blend);
    }
    return h;
  }

  stripAt(x, z) {
    for (const strip of [WORLD.homeStrip, WORLD.palmStrip]) {
      const a = (strip.heading * Math.PI) / 180;
      const dx = x - strip.x, dz = z - strip.z;
      const u = dx * Math.sin(a) - dz * Math.cos(a);
      const v = dx * Math.cos(a) + dz * Math.sin(a);
      if (Math.abs(u) <= strip.length / 2 && Math.abs(v) <= strip.width / 2) return strip;
    }
    return null;
  }

  // ---- sky, sea, terrain ----
  _buildSky() {
    this.sunLight = new THREE.DirectionalLight(0xfff2d8, 1.15);
    this.sunLight.position.set(800, 900, 400);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -260; this.sunLight.shadow.camera.right = 260;
    this.sunLight.shadow.camera.top = 260; this.sunLight.shadow.camera.bottom = -260;
    this.sunLight.shadow.camera.near = 100; this.sunLight.shadow.camera.far = 3200;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.hemi = new THREE.HemisphereLight(0xbfd9e8, 0x3d5a3a, 0.75);
    this.scene.add(this.hemi);
    // Sun disc so the sky has a source to look at.
    const sunGeo = new THREE.CircleGeometry(60, 32);
    this.sunDisc = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }));
    this.sunDisc.position.set(2400, 1300, 1200);
    this.sunDisc.lookAt(0, 0, 0);
    this.scene.add(this.sunDisc);
  }

  setLighting(name) {
    const L = LIGHTING[name] || LIGHTING.day;
    this.scene.background = new THREE.Color(L.sky);
    this.scene.fog = new THREE.Fog(L.fog[0], L.fog[1], L.fog[2]);
    this.sunLight.color.set(L.sun); this.sunLight.intensity = L.sunI;
    this.sunLight.position.set(L.sunPos[0], L.sunPos[1], L.sunPos[2]);
    this.hemi.color.set(L.hemi); this.hemi.intensity = L.hemiI;
    this.sunDisc.material.color.set(L.sun);
    this.sunDisc.position.set(L.sunPos[0] * 2.6, Math.max(300, L.sunPos[1] * 1.4), L.sunPos[2] * 2.6);
    for (const c of this.clouds) c.material.color.set(L.cloud);
    this.rain.visible = name === 'storm';
    this.scene.fog.color.set(L.fog[0]);
  }

  _buildSea() {
    const geo = new THREE.CircleGeometry(6500, 48);
    const mat = new THREE.MeshPhongMaterial({ color: 0x2a6f8e, shininess: 140, specular: 0x99ccdd, transparent: true, opacity: 0.96 });
    this.sea = new THREE.Mesh(geo, mat);
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.y = 0;
    this.sea.receiveShadow = true;
    this.scene.add(this.sea);
  }

  _buildTerrain() {
    const size = 8000, seg = 150;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(0xd9c08a), grass = new THREE.Color(0x5da24a),
      grass2 = new THREE.Color(0x4a8a3e), rock = new THREE.Color(0x7a7568),
      deep = new THREE.Color(0x2f5d3a);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.terrainHeight(x, z);
      pos.setY(i, h);
      const n = this.noise(x * 0.01 + 9, z * 0.01 + 9);
      if (h < 0.5) c.copy(deep).lerp(sand, clamp((h + 6) / 6.5, 0, 1));
      else if (h < 4) c.copy(sand);
      else if (h < 42) c.copy(grass).lerp(grass2, n);
      else if (h < 62) c.copy(grass2).lerp(rock, (h - 42) / 20);
      else c.copy(rock);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  _runwayTexture(labelA, labelB) {
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#2e3138'; g.fillRect(0, 0, 1024, 64);
    g.fillStyle = '#f2f2f2';
    for (let x = 60; x < 964; x += 72) g.fillRect(x, 30, 36, 4); // centreline
    g.fillRect(0, 4, 1024, 3); g.fillRect(0, 57, 1024, 3); // edges
    for (let i = 0; i < 4; i++) { g.fillRect(18 + i * 12, 12, 6, 40); g.fillRect(994 - i * 12, 12, 6, 40); } // thresholds
    g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(labelA, 60, 32); g.fillText(labelB, 964, 32);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  _buildStrips() {
    this.strips = [];
    for (const strip of [WORLD.homeStrip, WORLD.palmStrip]) {
      const group = new THREE.Group();
      const tex = this._runwayTexture(strip === WORLD.homeStrip ? '27' : '14', strip === WORLD.homeStrip ? '09' : '32');
      const surf = new THREE.Mesh(
        new THREE.PlaneGeometry(strip.length, strip.width),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
      );
      surf.rotation.x = -Math.PI / 2;
      surf.receiveShadow = true;
      group.add(surf);
      // Edge lights: small warm dots down both sides.
      const lightGeo = new THREE.SphereGeometry(0.7, 8, 6);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
      for (let d = -strip.length / 2 + 20; d <= strip.length / 2 - 20; d += 70) {
        for (const side of [-1, 1]) {
          const dot = new THREE.Mesh(lightGeo, lightMat);
          dot.position.set(d, 0.6, side * (strip.width / 2 + 2));
          group.add(dot);
        }
      }
      // PAPI: two red, two white beside the threshold.
      const papiColors = [0xff4444, 0xff4444, 0xffffff, 0xffffff];
      papiColors.forEach((col, i) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.4), new THREE.MeshBasicMaterial({ color: col }));
        box.position.set(-strip.length / 2 + 60, 0.8, strip.width / 2 + 8 + i * 3);
        group.add(box);
      });
      group.position.set(strip.x, strip.elevation + 0.15, strip.z);
      // PlaneGeometry's length lies along X; rotate so it lies along the strip's
      // compass heading: +X must map to (sin h, -cos h), i.e. rotate by 90 - h.
      group.rotation.y = ((90 - strip.heading) * Math.PI) / 180;
      this.scene.add(group);
      this.strips.push(group);
    }
    // Windsock by the home strip.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 9, 8), new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }));
    pole.position.set(WORLD.homeStrip.x - 40, WORLD.homeStrip.elevation + 4.5, WORLD.homeStrip.z - WORLD.homeStrip.width / 2 - 14);
    this.scene.add(pole);
    const sockGeo = new THREE.ConeGeometry(1.1, 4.5, 10, 1, true);
    const sockMat = new THREE.MeshStandardMaterial({ color: 0xff7a2a, side: THREE.DoubleSide });
    this.windsock = new THREE.Mesh(sockGeo, sockMat);
    this.windsock.position.set(pole.position.x, WORLD.homeStrip.elevation + 8.6, pole.position.z);
    this.windsock.rotation.z = Math.PI / 2;
    this.scene.add(this.windsock);
  }

  _buildTrees() {
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
    const topGeo = new THREE.ConeGeometry(3.2, 9, 7);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x2f7a33, roughness: 1, flatShading: true });
    const spots = [];
    let tries = 0;
    while (spots.length < 260 && tries++ < 4000) {
      const x = (this.rand() - 0.5) * 5600, z = (this.rand() - 0.5) * 5600;
      const h = this.terrainHeight(x, z);
      if (h > 6 && h < 42 && !this.stripAt(x, z)) spots.push([x, h, z]);
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const tops = new THREE.InstancedMesh(topGeo, topMat, spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    spots.forEach(([x, h, z], i) => {
      const scale = 0.8 + this.rand() * 0.9;
      p.set(x, h + 2.2 * scale, z); s.set(scale, scale, scale); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rand() * Math.PI * 2);
      m.compose(p, q, s); trunks.setMatrixAt(i, m);
      p.set(x, h + (5 + 4.5) * scale - 1.5, z); m.compose(p, q, s); tops.setMatrixAt(i, m);
    });
    trunks.castShadow = true; tops.castShadow = true;
    this.scene.add(trunks); this.scene.add(tops);
  }

  _buildBuildings() {
    const rand = this.rand;
    const matWall = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.9 });
    const matRoof = new THREE.MeshStandardMaterial({ color: 0xc25e3a, roughness: 0.9, flatShading: true });
    const matHangar = new THREE.MeshStandardMaterial({ color: 0x9fb4c0, roughness: 0.7, metalness: 0.3 });
    const addBox = (x, z, w, h, d, mat, ry = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, this.terrainHeight(x, z) + h / 2, z);
      b.rotation.y = ry; b.castShadow = true; b.receiveShadow = true;
      this.scene.add(b); return b;
    };
    // Hangar + tower by the home strip.
    addBox(-420, -300, 46, 14, 30, matHangar, 0.1);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 26, 10), matWall);
    tower.position.set(-380, this.terrainHeight(-380, -300) + 13, -300);
    tower.castShadow = true; this.scene.add(tower);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 5, 10), new THREE.MeshStandardMaterial({ color: 0x2a4a66, roughness: 0.3, metalness: 0.4 }));
    cab.position.set(-380, this.terrainHeight(-380, -300) + 28, -300);
    this.scene.add(cab);
    // Little harbour houses along the south shore.
    for (let i = 0; i < 8; i++) {
      const x = -500 + i * 130 + rand() * 40, z = 620 + rand() * 80;
      const w = 12 + rand() * 8, h = 7 + rand() * 4, d = 10 + rand() * 6;
      addBox(x, z, w, h, d, matWall, rand() * 0.6);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 4, 4), matRoof);
      roof.position.set(x, this.terrainHeight(x, z) + h + 2, z);
      roof.rotation.y = Math.PI / 4 + rand() * 0.4;
      this.scene.add(roof);
    }
  }

  _cloudTexture() {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    const blob = (x, y, r, a) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    blob(70, 80, 55, 0.9); blob(130, 65, 65, 0.95); blob(190, 85, 50, 0.9); blob(110, 90, 45, 0.8);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildClouds() {
    const tex = this._cloudTexture();
    for (let i = 0; i < 26; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.75 + this.rand() * 0.2, depthWrite: false });
      const spr = new THREE.Sprite(mat);
      const scale = 220 + this.rand() * 320;
      spr.scale.set(scale, scale * 0.45, 1);
      spr.position.set((this.rand() - 0.5) * 7000, 260 + this.rand() * 220, (this.rand() - 0.5) * 7000);
      spr.userData.drift = 1.5 + this.rand() * 2.5;
      this.scene.add(spr);
      this.clouds.push(spr);
    }
  }

  _buildBirds() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x1c2833, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const bird = new THREE.Group();
      const wingGeo = new THREE.PlaneGeometry(2.4, 0.9);
      const left = new THREE.Mesh(wingGeo, mat);
      left.position.x = -1.2;
      const right = new THREE.Mesh(wingGeo, mat);
      right.position.x = 1.2;
      bird.add(left); bird.add(right);
      bird.userData = { left, right, r: 180 + this.rand() * 260, h: 90 + this.rand() * 60, a: this.rand() * Math.PI * 2, speed: 0.05 + this.rand() * 0.04, cx: (this.rand() - 0.5) * 1200, cz: (this.rand() - 0.5) * 1200 };
      this.scene.add(bird);
      this.birds.push(bird);
    }
  }

  _buildRain() {
    const count = 900;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (this.rand() - 0.5) * 140;
      pos[i * 3 + 1] = this.rand() * 90;
      pos[i * 3 + 2] = (this.rand() - 0.5) * 140;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xbfd4e0, size: 0.9, transparent: true, opacity: 0.6 });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  // ---- gates ----
  setGates(gates, nextIndex = 0) {
    for (const m of this.ringMeshes) { this.scene.remove(m.group); }
    this.ringMeshes = [];
    gates.forEach((gate, i) => {
      const group = new THREE.Group();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(18, 1.5, 12, 48),
        new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.95 }),
      );
      group.add(torus);
      // Inner faint disc so the hole reads at distance.
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(18, 40),
        new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.07, side: THREE.DoubleSide }),
      );
      group.add(disc);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 260, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x7be3a8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      );
      beam.position.y = 130;
      beam.visible = false;
      group.add(beam);
      group.position.set(gate.x, gate.y, gate.z);
      // Face the ring toward the previous gate / start so the pilot sees the hole.
      const prev = i === 0 ? { x: 330, y: 8, z: -350 } : gates[i - 1];
      group.lookAt(prev.x, prev.y, prev.z);
      this.scene.add(group);
      this.ringMeshes.push({ group, torus, beam, passed: false, index: i });
    });
    this.markNextGate(nextIndex);
  }

  markNextGate(nextIndex) {
    this.ringMeshes.forEach((r, i) => {
      const isNext = i === nextIndex;
      r.torus.material.color.set(isNext ? 0x7be3a8 : r.passed ? 0x4a6a7a : 0xffb347);
      r.torus.material.opacity = r.passed ? 0.35 : 0.95;
      r.beam.visible = isNext;
    });
  }

  setGatePassed(index) {
    const r = this.ringMeshes[index];
    if (r) { r.passed = true; this.markNextGate(index + 1); }
  }

  // ---- per-frame ambience ----
  update(dt, t, planePos, wind) {
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 3600) c.position.x = -3600;
    }
    for (const b of this.birds) {
      const u = b.userData;
      u.a += u.speed * dt;
      b.position.set(u.cx + Math.cos(u.a) * u.r, u.h + Math.sin(t * 0.7 + u.a) * 4, u.cz + Math.sin(u.a) * u.r);
      b.rotation.y = -u.a;
      const flap = Math.sin(t * 9 + u.a * 5) * 0.55;
      u.left.rotation.z = flap; u.right.rotation.z = -flap;
    }
    if (this.rain.visible && planePos) {
      this.rain.position.set(planePos.x, planePos.y - 20, planePos.z);
      const pos = this.rain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 55 * dt;
        if (y < 0) y = 90;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    if (this.windsock && wind) {
      // Sock points where the wind blows toward; droops when the air is calm.
      const c = ((wind.from + 180) * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.sin(c), -0.12 - Math.max(0, 0.5 - wind.speed * 0.05), -Math.cos(c)).normalize();
      this.windsock.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    // Sun shadow box follows the plane so shadows stay crisp nearby.
    if (planePos) {
      this.sunLight.position.set(planePos.x + 800, 900, planePos.z + 400);
      this.sunLight.target.position.set(planePos.x, 0, planePos.z);
    }
  }
}
