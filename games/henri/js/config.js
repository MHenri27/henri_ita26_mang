// All the tuning numbers live here so they are easy to tweak

const LANE = 2;             // distance between lane centers
const HALF_WIDTH = 3.5;     // half of the path width
const VIEW_AHEAD = 140;     // how far ahead the path is generated

const START_SPEED = 13;
const MAX_SPEED = 30;
const SPEED_UP = 0.22;      // per second
const BOOST_MULTIPLIER = 1.7;

const GRAVITY = 42;
const JUMP_SPEED = 13;
const SLIDE_TIME = 0.75;
const LANE_SWITCH_SPEED = 16;
const TURN_BUFFER = 14;     // how early a turn press is remembered before a corner

const PLAYER_HEIGHT = 1.7;
const SLIDE_HEIGHT = 0.7;
const PLAYER_HALF_WIDTH = 0.4;

const HURT_TIME = 2;        // invulnerable seconds after taking a hit
const MAX_HEARTS = 5;
const COIN_SCORE = 5;
const BIG_COIN_VALUE = 5;

// Obstacles. lanes: how many lanes it covers, "all" for full width.
// bottom/top: vertical range that hurts the player.
const OBSTACLES = {
  block:  { lanes: 1, depth: 1.4, bottom: 0, top: 2.4 },   // switch lane
  log:    { lanes: "all", depth: 0.9, bottom: 0, top: 0.8 }, // jump
  beam:   { lanes: "all", depth: 0.8, bottom: 1.1, top: 4 }, // slide
  fire:   { lanes: 1, depth: 1.6, bottom: 0, top: 0.7 },   // jump or switch lane
  roller: { lanes: 1, depth: 1.4, bottom: 0, top: 0.9 },   // moves across lanes, jump it
  gap:    { lanes: "all", depth: 4, bottom: -10, top: 0.05 }, // hole in the path, jump
};

// Shop upgrades bought with coins
const UPGRADES = {
  hearts: {
    name: "Extra heart",
    info: "Start each run with one more heart.",
    icon: "ph-heart",
    costs: [150, 400],
  },
  boost: {
    name: "Longer boosts",
    info: "Speed boosts last one second longer per level.",
    icon: "ph-lightning",
    costs: [100, 250, 500],
  },
  magnet: {
    name: "Coin magnet",
    info: "Pull in coins from nearby lanes.",
    icon: "ph-magnet",
    costs: [120, 300, 650],
  },
  headstart: {
    name: "Head start",
    info: "Every run begins with a speed boost.",
    icon: "ph-rocket-launch",
    costs: [300],
  },
};

const BASE_HEARTS = 3;
const BASE_BOOST_TIME = 3;
const REVIVE_COST = 100;    // doubles every revive in the same run

// Wardrobe items. The first item in each group is free and worn by default.
const LOOKS = {
  hat: {
    name: "Hats",
    icon: "ph-cowboy-hat",
    items: [
      { id: "fedora", name: "Explorer hat", cost: 0 },
      { id: "cap", name: "Jungle cap", cost: 100 },
      { id: "bandana", name: "Bandana", cost: 80 },
      { id: "safari", name: "Safari helmet", cost: 200 },
      { id: "crown", name: "Golden crown", cost: 900 },
      { id: "none", name: "No hat", cost: 0 },
    ],
  },
  outfit: {
    name: "Outfits",
    icon: "ph-t-shirt",
    items: [
      { id: "explorer", name: "Explorer", cost: 0, shirt: "#e9e1cc", pants: "#5e4b35", boots: "#3a2a1e" },
      { id: "ranger", name: "Ranger", cost: 150, shirt: "#5f7d4a", pants: "#3e4a32", boots: "#2b2a22" },
      { id: "desert", name: "Desert", cost: 150, shirt: "#d9b77e", pants: "#a8835a", boots: "#5a4030" },
      { id: "midnight", name: "Midnight", cost: 300, shirt: "#2e3550", pants: "#1d2133", boots: "#15171d" },
      { id: "royal", name: "Royal", cost: 600, shirt: "#7a2e3a", pants: "#2a2440", boots: "#c79a3a" },
    ],
  },
  scarf: {
    name: "Scarves",
    icon: "ph-swatches",
    items: [
      { id: "amber", name: "Amber", cost: 0, color: "#f2a541" },
      { id: "crimson", name: "Crimson", cost: 60, color: "#d8433c" },
      { id: "teal", name: "Teal", cost: 60, color: "#2bb8a4" },
      { id: "violet", name: "Violet", cost: 120, color: "#8a5cd6" },
      { id: "snow", name: "Snow", cost: 120, color: "#f1f1ea" },
    ],
  },
  gear: {
    name: "Gear",
    icon: "ph-backpack",
    items: [
      { id: "backpack", name: "Backpack", cost: 0 },
      { id: "satchel", name: "Satchel", cost: 120 },
      { id: "cape", name: "Cape", cost: 350 },
      { id: "none", name: "Nothing", cost: 0 },
    ],
  },
  skin: {
    name: "Skin",
    icon: "ph-hand-palm",
    items: [
      { id: "tan", name: "Tan", cost: 0, color: "#d8a07a" },
      { id: "light", name: "Light", cost: 0, color: "#f0c8a8" },
      { id: "brown", name: "Brown", cost: 0, color: "#a86b45" },
      { id: "dark", name: "Dark", cost: 0, color: "#6b4430" },
    ],
  },
};
