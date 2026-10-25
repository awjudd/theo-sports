// Darts: a drifting reticle, press Action to throw. Highest total over five rounds of three darts.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const B = { x: 590, y: 300, r: 215 }; // board
  const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const ROUNDS = 5, DARTS = 3;
  // ring radii as fractions of board radius
  const RING = { bull: 0.04, outerBull: 0.095, tripleIn: 0.58, tripleOut: 0.66, doubleIn: 0.94 };

  function scoreAt(dx, dy) {
    const d = Math.hypot(dx, dy) / B.r;
    if (d > 1) return { pts: 0, label: 'MISS' };
    if (d < RING.bull) return { pts: 50, label: 'BULLSEYE!' };
    if (d < RING.outerBull) return { pts: 25, label: 'OUTER BULL' };
    let a = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / 20; // 0 at top, rotated half a sector
    a = ((a % TAU) + TAU) % TAU;
    const n = ORDER[Math.floor(a / (TAU / 20)) % 20];
    if (d > RING.doubleIn) return { pts: n * 2, label: 'DOUBLE ' + n };
    if (d > RING.tripleIn && d < RING.tripleOut) return { pts: n * 3, label: 'TRIPLE ' + n };
    return { pts: n, label: String(n) };
  }

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, turn: 0, cur: 0, round: 1, dart: 0, scores: [0, 0], darts: [], rx: 0, ry: 0, msg: null, phase: 'aim', endT: 0, cpuT: 0, cpu: null, lastPts: 0, roundPts: [0, 0],
    };
    S.msg = { text: 'DARTS', sub: 'Five rounds · three darts each', t: 1.6 };

    function begin() {
      S.cur = S.turn % 2; S.dart = 0; S.darts = []; S.phase = 'aim'; S.state = 'play'; S.cpuT = 0; S.roundPts[S.cur] = 0;
      if (!P[S.cur].human) S.cpu = { wait: U.rnd(0.8, 1.4) };
      S.msg = { text: U.NAMES[S.cur], sub: 'Round ' + S.round + ' · ' + DARTS + ' darts', t: 1.0 };
    }
    function drift(t) {
      // slow figure-eight; amplitude depends on the round so it stays challenging
      return { x: Math.sin(t * 1.5) * 150 + Math.sin(t * 3.1) * 30, y: Math.sin(t * 2.3 + 0.8) * 120 + Math.cos(t * 1.1) * 30 };
    }
    function throwDart() {
      const d = drift(S.t + S.cur);
      const x = d.x + U.gauss() * 5 + 0, y = d.y + U.gauss() * 5 + 10; // darts sag slightly
      const r = scoreAt(x, y);
      S.darts.push({ x, y, pts: r.pts });
      S.scores[S.cur] += r.pts; S.roundPts[S.cur] += r.pts; S.lastPts = r.pts;
      S.msg = { text: r.label, sub: r.pts ? '+' + r.pts : '', t: 0.9 };
      if (r.pts >= 40) TS.sfx.goal(); else if (r.pts > 0) TS.sfx.hit(); else TS.sfx.beep();
      S.dart++; S.phase = 'result'; S.endT = 0.85;
    }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) begin(); return; }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) { g.over = true; g.result = { winner: S.scores[0] === S.scores[1] ? null : (S.scores[0] > S.scores[1] ? 0 : 1), scores: S.scores.slice(), summary: 'Darts total — Henry ' + S.scores[0] + ', Theo ' + S.scores[1] }; }
        return;
      }
      const human = P[S.cur].human;
      if (S.phase === 'aim') {
        S.cpuT += dt;
        const d = drift(S.t + S.cur); S.rx = d.x; S.ry = d.y;
        if (human) { if (S.cpuT > 0.3 && TS.input.pad(S.cur).actP) throwDart(); }
        else if (S.cpuT > S.cpu.wait) {
          // the CPU releases when the reticle crosses near the board centre, with some slop
          if (Math.hypot(S.rx, S.ry) < 70 + U.rnd(0, 55)) throwDart();
        }
      } else if (S.phase === 'result') {
        S.endT -= dt;
        if (S.endT <= 0) {
          if (S.dart >= DARTS) {
            S.turn++;
            if (S.turn % 2 === 0) S.round++;
            if (S.round > ROUNDS) {
              if (S.scores[0] === S.scores[1] && S.round <= ROUNDS + 1) { /* one extra round on a tie */ }
              else { S.state = 'over'; S.t = 0; S.msg = { text: 'FINAL', sub: S.scores[0] + ' – ' + S.scores[1], t: 99 }; return; }
            }
            begin();
          } else { S.phase = 'aim'; S.cpuT = 0; if (!human) S.cpu.wait = U.rnd(0.6, 1.1); }
        }
      }
    }

    function draw(g) {
      g.fillStyle = '#2b1a14'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#33201a' : '#2a1812'; g.fillRect(i * 60, 0, 60, 600); }
      // board
      g.fillStyle = '#111'; g.beginPath(); g.arc(B.x, B.y, B.r + 14, 0, TAU); g.fill();
      for (let k = 0; k < 20; k++) {
        const a0 = -Math.PI / 2 - Math.PI / 20 + k * (TAU / 20), a1 = a0 + TAU / 20;
        const dark = k % 2 === 0;
        const ring = (r0, r1, c) => { g.fillStyle = c; g.beginPath(); g.arc(B.x, B.y, B.r * r1, a0, a1); g.arc(B.x, B.y, B.r * r0, a1, a0, true); g.closePath(); g.fill(); };
        ring(RING.outerBull, RING.tripleIn, dark ? '#1b1b1b' : '#f2e2b8');
        ring(RING.tripleIn, RING.tripleOut, dark ? '#e63946' : '#2a9d3e');
        ring(RING.tripleOut, RING.doubleIn, dark ? '#1b1b1b' : '#f2e2b8');
        ring(RING.doubleIn, 1, dark ? '#e63946' : '#2a9d3e');
      }
      g.fillStyle = '#2a9d3e'; g.beginPath(); g.arc(B.x, B.y, B.r * RING.outerBull, 0, TAU); g.fill();
      g.fillStyle = '#e63946'; g.beginPath(); g.arc(B.x, B.y, B.r * RING.bull, 0, TAU); g.fill();
      g.strokeStyle = '#ccc'; g.lineWidth = 1;
      for (let k = 0; k < 20; k++) { const a = -Math.PI / 2 - Math.PI / 20 + k * (TAU / 20); g.beginPath(); g.moveTo(B.x + Math.cos(a) * B.r * RING.outerBull, B.y + Math.sin(a) * B.r * RING.outerBull); g.lineTo(B.x + Math.cos(a) * B.r, B.y + Math.sin(a) * B.r); g.stroke(); }
      for (let k = 0; k < 20; k++) { const a = -Math.PI / 2 + k * (TAU / 20); U.text(g, String(ORDER[k]), B.x + Math.cos(a) * (B.r + 1) * 1.0, B.y + Math.sin(a) * (B.r + 1), 15, '#fff', 'center'); }
      // darts stuck
      S.darts.forEach((d) => {
        const x = B.x + d.x, y = B.y + d.y;
        g.strokeStyle = '#999'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 20, y + 20); g.stroke();
        g.fillStyle = U.TEAM[S.cur]; g.beginPath(); g.moveTo(x - 20, y + 20); g.lineTo(x - 32, y + 18); g.lineTo(x - 22, y + 32); g.closePath(); g.fill();
        g.fillStyle = '#ddd'; g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill();
      });
      // reticle
      if (S.state === 'play' && S.phase === 'aim') {
        const x = B.x + S.rx, y = B.y + S.ry;
        g.strokeStyle = '#fcbf49'; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, 14, 0, TAU); g.moveTo(x - 22, y); g.lineTo(x - 6, y); g.moveTo(x + 6, y); g.lineTo(x + 22, y); g.moveTo(x, y - 22); g.lineTo(x, y - 6); g.moveTo(x, y + 6); g.lineTo(x, y + 22); g.stroke();
      }
      // thrower + info
      const p = P[S.cur];
      TS.chars.draw(g, p.who, p.outfit, { x: 160, y: 560, scale: 1.9, t: S.t, arm: S.phase === 'result' ? 2.3 : 0.9, facing: 1 });
      U.panel(g, 30, 130, 230, 150, 16);
      U.text(g, 'THIS ROUND', 48, 156, 14, '#ffffffaa');
      U.text(g, String(S.roundPts[S.cur]), 48, 196, 40, '#fff');
      for (let i = 0; i < DARTS; i++) { g.fillStyle = i < S.dart ? '#ffffff33' : U.TEAM[S.cur]; g.beginPath(); g.arc(60 + i * 36, 250, 11, 0, TAU); g.fill(); }
      U.scoreboard(g, S.scores, 'R' + Math.min(ROUNDS, S.round) + '/' + ROUNDS, S.state === 'play' ? S.cur : -1);
      if (S.state === 'play' && S.phase === 'aim') U.hint(g, P[S.cur].human ? 'Press Action to throw when the reticle is on the target!' : U.NAMES[S.cur] + ' is aiming…');
      if (S.msg) { U.text(g, S.msg.text, 145, 330, 30, '#fcbf49', 'center', 900); if (S.msg.sub) U.text(g, S.msg.sub, 145, 366, 24, '#fff', 'center', 800); }
    }

    const g = {
      title: '🎯 Darts',
      help: [
        'Five rounds of three darts each — highest total wins. The reticle drifts around the board all the time.',
        'Press <b>Action</b> to throw when the reticle is over the spot you want. <b>Bullseye = 50</b>, the thin outer ring is a <b>double</b>, and the inner ring is a <b>triple</b>!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.darts = create;
})();
