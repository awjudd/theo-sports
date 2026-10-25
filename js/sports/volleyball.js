// Beach volleyball: side view, first to 7 points, win by... first to 7.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const GROUND = 500, NET_X = 480, NET_TOP = 330, WIN = 7;
  const PR = 30, BR = 15, GRAV = 1500, JUMP = 640, SPEED = 300;

  function create(ctx) {
    const P = ctx.players;
    const mk = (i) => ({ idx: i, x: i ? 700 : 260, y: GROUND, vx: 0, vy: 0, fx: i ? -1 : 1, hit: 0, t: Math.random() * 3, ai: { react: 0, tx: 0 } });
    const S = {
      state: 'intro', t: 0, cd: 0, score: [0, 0], msg: null, pl: [mk(0), mk(1)], server: 0,
      ball: { x: 0, y: 0, vx: 0, vy: 0, live: false, spin: 0 }, touches: [0, 0], last: -1, endT: 0, parts: [],
    };
    S.msg = { text: 'VOLLEYBALL', sub: 'First to ' + WIN, t: 1.6 };

    function serve() {
      S.pl = [mk(0), mk(1)];
      const b = S.ball;
      b.x = S.server ? 700 : 260; b.y = 250; b.vx = 0; b.vy = 0; b.live = false; S.touches = [0, 0]; S.last = -1;
      S.state = 'serve'; S.cd = 1.2;
      S.msg = { text: U.NAMES[S.server] + ' serves', sub: '', t: 1.0 };
    }

    function point(w) {
      S.score[w]++; S.server = w; S.state = 'point'; S.endT = 1.8;
      S.msg = { text: U.NAMES[w].toUpperCase() + ' SCORES!', sub: S.score[0] + ' – ' + S.score[1], t: 1.8 };
      TS.sfx.goal();
      if (S.score[w] >= WIN) { S.state = 'over'; S.t = 0; S.msg = { text: U.NAMES[w].toUpperCase() + ' WINS!', sub: S.score[0] + ' – ' + S.score[1], t: 99 }; }
    }

    function predictLanding(b) {
      // where the ball will come down (ignoring the net), at player head height
      let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
      for (let i = 0; i < 240; i++) { vy += GRAV * 0.016; x += vx * 0.016; y += vy * 0.016; if (y > GROUND - 60) return { x, t: i * 0.016 }; if (x < 30 || x > 930) vx = -vx; }
      return { x, t: 4 };
    }

    function cmd(p) {
      if (P[p.idx].human) { const pd = TS.input.pad(p.idx); return { x: pd.x, jump: pd.actP || pd.y < 0, smash: pd.act }; }
      const b = S.ball, own = p.idx ? b.x > NET_X : b.x < NET_X;
      let x = 0, jump = false;
      if (own && b.live) {
        const lp = predictLanding(b);
        const tx = U.clamp(lp.x + (p.idx ? 18 : -18) + p.ai.react, p.idx ? NET_X + 50 : 40, p.idx ? 920 : NET_X - 50);
        if (Math.abs(tx - p.x) > 10) x = Math.sign(tx - p.x);
        if (Math.abs(b.x - p.x) < 80 && b.y < GROUND - 60 && b.y > GROUND - 230 && p.y >= GROUND && Math.random() < 0.18) jump = true;
      } else {
        const home = p.idx ? 700 : 260;
        if (Math.abs(home - p.x) > 20) x = Math.sign(home - p.x) * 0.6;
        if (S.state === 'serve' && S.server === p.idx) jump = false;
      }
      return { x, jump, smash: true };
    }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      S.parts.forEach((q) => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 700 * dt; q.life -= dt; });
      S.parts = S.parts.filter((q) => q.life > 0);
      S.pl.forEach((p) => { p.t += dt; p.hit = Math.max(0, p.hit - dt); });
      if (S.state === 'intro') { if (S.t > 1.7) { serve(); } return; }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) { g.over = true; g.result = { winner: S.score[0] > S.score[1] ? 0 : 1, scores: S.score.slice(), summary: 'Final score: Henry ' + S.score[0] + ' – ' + S.score[1] + ' Theo' }; }
        return;
      }
      if (S.state === 'point') { S.endT -= dt; if (S.endT <= 0) serve(); return; }
      const b = S.ball;
      if (S.state === 'serve') {
        S.cd -= dt;
        b.y = 250 + Math.sin(S.t * 5) * 6;
        if (S.cd <= 0) { S.state = 'play'; b.live = true; b.vx = S.server ? -260 : 260; b.vy = -420; TS.sfx.swish(); }
      }
      // players
      for (const p of S.pl) {
        const c = cmd(p);
        p.vx += (c.x * SPEED - p.vx) * Math.min(1, dt * 14);
        if (p.y >= GROUND && c.jump && S.state !== 'serve') { p.vy = -JUMP; TS.sfx.swish(); }
        p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y > GROUND) { p.y = GROUND; p.vy = 0; }
        const lo = p.idx ? NET_X + 14 + PR * 0.6 : 30, hi = p.idx ? 930 : NET_X - 14 - PR * 0.6;
        p.x = U.clamp(p.x, lo, hi);
        if (Math.abs(c.x) > 0.1) p.fx = Math.sign(c.x);
        p.ai.react += (0 - p.ai.react) * dt; if (!P[p.idx].human && Math.random() < dt * 1.2) p.ai.react = U.rnd(-34, 34);
      }
      if (!b.live) return;
      b.vy += GRAV * dt * 0.62; b.x += b.vx * dt; b.y += b.vy * dt; b.spin += b.vx * dt * 0.02;
      if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx) * 0.8; }
      if (b.x > 960 - BR) { b.x = 960 - BR; b.vx = -Math.abs(b.vx) * 0.8; }
      // net
      if (b.y + BR > NET_TOP && Math.abs(b.x - NET_X) < BR + 5) {
        if (b.y < NET_TOP + 4 && b.vy > 0) { b.y = NET_TOP - BR; b.vy = -Math.abs(b.vy) * 0.5; }
        else { b.x = NET_X + Math.sign(b.x - NET_X || 1) * (BR + 5); b.vx = -b.vx * 0.5; }
      }
      // players
      for (const p of S.pl) {
        const dx = b.x - p.x, dy = b.y - (p.y - 48), d = Math.hypot(dx, dy);
        if (d < PR + BR && d > 0.01) {
          const nx = dx / d, ny = dy / d;
          b.x = p.x + nx * (PR + BR); b.y = p.y - 48 + ny * (PR + BR);
          const smash = p.y < GROUND - 20 && (P[p.idx].human ? TS.input.pad(p.idx).act : true);
          const sp = Math.max(520, Math.hypot(b.vx, b.vy) * 0.6) + (smash ? 180 : 0) + Math.abs(p.vx) * 0.3;
          b.vx = nx * sp * 0.8 + p.vx * 0.5; b.vy = Math.min(-300, ny * sp - 260);
          if (smash && ny > -0.2) b.vy = Math.abs(ny) * sp * 0.6;
          p.hit = 0.2;
          if (S.last === p.idx) S.touches[p.idx]++; else { S.touches[p.idx] = 1; S.touches[1 - p.idx] = 0; }
          S.last = p.idx;
          TS.sfx.hit();
          for (let k = 0; k < 5; k++) S.parts.push({ x: b.x, y: b.y, vx: U.rnd(-120, 120), vy: U.rnd(-180, -20), life: 0.4 });
          if (S.touches[p.idx] > 3) { point(1 - p.idx); S.msg.sub = 'Too many touches'; return; }
        }
      }
      if (b.y > GROUND - BR + 8) { // ball hits the sand
        const side = b.x < NET_X ? 0 : 1;
        TS.sfx.thud();
        point(1 - side);
      }
    }

    function drawChar(g, p) {
      const pl = P[p.idx];
      TS.chars.draw(g, pl.who, pl.outfit, { x: p.x, y: p.y + 22, scale: 0.88, t: p.t, moving: Math.abs(p.vx) > 40 && p.y >= GROUND, facing: p.fx >= 0 ? 1 : -1, arm: p.hit > 0 ? 2.5 : 0.6, lift: 0, cheer: S.state === 'point' && S.msg && S.score[p.idx] > S.score[1 - p.idx] && false });
    }
    function draw(g) {
      const sky = g.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#4aa3e8'); sky.addColorStop(1, '#bfe6ff');
      g.fillStyle = sky; g.fillRect(0, 0, 960, GROUND);
      g.fillStyle = '#fff8'; for (const [x, y, r] of [[160, 100, 36], [220, 96, 28], [720, 140, 34], [780, 134, 26]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      g.fillStyle = '#fcd34d'; g.beginPath(); g.arc(860, 80, 44, 0, TAU); g.fill();
      g.fillStyle = '#2f9fd0'; g.fillRect(0, 392, 960, 110);
      g.fillStyle = '#ffffff55'; for (let x = 0; x < 960; x += 40) g.fillRect(x + ((S.t * 20) % 40), 400 + (x % 3) * 12, 18, 2);
      g.fillStyle = '#f2d49b'; g.fillRect(0, GROUND - 6, 960, 110);
      g.fillStyle = '#e6c27f'; for (let x = 0; x < 960; x += 54) g.fillRect(x, GROUND + 22 + (x % 3) * 14, 24, 3);
      // net
      g.strokeStyle = '#e9e9e9'; g.lineWidth = 6; g.beginPath(); g.moveTo(NET_X, GROUND - 4); g.lineTo(NET_X, NET_TOP - 10); g.stroke();
      g.fillStyle = '#ffffff22'; g.fillRect(NET_X - 4, NET_TOP, 8, GROUND - NET_TOP);
      g.strokeStyle = '#ffffffaa'; g.lineWidth = 1;
      for (let y = NET_TOP; y < GROUND; y += 12) { g.beginPath(); g.moveTo(NET_X - 6, y); g.lineTo(NET_X + 6, y); g.stroke(); }
      g.fillStyle = '#fff'; g.fillRect(NET_X - 8, NET_TOP - 4, 16, 6);
      // shadows
      S.pl.forEach((p) => { g.fillStyle = '#0003'; g.beginPath(); g.ellipse(p.x, GROUND + 18, 24 - (GROUND - p.y) * 0.04, 6, 0, 0, TAU); g.fill(); });
      const b = S.ball;
      g.fillStyle = '#0003'; g.beginPath(); g.ellipse(b.x, GROUND + 18, 12, 4, 0, 0, TAU); g.fill();
      S.pl.forEach((p) => drawChar(g, p));
      // ball
      g.save(); g.translate(b.x, b.y); g.rotate(b.spin);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, BR, 0, TAU); g.fill();
      g.strokeStyle = '#3a86ff'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, BR - 1.5, 0.3, 2.2); g.stroke();
      g.strokeStyle = '#fcbf49'; g.beginPath(); g.arc(0, 0, BR - 1.5, 3.4, 5.4); g.stroke();
      g.restore();
      S.parts.forEach((q) => { g.fillStyle = '#fff'; g.globalAlpha = Math.max(0, q.life * 2.5); g.beginPath(); g.arc(q.x, q.y, 3, 0, TAU); g.fill(); g.globalAlpha = 1; });
      // touch counter
      if (S.state === 'play' && S.last >= 0) U.text(g, 'touches: ' + S.touches[S.last] + '/3', S.last ? 740 : 220, 150, 14, '#fff', 'center');
      U.scoreboard(g, S.score, 'to ' + WIN, -1);
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 200, '#fcbf49');
      if (S.state === 'serve' || (S.state === 'play' && S.t < 6)) {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: A/D move · W or Space jump      Theo: ◀ ▶ move · ▲ or Enter jump' : '◀ ▶ move · ▲ or Action to jump — hit the ball over the net!');
      }
    }

    const g = {
      title: '🏐 Beach Volleyball',
      help: [
        'First to seven points. Keep the ball off the sand on your side and hit it over the net so it lands on your rival’s side.',
        'Move with <b>◀ ▶</b> and jump with <b>▲</b> or <b>Action</b>. <b>Jump into the ball while holding Action</b> to spike it down hard!',
        'You get three touches per side — no hitting it four times in a row.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.volleyball = create;
})();
