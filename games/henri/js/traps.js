// Moving and timed traps. Each trap knows how to place itself on the path,
// build its mesh, animate, and tell when it hits the player.
// Lateral positions are to the right of the path, a mesh's local x points left.

// Materials only the traps use, made the first time they are needed
const trapMat = {};

// Is the player at the same spot along the path as the trap?
function trapNear(item, p, depth) {
  return Math.abs(item.along - p.along) < depth / 2 + 0.3;
}

function standingIn(p, bottom, top) {
  return p.y < top && p.y + playerHeight(p) > bottom;
}

const TRAPS = {
  // A stone wall sliding back and forth across the lanes
  wall: {
    place(seg, along) {
      addItem(seg, "wall", along, 0).phase = random(0, Math.PI * 2);
    },
    make(item) {
      const g = new THREE.Group();
      g.add(part(geo.box, mat.grate, HALF_WIDTH * 2, 0.04, 1, 0, 0.02, 0)); // track groove
      const wall = new THREE.Group();
      wall.add(part(geo.box, mat.block, 3, 2.6, 0.8, 0, 1.3, 0));
      wall.add(part(geo.box, mat.moss, 3.1, 0.16, 0.9, 0, 2.66, 0));
      wall.add(part(geo.box, mat.blockFace, 2.4, 0.12, 0.05, 0, 1.9, -0.41));
      wall.add(part(geo.box, mat.blockFace, 2.4, 0.12, 0.05, 0, 0.9, -0.41));
      g.add(wall);
      item.part = wall;
      return g;
    },
    lateral(item) {
      return Math.sin(world.time * 1.1 + item.phase) * LANE;
    },
    animate(item) {
      item.part.position.x = -this.lateral(item);
    },
    hits(item, p) {
      return trapNear(item, p, 0.8) && Math.abs(this.lateral(item) - p.x) < 1.5 + PLAYER_HALF_WIDTH && standingIn(p, 0, 2.6);
    },
  },

  // A heavy stone that keeps slamming down on one lane
  crusher: {
    place(seg, along) {
      const lane = pick([-1, 0, 1]);
      addItem(seg, "crusher", along, lane).phase = random(0, 1);
      coinLine(seg, along - 3, pick([-1, 0, 1].filter((l) => l !== lane)), 4);
    },
    make(item) {
      const g = new THREE.Group();
      for (const x of [-1.1, 1.1]) g.add(part(geo.box, mat.woodDark, 0.3, 5.6, 0.3, x, 2.8, 0));
      g.add(part(geo.box, mat.woodDark, 2.6, 0.4, 0.5, 0, 5.6, 0));
      const block = new THREE.Group();
      block.add(part(geo.box, mat.block, 1.8, 1.6, 1.4, 0, 0.8, 0));
      block.add(part(geo.box, mat.moss, 1.9, 0.14, 1.5, 0, 1.62, 0));
      for (const x of [-0.4, 0.4]) block.add(part(geo.box, mat.blockFace, 0.35, 0.25, 0.05, x, 1.1, -0.71));
      block.add(part(geo.box, mat.blockFace, 1.1, 0.18, 0.05, 0, 0.5, -0.71));
      g.add(block);
      item.part = block;
      return g;
    },
    // Waits up top, slams down, sits a moment, then slowly rises
    height(item) {
      const t = (world.time * 0.45 + item.phase) % 1;
      if (t < 0.45) return 3.8;
      if (t < 0.52) return 3.8 * (1 - (t - 0.45) / 0.07);
      if (t < 0.7) return 0;
      return 3.8 * (t - 0.7) / 0.3;
    },
    animate(item) {
      const h = this.height(item);
      // Dust puff the moment it hits the ground
      if (h === 0 && !item.slammed) {
        const m = item.mesh.position;
        burst(m.x, 0.2, m.z, "#cbb393", 14, 3);
      }
      item.slammed = h === 0;
      item.part.position.y = h;
    },
    hits(item, p) {
      const h = this.height(item);
      return trapNear(item, p, 1.4) && Math.abs(item.lateral - p.x) < 0.9 + PLAYER_HALF_WIDTH && standingIn(p, h, h + 1.6);
    },
  },

  // Spikes popping out of the floor across the whole path
  spikes: {
    place(seg, along) {
      addItem(seg, "spikes", along, 0).phase = random(0, 1);
      coinArc(seg, along, pick([-1, 0, 1]));
    },
    make(item) {
      trapMat.metal ??= standard("#a3a7ad", { metalness: 0.6, roughness: 0.35 });
      const g = new THREE.Group();
      g.add(part(geo.box, mat.grate, HALF_WIDTH * 2 - 0.4, 0.06, 1.4, 0, 0.03, 0));
      const spikes = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        for (const z of [-0.35, 0.35]) {
          spikes.add(part(geo.cone, trapMat.metal, 0.16, 0.75, 0.16, -HALF_WIDTH + 0.55 + i * 0.54, 0.37, z));
        }
      }
      g.add(spikes);
      item.part = spikes;
      return g;
    },
    // Up for about a second, then down for a bit less
    height(item) {
      const t = (world.time * 0.5 + item.phase) % 1;
      if (t < 0.5) return 0.75;
      if (t < 0.55) return 0.75 * (1 - (t - 0.5) / 0.05);
      if (t < 0.95) return 0;
      return 0.75 * (t - 0.95) / 0.05;
    },
    animate(item) {
      item.part.position.y = this.height(item) - 0.75;
    },
    hits(item, p) {
      return trapNear(item, p, 1.2) && p.y < this.height(item) - 0.1;
    },
  },

  // A big blade swinging across the path. Slide under it or time it.
  axe: {
    length: 4.6,
    place(seg, along) {
      addItem(seg, "axe", along, 0).phase = random(0, Math.PI * 2);
    },
    make(item) {
      trapMat.metal ??= standard("#a3a7ad", { metalness: 0.6, roughness: 0.35 });
      const g = new THREE.Group();
      for (const x of [-HALF_WIDTH - 0.2, HALF_WIDTH + 0.2]) g.add(part(geo.box, mat.woodDark, 0.4, 6.6, 0.4, x, 3.3, 0));
      g.add(part(geo.box, mat.woodDark, HALF_WIDTH * 2 + 1, 0.45, 0.5, 0, 6.4, 0));
      const pivot = new THREE.Group();
      pivot.position.y = 6.2;
      pivot.add(part(geo.box, mat.woodDark, 0.12, this.length, 0.12, 0, -this.length / 2, 0));
      pivot.add(part(geo.box, trapMat.metal, 1.4, 1, 0.08, 0, -this.length, 0));
      g.add(pivot);
      item.part = pivot;
      return g;
    },
    angle(item) {
      return Math.sin(world.time * 2 + item.phase);
    },
    animate(item) {
      item.part.rotation.z = this.angle(item);
    },
    hits(item, p) {
      const a = this.angle(item);
      const bladeX = -this.length * Math.sin(a);
      const bladeY = 6.2 - this.length * Math.cos(a);
      return trapNear(item, p, 0.4) && Math.abs(bladeX - p.x) < 0.7 + PLAYER_HALF_WIDTH && standingIn(p, bladeY - 0.5, bladeY + 0.5);
    },
  },

  // A boulder that starts rolling down the lane once the player gets close
  boulder: {
    place(seg, along) {
      const end = seg.length - (seg.corner ? 12 : 4);
      addItem(seg, "boulder", Math.min(along + 20, end), pick([-1, 0, 1]));
    },
    make(item) {
      trapMat.rock ??= new THREE.IcosahedronGeometry(1.1, 1);
      const g = new THREE.Group();
      const rock = new THREE.Group();
      rock.position.y = 1.1;
      rock.add(part(trapMat.rock, mat.block, 1, 1, 1));
      rock.add(part(geo.box, mat.moss, 0.9, 0.3, 0.9, 0.3, 0.75, 0.3));
      g.add(rock);
      item.part = rock;
      return g;
    },
    animate(item, seg, dt) {
      const p = run.player;
      if (!item.rolling && state === "playing" && p.seg === seg.index && item.along - p.along < 55) item.rolling = true;
      if (!item.rolling || state !== "playing") return;
      item.along -= 9 * dt;
      item.part.rotation.x -= (9 * dt) / 1.1;
      placeItemMesh(seg, item);
      if (Math.random() < dt * 20) {
        const m = item.mesh.position;
        burst(m.x, 0.1, m.z, "#cbb393", 2, 1.5);
      }
      if (item.along < -3) {
        item.done = true;
        item.mesh.visible = false;
      }
    },
    hits(item, p) {
      return trapNear(item, p, 2) && Math.abs(item.lateral - p.x) < 1.1 + PLAYER_HALF_WIDTH && standingIn(p, 0, 2.2);
    },
  },

  // Water pouring down over one or two lanes, it knocks the runner over
  waterfall: {
    smash: false,
    place(seg, along) {
      const free = pick([-1, 0, 1]);
      const wet = [-1, 0, 1].filter((l) => l !== free);
      for (const lane of Math.random() < 0.5 ? wet : [pick(wet)]) addItem(seg, "waterfall", along, lane);
      coinLine(seg, along - 3, free, 4);
    },
    make(item) {
      if (!trapMat.water) {
        // Streaky texture that scrolls down
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 128;
        const g = c.getContext("2d");
        g.fillStyle = "#6fb8e6";
        g.fillRect(0, 0, 32, 128);
        for (let i = 0; i < 40; i++) {
          g.fillStyle = `rgba(255,255,255,${random(0.2, 0.7)})`;
          g.fillRect(random(0, 32), random(0, 128), random(1, 3), random(10, 40));
        }
        const texture = new THREE.CanvasTexture(c);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 5);
        trapMat.waterTexture = texture;
        trapMat.water = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.8, depthWrite: false });
        trapMat.foam = new THREE.MeshBasicMaterial({ color: "#eaf7ff" });
        trapMat.mist = mat.glow("#dff3ff");
      }
      const g = new THREE.Group();
      const fall = new THREE.Mesh(geo.box, trapMat.water);
      fall.scale.set(1.7, 34, 0.5);
      fall.position.y = 3;
      g.add(fall);
      // Rock pillar beside the path with an overhang the water pours from
      const side = item.lateral >= 0 ? 1 : -1;
      const pillarX = -(side * (HALF_WIDTH + 2.5) - item.lateral);
      g.add(part(geo.box, mat.stoneDark, 2.6, 44, 2.6, pillarX, -1, 0));
      g.add(part(geo.box, mat.stoneDark, Math.abs(pillarX) + 1.4, 1.4, 1.8, pillarX / 2, 20.3, 0));
      g.add(part(geo.box, mat.moss, Math.abs(pillarX) + 1.5, 0.3, 1.9, pillarX / 2, 21.1, 0));
      for (let i = 0; i < 4; i++) {
        const foam = part(geo.box, trapMat.foam, random(0.4, 0.7), 0.25, random(0.4, 0.7), random(-0.7, 0.7), 0.12, random(-0.5, 0.5));
        foam.rotation.y = random(0, 3);
        g.add(foam);
      }
      const mist = new THREE.Sprite(trapMat.mist);
      mist.scale.setScalar(3.5);
      mist.position.y = 0.6;
      g.add(mist);
      return g;
    },
    animate(item, seg, dt) {
      trapMat.waterTexture.offset.y = (world.time * 1.6) % 1;
      if (Math.random() < dt * 6) {
        const m = item.mesh.position;
        burst(m.x, 0.3, m.z, "#eaf7ff", 3, 2.5);
      }
    },
    hits(item, p) {
      return trapNear(item, p, 0.5) && Math.abs(item.lateral - p.x) < 0.85 + PLAYER_HALF_WIDTH;
    },
  },

  // A chasm with a stone platform sliding across it. Stay on the platform.
  platform: {
    hole: 8,
    smash: false,
    onCurve: false,
    place(seg, along) {
      addItem(seg, "platform", along + 3, 0).phase = random(0, Math.PI * 2);
    },
    make(item) {
      const g = new THREE.Group();
      const slab = new THREE.Group();
      slab.add(part(geo.box, mat.cornerTile, 2.4, 0.6, this.hole + 1.2, 0, -0.3, 0));
      slab.add(part(geo.box, mat.stoneDark, 2, 0.8, this.hole, 0, -1, 0));
      for (const z of [-3, 0, 3]) slab.add(part(geo.box, mat.leaves, 0.14, 1.6, 0.14, 1.1, -1.5, z));
      g.add(slab);
      item.part = slab;
      return g;
    },
    lateral(item) {
      return Math.sin(world.time * 0.9 + item.phase) * LANE;
    },
    animate(item) {
      item.part.position.x = -this.lateral(item);
    },
    // Only hurts when standing over the chasm and off the platform
    hits(item, p) {
      if (Math.abs(item.along - p.along) > this.hole / 2 - 0.3 || !onGround(p)) return false;
      return Math.abs(this.lateral(item) - p.x) > 1.3;
    },
    onHit(item, p) {
      p.vy = JUMP_SPEED; // scramble out of the chasm
    },
  },
};
