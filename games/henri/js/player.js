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
    stumble: 0,       // stagger timer after a hit
    cheer: 0,         // little celebration after picking new clothes
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
  p.stumble = Math.max(0, p.stumble - dt);

  p.slide = Math.max(0, p.slide - dt);
  p.phase += dt * speed * 0.75;
  return landed;
}

// ---- Model ----

function makePlayerMesh(look) {
  const c = {
    shirt: standard(look.outfit.shirt),
    pants: standard(look.outfit.pants),
    skin: standard(look.skin.color),
    boots: standard(look.outfit.boots),
    scarf: standard(look.scarf.color),
    hatBand: standard("#4a3524"),
    leather: standard("#7a5a36"),
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
  body.add(box(c.hatBand, 0.64, 0.08, 0.38, 0, 0.88, 0)); // belt
  body.add(box(c.scarf, 0.66, 0.12, 0.4, 0, 1.5, 0));
  const cape = addGear(look.gear.id, body, c, box);
  const scarfTail = box(c.scarf, 0.14, 0.34, 0.08, 0.18, 1.36, -0.24);
  body.add(scarfTail);

  // Head and hat turn together
  const head = new THREE.Group();
  head.position.y = 1.57;
  head.add(box(c.skin, 0.38, 0.38, 0.38, 0, 0.19, 0));
  // Simple face: eyes, brows and a mouth
  const dark = standard("#2a1d14");
  for (const x of [-0.09, 0.09]) {
    head.add(box(dark, 0.06, 0.07, 0.02, x, 0.24, 0.19));
    head.add(box(c.hatBand, 0.1, 0.025, 0.02, x, 0.3, 0.19));
  }
  head.add(box(dark, 0.12, 0.025, 0.02, 0, 0.12, 0.19));
  addHat(look.hat.id, head, c, box);
  body.add(head);

  root.userData = { body, legs, arms, head, scarfTail, cape, pose: { ...POSE_ZERO } };
  return root;
}

function cylinder(material, rTop, rBottom, h, y, segments = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  m.position.y = y;
  m.castShadow = true;
  return m;
}

// Hats sit on the head group, the head box top is at y 0.38
function addHat(id, head, c, box) {
  if (id === "fedora") {
    const felt = standard("#9a7444");
    head.add(cylinder(felt, 0.42, 0.42, 0.05, 0.4), cylinder(felt, 0.22, 0.26, 0.24, 0.53), cylinder(c.hatBand, 0.265, 0.265, 0.07, 0.45));
  } else if (id === "cap") {
    const green = standard("#4f6b3a");
    head.add(box(green, 0.42, 0.14, 0.42, 0, 0.43, 0), box(green, 0.36, 0.03, 0.22, 0, 0.38, 0.27));
  } else if (id === "bandana") {
    const red = standard("#c2412f");
    head.add(box(red, 0.41, 0.13, 0.41, 0, 0.33, 0), box(red, 0.1, 0.1, 0.08, 0, 0.32, -0.23));
    head.add(box(red, 0.06, 0.2, 0.03, -0.04, 0.2, -0.25), box(red, 0.06, 0.16, 0.03, 0.05, 0.22, -0.25));
  } else if (id === "safari") {
    const khaki = standard("#d9cfae");
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), khaki);
    dome.position.y = 0.38;
    dome.castShadow = true;
    head.add(dome, cylinder(khaki, 0.36, 0.36, 0.04, 0.39), cylinder(c.hatBand, 0.272, 0.272, 0.06, 0.42));
  } else if (id === "crown") {
    const gold = standard("#f2c14e", { metalness: 0.7, roughness: 0.3, emissive: "#6a4a00", emissiveIntensity: 0.4 });
    const ruby = standard("#d8303f", { emissive: "#5a0a10" });
    head.add(cylinder(gold, 0.22, 0.2, 0.14, 0.45, 8));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(geo.cone, gold);
      spike.scale.set(0.06, 0.14, 0.06);
      spike.position.set(Math.sin(a) * 0.19, 0.58, Math.cos(a) * 0.19);
      head.add(spike);
    }
    head.add(box(ruby, 0.07, 0.07, 0.03, 0, 0.45, 0.22));
  } else {
    head.add(box(standard("#3b2a1e"), 0.4, 0.08, 0.4, 0, 0.41, 0)); // hair
  }
}

// Things worn on the back. Returns the cape group so it can flutter.
function addGear(id, body, c, box) {
  if (id === "backpack") {
    body.add(box(c.leather, 0.46, 0.5, 0.22, 0, 1.22, -0.28));
    const roll = cylinder(standard("#5f7d4a"), 0.09, 0.09, 0.5, 0, 8);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 1.52, -0.3);
    body.add(roll);
  } else if (id === "satchel") {
    const strap = box(c.leather, 0.07, 0.8, 0.39, 0, 1.18, 0);
    strap.rotation.z = 0.7;
    body.add(strap, box(c.leather, 0.32, 0.28, 0.14, 0.3, 0.86, 0.12));
  } else if (id === "cape") {
    const cape = new THREE.Group();
    cape.position.set(0, 1.5, -0.2);
    cape.add(box(c.scarf, 0.6, 0.95, 0.04, 0, -0.47, 0));
    body.add(cape);
    return cape;
  }
  return null;
}

const CHEER_TIME = 0.8;

// Every pose sets these numbers, and the model blends toward them
const POSE_ZERO = {
  lean: 0, y: 0, z: 0,
  legL: 0, legR: 0, kneeL: 0, kneeR: 0,
  armL: 0, armR: 0, elbowL: 0, elbowR: 0,
  head: 0, headTurn: 0,
};

function targetPose(p, mode) {
  const s = Math.sin(p.phase);
  const c = Math.cos(p.phase);

  // Hop with both arms up after trying something on
  if (mode === "idle" && p.cheer > 0) {
    const wave = Math.sin(world.time * 18) * 0.3;
    return {
      ...POSE_ZERO, y: Math.sin((p.cheer / CHEER_TIME) * Math.PI) * 0.35,
      kneeL: 0.3, kneeR: 0.3,
      armL: -2.8 + wave, armR: -2.8 - wave, elbowL: -0.3, elbowR: -0.3,
      head: -0.2,
    };
  }

  // Standing around on the menu: breathing and looking about
  if (mode === "idle") {
    const t = world.time;
    const breath = Math.sin(t * 2.2);
    return {
      ...POSE_ZERO, y: breath * 0.015,
      kneeL: 0.05, kneeR: 0.05, legL: -0.05, legR: 0.08,
      armL: 0.08 + breath * 0.04, armR: -0.08 - breath * 0.04, elbowL: -0.25, elbowR: -0.25,
      head: Math.sin(t * 0.9) * 0.08, headTurn: Math.sin(t * 0.6) * 0.6,
    };
  }

  // Startled look over the shoulder when the monkeys show up
  if (mode === "startled") {
    return {
      ...POSE_ZERO, lean: -0.15, y: 0.05,
      legL: -0.2, kneeL: 0.3, legR: 0.25, kneeR: 0.2,
      armL: -2.2, armR: -1.6, elbowL: -0.8, elbowR: -0.9,
      head: -0.1, headTurn: 1.3,
    };
  }

  // Out of hearts: face down on the stones
  if (mode === "dead") {
    return {
      ...POSE_ZERO, lean: 1.45, y: 0.22, z: -0.2,
      legL: 0.1, legR: -0.2, kneeR: 0.7,
      armL: -2.9, armR: -2.6, elbowR: -0.5, head: -0.6,
    };
  }

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

  // Stagger forward with flailing arms after a hit
  if (p.stumble > 0) {
    const flail = Math.sin(world.time * 30) * 0.5;
    return {
      ...POSE_ZERO, lean: 0.65, y: 0,
      legL: s * 0.9, kneeL: 0.6, legR: -s * 0.9, kneeR: 0.6,
      armL: -2.6 + flail, armR: -2.2 - flail, elbowL: -0.4, elbowR: -0.4,
      head: -0.5,
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
  rig.head.rotation.y = pose.headTurn;
}

function updatePlayerMesh(mesh, p, seg, mode, blink, dt) {
  const rig = mesh.userData;
  const pos = pathToWorld(seg, p.along, p.x);
  mesh.position.set(pos.x, p.y, pos.z);

  // Turn smoothly toward the path direction, so corners swing instead of snap
  rig.heading ??= pos.heading;
  const diff = Math.atan2(Math.sin(pos.heading - rig.heading), Math.cos(pos.heading - rig.heading));
  rig.heading += diff * Math.min(1, dt * 14);
  mesh.rotation.set(0, rig.heading, 0);

  // Lean into lane changes and corners
  const leanAmount = (p.lane * LANE - p.x) * 0.12 - diff * 0.5;
  rig.body.rotation.z = -leanAmount;

  // Running is fast enough to follow the cycle closely, other poses ease in
  const running = mode === "run" && onGround(p) && p.slide <= 0 && p.stumble <= 0;
  const k = running ? 0.6 : Math.min(1, dt * (mode === "dead" ? 8 : 14));
  applyPose(rig, targetPose(p, mode), k);

  // Stretch on the way up, squash when landing
  let squash = 1;
  if (!onGround(p)) squash = 1 + clamp(p.vy / JUMP_SPEED, 0, 1) * 0.12;
  if (p.land > 0) squash = 1 - p.land * 1.2;
  const wide = 1 + (1 - squash) * 0.6;
  mesh.scale.set(wide, squash, wide);
  rig.scarfTail.rotation.x = -0.6 + Math.sin(p.phase * 2) * 0.25;
  if (rig.cape) {
    const flutter = mode === "run" ? 0.55 + Math.sin(world.time * 14) * 0.1 : 0.06 + Math.sin(world.time * 2) * 0.03;
    rig.cape.rotation.x += (flutter - rig.cape.rotation.x) * Math.min(1, dt * 8);
  }

  // Blink while invulnerable after a hit
  mesh.visible = !blink || Math.floor(world.time * 12) % 2 === 0;
  return pos;
}
