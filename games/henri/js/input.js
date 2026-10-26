// Keyboard and touch controls. Calls the matching action from the actions object.
function setupInput(actions) {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        actions.left();
        break;
      case "ArrowRight":
      case "KeyD":
        actions.right();
        break;
      case "ArrowUp":
      case "KeyW":
      case "Space":
        e.preventDefault();
        actions.jump();
        break;
      case "ArrowDown":
      case "KeyS":
        e.preventDefault();
        actions.slide();
        break;
      case "KeyP":
      case "Escape":
        actions.pause();
        break;
      case "KeyM":
        actions.mute();
        break;
      case "Enter":
        actions.confirm();
        break;
    }
  });

  // Swipes in four directions, a tap counts as jump
  let startX = 0;
  let startY = 0;

  window.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchend", (e) => {
    if (e.target.closest("button, a")) return;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const minSwipe = 30;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
      dx < 0 ? actions.left() : actions.right();
    } else if (dy > minSwipe) {
      actions.slide();
    } else {
      actions.jump();
    }
  });
}
