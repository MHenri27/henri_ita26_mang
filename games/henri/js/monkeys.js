// The pack of temple monkeys chasing the runner
const MONKEY_COUNT = 4;
const CHASE_REST = 10;      // how far behind the monkeys normally stay
const CHASE_RECOVER = 0.7;  // how fast the runner pulls away again, per second
const CHASE_HIT = 5;        // how much closer they get on every hit

const monkeys = [];

function makeMonkey() {
  const fur = standard("#6b4a2e");
  const furDark = standard("#4e3420");
  const face = standard("#d9b48a");
  const dark = standard("#21160e");

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const box = (material, w, h, d, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo.box, material);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  box(fur, 0.62, 0.55, 0.75, 0, 0.8, 0);
  box(face, 0.4, 0.3, 0.1, 0, 0.78, 0.36); // belly

  const head = new THREE.Group();
  head.position.set(0, 1.2, 0.35);
  box(fur, 0.48, 0.44, 0.44, 0, 0, 0, head);
  box(face, 0.36, 0.3, 0.06, 0, -0.03, 0.23, head);
  box(face, 0.24, 0.14, 0.14, 0, -0.1, 0.28, head); // muzzle
  for (const x of [-0.09, 0.09]) box(dark, 0.06, 0.07, 0.02, x, 0.05, 0.265, head);
  box(dark, 0.14, 0.03, 0.02, 0, -0.12, 0.355, head);
  for (const x of [-0.29, 0.29]) box(face, 0.1, 0.17, 0.08, x, 0.02, 0, head);
  body.add(head);

  // Long arms for knuckle running
  const arms = [-0.36, 0.36].map((x) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 1.0, 0.2);
    box(furDark, 0.15, 0.75, 0.15, 0, -0.37, 0, shoulder);
    box(face, 0.17, 0.12, 0.17, 0, -0.78, 0.02, shoulder);
    body.add(shoulder);
    return shoulder;
  });

  const legs = [-0.2, 0.2].map((x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.6, -0.2);
    box(furDark, 0.17, 0.5, 0.17, 0, -0.25, 0, hip);
    box(face, 0.19, 0.1, 0.25, 0, -0.55, 0.05, hip);
    body.add(hip);
    return hip;
  });

  // Curly tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.85, -0.38);
  box(fur, 0.09, 0.09, 0.4, 0, 0.05, -0.18, tail);
  box(fur, 0.09, 0.4, 0.09, 0, 0.25, -0.38, tail);
  box(fur, 0.09, 0.09, 0.22, 0, 0.45, -0.3, tail);
  body.add(tail);

  root.userData = { body, head, arms, legs, tail };
  root.visible = false;
  return root;
}

function createMonkeys() {
  for (let i = 0; i < MONKEY_COUNT; i++) {
    const mesh = makeMonkey();
    world.scene.add(mesh);
    monkeys.push({
      mesh,
      offset: [-2.4, 2.1, -0.7, 0.9][i],   // sideways spot in the pack
      lag: [0, 0.8, 1.7, 2.6][i],          // how far behind the front monkey
      phase: random(0, Math.PI * 2),
      heading: 0,
    });
  }
}

function hideMonkeys() {
  for (const m of monkeys) m.mesh.visible = false;
}

// Places the pack behind the player along the path
function updateMonkeys(dt, run, path, speed, caught) {
  const p = run.player;

  for (const m of monkeys) {
    const back = caught ? 1.2 + m.lag * 0.5 : run.chase + m.lag;
    const spot = pathBehind(path, p.seg, p.along - back);
    const lateral = caught ? m.offset * 0.5 : clamp(p.x * 0.6 + m.offset, -HALF_WIDTH + 0.6, HALF_WIDTH - 0.6);
    const pos = pathToWorld(spot.seg, spot.along, lateral);

    // Turn smoothly like the runner does
    const diff = Math.atan2(Math.sin(pos.heading - m.heading), Math.cos(pos.heading - m.heading));
    m.heading += diff * Math.min(1, dt * 10);

    // Galloping: bounce, arms and legs swing in pairs
    m.phase += dt * (caught ? 14 : 4 + speed * 0.55);
    const s = Math.sin(m.phase);
    const rig = m.mesh.userData;
    const hop = caught ? Math.abs(s) * 0.5 : Math.abs(s) * 0.3;

    m.mesh.visible = true;
    m.mesh.position.set(pos.x, hop, pos.z);
    m.mesh.rotation.y = m.heading;
    m.mesh.scale.setScalar(1.15);
    rig.body.rotation.x = caught ? -0.2 : 0.35 + s * 0.12;
    rig.arms.forEach((a) => (a.rotation.x = caught ? -2.6 + s * 0.5 : -0.4 - s * 0.9));
    rig.legs.forEach((l) => (l.rotation.x = s * 0.8));
    rig.head.rotation.x = caught ? 0.3 : -0.3 + s * 0.1;
    rig.tail.rotation.x = s * 0.3;
  }
}
