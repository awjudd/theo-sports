// Tiny WebAudio sound effects (no audio files needed).
(function () {
  const TS = (window.TS = window.TS || {});
  let ac = null;
  let muted = false;
  try { muted = localStorage.getItem('ts.muted') === '1'; } catch (e) {}

  function audio() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, dur, type, vol, slide) {
    if (muted) return;
    const a = audio();
    if (!a) return;
    dur = dur || 0.1;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.07, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  }

  function seq(notes, gap, type, vol) {
    notes.forEach((f, i) => setTimeout(() => tone(f, gap * 1.6 / 1000, type || 'square', vol || 0.07), i * gap));
  }

  TS.sfx = {
    tone,
    click() { tone(660, 0.05); },
    tick() { tone(1100, 0.03, 'triangle', 0.06); },
    hit() { tone(240, 0.12, 'sawtooth', 0.08, -140); },
    thud() { tone(120, 0.15, 'sine', 0.12, -60); },
    swish() { tone(500, 0.18, 'triangle', 0.05, 600); },
    beep() { tone(520, 0.12, 'square', 0.06); },
    go() { tone(880, 0.3, 'square', 0.07); },
    goal() { seq([523, 659, 784, 1046], 110); },
    win() { seq([523, 659, 784, 659, 784, 1046], 120); },
    lose() { seq([392, 349, 311, 262], 160, 'triangle'); },
    wheelDone() { seq([784, 988, 1175], 90); },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('ts.muted', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
    isMuted() { return muted; },
  };
})();
