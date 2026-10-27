// Everything that touches the HTML overlay: HUD, menus and the shop
const $ = (id) => document.getElementById(id);

const ui = {
  hud: $("hud"),
  score: $("score"),
  runCoins: $("run-coins"),
  hearts: $("hearts"),
  boost: $("boost"),
  boostBar: $("boost-bar"),
  turnHint: $("turn-hint"),
  turnIcon: $("turn-icon"),
  muteBtn: $("mute-btn"),
  screens: { menu: $("menu"), shop: $("shop"), wardrobe: $("wardrobe"), paused: $("pause"), over: $("over") },
  lookTabs: $("look-tabs"),
  lookGrid: $("look-grid"),
  shopList: $("shop-list"),
  reviveBtn: $("revive-btn"),
  reviveCost: $("revive-cost"),
};

function showScreen(name) {
  for (const [key, el] of Object.entries(ui.screens)) el.hidden = key !== name;
  ui.hud.hidden = ["menu", "shop", "wardrobe", "intro", "over"].includes(name);
  if (name !== "playing") {
    ui.turnHint.hidden = true;
    $("danger").hidden = true;
  }

  updateWallet();
  $("menu-best").textContent = save.best;

  // Move keyboard focus to the main button of the new screen
  const firstButton = ui.screens[name]?.querySelector("button:not([disabled])");
  firstButton?.focus({ preventScroll: true });
}

function updateWallet() {
  document.querySelectorAll(".wallet-amount").forEach((el) => (el.textContent = save.wallet));
}

function updateMuteIcon() {
  const icon = `<i class="ph-fill ${save.muted ? "ph-speaker-slash" : "ph-speaker-high"}"></i>`;
  ui.muteBtn.innerHTML = icon;
  $("pause-sound-btn").innerHTML = `${icon}${save.muted ? "Sound off" : "Sound on"}`;
}

function renderPause(run, score) {
  $("pause-stats").textContent = `${score} points and ${run.coins} coins so far.`;
}

let shownHearts = -1;

function updateHud(run, score) {
  ui.score.textContent = score;

  // Little bump on the coin counter for every pickup
  if (ui.runCoins.textContent !== String(run.coins)) {
    ui.runCoins.textContent = run.coins;
    const counter = ui.runCoins.parentElement;
    counter.classList.remove("bump");
    void counter.offsetWidth; // restarts the css animation
    counter.classList.add("bump");
  }

  // Only rebuild the hearts when the number changes
  if (shownHearts !== run.hearts) {
    const slots = Math.max(run.hearts, startHearts());
    ui.hearts.innerHTML = "";
    for (let i = 0; i < slots; i++) {
      const heart = document.createElement("i");
      heart.className = "ph-fill ph-heart" + (i < run.hearts ? "" : " empty");
      ui.hearts.append(heart);
    }
    // Shake the hearts when one is lost
    if (run.hearts < shownHearts) {
      ui.hearts.classList.remove("lost");
      void ui.hearts.offsetWidth; // restarts the css animation
      ui.hearts.classList.add("lost");
    }
    shownHearts = run.hearts;
  }

  // Warn when one more stumble would let the monkeys catch up
  $("danger").hidden = run.chase > CHASE_REST - 2;

  ui.boost.hidden = run.boost <= 0;
  ui.boostBar.style.transform = `scaleX(${Math.min(1, run.boost / boostTime())})`;
}

// Big word that pops up in the middle of the screen
function showCallout(text) {
  const el = $("callout");
  el.textContent = text;
  el.hidden = false;
  el.style.animation = "none";
  void el.offsetWidth; // restarts the css animation
  el.style.animation = "";
  clearTimeout(el.timer);
  el.timer = setTimeout(() => (el.hidden = true), 1200);
}

function showTurnHint(side) {
  ui.turnHint.hidden = !side;
  if (side) ui.turnIcon.className = `ph-fill ph-arrow-bend-up-${side}`;
}

function renderShop() {
  ui.shopList.innerHTML = "";

  for (const [id, up] of Object.entries(UPGRADES)) {
    const level = upgradeLevel(id);
    const cost = nextUpgradeCost(id);
    const maxed = cost === undefined;

    const li = document.createElement("li");
    li.className = "shop-item";
    li.innerHTML = `
      <i class="ph-fill ${up.icon} shop-icon"></i>
      <div class="shop-text">
        <strong>${up.name}</strong>
        <span>${up.info}</span>
        <span class="pips">${up.costs.map((_, i) => `<b class="${i < level ? "on" : ""}"></b>`).join("")}</span>
      </div>
      <button class="btn small" ${maxed || save.wallet < cost ? "disabled" : ""}>
        ${maxed ? "Maxed" : `<i class="ph-fill ph-coin"></i>${cost}`}
      </button>`;

    li.querySelector("button").addEventListener("click", () => {
      if (buyUpgrade(id)) {
        playSound("bigCoin");
        renderShop();
        updateWallet();
      }
    });
    ui.shopList.append(li);
  }
}

function renderOver(run, score, isBest, reviveCost, caught) {
  $("over-title").textContent = caught ? "The monkeys got you" : "Out of hearts";
  $("final-score").textContent = score;
  $("final-distance").textContent = `${Math.floor(run.distance)} m`;
  $("final-coins").textContent = run.coins;
  $("final-best").textContent = save.best;
  $("new-best").hidden = !isBest;
  ui.reviveCost.textContent = reviveCost;
  ui.reviveBtn.disabled = save.wallet < reviveCost;
}

// ---- Wardrobe ----

// Icons for items that are not shown as a color swatch
const LOOK_ICONS = {
  fedora: "ph-cowboy-hat",
  cap: "ph-baseball-cap",
  bandana: "ph-flag-banner",
  safari: "ph-hard-hat",
  crown: "ph-crown",
  backpack: "ph-backpack",
  satchel: "ph-handbag",
  cape: "ph-coat-hanger",
  none: "ph-prohibit",
};

let wardrobeTab = "hat";

function lookSwatch(item) {
  if (item.shirt) return `<span class="swatch split" style="--a:${item.shirt};--b:${item.pants}"></span>`;
  if (item.color) return `<span class="swatch" style="--a:${item.color}"></span>`;
  return `<i class="ph-fill ${LOOK_ICONS[item.id] || "ph-circle"} look-icon"></i>`;
}

function renderWardrobe(onPick) {
  ui.lookTabs.innerHTML = "";
  for (const [group, info] of Object.entries(LOOKS)) {
    const tab = document.createElement("button");
    tab.className = "tab" + (group === wardrobeTab ? " active" : "");
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", group === wardrobeTab);
    tab.innerHTML = `<i class="ph-fill ${info.icon}"></i><span>${info.name}</span>`;
    tab.addEventListener("click", () => {
      wardrobeTab = group;
      renderWardrobe(onPick);
    });
    ui.lookTabs.append(tab);
  }

  const wearing = currentLook()[wardrobeTab].id;
  ui.lookGrid.innerHTML = "";

  for (const item of LOOKS[wardrobeTab].items) {
    const owned = ownsLook(wardrobeTab, item.id);
    const worn = item.id === wearing;
    let status = "Wear";
    if (worn) status = `<i class="ph-fill ph-check"></i>Wearing`;
    else if (!owned) status = `<i class="ph-fill ph-coin"></i>${item.cost}`;

    const li = document.createElement("li");
    li.innerHTML = `
      <button class="look-card${worn ? " worn" : ""}${!owned && save.wallet < item.cost ? " pricey" : ""}">
        ${lookSwatch(item)}
        <span class="look-name">${item.name}</span>
        <span class="look-status">${status}</span>
      </button>`;
    li.querySelector("button").addEventListener("click", () => onPick(wardrobeTab, item));
    ui.lookGrid.append(li);
  }
}
