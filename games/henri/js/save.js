// Progress that survives between runs: best score, coin wallet, upgrades
const SAVE_KEY = "templeDashSave";

const save = loadSave();

function loadSave() {
  const empty = {
    best: 0,
    wallet: 0,
    muted: false,
    upgrades: { hearts: 0, boost: 0, magnet: 0, headstart: 0 },
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
