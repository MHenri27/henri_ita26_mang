// The path is a list of segments: straights and gentle curves.
// A straight can end in a sharp corner where the player has to turn.
// Positions on a segment are given as (along, lateral): distance from the
// segment start, and sideways offset where positive is to the right.

function forward(h) {
  return { x: Math.sin(h), z: Math.cos(h) };
}

function rightOf(h) {
  return { x: -Math.cos(h), z: Math.sin(h) };
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Point in the middle of the path, plus heading at that spot
function pointOnSegment(seg, along) {
  if (seg.type === "curve") {
    const heading = seg.heading + seg.bend * along / seg.radius;
    // Curve center sits to the side the path bends toward
    const r0 = rightOf(seg.heading);
    const cx = seg.x - r0.x * seg.radius * seg.bend;
    const cz = seg.z - r0.z * seg.radius * seg.bend;
    const r = rightOf(heading);
    return {
      x: cx + r.x * seg.radius * seg.bend,
      z: cz + r.z * seg.radius * seg.bend,
      heading,
    };
  }

  const f = forward(seg.heading);
  return { x: seg.x + f.x * along, z: seg.z + f.z * along, heading: seg.heading };
}

// World position for a spot on the path
function pathToWorld(seg, along, lateral) {
  const p = pointOnSegment(seg, along);
  const r = rightOf(p.heading);
  return { x: p.x + r.x * lateral, z: p.z + r.z * lateral, heading: p.heading };
}

// Walks back along the path, across corners if needed
function pathBehind(path, segIndex, along) {
  while (along < 0 && segIndex > 0) {
    segIndex--;
    along += path.segments[segIndex].length;
  }
  return { seg: path.segments[segIndex], along };
}

function createPath() {
  return {
    segments: [],
    totalLength: 0,
    netHeading: 0, // keeps the path from looping back on itself
    samples: [],   // points along the middle of the path, the terrain keeps clear of these
  };
}

// Keep adding segments until the path reaches far enough ahead
function extendPath(path, untilDistance) {
  while (path.totalLength < untilDistance) {
    addSegment(path);
  }
}

function addSegment(path) {
  const last = path.segments[path.segments.length - 1];
  const index = path.segments.length;

  // Where the new segment starts
  let x = 0;
  let z = 0;
  let heading = 0;
  if (last) {
    const end = pointOnSegment(last, last.length);
    x = end.x;
    z = end.z;
    heading = end.heading;
    if (last.corner) heading += last.corner === "left" ? Math.PI / 2 : -Math.PI / 2;
  }

  const seg = { index, x, z, heading, startS: path.totalLength, items: [], group: null };
  const roll = Math.random();
  const H = path.netHeading;

  if (index === 0) {
    seg.type = "straight";
    seg.length = 60;
  } else if (last.corner || roll < 0.35) {
    // Plain straight, sometimes ending in a corner
    seg.type = "straight";
    seg.length = Math.round(random(30, 55));
    if (!last.corner || Math.random() < 0.5) {
      // Turn back toward the main direction so the path never crosses itself
      seg.corner = H > 0.1 ? "right" : H < -0.1 ? "left" : pick(["left", "right"]);
    }
  } else if (roll < 0.7) {
    seg.type = "curve";
    seg.radius = random(22, 40);
    seg.length = Math.round(random(20, 36));
    const sweep = seg.length / seg.radius;
    // Bend left (+1) or right (-1), but stay within 90 degrees of the start
    let bend = pick([-1, 1]);
    if (Math.abs(H + bend * sweep) > Math.PI / 2) bend = -bend;
    if (Math.abs(H + bend * sweep) > Math.PI / 2) bend = H > 0 ? -1 : 1;
    seg.bend = bend;
    path.netHeading += bend * sweep;
  } else {
    seg.type = "straight";
    seg.length = Math.round(random(20, 40));
  }

  if (seg.corner) path.netHeading += seg.corner === "left" ? Math.PI / 2 : -Math.PI / 2;

  placeItems(seg);
  path.segments.push(seg);
  path.totalLength += seg.length;
  for (let t = 0; t <= seg.length; t += 4) path.samples.push(pointOnSegment(seg, t));

  // Let the hills make room before the segment's trees are placed on them
  terrainFollowPath(path);
  buildSegment(seg, last);
}

// Fills a segment with rows of obstacles, coins and the odd pickup
function placeItems(seg) {
  const difficulty = Math.min(1, seg.startS / 2500);
  let along = seg.index === 0 ? 35 : 14;
  const end = seg.length - (seg.corner ? 12 : 4);

  while (along < end) {
    placeRow(seg, along, difficulty);

    const gap = random(15, 23) - difficulty * 6;

    // Something to grab in the space between rows
    const middle = along + gap / 2;
    if (middle < end) {
      const roll = Math.random();
      if (roll < 0.1) {
        addItem(seg, "boost", middle, pick([-1, 0, 1]));
      } else if (roll < 0.15) {
        addItem(seg, "heart", middle, pick([-1, 0, 1]), 1);
      }
    }

    along += gap;
  }
}

function addItem(seg, kind, along, lane, y = 0) {
  const item = { kind, along, lateral: lane * LANE, y, done: false };
  if (kind === "roller") item.phase = random(0, Math.PI * 2);
  seg.items.push(item);
  return item;
}

function coinLine(seg, along, lane, count = 5) {
  const bigIndex = Math.random() < 0.2 ? Math.floor(count / 2) : -1;
  for (let i = 0; i < count; i++) {
    addItem(seg, i === bigIndex ? "bigCoin" : "coin", along + i * 1.6, lane, 0.9);
  }
}

// Coins in an arc, placed over things you jump across
function coinArc(seg, along, lane) {
  for (let i = -3; i <= 3; i++) {
    const t = i / 3;
    addItem(seg, "coin", along + i * 1.4, lane, 0.9 + (1 - t * t) * 1.6);
  }
}

function placeRow(seg, along, difficulty) {
  const lanes = [-1, 0, 1];
  const freeLane = pick(lanes);
  const others = lanes.filter((l) => l !== freeLane);
  const isCurve = seg.type === "curve";

  const options = ["blocks", "blocks", "log", "beam", "fire", "roller"];
  if (!isCurve && seg.index > 0) options.push("gap");
  // Moving traps from traps.js, some only fit on a straight path
  for (const [kind, trap] of Object.entries(TRAPS)) {
    if (!isCurve || trap.onCurve !== false) options.push(kind);
  }
  const pattern = pick(options);

  if (TRAPS[pattern]) {
    TRAPS[pattern].place(seg, along, difficulty);
    return;
  }

  switch (pattern) {
    case "blocks": {
      const count = Math.random() < 0.3 + difficulty * 0.4 ? 2 : 1;
      for (const lane of others.slice(0, count)) addItem(seg, "block", along, lane);
      coinLine(seg, along - 4, freeLane);
      break;
    }
    case "log":
      addItem(seg, "log", along, 0);
      coinArc(seg, along, pick(lanes));
      break;
    case "beam":
      addItem(seg, "beam", along, 0);
      coinLine(seg, along - 3, pick(lanes), 4);
      // Coins under the beam sit low so they can be grabbed while sliding
      seg.items.filter((i) => i.kind === "coin" && Math.abs(i.along - along) < 4).forEach((c) => (c.y = 0.4));
      break;
    case "fire": {
      const count = Math.random() < 0.3 + difficulty * 0.4 ? 2 : 1;
      for (const lane of others.slice(0, count)) addItem(seg, "fire", along, lane);
      coinLine(seg, along - 2, freeLane, 3);
      break;
    }
    case "roller":
      addItem(seg, "roller", along, 0);
      if (difficulty > 0.4) addItem(seg, "roller", along + 7, 0);
      break;
    case "gap":
      addItem(seg, "gap", along, 0);
      coinArc(seg, along, pick(lanes));
      break;
  }
}
