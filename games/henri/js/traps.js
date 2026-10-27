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
};
