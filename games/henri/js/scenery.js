// Landscape around the path. Everything here follows the player, so it never runs out.
const scenery = {};

// ---- Hills and valleys. The ground stays well below the path, hills rise away from it ----

const TERRAIN_SIZE = 420;
const TERRAIN_STEPS = 60;
const WATER_LEVEL = -21;

// Shape of the land before the path cuts through it
function naturalHeight(x, z) {
  const hills = Math.sin(x * 0.012) * Math.cos(z * 0.01) * 14 + Math.sin((x + z) * 0.021 + 2) * 6;
  const bumps = Math.sin(x * 0.05 + Math.cos(z * 0.04)) * 2.5 + Math.sin(z * 0.07 - x * 0.03) * 1.5;

  // Winding rivers carve channels across the land, the path keeps crossing them
  const bend = Math.sin(z * 0.016 + Math.sin(x * 0.011) * 2.2);
  const river = Math.exp(-(bend * bend) / 0.02);

  return -14 + hills + bumps - river * 16;
}

// Distance to the nearest bit of path. The unbuilt path ahead counts as close too.
function distanceToPath(x, z) {
  let best = Infinity;
  for (const p of scenery.nearPath || []) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) best = d;
  }
  best = Math.sqrt(best);
  const end = scenery.pathEnd;
  if (end) best = Math.min(best, Math.max(0, Math.hypot(end.x - x, end.z - z) - 60));
  return best;
}

function terrainHeight(x, z) {
  const limit = -9 + Math.max(0, distanceToPath(x, z) - 12) * 0.9;
  return Math.min(naturalHeight(x, z), limit);
}

// Called whenever the path grows, so the hills make room for it
function terrainFollowPath(path) {
  scenery.path = path;
  const last = path.segments[path.segments.length - 1];
  scenery.pathEnd = pointOnSegment(last, last.length);
  const c = scenery.terrainCenter || { x: 0, z: 0 };
  if (scenery.terrain) shapeTerrain(c.x, c.z);
}

function makeTerrain() {
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_STEPS, TERRAIN_STEPS);
  geometry.rotateX(-Math.PI / 2);
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
  scenery.terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  world.scene.add(scenery.terrain);
}

// Re-shapes the hills around a new center, so they look fixed in the world
function shapeTerrain(cx, cz) {
  // Only path points around the terrain matter
  const reach = TERRAIN_SIZE * 0.75;
  scenery.nearPath = (scenery.path?.samples || []).filter((p) => Math.hypot(p.x - cx, p.z - cz) < reach);

  const geometry = scenery.terrain.geometry;
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i) + cx, pos.getZ(i) + cz));
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  colorTerrain(geometry);
  scenery.terrain.position.set(cx, 0, cz);
  scenery.terrainCenter = { x: cx, z: cz };
  if (scenery.cascades) placeCascades(cx, cz);
  if (scenery.ruins) placeHilltopRuins(cx, cz);
  if (scenery.trunks) placeForest(cx, cz);
  if (scenery.rocks) placeRocks(cx, cz);
}

// Sandy shores low down, grass on the slopes, bare rock where it gets steep or high
const TERRAIN_COLORS = {
  sand: new THREE.Color("#c2a46e"),
  grassLow: new THREE.Color("#2c5a2e"),
  grassHigh: new THREE.Color("#5b8a3e"),
  rock: new THREE.Color("#6e6458"),
  peak: new THREE.Color("#8d8270"),
};

function colorTerrain(geometry) {
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const col = geometry.attributes.color;
  const t = TERRAIN_COLORS;
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i);
    const flat = normal.getY(i);
    c.copy(t.grassLow).lerp(t.grassHigh, clamp((h + 20) / 22, 0, 1));
    if (h < WATER_LEVEL + 1.5) c.copy(t.sand);
    if (flat < 0.8) c.lerp(t.rock, clamp((0.8 - flat) / 0.2, 0, 1));
    if (h > 3) c.lerp(t.peak, clamp((h - 3) / 6, 0, 1));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

function updateTerrain(pos) {
  const center = scenery.terrainCenter;
  if (center && Math.hypot(pos.x - center.x, pos.z - center.z) < 60) return;
  const grid = TERRAIN_SIZE / TERRAIN_STEPS;
  shapeTerrain(Math.round(pos.x / grid) * grid, Math.round(pos.z / grid) * grid);
}

// ---- Forest covering the hills ----

const FOREST_CELL = 9;   // one tree spot per cell
const FOREST_MAX = 1500;

function makeForest() {
  scenery.trunks = new THREE.InstancedMesh(geo.trunk, mat.trunk, FOREST_MAX);
  scenery.crowns = new THREE.InstancedMesh(geo.cone, mat.leaves, FOREST_MAX * 2);
  world.scene.add(scenery.trunks, scenery.crowns);
}

// Same random number for the same cell every time, so trees don't jump around
function cellRandom(i, j, salt = 0) {
  const v = Math.sin(i * 127.1 + j * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

function placeForest(cx, cz) {
  const half = TERRAIN_SIZE / 2 - FOREST_CELL;
  const color = new THREE.Color();
  let count = 0;

  for (let gx = Math.ceil((cx - half) / FOREST_CELL); gx < (cx + half) / FOREST_CELL; gx++) {
    for (let gz = Math.ceil((cz - half) / FOREST_CELL); gz < (cz + half) / FOREST_CELL; gz++) {
      if (count >= FOREST_MAX || cellRandom(gx, gz) > 0.45) continue;
      const x = (gx + cellRandom(gx, gz, 1)) * FOREST_CELL;
      const z = (gz + cellRandom(gx, gz, 2)) * FOREST_CELL;
      const h = terrainMeshHeight(x, z);

      // No trees in the water, on cliffs, or right under the path
      if (h < WATER_LEVEL + 1.5) continue;
      if (Math.abs(terrainMeshHeight(x + 3, z) - h) + Math.abs(terrainMeshHeight(x, z + 3) - h) > 4) continue;
      if (distanceToPath(x, z) < 10) continue;
      if (scenery.ruins?.children.some((r) => Math.hypot(r.position.x - x, r.position.z - z) < 10)) continue;

      const size = 0.8 + cellRandom(gx, gz, 3) * 0.7;
      scenery.trunks.setMatrixAt(count, matrixAt(x, h + 2 * size, z, 0, size, 4 * size, size));
      scenery.crowns.setMatrixAt(count * 2, matrixAt(x, h + 5 * size, z, gx, 2.6 * size, 4.2 * size, 2.6 * size));
      scenery.crowns.setMatrixAt(count * 2 + 1, matrixAt(x, h + 7.2 * size, z, gz, 1.8 * size, 3.2 * size, 1.8 * size));
      color.set(COLORS.leaves[Math.floor(cellRandom(gx, gz, 4) * COLORS.leaves.length)]);
      scenery.crowns.setColorAt(count * 2, color);
      scenery.crowns.setColorAt(count * 2 + 1, color);
      count++;
    }
  }

  scenery.trunks.count = count;
  scenery.crowns.count = count * 2;
  scenery.trunks.instanceMatrix.needsUpdate = true;
  scenery.crowns.instanceMatrix.needsUpdate = true;
  if (scenery.crowns.instanceColor) scenery.crowns.instanceColor.needsUpdate = true;
}

// ---- Boulders on the slopes and along the shores ----

const ROCK_MAX = 300;

function makeRocks() {
  scenery.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat.stoneDark, ROCK_MAX);
  scenery.rocks.receiveShadow = true;
  world.scene.add(scenery.rocks);
}

function placeRocks(cx, cz) {
  const cell = 13;
  const half = TERRAIN_SIZE / 2 - cell;
  let count = 0;

  for (let gx = Math.ceil((cx - half) / cell); gx < (cx + half) / cell; gx++) {
    for (let gz = Math.ceil((cz - half) / cell); gz < (cz + half) / cell; gz++) {
      if (count >= ROCK_MAX || cellRandom(gx, gz, 9) > 0.3) continue;
      const x = (gx + cellRandom(gx, gz, 10)) * cell;
      const z = (gz + cellRandom(gx, gz, 11)) * cell;
      if (distanceToPath(x, z) < 8) continue;
      const size = 0.8 + cellRandom(gx, gz, 12) * 2.4;
      const h = terrainMeshHeight(x, z);
      dummy.position.set(x, h + size * 0.3, z);
      dummy.rotation.set(gx, gz, gx + gz);
      dummy.scale.set(size * 1.3, size * 0.8, size);
      dummy.updateMatrix();
      scenery.rocks.setMatrixAt(count++, dummy.matrix);
    }
  }
  scenery.rocks.count = count;
  scenery.rocks.instanceMatrix.needsUpdate = true;
}

// ---- Old temple ruins sitting on the highest hilltops ----

function makeHilltopRuins() {
  scenery.ruins = new THREE.Group();
  world.scene.add(scenery.ruins);
}

function placeHilltopRuins(cx, cz) {
  const group = scenery.ruins;
  group.clear();
  const cell = 21;
  const half = TERRAIN_SIZE / 2 - cell;
  const spots = [];

  // Highest point of each big cell that is well away from the path
  for (let gx = Math.ceil((cx - half) / cell); gx < (cx + half) / cell; gx++) {
    for (let gz = Math.ceil((cz - half) / cell); gz < (cz + half) / cell; gz++) {
      const x = (gx + 0.5) * cell;
      const z = (gz + 0.5) * cell;
      const h = terrainMeshHeight(x, z);
      if (h > -4 && distanceToPath(x, z) > 30) spots.push({ x, z, h, gx, gz });
    }
  }
  spots.sort((a, b) => b.h - a.h);

  const chosen = [];
  for (const s of spots) {
    if (chosen.length >= 5) break;
    if (chosen.some((c) => Math.hypot(c.x - s.x, c.z - s.z) < 70)) continue;
    chosen.push(s);
  }

  for (const s of chosen) {
    const ruin = new THREE.Group();
    ruin.position.set(s.x, s.h - 0.6, s.z);
    ruin.rotation.y = cellRandom(s.gx, s.gz, 20) * Math.PI;

    // Stepped base with a few broken columns and a little shrine on top
    for (let i = 0; i < 3; i++) {
      ruin.add(part(geo.box, mat.block, 12 - i * 3, 1.2, 12 - i * 3, 0, i * 1.2 + 0.6, 0));
    }
    ruin.add(part(geo.box, mat.moss, 12.1, 0.2, 12.1, 0, 1.25, 0));
    geo.column ??= new THREE.CylinderGeometry(0.9, 1.05, 1, 8);
    for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) {
      const tall = 2 + cellRandom(s.gx + x, s.gz + z, 21) * 5;
      ruin.add(part(geo.column, mat.block, 0.7, tall, 0.7, x, 1.2 + tall / 2, z));
    }
    ruin.add(part(geo.box, mat.stoneDark, 3, 2.6, 3, 0, 4.9, 0));
    ruin.add(part(geo.box, mat.block, 3.6, 0.6, 3.6, 0, 6.5, 0));
    group.add(ruin);
  }
}

// ---- Lakes filling the low valleys ----

function makeLakes() {
  const material = new THREE.MeshStandardMaterial({
    color: "#2f8f9a",
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88,
  });
  scenery.lakes = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE * 1.6, TERRAIN_SIZE * 1.6), material);
  scenery.lakes.rotation.x = -Math.PI / 2;
  world.scene.add(scenery.lakes);
}

function updateLakes(pos) {
  // Gentle bob so the water surface feels alive
  scenery.lakes.position.set(pos.x, WATER_LEVEL + Math.sin(world.time * 0.8) * 0.08, pos.z);
}

// ---- Waterfalls tumbling down the steepest hillsides ----

function makeCascades() {
  scenery.cascades = new THREE.Group();
  scenery.poolGeo = new THREE.CylinderGeometry(1, 1.2, 1, 9);
  world.scene.add(scenery.cascades);
}

// Finds big drops in the terrain away from the path and runs water down them
function placeCascades(cx, cz) {
  const group = scenery.cascades;
  group.traverse((o) => o.geometry?.type === "BufferGeometry" && o.geometry.dispose());
  group.clear();
  const pos = scenery.terrain.geometry.attributes.position;
  const n = TERRAIN_STEPS + 1;
  const index = (i, j) => j * n + i;
  const spots = [];

  for (let j = 2; j < n - 2; j += 2) {
    for (let i = 2; i < n - 2; i += 2) {
      const h = pos.getY(index(i, j));
      if (h < -10) continue;

      // Steepest drop toward a neighbour two cells away
      let best = null;
      for (const [di, dj] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const drop = h - pos.getY(index(i + di, j + dj));
        if (drop > 9 && (!best || drop > best.drop)) best = { low: index(i + di, j + dj), drop };
      }
      if (!best) continue;

      const x = pos.getX(index(i, j)) + cx;
      const z = pos.getZ(index(i, j)) + cz;
      if (distanceToPath(x, z) < 18) continue;
      spots.push({ x, z, h, ...best });
    }
  }

  // The biggest drops win, spread out so they don't bunch up
  spots.sort((a, b) => b.drop - a.drop);
  const chosen = [];
  for (const s of spots) {
    if (chosen.length >= 6) break;
    if (chosen.some((c) => Math.hypot(c.x - s.x, c.z - s.z) < 50)) continue;
    chosen.push(s);
  }

  for (const s of chosen) {
    const top = new THREE.Vector3(s.x, s.h + 0.3, s.z);
    const bottom = new THREE.Vector3(pos.getX(s.low) + cx, pos.getY(s.low) + 0.3, pos.getZ(s.low) + cz);
    addCascade(group, top, bottom);
  }
}

// Height of the drawn terrain, which is a bit coarser than terrainHeight
function terrainMeshHeight(x, z) {
  const pos = scenery.terrain.geometry.attributes.position;
  const c = scenery.terrainCenter;
  const cell = TERRAIN_SIZE / TERRAIN_STEPS;
  const n = TERRAIN_STEPS + 1;
  const gx = clamp((x - c.x + TERRAIN_SIZE / 2) / cell, 0, TERRAIN_STEPS - 0.001);
  const gz = clamp((z - c.z + TERRAIN_SIZE / 2) / cell, 0, TERRAIN_STEPS - 0.001);
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const fx = gx - i;
  const fz = gz - j;
  const h = (a, b) => pos.getY(b * n + a);
  const top = h(i, j) * (1 - fx) + h(i + 1, j) * fx;
  const bottom = h(i, j + 1) * (1 - fx) + h(i + 1, j + 1) * fx;
  return top * (1 - fz) + bottom * fz;
}

function addCascade(group, top, bottom) {
  const dir = bottom.clone().sub(top).setY(0).normalize();
  const across = new THREE.Vector3(-dir.z, 0, dir.x);
  const start = top.clone().addScaledVector(dir, -6);
  const end = bottom.clone().addScaledVector(dir, 2);
  const length = start.distanceTo(end);

  // Ribbon of water hugging the ground from above the edge down into the pool
  const steps = 18;
  const vertices = [];
  const uvs = [];
  const faces = [];
  for (let k = 0; k <= steps; k++) {
    const p = start.clone().lerp(end, k / steps);
    const y = terrainMeshHeight(p.x, p.z) + 0.5;
    for (const s of [-1, 1]) {
      vertices.push(p.x + across.x * s * 1.5, y, p.z + across.z * s * 1.5);
      uvs.push((s + 1) / 2, ((k / steps) * length) / 10);
    }
    if (k > 0) {
      const a = (k - 1) * 2;
      faces.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(faces);
  scenery.cascadeMat ??= mat.water.clone();
  scenery.cascadeMat.side = THREE.DoubleSide;
  group.add(new THREE.Mesh(geometry, scenery.cascadeMat));

  // Rock lip at the edge it spills over
  const lip = new THREE.Mesh(geo.box, mat.stoneDark);
  lip.scale.set(4.4, 1, 1.6);
  lip.position.set(top.x, terrainMeshHeight(top.x, top.z) + 0.3, top.z);
  lip.lookAt(bottom.x, lip.position.y, bottom.z);
  group.add(lip);

  // Foamy pool and spray where it lands
  const landing = new THREE.Vector3(end.x, terrainMeshHeight(end.x, end.z) + 0.4, end.z);
  const pool = new THREE.Mesh(scenery.poolGeo, mat.foam);
  pool.scale.set(3.4, 0.25, 3.4);
  pool.position.copy(landing);
  const spray = new THREE.Sprite(mat.waterMist);
  spray.scale.setScalar(9);
  spray.position.copy(landing).y += 1.5;
  group.add(pool, spray);
}

// ---- Mountains on the horizon ----

function makeMountains() {
  scenery.mountains = new THREE.Group();
  const rock = new THREE.MeshBasicMaterial({ color: "#7a5560", fog: false });
  const lit = new THREE.MeshBasicMaterial({ color: "#c99a86", fog: false });

  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + random(-0.1, 0.1);
    const dist = random(400, 460);
    const height = random(50, 110);
    const radius = random(45, 80);

    const peak = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), rock);
    peak.position.set(Math.sin(angle) * dist, height / 2 - 25, Math.cos(angle) * dist);
    peak.rotation.y = random(0, Math.PI);

    // Lighter tip catching the evening sun, a bit wider so it sits on top
    const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.31, height * 0.28, 5), lit);
    tip.position.y = height * 0.36;
    peak.add(tip);
    scenery.mountains.add(peak);
  }
  world.scene.add(scenery.mountains);
}

function updateMountains(pos) {
  scenery.mountains.position.set(pos.x, 0, pos.z);
}

// ---- Clouds drifting slowly around the sky ----

function makeClouds() {
  scenery.clouds = [];
  const material = new THREE.MeshBasicMaterial({ color: "#f2c39e", fog: false, transparent: true, opacity: 0.85 });
  const puff = new THREE.IcosahedronGeometry(1, 0);

  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const p = new THREE.Mesh(puff, material);
      p.scale.set(random(10, 18), random(4, 7), random(8, 12));
      p.position.set(k * 9 - 18 + random(-3, 3), random(-2, 2), random(-4, 4));
      cloud.add(p);
    }
    cloud.userData = { angle: random(0, Math.PI * 2), dist: random(180, 330), height: random(70, 120), drift: random(0.004, 0.01) };
    scenery.clouds.push(cloud);
    world.scene.add(cloud);
  }
}

function updateClouds(dt, pos) {
  for (const cloud of scenery.clouds) {
    const d = cloud.userData;
    d.angle += d.drift * dt;
    cloud.position.set(pos.x + Math.sin(d.angle) * d.dist, d.height, pos.z + Math.cos(d.angle) * d.dist);
    cloud.lookAt(pos.x, d.height, pos.z);
  }
}

// ---- A flock of birds circling over the jungle ----

function makeBirds() {
  scenery.birds = [];
  scenery.flockCenter = new THREE.Vector3();
  const material = standard("#2b2230");

  for (let i = 0; i < 9; i++) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(geo.box, material);
    body.scale.set(0.25, 0.2, 0.7);
    bird.add(body);

    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      const wing = new THREE.Mesh(geo.box, material);
      wing.scale.set(1.1, 0.05, 0.4);
      wing.position.x = side * 0.55;
      pivot.add(wing);
      bird.add(pivot);
      return { pivot, side };
    });

    bird.userData = {
      wings,
      angle: (i / 9) * Math.PI * 2,
      radius: random(18, 34),
      height: random(10, 22),
      speed: random(0.25, 0.4),
      flap: random(0, 6),
    };
    scenery.birds.push(bird);
    world.scene.add(bird);
  }
}

function updateBirds(dt, pos) {
  // The flock lazily follows the player and circles around them
  const c = scenery.flockCenter;
  c.lerp(new THREE.Vector3(pos.x, 0, pos.z), Math.min(1, dt * 0.5));

  for (const bird of scenery.birds) {
    const d = bird.userData;
    d.angle += d.speed * dt;
    const x = c.x + Math.sin(d.angle) * d.radius;
    const z = c.z + Math.cos(d.angle) * d.radius;
    const y = d.height + Math.sin(world.time * 0.7 + d.flap) * 1.5;
    bird.position.set(x, y, z);
    bird.lookAt(x + Math.cos(d.angle), y, z - Math.sin(d.angle));
    const flap = Math.sin(world.time * 9 + d.flap) * 0.6;
    d.wings.forEach((w) => (w.pivot.rotation.z = w.side * flap));
  }
}

// ---- Fireflies drifting around the path ----

function makeFireflies() {
  const count = 70;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.35,
    map: mat.glowTexture,
    color: "#e8ff8a",
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  world.scene.add(points);

  scenery.fireflies = {
    points,
    list: Array.from({ length: count }, () => ({ x: random(-30, 30), y: random(-5, 6), z: random(-30, 30), phase: random(0, 6) })),
  };
}

function updateFireflies(dt, pos) {
  // They stay put in the world and wrap around the player
  const ff = scenery.fireflies;
  const attr = ff.points.geometry.attributes.position;
  ff.list.forEach((f, i) => {
    f.phase += dt;
    f.x += Math.sin(f.phase * 0.7) * dt;
    f.y += Math.cos(f.phase * 0.9) * dt * 0.5;
    if (f.x - pos.x > 30) f.x -= 60;
    if (f.x - pos.x < -30) f.x += 60;
    if (f.z - pos.z > 30) f.z -= 60;
    if (f.z - pos.z < -30) f.z += 60;
    attr.setXYZ(i, f.x, f.y, f.z);
  });
  attr.needsUpdate = true;
  ff.points.material.opacity = 0.6 + Math.sin(world.time * 3) * 0.3;
}

// ---- Butterflies fluttering around the path ----

function makeButterflies() {
  scenery.butterflies = [];
  // Wing outline, hinged at the body
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.22, 0.2);
  shape.lineTo(0.32, 0.08);
  shape.lineTo(0.24, -0.16);
  shape.lineTo(0.08, -0.12);
  shape.closePath();
  const wingGeo = new THREE.ShapeGeometry(shape);
  wingGeo.rotateX(-Math.PI / 2);

  for (let i = 0; i < 16; i++) {
    const color = pick(["#f4d35e", "#f28fad", "#7fd3f0", "#f6f1e7", "#ff9a3c"]);
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const fly = new THREE.Group();
    const wings = [1, -1].map((side) => {
      const wing = new THREE.Mesh(wingGeo, material);
      wing.scale.x = side;
      fly.add(wing);
      return wing;
    });
    fly.userData = { wings, x: random(-25, 25), y: random(0.4, 3), z: random(-25, 25), phase: random(0, 6), speed: random(1, 2) };
    scenery.butterflies.push(fly);
    world.scene.add(fly);
  }
}

function updateButterflies(dt, pos) {
  for (const fly of scenery.butterflies) {
    const d = fly.userData;
    d.phase += dt * d.speed;
    // Wander in loose loops and stay around the player
    d.x += Math.sin(d.phase * 0.8) * dt * 2;
    d.z += Math.cos(d.phase * 0.6) * dt * 2;
    if (d.x - pos.x > 25) d.x -= 50;
    if (d.x - pos.x < -25) d.x += 50;
    if (d.z - pos.z > 25) d.z -= 50;
    if (d.z - pos.z < -25) d.z += 50;

    fly.position.set(d.x, d.y + Math.sin(d.phase * 3) * 0.3, d.z);
    fly.rotation.y = d.phase * 0.8;
    const flap = Math.sin(world.time * 22 + d.phase) * 1.1;
    d.wings[0].rotation.z = flap;
    d.wings[1].rotation.z = -flap;
  }
}

// ---- Setup and per-frame update ----

function createScenery() {
  makeTerrain();
  makeForest();
  makeRocks();
  makeHilltopRuins();
  makeCascades();
  makeLakes();
  makeMountains();
  makeClouds();
  makeBirds();
  makeFireflies();
  makeButterflies();
}

function updateScenery(dt, pos) {
  updateTerrain(pos);
  updateLakes(pos);
  updateMountains(pos);
  updateClouds(dt, pos);
  updateBirds(dt, pos);
  updateFireflies(dt, pos);
  updateButterflies(dt, pos);
}
