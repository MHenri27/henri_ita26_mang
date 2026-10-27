// Main game loop: movement, corners, collisions and switching screens
const canvas = document.getElementById("game");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

createWorld(canvas);
const playerMesh = makePlayerMesh();
world.scene.add(playerMesh);

let state = "menu"; // menu, shop, playing, paused, over
let shopReturn = "menu";
let path = null;
let run = null;
let lastTime = 0;

function newRun() {
  if (path) path.segments.forEach(removeSegment);
  path = createPath();
  extendPath(path, VIEW_AHEAD);

  run = {
    speed: START_SPEED,
    distance: 0,
    coins: 0,
    deposited: 0,    // coins already moved into the wallet
    hearts: startHearts(),
    boost: upgradeLevel("headstart") ? boostTime() + 1 : 0,
    hurt: 0,
    revives: 0,
    player: createPlayer(),
  };
  world.camHeading = 0;
}

function scoreOf(r) {
  return Math.floor(r.distance) + r.coins * COIN_SCORE;
}

function reviveCost() {
  return REVIVE_COST * 2 ** run.revives;
}

function startRun() {
  newRun();
  state = "playing";
  showScreen("playing");
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
    showScreen("paused");
  } else if (state === "paused") {
    state = "playing";
    showScreen("playing");
  }
}

function openShop(from) {
  shopReturn = from;
  state = "shop";
  renderShop();
  showScreen("shop");
}

function closeShop() {
  state = shopReturn;
  showScreen(shopReturn);
  if (shopReturn === "over") renderOver(run, scoreOf(run), false, reviveCost());
}

function endRun() {
  state = "over";
  updateHud(run, scoreOf(run));

  // Coins from this run go into the wallet
  save.wallet += run.coins - run.deposited;
  run.deposited = run.coins;

  const score = scoreOf(run);
  const isBest = score > save.best;
  if (isBest) save.best = score;
  writeSave();

  renderOver(run, score, isBest, reviveCost());
  showScreen("over");
}

function revive() {
  const cost = reviveCost();
  if (save.wallet < cost) return;
  save.wallet -= cost;
  writeSave();

  run.revives++;
  run.hearts = 1;
  run.hurt = HURT_TIME + 1;
  state = "playing";
  showScreen("playing");
  playSound("heart");
}

function hurt() {
  if (run.hurt > 0 || run.boost > 0) return;
  run.hearts--;
  run.hurt = HURT_TIME;
  run.speed = Math.max(START_SPEED, run.speed * 0.85);
  world.shake = reduceMotion ? 0 : 0.4;
  playSound("hurt");
  if (run.hearts <= 0) endRun();
}

// Left/right either queues a turn near a corner, or switches lane
function steer(dir) {
  const p = run.player;
  const seg = path.segments[p.seg];
  const side = dir < 0 ? "left" : "right";

  if (seg.corner === side && seg.length - p.along < TURN_BUFFER) {
    p.pendingTurn = side;
    return;
  }
  p.lane = clamp(p.lane + dir, -1, 1);
}

// Moves the player onto the next segment, keeping their exact world position
function turnCorner(seg) {
  const p = run.player;
  const next = path.segments[seg.index + 1];
  const corner = pointOnSegment(seg, seg.length);
  const pos = pathToWorld(seg, p.along, p.x);
  const dx = pos.x - corner.x;
  const dz = pos.z - corner.z;
  const f = forward(next.heading);
  const r = rightOf(next.heading);

  p.along = dx * f.x + dz * f.z;
  p.x = clamp(dx * r.x + dz * r.z, -LANE, LANE);
  p.lane = Math.round(p.x / LANE);
  p.seg = next.index;
  p.pendingTurn = null;
  playSound("turn");
}

function update(dt) {
  const p = run.player;
  run.speed = Math.min(MAX_SPEED, run.speed + SPEED_UP * dt);
  const speed = run.speed * (run.boost > 0 ? BOOST_MULTIPLIER : 1);
  const move = speed * dt;

  p.along += move;
  run.distance += move;
  run.boost = Math.max(0, run.boost - dt);
  run.hurt = Math.max(0, run.hurt - dt);

  // Corners and moving on to the next segment
  let seg = path.segments[p.seg];
  if (seg.corner) {
    const left = seg.length - p.along;
    if (p.pendingTurn === seg.corner && left <= HALF_WIDTH) {
      turnCorner(seg);
    } else if (run.boost > 0 && left <= 0) {
      turnCorner(seg); // boost takes corners by itself
    } else if (left < -HALF_WIDTH * 0.7) {
      // Ran off the edge: lose a heart and get put back on the path
      hurt();
      turnCorner(seg);
      p.lane = 0;
    }
  } else if (p.along > seg.length) {
    p.along -= seg.length;
    p.seg++;
  }
  if (state !== "playing") return;

  // Show an arrow when a corner is coming up
  seg = path.segments[p.seg];
  const nearCorner = seg.corner && !p.pendingTurn && seg.length - p.along < TURN_BUFFER;
  showTurnHint(nearCorner ? seg.corner : null);

  updatePlayerMotion(p, dt, speed);
  checkItems(seg, dt);

  // Dust kicked up while sliding
  if (p.slide > 0 && onGround(p) && Math.random() < 0.7) {
    const feet = pathToWorld(seg, p.along + 0.6, p.x);
    burst(feet.x, 0.1, feet.z, "#cbb393", 2, 1.6);
  }

  // Build the path ahead and throw away what is behind
  extendPath(path, seg.startS + p.along + VIEW_AHEAD);
  if (path.segments[p.seg - 2]) removeSegment(path.segments[p.seg - 2]);

  updateHud(run, scoreOf(run));
}

function checkItems(seg, dt) {
  const p = run.player;
  for (const item of seg.items) {
    if (item.done) continue;
    const dz = item.along - p.along;
    if (dz > 8 || dz < -3) continue;

    const def = OBSTACLES[item.kind];
    if (def) checkObstacle(item, def, dz);
    else checkPickup(item, dz, dt);
    if (state !== "playing") return;
  }
}

function checkObstacle(item, def, dz) {
  const p = run.player;

  if (item.kind === "gap") {
    // Falling in a gap costs a heart and bounces the player across
    if (Math.abs(dz) < def.depth / 2 - 0.3 && onGround(p) && run.boost <= 0) {
      hurt();
      p.vy = JUMP_SPEED;
    }
    return;
  }

  if (Math.abs(dz) > def.depth / 2 + 0.3) return;
  const reach = def.lanes === "all" ? Infinity : LANE * 0.4 + PLAYER_HALF_WIDTH;
  if (Math.abs(itemLateral(item) - p.x) > reach) return;
  if (p.y >= def.top || p.y + playerHeight(p) <= def.bottom) return;

  if (run.boost > 0) {
    // Boosting smashes straight through
    item.done = true;
    item.mesh.visible = false;
    const m = item.mesh.position;
    burst(m.x, m.y + 0.8, m.z, item.kind === "fire" ? COLORS.flame : COLORS.block, 26, 7);
    playSound("smash");
    return;
  }
  hurt();
}

function checkPickup(item, dz, dt) {
  const p = run.player;
  const isCoin = item.kind === "coin" || item.kind === "bigCoin";

  // Magnet upgrade pulls nearby coins toward the player
  const range = magnetRange();
  if (isCoin && range > 0 && !item.pulled && dz < 7 && dz > -1 && Math.abs(item.lateral - p.x) <= range + 0.5) {
    item.pulled = true;
  }
  if (item.pulled) {
    const k = Math.min(1, dt * 12);
    item.along += (p.along + 0.3 - item.along) * k;
    item.lateral += (p.x - item.lateral) * k;
    item.y += (p.y + 1 - item.y) * k;
  }

  const closeEnough =
    Math.abs(item.along - p.along) < 0.9 &&
    Math.abs(item.lateral - p.x) < 0.9 &&
    item.y > p.y - 0.4 &&
    item.y < p.y + playerHeight(p) + 0.4;
  if (closeEnough) collect(item);
}

function collect(item) {
  item.done = true;
  item.mesh.visible = false;
  const m = item.mesh.position;

  switch (item.kind) {
    case "coin":
      run.coins++;
      burst(m.x, m.y, m.z, COLORS.coin, 8, 3);
      playSound("coin");
      break;
    case "bigCoin":
      run.coins += BIG_COIN_VALUE;
      burst(m.x, m.y, m.z, COLORS.coin, 22, 5);
      playSound("bigCoin");
      break;
    case "boost":
      run.boost = boostTime();
      burst(m.x, m.y + 0.3, m.z, COLORS.boost, 24, 6);
      playSound("boost");
      break;
    case "heart":
      // A full set of hearts turns the pickup into coins instead
      if (run.hearts < MAX_HEARTS) run.hearts++;
      else run.coins += 10;
      burst(m.x, m.y, m.z, COLORS.heart, 20, 4);
      playSound("heart");
      break;
  }
}

function loop(now) {
  // Clamp dt so a background tab doesn't teleport the player
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  world.time += dt;

  if (state === "playing") update(dt);
  else if (state === "menu" || (state === "shop" && shopReturn === "menu")) run.player.phase += dt * 4;

  const p = run.player;
  const seg = path.segments[p.seg];

  // Animate torches, coins and rollers on the nearby segments
  for (let i = Math.max(0, p.seg - 1); i < path.segments.length; i++) {
    const s = path.segments[i];
    if (s.startS > seg.startS + VIEW_AHEAD) break;
    animateSegment(s, dt);
  }

  const pos = updatePlayerMesh(playerMesh, p, seg, run.hurt > 0 && state === "playing", dt);
  updateCamera(dt, { x: pos.x, y: p.y, z: pos.z }, pos.heading);
  updateParticles(dt);
  renderWorld();

  requestAnimationFrame(loop);
}

setupInput({
  left: () => state === "playing" && steer(-1),
  right: () => state === "playing" && steer(1),
  jump: () => {
    if (state === "playing" && playerJump(run.player)) playSound("jump");
    else if (state === "menu") startRun();
  },
  slide: () => state === "playing" && playerSlide(run.player) && playSound("slide"),
  pause: togglePause,
  mute: toggleMute,
  confirm: () => {
    if (state === "menu" || state === "over") startRun();
    else if (state === "paused") togglePause();
  },
});

function toggleMute() {
  save.muted = !save.muted;
  writeSave();
  updateMuteIcon();
}

$("start-btn").addEventListener("click", startRun);
$("again-btn").addEventListener("click", startRun);
$("resume-btn").addEventListener("click", togglePause);
$("pause-btn").addEventListener("click", togglePause);
$("mute-btn").addEventListener("click", toggleMute);
$("revive-btn").addEventListener("click", revive);
$("shop-btn").addEventListener("click", () => openShop("menu"));
$("over-shop-btn").addEventListener("click", () => openShop("over"));
$("shop-back").addEventListener("click", closeShop);
$("quit-btn").addEventListener("click", () => {
  newRun();
  state = "menu";
  showScreen("menu");
});

// Pause automatically when the tab is hidden
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") togglePause();
});

window.addEventListener("resize", resizeWorld);

newRun();
updateMuteIcon();
showScreen("menu");
requestAnimationFrame((now) => {
  lastTime = now;
  loop(now);
});
