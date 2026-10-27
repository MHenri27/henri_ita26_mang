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

// ---- Setup and per-frame update ----

function createScenery() {
  makeTerrain();
}

function updateScenery(dt, pos) {
  updateTerrain(pos);
}
