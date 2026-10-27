// Tiny synth sound effects, no audio files needed
let audio = null;

function playSound(name) {
  if (save.muted) return;

  // Browsers only allow audio after a user action, so create it lazily
  if (!audio) {
    try {
      audio = new AudioContext();
    } catch {
      return;
    }
  }

  const sounds = {
    coin: [[1320, 0.06], [1760, 0.1]],
    bigCoin: [[880, 0.06], [1320, 0.06], [1760, 0.14]],
    jump: [[300, 0.04], [520, 0.08]],
    slide: [[220, 0.1]],
    hurt: [[180, 0.12], [110, 0.2]],
    boost: [[440, 0.06], [660, 0.06], [990, 0.16]],
    heart: [[660, 0.08], [990, 0.16]],
    turn: [[520, 0.05]],
    smash: [[160, 0.06], [90, 0.14]],
    monkey: [[1100, 0.05], [1500, 0.05], [1050, 0.05], [1600, 0.05], [1200, 0.08]],
  };

  let t = audio.currentTime;
  for (const [freq, length] of sounds[name] || []) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = name === "hurt" || name === "smash" ? "sawtooth" : "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + length);
    t += length * 0.8;
  }
}
