// Three.js scene: lights, sky, scenery and the meshes for each path segment
const world = {};

const COLORS = {
  skyTop: "#1f2b4a",
  haze: "#d98d5f",
  ground: "#1b3324",
  mist: "#b97a58",
  stone: ["#a39885", "#968b78", "#aea392", "#8f8572"],
  stoneDark: "#6c6457",
  curb: "#7d7465",
  block: "#878a8e",
  blockFace: "#3c3f44",
  moss: "#5b8a47",
  wood: "#7a4b2a",
  woodDark: "#553620",
  grate: "#38322c",
  flame: "#ff8a2a",
  flameCore: "#ffd36b",
  roller: "#6f747a",
  coin: "#f6b93b",
  coinInner: "#ffd772",
  boost: "#36dcc4",
  heart: "#ff4d63",
  trunk: "#4a3626",
  leaves: ["#2e6a3b", "#3b7a3d", "#27573a", "#4a8743", "#356f34"],
  flowers: ["#f4d35e", "#f28fad", "#f6f1e7", "#e8604c"],
  temple: "#5b4559",
  sun: "#ffe0a8",
};

// Shared geometry and materials, made once
const POP_TIME = 0.25;  // how long a picked up item takes to vanish

const geo = {};
const mat = {};

function standard(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });
}

function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.haze);
  scene.fog = new THREE.Fog(COLORS.haze, 50, 170);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);

  // Warm evening light
  scene.add(new THREE.HemisphereLight("#ffd9b0", "#2a3b2c", 0.6));
  const sun = new THREE.DirectionalLight("#ffc890", 0.95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 120 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  Object.assign(world, { renderer, scene, camera, sun, time: 0, shake: 0, camHeading: 0, flames: [] });

  makeMaterials();
  makeSky();
  makeGround();
  makeDistantTemples();
  makeParticles();
  resizeWorld();
}

function makeMaterials() {
  geo.tile = new THREE.BoxGeometry(HALF_WIDTH * 2, 1, 1.94);
  geo.curveTile = new THREE.BoxGeometry(HALF_WIDTH * 2, 1, 1.3);
  geo.corner = new THREE.BoxGeometry(HALF_WIDTH * 2, 1, HALF_WIDTH * 2);
  geo.curb = new THREE.BoxGeometry(0.45, 0.28, 1.94);
  geo.pillar = new THREE.CylinderGeometry(1.3, 1.6, 18, 7);
  geo.trunk = new THREE.CylinderGeometry(0.35, 0.6, 1, 6);
  geo.cone = new THREE.ConeGeometry(1, 1, 7);
  geo.box = new THREE.BoxGeometry(1, 1, 1);
  geo.coin = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20);
  geo.coinInner = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 20);
  geo.log = new THREE.CylinderGeometry(0.42, 0.42, HALF_WIDTH * 2 + 0.6, 9);
  geo.roller = new THREE.CylinderGeometry(0.45, 0.45, 1.5, 10);
  geo.heart = makeHeartGeometry();

  mat.tile = standard("#ffffff");
  mat.cornerTile = standard(COLORS.stone[1]);
  mat.stoneDark = standard(COLORS.stoneDark);
  mat.curb = standard(COLORS.curb);
  mat.trunk = standard(COLORS.trunk);
  mat.leaves = standard("#ffffff");
  mat.block = standard(COLORS.block);
  mat.blockFace = standard(COLORS.blockFace);
  mat.moss = standard(COLORS.moss);
  mat.wood = standard(COLORS.wood);
  mat.woodDark = standard(COLORS.woodDark);
  mat.grate = standard(COLORS.grate);
  mat.roller = standard(COLORS.roller);
  mat.flame = new THREE.MeshBasicMaterial({ color: COLORS.flame });
  mat.flameCore = new THREE.MeshBasicMaterial({ color: COLORS.flameCore });
  mat.coin = standard(COLORS.coin, { metalness: 0.55, roughness: 0.3, emissive: "#8a5000", emissiveIntensity: 0.5, flatShading: false });
  mat.coinInner = standard(COLORS.coinInner, { metalness: 0.4, roughness: 0.35, emissive: "#8a6000", emissiveIntensity: 0.4, flatShading: false });
  mat.boost = standard(COLORS.boost, { emissive: COLORS.boost, emissiveIntensity: 0.6 });
  mat.boostArrow = new THREE.MeshBasicMaterial({ color: "#d8fff8" });
  mat.heart = standard(COLORS.heart, { emissive: "#8a1020", emissiveIntensity: 0.6, roughness: 0.4 });

  // Soft round glow used behind coins and pickups
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const g = glowCanvas.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  mat.glowTexture = glowTexture;
  mat.glow = (color) => new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  mat.coinGlow = mat.glow("#ffb340");

  // Streaky water that scrolls down, used by waterfalls
  const waterCanvas = document.createElement("canvas");
  waterCanvas.width = 32;
  waterCanvas.height = 128;
  const w = waterCanvas.getContext("2d");
  w.fillStyle = "#6fb8e6";
  w.fillRect(0, 0, 32, 128);
  for (let i = 0; i < 40; i++) {
    w.fillStyle = `rgba(255,255,255,${random(0.2, 0.7)})`;
    w.fillRect(random(0, 32), random(0, 128), random(1, 3), random(10, 40));
  }
  mat.waterTexture = new THREE.CanvasTexture(waterCanvas);
  mat.waterTexture.wrapS = mat.waterTexture.wrapT = THREE.RepeatWrapping;
  mat.waterTexture.repeat.set(1, 5);
  mat.water = new THREE.MeshBasicMaterial({ map: mat.waterTexture, transparent: true, opacity: 0.8, depthWrite: false });
  mat.foam = new THREE.MeshBasicMaterial({ color: "#eaf7ff" });
  mat.waterMist = mat.glow("#dff3ff");
  mat.heartGlow = mat.glow("#ff4d63");
  mat.boostGlow = mat.glow("#36dcc4");
}

function makeHeartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.6, -0.1, -0.6, 0.2);
  s.bezierCurveTo(-0.6, 0.45, -0.35, 0.6, -0.15, 0.55);
  s.bezierCurveTo(-0.05, 0.52, 0, 0.45, 0, 0.38);
  s.bezierCurveTo(0, 0.45, 0.05, 0.52, 0.15, 0.55);
  s.bezierCurveTo(0.35, 0.6, 0.6, 0.45, 0.6, 0.2);
  s.bezierCurveTo(0.6, -0.1, 0.15, -0.35, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  g.center();
  return g;
}

// Gradient sky dome that follows the camera
function makeSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(COLORS.skyTop) },
      bottom: { value: new THREE.Color(COLORS.haze) },
    },
    vertexShader: `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 bottom;
      varying float vHeight;
      void main() {
        gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.55, vHeight)), 1.0);
      }`,
  });
  world.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), material);
  world.sky.renderOrder = -1;

  // Low setting sun
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: COLORS.sun, fog: false, depthWrite: false })
  );
  sunDisc.position.set(-180, 45, 380);
  sunDisc.lookAt(0, 0, 0);
  world.sky.add(sunDisc);
  world.scene.add(world.sky);
}

// Mist hanging in the valleys, hilltops poke out above it
const MIST_LEVEL = -15;

function makeGround() {
  world.mist = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshBasicMaterial({ color: COLORS.mist, transparent: true, opacity: 0.3, depthWrite: false })
  );
  world.mist.rotation.x = -Math.PI / 2;
  world.mist.position.y = MIST_LEVEL;

  world.scene.add(world.mist);
}

// Big stepped temples on the horizon. They move with the player so they never get closer.
function makeDistantTemples() {
  world.temples = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: COLORS.temple, fog: false });
  const spots = [[-0.9, 300, 1.2], [-0.35, 340, 1.6], [0.15, 320, 1], [0.6, 300, 1.4], [1.3, 330, 0.9], [-1.5, 310, 1.1]];

  for (const [angle, dist, size] of spots) {
    const temple = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const w = (60 - i * 11) * size;
      const step = new THREE.Mesh(geo.box, material);
      step.scale.set(w, 9 * size, w);
      step.position.y = (i * 9 + 4.5) * size;
      temple.add(step);
    }
    temple.position.set(Math.sin(angle) * dist, -7, Math.cos(angle) * dist);
    world.temples.add(temple);
  }
  world.scene.add(world.temples);
}

// Small sparkle bursts when picking things up or smashing obstacles
function makeParticles() {
  const max = 400;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.4, map: mat.glowTexture, vertexColors: true, transparent: true, depthWrite: false }));
  points.frustumCulled = false;
  world.scene.add(points);
  world.particles = { points, list: [], max };
}

function burst(x, y, z, color, count = 14, power = 5) {
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    world.particles.list.push({
      x, y, z,
      vx: random(-1, 1) * power,
      vy: random(0.2, 1.2) * power,
      vz: random(-1, 1) * power,
      life: random(0.4, 0.8),
      color: c,
    });
  }
  const list = world.particles.list;
  if (list.length > world.particles.max) list.splice(0, list.length - world.particles.max);
}

// Scrolls the waterfall texture so the water flows
function updateWater() {
  mat.waterTexture.offset.y = (world.time * 1.6) % 1;
}

function updateParticles(dt) {
  const { points, list } = world.particles;
  const pos = points.geometry.attributes.position;
  const col = points.geometry.attributes.color;

  for (const p of list) {
    p.life -= dt;
    p.vy -= 14 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
  }
  world.particles.list = list.filter((p) => p.life > 0);

  world.particles.list.forEach((p, i) => {
    pos.setXYZ(i, p.x, p.y, p.z);
    col.setXYZ(i, p.color.r, p.color.g, p.color.b);
  });
  points.geometry.setDrawRange(0, world.particles.list.length);
  pos.needsUpdate = true;
  col.needsUpdate = true;
}

function resizeWorld() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  world.renderer.setSize(w, h, false);
  world.camera.aspect = w / h;
  // Narrow screens get a wider view so the lanes still fit
  world.baseFov = w / h < 0.8 ? 78 : 62;
  world.camera.fov = world.baseFov;
  world.camera.updateProjectionMatrix();
}

// ---- Building path segments ----

const dummy = new THREE.Object3D();

function matrixAt(x, y, z, rotY, sx = 1, sy = 1, sz = 1) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, rotY, 0);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

// Many copies of one mesh in a single draw call
function addInstances(group, geometry, material, list, shadows = true) {
  if (!list.length) return;
  const mesh = new THREE.InstancedMesh(geometry, material, list.length);
  list.forEach((item, i) => {
    mesh.setMatrixAt(i, item.matrix);
    if (item.color) mesh.setColorAt(i, new THREE.Color(item.color));
  });
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  group.add(mesh);
}

// Spots with no tiles: gaps, and traps that open a hole in the path
function inGap(seg, along) {
  return seg.items.some((i) => {
    const length = i.kind === "gap" ? OBSTACLES.gap.depth : TRAPS[i.kind]?.hole;
    return length && Math.abs(i.along - along) < length / 2;
  });
}

function buildSegment(seg, prev) {
  const group = new THREE.Group();
  const tiles = [];
  const footings = [];
  const vines = [];
  const grass = [];
  const flowers = [];
  const curbs = [];
  const trunks = [];
  const leaves = [];
  const pillars = [];

  const isCurve = seg.type === "curve";
  const step = isCurve ? 1.2 : 2;
  const start = !prev ? GATE_ALONG : prev.corner ? HALF_WIDTH : 0;
  const end = seg.corner ? seg.length - HALF_WIDTH : seg.length;

  // Stone tiles and the low curbs on both sides
  for (let t = start + step / 2; t < end; t += step) {
    if (inGap(seg, t)) continue;
    const p = pointOnSegment(seg, t);
    const shade = pick(COLORS.stone);
    tiles.push({ matrix: matrixAt(p.x, -0.5, p.z, p.heading), color: shade });
    // Narrower dark stone under the tiles gives the walkway some thickness
    footings.push({ matrix: matrixAt(p.x, -1.6, p.z, p.heading, HALF_WIDTH * 2 - 0.8, 1.2, step) });

    for (const side of [-1, 1]) {
      const c = pathToWorld(seg, t, side * (HALF_WIDTH - 0.22));
      curbs.push({ matrix: matrixAt(c.x, 0.14, c.z, p.heading, 1, 1, step / 1.94) });

      // Vines hanging over the edge
      if (Math.random() < 0.3) {
        const v = pathToWorld(seg, t + random(-0.6, 0.6), side * (HALF_WIDTH + 0.08));
        const length = random(1.2, 4.5);
        vines.push({ matrix: matrixAt(v.x, -length / 2 + 0.1, v.z, p.heading, 0.14, length, 0.14), color: pick(COLORS.leaves) });
        vines.push({ matrix: matrixAt(v.x, -length, v.z, random(0, 3), 0.32, 0.32, 0.32), color: pick(COLORS.leaves) });
      }

      // Grass tufts growing on the curbs, some with a flower
      if (Math.random() < 0.35) {
        const g = pathToWorld(seg, t + random(-0.8, 0.8), side * (HALF_WIDTH - 0.22));
        for (let k = 0; k < 3; k++) {
          grass.push({
            matrix: matrixAt(g.x + random(-0.15, 0.15), 0.4, g.z + random(-0.15, 0.15), random(0, 3), 0.08, random(0.25, 0.45), 0.08),
            color: pick(COLORS.leaves),
          });
        }
        if (Math.random() < 0.35) {
          flowers.push({ matrix: matrixAt(g.x, 0.56, g.z, random(0, 3), 0.13, 0.08, 0.13), color: pick(COLORS.flowers) });
        }
      }
    }
  }
  addInstances(group, isCurve ? geo.curveTile : geo.tile, mat.tile, tiles);
  addInstances(group, geo.curb, mat.curb, curbs);
  addInstances(group, geo.box, mat.stoneDark, footings, false);
  addInstances(group, geo.box, mat.leaves, vines, false);
  addInstances(group, geo.cone, mat.leaves, grass, false);
  addInstances(group, geo.box, mat.leaves, flowers, false);

  // Corner tile with curbs on the two closed sides so the dead end is obvious
  if (seg.corner) {
    const c = pointOnSegment(seg, seg.length);
    const tile = new THREE.Mesh(geo.corner, mat.cornerTile);
    tile.position.set(c.x, -0.5, c.z);
    tile.rotation.y = c.heading;
    tile.receiveShadow = true;
    const footing = new THREE.Mesh(geo.box, mat.stoneDark);
    footing.position.set(c.x, -1.6, c.z);
    footing.rotation.y = c.heading;
    footing.scale.set(HALF_WIDTH * 2 - 0.8, 1.2, HALF_WIDTH * 2 - 0.8);
    group.add(tile, footing);

    const closedSide = seg.corner === "left" ? 1 : -1;
    const wallA = new THREE.Mesh(geo.box, mat.curb);
    const front = pathToWorld(seg, seg.length + HALF_WIDTH - 0.22, 0);
    wallA.position.set(front.x, 0.3, front.z);
    wallA.rotation.y = c.heading;
    wallA.scale.set(HALF_WIDTH * 2, 0.6, 0.45);
    const side = pathToWorld(seg, seg.length, closedSide * (HALF_WIDTH - 0.22));
    const wallB = new THREE.Mesh(geo.box, mat.curb);
    wallB.position.set(side.x, 0.3, side.z);
    wallB.rotation.y = c.heading;
    wallB.scale.set(0.45, 0.6, HALF_WIDTH * 2);
    group.add(wallA, wallB);

    // Torches on the outer corner light the way
    addTorch(seg, group, pathToWorld(seg, seg.length + HALF_WIDTH - 0.3, closedSide * (HALF_WIDTH - 0.3)), 1.4);
  }

  if (!prev) addTempleGate(seg, group);

  // Stone pillars holding the path up
  for (let t = 6; t < seg.length - 2; t += 18) {
    if (inGap(seg, t)) continue;
    const p = pointOnSegment(seg, t);
    // Tall enough to reach the hills below
    pillars.push({ matrix: matrixAt(p.x, -19, p.z, p.heading, 1, 2, 1) });
  }
  addInstances(group, geo.pillar, mat.stoneDark, pillars, false);

  // Torches along the edges
  for (let t = 9; t < end - 3; t += 16) {
    const side = Math.floor(t / 16) % 2 ? 1 : -1;
    addTorch(seg, group, pathToWorld(seg, t, side * (HALF_WIDTH - 0.22)));
  }

  // Trees on both sides, skipping spots where the next or previous segment runs
  for (const side of [-1, 1]) {
    for (let t = random(0, 3); t < seg.length; t += random(3.5, 7)) {
      const turnSide = seg.corner === "left" ? -1 : 1;
      if (seg.corner && side === turnSide && t > seg.length - 6) continue;
      if (prev && prev.corner && side === (prev.corner === "left" ? -1 : 1) && t < 6) continue;

      let maxDist = 28;
      if (isCurve && side === -seg.bend) maxDist = Math.min(maxDist, seg.radius - 4);
      const dist = random(HALF_WIDTH + 4.5, maxDist);
      const p = pathToWorld(seg, t, side * dist);
      // Most treetops stay below the path, a few tall ones reach above it.
      // Trunks start a bit under the ground in case the hills shift later.
      const ground = terrainHeight(p.x, p.z) - 4;
      const top = Math.max(ground + 9, Math.random() < 0.2 ? random(2, 8) : random(-8, 1));
      const size = random(2.2, 3.6);

      // Trunk grows from the hills below up to the treetop
      trunks.push({ matrix: matrixAt(p.x, (top + ground) / 2, p.z, 0, 1, top - ground, 1) });
      for (let k = 0; k < 3; k++) {
        const ly = top - k * 2.4 + 1;
        const r = size * (0.6 + k * 0.3);
        leaves.push({
          matrix: matrixAt(p.x, ly, p.z, random(0, 3), r, 3.4, r),
          color: pick(COLORS.leaves),
        });
      }
    }
  }
  addInstances(group, geo.trunk, mat.trunk, trunks, false);
  addInstances(group, geo.cone, mat.leaves, leaves, false);
  addLandmark(seg, group, prev);

  for (const item of seg.items) {
    item.mesh = makeItemMesh(item);
    if (item.mesh) {
      placeItemMesh(seg, item);
      group.add(item.mesh);
    }
  }

  seg.group = group;
  world.scene.add(group);
}

// The temple the run starts from, the path comes out of its doorway
const GATE_ALONG = -24;

function addTempleGate(seg, group) {
  const p = pointOnSegment(seg, GATE_ALONG);
  const temple = new THREE.Group();
  temple.position.set(p.x, 0, p.z);
  temple.rotation.y = p.heading;

  const stone = mat.block;
  const piece = (material, w, h, d, x, y, z) => {
    const m = part(geo.box, material, w, h, d, x, y, z);
    temple.add(m);
    return m;
  };

  // Stepped temple body behind the gate, reaching all the way down to the ground
  piece(stone, 18, 50, 12, 0, -21, -6.2);
  piece(stone, 13, 4, 9, 0, 6, -6.5);
  piece(stone, 8, 3, 6, 0, 9.5, -6.5);
  piece(mat.moss, 18.2, 0.3, 12.2, 0, 4.05, -6.2);

  // Gate pillars, lintel and the dark doorway
  for (const side of [-1, 1]) piece(mat.stoneDark, 1.3, 6.4, 1.4, side * (HALF_WIDTH + 0.4), 3.2, 0);
  piece(mat.stoneDark, HALF_WIDTH * 2 + 2.6, 1.3, 1.8, 0, 6.9, 0);
  piece(mat.blockFace, HALF_WIDTH * 2 - 0.2, 6.3, 0.1, 0, 3.15, -0.25);

  // Carved face over the doorway
  piece(mat.block, 2.4, 1.6, 0.5, 0, 8.3, 0.3);
  piece(mat.blockFace, 0.5, 0.35, 0.1, -0.55, 8.5, 0.56);
  piece(mat.blockFace, 0.5, 0.35, 0.1, 0.55, 8.5, 0.56);
  piece(mat.blockFace, 1.2, 0.2, 0.1, 0, 7.95, 0.56);

  group.add(temple);
  for (const side of [-1, 1]) {
    addTorch(seg, group, pathToWorld(seg, GATE_ALONG + 1.6, side * (HALF_WIDTH - 0.3)), 1.4);
  }
}

// A big landmark out in the jungle now and then, facing the path
function addLandmark(seg, group, prev) {
  if (Math.random() > 0.5) return;
  const side = pick([-1, 1]);
  const dist = random(14, 26);
  const t = random(4, seg.length - 4);

  // Keep clear of the segments before and after a corner
  if (seg.corner && side === (seg.corner === "left" ? -1 : 1) && t > seg.length - 16) return;
  if (prev && prev.corner && side === (prev.corner === "left" ? -1 : 1) && t < 16) return;
  if (seg.type === "curve" && side === -seg.bend && dist > seg.radius - 6) return;

  const p = pathToWorld(seg, t, side * dist);
  // Landmarks stand on the ground, never in the water
  const ground = terrainHeight(p.x, p.z) - 0.5;
  if (ground < WATER_LEVEL + 1) return;
  const landmark = new THREE.Group();
  landmark.position.set(p.x, 0, p.z);
  landmark.rotation.y = p.heading + side * Math.PI / 2;

  if (Math.random() < 0.5) ruinedPillar(landmark, ground);
  else stoneHead(landmark, ground);
  group.add(landmark);
}

// Giant carved head half sunk into the hillside, staring at the runner
function stoneHead(g, ground) {
  g.position.y = ground + 0.2;
  g.scale.setScalar(1.4);
  g.add(part(geo.box, mat.block, 3.2, 3.6, 3, 0, 1.3, 0));
  g.add(part(geo.box, mat.moss, 3.3, 0.35, 3.1, 0, 3.2, 0));
  g.add(part(geo.box, mat.blockFace, 2.6, 0.3, 0.1, 0, 2.4, 1.52)); // brow
  for (const x of [-0.7, 0.7]) {
    g.add(part(geo.box, mat.blockFace, 0.6, 0.45, 0.1, x, 1.9, 1.52)); // eyes
    g.add(part(geo.box, mat.block, 0.35, 1, 0.6, x * 2.5, 1.4, 0)); // ears
  }
  g.add(part(geo.box, mat.block, 0.7, 1, 0.5, 0, 1.2, 1.6)); // nose
  g.add(part(geo.box, mat.blockFace, 1.6, 0.3, 0.1, 0, 0.35, 1.52)); // mouth
}

// Broken temple column rising out of the jungle
function ruinedPillar(g, ground) {
  geo.column ??= new THREE.CylinderGeometry(0.9, 1.05, 1, 8);
  const top = ground + random(5, 11);
  g.add(part(geo.column, mat.block, 1, top - ground, 1, 0, (top + ground) / 2, 0));
  g.add(part(geo.column, mat.moss, 1.08, 0.5, 1.08, 0, top - 1.2, 0));
  const cap = part(geo.box, mat.block, 2.3, 0.7, 2.3, 0.2, top + 0.2, 0);
  cap.rotation.z = random(-0.35, 0.35);
  g.add(cap);
}

function addTorch(seg, group, pos, scale = 1) {
  const torch = new THREE.Group();
  const post = new THREE.Mesh(geo.box, mat.woodDark);
  post.scale.set(0.22, 1.5, 0.22);
  post.position.y = 0.75;
  const bowl = new THREE.Mesh(geo.box, mat.grate);
  bowl.scale.set(0.45, 0.2, 0.45);
  bowl.position.y = 1.55;
  const flame = new THREE.Mesh(geo.cone, mat.flame);
  flame.scale.set(0.25, 0.7, 0.25);
  flame.position.y = 1.95;
  const core = new THREE.Mesh(geo.cone, mat.flameCore);
  core.scale.set(0.13, 0.4, 0.13);
  core.position.y = 1.85;
  torch.add(post, bowl, flame, core);
  torch.position.set(pos.x, 0, pos.z);
  torch.scale.setScalar(scale);
  group.add(torch);

  seg.flames = seg.flames || [];
  seg.flames.push(flame, core);
}

function removeSegment(seg) {
  if (!seg.group) return;
  seg.group.traverse((o) => o.isInstancedMesh && o.dispose());
  world.scene.remove(seg.group);
  seg.group = null;
  seg.items = [];
  seg.flames = [];
}

// ---- Obstacles and pickups ----

function part(geometry, material, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeItemMesh(item) {
  const g = new THREE.Group();

  switch (item.kind) {
    case "block":
      g.add(part(geo.box, mat.block, 1.6, 2.4, 1.4, 0, 1.2));
      g.add(part(geo.box, mat.moss, 1.7, 0.18, 1.5, 0, 2.45));
      // Carved face looking at the player
      g.add(part(geo.box, mat.blockFace, 0.35, 0.3, 0.06, -0.35, 1.7, -0.71));
      g.add(part(geo.box, mat.blockFace, 0.35, 0.3, 0.06, 0.35, 1.7, -0.71));
      g.add(part(geo.box, mat.blockFace, 0.9, 0.18, 0.06, 0, 1.15, -0.71));
      break;

    case "log": {
      const log = part(geo.log, mat.wood, 1, 1, 1, 0, 0.42);
      log.rotation.z = Math.PI / 2;
      g.add(log);
      g.add(part(geo.box, mat.moss, 1.2, 0.12, 0.5, -1.2, 0.84));
      g.add(part(geo.box, mat.moss, 0.8, 0.12, 0.45, 1.8, 0.82));
      break;
    }

    case "beam":
      for (const x of [-HALF_WIDTH - 0.1, HALF_WIDTH + 0.1]) {
        g.add(part(geo.box, mat.woodDark, 0.5, 3.4, 0.5, x, 1.7));
      }
      g.add(part(geo.box, mat.wood, HALF_WIDTH * 2 + 1, 0.9, 0.6, 0, 1.55));
      // Hanging vines show how low the beam reaches
      for (const x of [-2.4, -0.6, 1.1, 2.6]) {
        g.add(part(geo.box, mat.moss, 0.12, 0.5, 0.12, x, 0.9));
      }
      break;

    case "fire":
      g.add(part(geo.box, mat.grate, 1.7, 0.14, 1.6, 0, 0.07));
      item.flames = [];
      for (const [x, z, s] of [[-0.45, -0.3, 1], [0.4, -0.2, 0.85], [0, 0.35, 1.1], [-0.3, 0.45, 0.7], [0.45, 0.4, 0.8]]) {
        const flame = part(geo.cone, mat.flame, 0.32 * s, 1 * s, 0.32 * s, x, 0.5 * s + 0.1, z);
        const core = part(geo.cone, mat.flameCore, 0.16 * s, 0.55 * s, 0.16 * s, x, 0.3 * s + 0.1, z);
        flame.castShadow = core.castShadow = false;
        g.add(flame, core);
        item.flames.push(flame, core);
      }
      break;

    case "roller": {
      const wheel = new THREE.Group();
      const body = part(geo.roller, mat.roller, 1, 1, 1);
      body.rotation.x = Math.PI / 2;
      wheel.add(body);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spike = part(geo.cone, mat.stoneDark, 0.14, 0.4, 0.14, Math.cos(a) * 0.55, Math.sin(a) * 0.55, (i % 2 ? 0.35 : -0.35));
        spike.rotation.z = a - Math.PI / 2;
        wheel.add(spike);
      }
      wheel.position.y = 0.48;
      g.add(wheel);
      item.wheel = wheel;
      break;
    }

    case "coin":
    case "bigCoin": {
      const coin = new THREE.Group();
      const face = part(geo.coin, mat.coin, 1, 1, 1);
      face.rotation.x = Math.PI / 2;
      const inner = part(geo.coinInner, mat.coinInner, 1, 1, 1);
      inner.rotation.x = Math.PI / 2;
      coin.add(face, inner);
      const glow = new THREE.Sprite(mat.coinGlow);
      glow.scale.setScalar(1.2);
      g.add(coin, glow);
      if (item.kind === "bigCoin") g.scale.setScalar(1.7);
      item.spin = coin;
      break;
    }

    case "boost": {
      g.add(part(geo.box, mat.boost, 1.7, 0.08, 2.6, 0, 0.04));
      // Two arrows pointing forward
      for (const z of [-0.5, 0.5]) {
        for (const side of [-1, 1]) {
          const arrow = part(geo.box, mat.boostArrow, 0.14, 0.04, 0.8, side * 0.25, 0.1, z);
          arrow.rotation.y = side * -0.7;
          g.add(arrow);
        }
      }
      const glow = new THREE.Sprite(mat.boostGlow);
      glow.scale.set(3, 1.5, 1);
      glow.position.y = 0.3;
      g.add(glow);
      break;
    }

    case "heart": {
      const heart = part(geo.heart, mat.heart, 1, 1, 1);
      const glow = new THREE.Sprite(mat.heartGlow);
      glow.scale.setScalar(2.2);
      g.add(heart, glow);
      item.spin = heart;
      break;
    }

    default:
      // Traps build their own mesh, gaps have none since the missing tiles are the obstacle
      return TRAPS[item.kind] ? TRAPS[item.kind].make(item) : null;
  }

  return g;
}

function itemLateral(item) {
  if (item.kind === "roller") return Math.sin(world.time * 1.4 + item.phase) * LANE;
  return item.lateral;
}

function placeItemMesh(seg, item) {
  const p = pathToWorld(seg, item.along, itemLateral(item));
  item.mesh.position.set(p.x, item.y, p.z);
  item.mesh.rotation.y = p.heading;
}

// Animations for torches, coins and moving obstacles on the visible segments
function animateSegment(seg, dt) {
  const t = world.time;
  for (const f of seg.flames || []) {
    f.scale.y = (f.userData.baseY ??= f.scale.y) * (0.85 + Math.sin(t * 14 + f.id) * 0.15);
  }

  for (const item of seg.items) {
    if (!item.mesh) continue;

    // Picked up items float up, swell and vanish
    if (item.pop > 0) {
      item.baseScale ??= item.mesh.scale.x;
      item.pop -= dt;
      item.mesh.position.y += dt * 5;
      item.mesh.scale.setScalar(item.baseScale * (1 + (POP_TIME - item.pop) * 3) * Math.max(0, item.pop / POP_TIME));
      if (item.pop <= 0) item.mesh.visible = false;
      continue;
    }
    if (item.done) continue;

    if (item.spin) {
      item.spin.rotation.y += dt * 3;
      if (item.kind === "heart") item.mesh.position.y = item.y + Math.sin(t * 3) * 0.15;
    }
    if (item.flames) {
      item.flames.forEach((f, i) => {
        f.scale.y = (f.userData.baseY ??= f.scale.y) * (0.8 + Math.sin(t * 16 + i * 1.7) * 0.2);
      });
    }
    if (item.kind === "roller") {
      const before = item.mesh.position.clone();
      placeItemMesh(seg, item);
      item.wheel.rotation.z -= before.distanceTo(item.mesh.position) / 0.45 * Math.sign(Math.cos(t * 1.4 + item.phase));
    }
    if (item.pulled) placeItemMesh(seg, item);
    TRAPS[item.kind]?.animate?.(item, seg, dt);
  }
}

// Camera sits behind the player and swings smoothly around corners
function updateCamera(dt, pos, heading, boosting, showcase) {
  // Widen the view while boosting so it feels faster
  const fov = world.baseFov + (boosting ? 14 : 0);
  if (Math.abs(world.camera.fov - fov) > 0.05) {
    world.camera.fov += (fov - world.camera.fov) * Math.min(1, dt * 4);
    world.camera.updateProjectionMatrix();
  }

  let diff = heading - world.camHeading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  world.camHeading += diff * Math.min(1, dt * 7);

  // Showcase swings the camera around to the front of the runner
  world.showcase = (world.showcase || 0) + ((showcase ? 1 : 0) - (world.showcase || 0)) * Math.min(1, dt * 3);
  const m = world.showcase * world.showcase * (3 - 2 * world.showcase);
  const mix = (a, b) => a + (b - a) * m;

  // Keep the last showcase shot while swinging back, so it does not jump
  if (showcase) world.shot = showcase;
  const narrow = world.camera.aspect < 0.8;
  const target = world.shot === "intro"
    ? { orbit: 0.3, dist: narrow ? 8 : 6.5, height: 2.6, lookY: 1, side: 0 }
    : { orbit: 0.35 + Math.sin(world.time * 0.4) * 0.2, dist: narrow ? 5.2 : 4.4, height: 1.9, lookY: narrow ? -1.1 : 1.1, side: narrow ? 0 : 1.5 };

  // Ease between shots, like going from the menu straight into the intro
  world.shotNow ??= { ...target };
  const shot = world.shotNow;
  for (const key in target) shot[key] += (target[key] - shot[key]) * Math.min(1, dt * 3);

  const orbit = mix(Math.PI, shot.orbit);
  const dist = mix(7.5, shot.dist);
  const o = forward(world.camHeading + orbit);
  const cam = world.camera;
  cam.position.set(pos.x + o.x * dist, mix(pos.y * 0.5 + 4.6, shot.height), pos.z + o.z * dist);
  if (world.shake > 0) {
    world.shake -= dt;
    cam.position.x += random(-1, 1) * world.shake;
    cam.position.y += random(-1, 1) * world.shake;
  }

  // On the side panels the runner sits next to the panel, or above it on phones
  const f = forward(world.camHeading);
  const r = rightOf(world.camHeading);
  cam.lookAt(
    mix(pos.x + f.x * 8, pos.x + r.x * shot.side),
    mix(1.2 + pos.y * 0.3, shot.lookY),
    mix(pos.z + f.z * 8, pos.z + r.z * shot.side)
  );

  // Things that stay put relative to the player
  world.sky.position.copy(cam.position);
  world.temples.position.set(pos.x, 0, pos.z);
  world.mist.position.set(pos.x, MIST_LEVEL, pos.z);
  world.sun.position.set(pos.x - 30, 45, pos.z + 25);
  world.sun.target.position.set(pos.x, 0, pos.z);
}

function renderWorld() {
  world.renderer.render(world.scene, world.camera);
}
