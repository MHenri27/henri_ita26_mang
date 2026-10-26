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
  screens: { menu: $("menu"), shop: $("shop"), paused: $("pause"), over: $("over") },
  shopList: $("shop-list"),
  reviveBtn: $("revive-btn"),
  reviveCost: $("revive-cost"),
};

function showScreen(name) {
  for (const [key, el] of Object.entries(ui.screens)) el.hidden = key !== name;
  ui.hud.hidden = name === "menu" || name === "shop";
  if (name !== "playing") ui.turnHint.hidden = true;

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
  ui.muteBtn.innerHTML = `<i class="ph-fill ${save.muted ? "ph-speaker-slash" : "ph-speaker-high"}"></i>`;
}

let shownHearts = -1;

function updateHud(run, score) {
  ui.score.textContent = score;
  ui.runCoins.textContent = run.coins;

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

  ui.boost.hidden = run.boost <= 0;
  ui.boostBar.style.transform = `scaleX(${Math.min(1, run.boost / boostTime())})`;
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

function renderOver(run, score, isBest, reviveCost) {
  $("final-score").textContent = score;
  $("final-coins").textContent = run.coins;
  $("final-best").textContent = save.best;
  $("new-best").hidden = !isBest;
  ui.reviveCost.textContent = reviveCost;
  ui.reviveBtn.disabled = save.wallet < reviveCost;
}
