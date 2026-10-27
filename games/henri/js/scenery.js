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
  return -14 + hills + bumps;
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

// ---- Lakes filling the low valleys ----

function makeLakes() {
  const material = new THREE.MeshStandardMaterial({
    color: "#3d7c86",
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

// ---- Setup and per-frame update ----

function createScenery() {
  makeTerrain();
  makeLakes();
  makeMountains();
  makeClouds();
  makeBirds();
  makeFireflies();
}

function updateScenery(dt, pos) {
  updateTerrain(pos);
  updateLakes(pos);
  updateMountains(pos);
  updateClouds(dt, pos);
  updateBirds(dt, pos);
  updateFireflies(dt, pos);
}
