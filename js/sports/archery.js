// Archery: hold Action to steady your aim, release to loose the arrow.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const T = { x: 560, y: 285, r: 150 };
  const ARROWS = 5;
  const RINGS = ['#f5f5f5', '#f5f5f5', '#222', '#222', '#3a86ff', '#3a86ff', '#e63946', '#e63946', '#fcbf49', '#fcbf49'];

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, shot: 0, cur: 0, scores: [0, 0], stuck: [[], []], hold: 0, holding: false,
      rx: 0, ry: 0, wind: 0, arrow: null, msg: null, phase: 'aim', cpu: null, cpuT: 0, extra: 0, tw: 0,
    };

    function begin() {
      S.cur = S.shot % 2;
      S.rx = U.rnd(-30, 30); S.ry = U.rnd(-20, 30); S.hold = 0; S.holding = false; S.arrow = null;
      S.wind = Math.round(U.rnd(-1, 1) * 24);
      S.phase = 'aim'; S.cpuT = 0;
      if (!P[S.cur].human) S.cpu = { wait: U.rnd(1.1, 2.0), err: 24 + U.rnd(0, 12) };
      S.state = 'play';
      S.msg = { text: U.NAMES[S.cur], sub: 'Arrow ' + (Math.floor(S.shot / 2) + 1) + ' of ' + ARROWS, t: 1.0 };
    }
    S.msg = { text: 'ARCHERY', sub: 'Steady… and release', t: 1.6 };

    function sway() {
      // amplitude shrinks while holding the breath, then grows when you run out
      const h = S.hold;
      const amp = !S.holding ? 36 : (h < 1.4 ? 36 - 28 * (h / 1.4) : 8 + (h - 1.4) * 40);
      return {
        x: Math.sin(S.t * 1.7) * amp + Math.sin(S.t * 3.1 + 1) * amp * 0.35,
        y: Math.cos(S.t * 1.3) * amp * 0.8 + Math.sin(S.t * 2.7) * amp * 0.3,
      };
    }

    function loose(aimX, aimY) {
      const x = aimX + S.wind + U.gauss() * 2.5, y = aimY + 6 + U.gauss() * 2.5; // arrows drop a little
      S.arrow = { u: 0, x, y, sx: 0, sy: 0 };
      S.phase = 'flight';
      TS.sfx.swish();
    }
    function score(x, y) {
      const d = Math.hypot(x, y);
      return d >= T.r ? 0 : 10 - Math.floor(d / (T.r / 10));
    }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) begin(); return; }
      if (S.state === 'over') {
        if (S.t > 1.6 && !g.over) {
          g.over = true;
          g.result = { winner: S.scores[0] === S.scores[1] ? null : (S.scores[0] > S.scores[1] ? 0 : 1), scores: S.scores.slice(), summary: 'Archery — Henry ' + S.scores[0] + ', Theo ' + S.scores[1] };
        }
        return;
      }
      const human = P[S.cur].human;
      const pad = TS.input.pad(S.cur);
      if (S.phase === 'aim') {
        S.cpuT += dt;
        if (human) {
          S.rx = U.clamp(S.rx + pad.x * 110 * dt, -190, 190);
          S.ry = U.clamp(S.ry + pad.y * 110 * dt, -190, 190);
          if (pad.act) { S.holding = true; S.hold += dt; }
          else if (S.holding) {
            const sw = sway(); // measured while still holding, before the state resets
            S.holding = false; S.hold = 0;
            loose(S.rx + sw.x, S.ry + sw.y);
          } else S.hold = 0;
        } else {
          S.holding = S.cpuT > 0.4; S.hold = Math.max(0, S.cpuT - 0.4);
          if (S.cpuT > S.cpu.wait) {
            const e = S.cpu.err;
            const comp = -S.wind * (0.6 + U.rnd(0, 0.5));
            S.holding = false;
            loose(U.gauss() * e + comp, U.gauss() * e - 4);
          }
        }
      } else if (S.phase === 'flight') {
        S.arrow.u = Math.min(1, S.arrow.u + dt / 0.38);
        if (S.arrow.u >= 1) {
          const pts = score(S.arrow.x, S.arrow.y);
          S.scores[S.cur] += pts; S.stuck[S.cur].push({ x: S.arrow.x, y: S.arrow.y, pts });
          S.phase = 'result'; S.t = 0;
          S.msg = { text: pts === 10 ? 'BULLSEYE!' : (pts === 0 ? 'MISSED' : pts + ' POINTS'), sub: '', t: 1.3 };
          if (pts >= 9) TS.sfx.goal(); else if (pts > 0) TS.sfx.thud(); else TS.sfx.beep();
          S.tw = 0.6;
        }
      } else if (S.phase === 'result') {
        S.tw = Math.max(0, S.tw - dt);
        if (S.t > 1.5) {
          S.shot++;
          if (S.shot >= ARROWS * 2) {
            if (S.scores[0] === S.scores[1] && S.extra < 2) { S.extra++; begin(); return; }
            S.state = 'over'; S.t = 0; S.msg = { text: 'FINAL', sub: S.scores[0] + ' – ' + S.scores[1], t: 99 };
          } else begin();
        }
      }
    }

    function drawScene(g) {
      const sky = g.createLinearGradient(0, 0, 0, 380);
      sky.addColorStop(0, '#5aa9e6'); sky.addColorStop(1, '#d6efff');
      g.fillStyle = sky; g.fillRect(0, 0, 960, 380);
      g.fillStyle = '#7fb77e'; g.beginPath(); g.moveTo(0, 360); g.quadraticCurveTo(250, 290, 520, 350); g.quadraticCurveTo(760, 300, 960, 340); g.lineTo(960, 400); g.lineTo(0, 400); g.fill();
      g.fillStyle = '#4f9a50'; g.fillRect(0, 380, 960, 220);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#559f56' : '#4a9149'; g.fillRect(0, 380 + i * 28, 960, 28); }
      // flag for wind
      g.strokeStyle = '#444'; g.lineWidth = 4; g.beginPath(); g.moveTo(850, 400); g.lineTo(850, 250); g.stroke();
      const fl = Math.sign(S.wind) || 1, wave = Math.sin(S.t * 5) * 4;
      g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(850, 252); g.lineTo(850 + fl * (24 + Math.abs(S.wind) * 1.4), 262 + wave); g.lineTo(850, 276); g.fill();
      // target stand
      g.strokeStyle = '#6b4423'; g.lineWidth = 10; g.beginPath(); g.moveTo(T.x - 60, 560); g.lineTo(T.x, T.y + 40); g.lineTo(T.x + 60, 560); g.stroke();
      g.fillStyle = '#d9b57b'; g.beginPath(); g.arc(T.x, T.y, T.r + 12, 0, TAU); g.fill();
      for (let i = 0; i < 10; i++) { g.fillStyle = RINGS[i]; g.beginPath(); g.arc(T.x, T.y, T.r - i * (T.r / 10), 0, TAU); g.fill(); }
      g.strokeStyle = '#00000033'; g.lineWidth = 1;
      for (let i = 1; i <= 10; i++) { g.beginPath(); g.arc(T.x, T.y, i * (T.r / 10), 0, TAU); g.stroke(); }
    }
    function drawArrowStuck(g, x, y, col) {
      g.strokeStyle = '#3b2a1a'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 22, y + 8); g.stroke();
      g.strokeStyle = col; g.lineWidth = 5;
      g.beginPath(); g.moveTo(x - 22, y + 8); g.lineTo(x - 30, y + 11); g.stroke();
      g.fillStyle = '#222'; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill();
    }
    function draw(g) {
      drawScene(g);
      for (let i = 0; i < 2; i++) S.stuck[i].forEach((a) => drawArrowStuck(g, T.x + a.x, T.y + a.y, U.TEAM[i]));
      // flying arrow
      if (S.phase === 'flight' && S.arrow) {
        const a = S.arrow, u = a.u;
        const x = U.lerp(180, T.x + a.x, u), y = U.lerp(430, T.y + a.y, u) - Math.sin(u * Math.PI) * 60;
        const ang = Math.atan2((T.y + a.y - 430) - Math.cos(u * Math.PI) * 60 * Math.PI, T.x + a.x - 180);
        g.save(); g.translate(x, y); g.rotate(ang * 0.5);
        g.strokeStyle = '#3b2a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-26, 0); g.lineTo(0, 0); g.stroke();
        g.strokeStyle = U.TEAM[S.cur]; g.lineWidth = 5; g.beginPath(); g.moveTo(-26, 0); g.lineTo(-33, 0); g.stroke();
        g.restore();
      }
      // archers
      const o = P[1 - S.cur], k = P[S.cur];
      TS.chars.draw(g, o.who, o.outfit, { x: 60, y: 585, scale: 1.1, t: S.t + 2 });
      TS.chars.draw(g, k.who, k.outfit, { x: 170, y: 560, scale: 1.5, t: S.t, arm: S.phase === 'aim' && S.holding ? 1.5 : 0.4 });
      // bow
      g.strokeStyle = '#6b4423'; g.lineWidth = 5; g.beginPath(); g.arc(205, 470, 34, -1.2, 1.2); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(205 + Math.cos(-1.2) * 34, 470 + Math.sin(-1.2) * 34); g.lineTo(S.holding ? 186 : 205 + 6, 470); g.lineTo(205 + Math.cos(1.2) * 34, 470 + Math.sin(1.2) * 34); g.stroke();
      // reticle
      if (S.state === 'play' && S.phase === 'aim') {
        const sw = sway();
        const cx = T.x + S.rx + sw.x, cy = T.y + S.ry + sw.y;
        const hot = Math.hypot(S.rx + sw.x, S.ry + sw.y) < T.r;
        g.strokeStyle = hot ? '#fff' : '#ffb3b3'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(cx, cy, 16, 0, TAU); g.moveTo(cx - 26, cy); g.lineTo(cx - 6, cy); g.moveTo(cx + 6, cy); g.lineTo(cx + 26, cy); g.moveTo(cx, cy - 26); g.lineTo(cx, cy - 6); g.moveTo(cx, cy + 6); g.lineTo(cx, cy + 26); g.stroke();
        g.fillStyle = '#e63946'; g.beginPath(); g.arc(cx, cy, 2, 0, TAU); g.fill();
      }
      U.scoreboard(g, S.scores, Math.min(ARROWS, Math.floor(S.shot / 2) + 1) + '/' + ARROWS, S.state === 'play' ? S.cur : -1);
      U.panel(g, 14, 90, 128, 46, 12);
      U.text(g, 'WIND ' + (S.wind === 0 ? '–' : (S.wind < 0 ? '◀ ' : '') + Math.abs(S.wind) + (S.wind > 0 ? ' ▶' : '')), 28, 113, 15, '#fff');
      if (S.state === 'play' && S.phase === 'aim') {
        const human = P[S.cur].human;
        if (human) {
          U.hint(g, '◀ ▶ ▲ ▼ move aim · HOLD Action to steady · RELEASE to shoot');
          if (S.holding) { const f = U.clamp(1 - S.hold / 2.2, 0, 1); U.panel(g, 420, 520, 140, 14, 7, '#0b132b'); g.fillStyle = f > 0.35 ? '#4cc9f0' : '#e63946'; g.fillRect(422, 522, 136 * f, 10); }
        } else U.hint(g, U.NAMES[S.cur] + ' draws the bow…');
      }
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 120, '#fcbf49');
    }

    const g = {
      title: '🏹 Archery',
      help: [
        'Five arrows each. Closer to the bullseye scores more — a bullseye is <b>10 points</b>.',
        'Use the direction keys to move your aim. Your aim wobbles: <b>hold Action</b> to hold your breath and steady it, then <b>release</b> to shoot. Don’t hold too long!',
        'The flag shows the <b>wind</b> — it will push your arrow sideways.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.archery = create;
})();
