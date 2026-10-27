// Progress that survives between runs: best score, coin wallet, upgrades
const SAVE_KEY = "templeDashSave";

const save = loadSave();

function loadSave() {
  const empty = {
    best: 0,
    wallet: 0,
    muted: false,
    upgrades: { hearts: 0, boost: 0, magnet: 0, headstart: 0 },
    owned: [],   // bought wardrobe items, stored as "group:id"
    wearing: {}, // chosen item id per wardrobe group
  };

  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data) return empty;
    return { ...empty, ...data, upgrades: { ...empty.upgrades, ...data.upgrades } };
  } catch {
    return empty;
  }
}

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // storage blocked, progress just won't persist
  }
}

function upgradeLevel(id) {
  return save.upgrades[id] || 0;
}

function nextUpgradeCost(id) {
  return UPGRADES[id].costs[upgradeLevel(id)];
}

function buyUpgrade(id) {
  const cost = nextUpgradeCost(id);
  if (cost === undefined || save.wallet < cost) return false;
  save.wallet -= cost;
  save.upgrades[id]++;
  writeSave();
  return true;
}

// Values that depend on upgrades
function startHearts() {
  return BASE_HEARTS + upgradeLevel("hearts");
}

function boostTime() {
  return BASE_BOOST_TIME + upgradeLevel("boost");
}

function magnetRange() {
  return upgradeLevel("magnet") * LANE;
}

// Wardrobe: free items are always owned
function lookItem(group, id) {
  const items = LOOKS[group].items;
  return items.find((i) => i.id === id) || items[0];
}

function ownsLook(group, id) {
  return lookItem(group, id).cost === 0 || save.owned.includes(`${group}:${id}`);
}

function buyLook(group, id) {
  const item = lookItem(group, id);
  if (ownsLook(group, id) || save.wallet < item.cost) return false;
  save.wallet -= item.cost;
  save.owned.push(`${group}:${id}`);
  writeSave();
  return true;
}

function wearLook(group, id) {
  if (!ownsLook(group, id)) return false;
  save.wearing[group] = id;
  writeSave();
  return true;
}

// The full set of items the runner has on right now
function currentLook() {
  const look = {};
  for (const group in LOOKS) {
    const id = save.wearing[group];
    look[group] = ownsLook(group, id) ? lookItem(group, id) : LOOKS[group].items[0];
  }
  return look;
}
