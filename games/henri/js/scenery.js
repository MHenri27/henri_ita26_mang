// Landscape around the path. Everything here follows the player, so it never runs out.
const scenery = {};

// ---- Rolling jungle hills far below the path ----

const TERRAIN_SIZE = 420;
const TERRAIN_STEPS = 60;

function terrainHeight(x, z) {
  return -22
    + Math.sin(x * 0.021) * 4
    + Math.sin(z * 0.017 + 1.3) * 5
    + Math.sin((x + z) * 0.043) * 2.5
    + Math.sin((x - z) * 0.08) * 1.2;
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
  const pos = scenery.terrain.geometry.attributes.position;
  const col = scenery.terrain.geometry.attributes.color;
  const low = new THREE.Color("#183022");
  const high = new THREE.Color("#3f6b39");
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const h = terrainHeight(pos.getX(i) + cx, pos.getZ(i) + cz);
    pos.setY(i, h);
    c.copy(low).lerp(high, clamp((h + 30) / 14, 0, 1));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  scenery.terrain.geometry.computeVertexNormals();
  scenery.terrain.position.set(cx, 0, cz);
  scenery.terrainCenter = { x: cx, z: cz };
}

function updateTerrain(pos) {
  const center = scenery.terrainCenter;
  if (center && Math.hypot(pos.x - center.x, pos.z - center.z) < 60) return;
  const grid = TERRAIN_SIZE / TERRAIN_STEPS;
  shapeTerrain(Math.round(pos.x / grid) * grid, Math.round(pos.z / grid) * grid);
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

// ---- Setup and per-frame update ----

function createScenery() {
  makeTerrain();
  makeMountains();
  makeClouds();
}

function updateScenery(dt, pos) {
  updateTerrain(pos);
  updateMountains(pos);
  updateClouds(dt, pos);
}
