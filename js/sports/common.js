// Small drawing helpers shared by the turn-based and race sports.
(function () {
  const TS = (window.TS = window.TS || {});
  TS.sports = TS.sports || {};
  const FONT = '"Trebuchet MS", sans-serif';

  TS.ui = {
    TEAM: ['#e63946', '#3a86ff'],
    NAMES: ['Henry', 'Theo'],
    W: 960,
    H: 600,
    FONT,
    rnd: (a, b) => a + Math.random() * (b - a),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    gauss: () => Math.random() + Math.random() + Math.random() - 1.5, // roughly ±1.5
    tri: (t) => Math.abs((t % 2) - 1), // 0..1..0 triangle wave, period 2

    // Detects left/right alternation. Call with the pad's x axis each frame; returns true on each new step.
    stepper() {
      let last = 0;
      return (x) => {
        let step = false;
        if (x !== 0 && x !== last) step = true;
        if (x !== 0) last = x;
        return step;
      };
    },

    panel(g, x, y, w, h, r, fill) {
      TS.chars.rr(g, x, y, w, h, r || 14);
      g.fillStyle = fill || '#0b132bdd';
      g.fill();
    },
    text(g, str, x, y, size, color, align, weight) {
      g.font = (weight || 800) + ' ' + size + 'px ' + FONT;
      g.textAlign = align || 'left';
      g.textBaseline = 'middle';
      g.fillStyle = color || '#fff';
      g.fillText(str, x, y);
    },
    big(g, text, sub, y, color) {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.font = '900 72px ' + FONT; g.lineWidth = 12; g.strokeStyle = '#0b132b';
      g.strokeText(text, 480, y); g.fillStyle = color || '#fcbf49'; g.fillText(text, 480, y);
      if (sub) {
        g.font = '800 28px ' + FONT; g.lineWidth = 8;
        g.strokeText(sub, 480, y + 58); g.fillStyle = '#fff'; g.fillText(sub, 480, y + 58);
      }
    },
    hint(g, str) {
      g.font = '800 16px ' + FONT;
      const w = g.measureText(str).width + 34;
      TS.ui.panel(g, 480 - w / 2, 556, w, 32, 16, '#0b132bcc');
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(str, 480, 572);
    },
    // Top-centre scoreboard. `active` highlights whose turn it is.
    scoreboard(g, scores, mid, active) {
      TS.ui.panel(g, 480 - 170, 8, 340, 62, 16);
      g.strokeStyle = '#ffffff33'; g.lineWidth = 2; g.stroke();
      for (let i = 0; i < 2; i++) {
        const x = 480 + (i ? 112 : -112);
        TS.ui.text(g, TS.ui.NAMES[i].toUpperCase(), x, 24, 16, active === i ? '#fcbf49' : TS.ui.TEAM[i], 'center');
        TS.ui.text(g, String(scores[i]), x, 52, 34, '#fff', 'center', 800);
      }
      if (mid) TS.ui.text(g, mid, 480, 40, 22, '#fcbf49', 'center');
    },
    // Horizontal oscillating meter. `zone` = [lo, hi] highlighted in green.
    meter(g, x, y, w, h, v, zone, label) {
      TS.ui.panel(g, x - 10, y - 10, w + 20, h + 20, 14, '#0b132bdd');
      g.fillStyle = '#ffffff22'; TS.chars.rr(g, x, y, w, h, 10); g.fill();
      if (zone) {
        g.fillStyle = '#6a994e'; g.fillRect(x + w * zone[0], y, w * (zone[1] - zone[0]), h);
      }
      g.fillStyle = '#fff'; g.fillRect(x + w * v - 3, y - 6, 6, h + 12);
      if (label) TS.ui.text(g, label, x + w / 2, y - 22, 13, '#fff', 'center');
    },
  };
})();
