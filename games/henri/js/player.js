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
    land: 0,          // squash timer after landing
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

  // Gravity, returns true on the frame the player lands
  let landed = false;
  if (!onGround(p)) {
    p.vy -= GRAVITY * dt;
    p.y = Math.max(0, p.y + p.vy * dt);
    if (p.y === 0) {
      p.vy = 0;
      p.land = 0.15;
      landed = true;
    }
  }
  p.land = Math.max(0, p.land - dt);

  p.slide = Math.max(0, p.slide - dt);
  p.phase += dt * speed * 0.75;
  return landed;
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

  // Legs: thigh swings from the hip, shin bends at the knee
  const legs = [-0.15, 0.15].map((x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.86, 0);
    hip.add(box(c.pants, 0.24, 0.42, 0.26, 0, -0.21, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    knee.add(box(c.pants, 0.22, 0.34, 0.24, 0, -0.17, 0));
    knee.add(box(c.boots, 0.26, 0.16, 0.34, 0, -0.36, 0.04));
    hip.add(knee);
    body.add(hip);
    return { hip, knee };
  });

  // Arms: upper arm from the shoulder, forearm bends at the elbow
  const arms = [-0.42, 0.42].map((x) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 1.48, 0);
    shoulder.add(box(c.shirt, 0.18, 0.3, 0.2, 0, -0.15, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    elbow.add(box(c.shirt, 0.16, 0.22, 0.18, 0, -0.11, 0));
    elbow.add(box(c.skin, 0.16, 0.14, 0.18, 0, -0.28, 0));
    shoulder.add(elbow);
    body.add(shoulder);
    return { shoulder, elbow };
  });

  body.add(box(c.shirt, 0.62, 0.68, 0.36, 0, 1.18, 0));
  body.add(box(c.pack, 0.46, 0.5, 0.22, 0, 1.22, -0.28));
  body.add(box(c.scarf, 0.66, 0.12, 0.4, 0, 1.5, 0));
  const scarfTail = box(c.scarf, 0.14, 0.34, 0.08, 0.18, 1.36, -0.24);
  body.add(scarfTail);

  // Head and hat turn together
  const head = new THREE.Group();
  head.position.y = 1.57;
  head.add(box(c.skin, 0.38, 0.38, 0.38, 0, 0.19, 0));
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), c.hat);
  brim.position.y = 0.4;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.24, 12), c.hat);
  crown.position.y = 0.53;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.07, 12), c.hatBand);
  band.position.y = 0.45;
  brim.castShadow = crown.castShadow = true;
  head.add(brim, crown, band);
  body.add(head);

  root.userData = { body, legs, arms, head, scarfTail, pose: { ...POSE_ZERO } };
  return root;
}

// Every pose sets these numbers, and the model blends toward them
const POSE_ZERO = {
  lean: 0, y: 0, z: 0,
  legL: 0, legR: 0, kneeL: 0, kneeR: 0,
  armL: 0, armR: 0, elbowL: 0, elbowR: 0,
  head: 0,
};

function targetPose(p) {
  const s = Math.sin(p.phase);
  const c = Math.cos(p.phase);

  // Feet first slide: lying back, one leg bent, a hand trailing on the ground
  if (p.slide > 0) {
    return {
      ...POSE_ZERO, lean: -1.25, y: 0.14, z: 0.8,
      legL: -0.05, legR: -0.6, kneeR: 1.3,
      armL: 1.1, elbowL: -0.2, armR: -1.5, elbowR: -0.7,
      head: 0.95,
    };
  }

  if (!onGround(p)) {
    return {
      ...POSE_ZERO, lean: 0.15,
      legL: -0.9, kneeL: 1.4, legR: 0.4, kneeR: 1.1,
      armL: -2.6, armR: -2.3, elbowL: -0.3, elbowR: -0.4,
    };
  }

  // Running cycle: legs and arms swing opposite, knees fold on the back swing
  return {
    ...POSE_ZERO,
    lean: 0.18,
    y: Math.abs(c) * 0.08,
    legL: s * 0.8, kneeL: 0.2 + Math.max(0, c) * 1.2,
    legR: -s * 0.8, kneeR: 0.2 + Math.max(0, -c) * 1.2,
    armL: -s * 0.8, armR: s * 0.8,
    elbowL: -1.1, elbowR: -1.1,
    head: -0.1,
  };
}

function applyPose(rig, target, k) {
  const pose = rig.pose;
  for (const key in pose) pose[key] += (target[key] - pose[key]) * k;

  rig.body.rotation.x = pose.lean;
  rig.body.position.set(0, pose.y, pose.z);
  rig.legs[0].hip.rotation.x = pose.legL;
  rig.legs[1].hip.rotation.x = pose.legR;
  rig.legs[0].knee.rotation.x = pose.kneeL;
  rig.legs[1].knee.rotation.x = pose.kneeR;
  rig.arms[0].shoulder.rotation.x = pose.armL;
  rig.arms[1].shoulder.rotation.x = pose.armR;
  rig.arms[0].elbow.rotation.x = pose.elbowL;
  rig.arms[1].elbow.rotation.x = pose.elbowR;
  rig.head.rotation.x = pose.head;
}

function updatePlayerMesh(mesh, p, seg, invulnerable, dt) {
  const rig = mesh.userData;
  const pos = pathToWorld(seg, p.along, p.x);
  mesh.position.set(pos.x, p.y, pos.z);

  // Face along the path and lean a bit into lane changes
  const leanAmount = (p.lane * LANE - p.x) * 0.12;
  mesh.rotation.set(0, pos.heading, 0);
  rig.body.rotation.z = -leanAmount;

  // Running is fast enough to follow the cycle closely, other poses ease in
  const k = onGround(p) && p.slide <= 0 ? 0.6 : Math.min(1, dt * 14);
  applyPose(rig, targetPose(p), k);

  // Stretch on the way up, squash when landing
  let squash = 1;
  if (!onGround(p)) squash = 1 + clamp(p.vy / JUMP_SPEED, 0, 1) * 0.12;
  if (p.land > 0) squash = 1 - p.land * 1.2;
  const wide = 1 + (1 - squash) * 0.6;
  mesh.scale.set(wide, squash, wide);
  rig.scarfTail.rotation.x = -0.6 + Math.sin(p.phase * 2) * 0.25;

  // Blink while invulnerable after a hit
  mesh.visible = !invulnerable || Math.floor(world.time * 12) % 2 === 0;
  return pos;
}
