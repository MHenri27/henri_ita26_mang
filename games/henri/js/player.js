// Player movement and the little explorer model

function createPlayer() {
  return {
    seg: 0,           // index of the segment the player is on
    along: 0,         // distance along that segment
    x: 0,             // sideways offset, slides toward lane
    lane: 0,          // target lane: -1, 0 or 1
    y: 0,
    vy: 0,
    slide: 0,         // time left in the slide
    pendingTurn: null,
    phase: 0,         // running animation
  };
}

function onGround(p) {
  return p.y <= 0 && p.vy <= 0;
}

function playerHeight(p) {
  return p.slide > 0 ? SLIDE_HEIGHT : PLAYER_HEIGHT;
}

function playerJump(p) {
  if (!onGround(p)) return false;
  p.vy = JUMP_SPEED;
  p.slide = 0;
  return true;
}

function playerSlide(p) {
  // Sliding in the air drops the player down fast
  if (!onGround(p)) p.vy = -JUMP_SPEED * 1.4;
  const wasSliding = p.slide > 0;
  p.slide = SLIDE_TIME;
  return !wasSliding;
}

function updatePlayerMotion(p, dt, speed) {
  // Slide toward the target lane
  const target = p.lane * LANE;
  const diff = target - p.x;
  const step = LANE_SWITCH_SPEED * dt;
  p.x = Math.abs(diff) < step ? target : p.x + Math.sign(diff) * step;

  // Gravity
  if (!onGround(p)) {
    p.vy -= GRAVITY * dt;
    p.y = Math.max(0, p.y + p.vy * dt);
    if (p.y === 0) p.vy = 0;
  }

  p.slide = Math.max(0, p.slide - dt);
  p.phase += dt * speed * 0.75;
}

// ---- Model ----

function makePlayerMesh() {
  const c = {
    shirt: standard("#e9e1cc"),
    pants: standard("#5e4b35"),
    skin: standard("#d8a07a"),
    hat: standard("#9a7444"),
    hatBand: standard("#4a3524"),
    boots: standard("#3a2a1e"),
    scarf: standard("#f2a541"),
    pack: standard("#7a5a36"),
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const box = (material, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(geo.box, material);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };

  // Legs swing from the hip
  const legs = [-0.15, 0.15].map((x) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.85, 0);
    leg.add(box(c.pants, 0.24, 0.7, 0.26, 0, -0.35, 0));
    leg.add(box(c.boots, 0.26, 0.18, 0.34, 0, -0.76, 0.04));
    body.add(leg);
    return leg;
  });

  // Arms swing from the shoulder
  const arms = [-0.42, 0.42].map((x) => {
    const arm = new THREE.Group();
    arm.position.set(x, 1.48, 0);
    arm.add(box(c.shirt, 0.18, 0.5, 0.2, 0, -0.25, 0));
    arm.add(box(c.skin, 0.16, 0.16, 0.18, 0, -0.56, 0));
    body.add(arm);
    return arm;
  });

  body.add(box(c.shirt, 0.62, 0.68, 0.36, 0, 1.18, 0));
  body.add(box(c.pack, 0.46, 0.5, 0.22, 0, 1.22, -0.28));
  body.add(box(c.scarf, 0.66, 0.12, 0.4, 0, 1.5, 0));
  const scarfTail = box(c.scarf, 0.14, 0.34, 0.08, 0.18, 1.36, -0.24);
  body.add(scarfTail);
  body.add(box(c.skin, 0.38, 0.38, 0.38, 0, 1.76, 0));

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), c.hat);
  brim.position.y = 1.97;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.24, 12), c.hat);
  crown.position.y = 2.1;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.07, 12), c.hatBand);
  band.position.y = 2.02;
  brim.castShadow = crown.castShadow = true;
  body.add(brim, crown, band);

  root.userData = { body, legs, arms, scarfTail };
  return root;
}

function updatePlayerMesh(mesh, p, seg, invulnerable) {
  const { body, legs, arms, scarfTail } = mesh.userData;
  const pos = pathToWorld(seg, p.along, p.x);
  mesh.position.set(pos.x, p.y, pos.z);

  // Face along the path and lean a bit into lane changes
  const leanAmount = (p.lane * LANE - p.x) * 0.12;
  mesh.rotation.set(0, pos.heading, 0);
  body.rotation.z = -leanAmount;

  const swing = Math.sin(p.phase);

  if (p.slide > 0) {
    body.rotation.x = -1.15;
    body.position.y = 0.32;
    body.position.z = -0.3;
    legs.forEach((l) => (l.rotation.x = -1.2));
    arms.forEach((a) => (a.rotation.x = -2.4));
  } else if (!onGround(p)) {
    body.rotation.x = 0.1;
    body.position.set(0, 0, 0);
    legs[0].rotation.x = -0.9;
    legs[1].rotation.x = 0.5;
    arms[0].rotation.x = -2.5;
    arms[1].rotation.x = -2.2;
  } else {
    body.rotation.x = 0.12;
    body.position.set(0, Math.abs(Math.cos(p.phase)) * 0.08, 0);
    legs[0].rotation.x = swing * 0.9;
    legs[1].rotation.x = -swing * 0.9;
    arms[0].rotation.x = -swing * 0.8;
    arms[1].rotation.x = swing * 0.8;
  }
  scarfTail.rotation.x = -0.6 + Math.sin(p.phase * 2) * 0.25;

  // Blink while invulnerable after a hit
  mesh.visible = !invulnerable || Math.floor(world.time * 12) % 2 === 0;
  return pos;
}
