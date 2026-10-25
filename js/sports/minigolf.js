// Mini golf: four holes of obstacles, take turns, fewest putts wins.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const BR = 8, CUP = 12, MAX = 6, FRIC = 170, SAND = 560;

  const HOLES = [
    { par: 2, area: [80, 220, 880, 380], tee: [150, 300], cup: [800, 300],
      rects: [[470, 262, 36, 76]], circles: [], sand: [], mill: null },
    { par: 3, area: [80, 110, 880, 530], tee: [140, 480], cup: [810, 160],
      rects: [[260, 110, 120, 290], [580, 250, 120, 280]], circles: [], sand: [], mill: null },
    { par: 3, area: [80, 200, 880, 400], tee: [140, 300], cup: [815, 300],
      rects: [[458, 200, 44, 65], [458, 335, 44, 65]], circles: [], sand: [], mill: { x: 480, y: 300, len: 52, w: 1.4 } },
    { par: 3, area: [80, 110, 880, 530], tee: [140, 320], cup: [820, 320],
      rects: [], circles: [[310, 240, 28], [310, 400, 28], [650, 320, 30]], sand: [[400, 190, 160, 260]], mill: null },
  ];

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, hole: 0, cur: 0, phase: 'aim', angle: 0, power: 0, powT: 0, msg: null,
      pl: P.map((p, i) => ({ idx: i, who: p.who, outfit: p.outfit, x: 0, y: 0, putts: 0, holed: false, scores: [], t: Math.random() * 4, cheer: 0, lastOk: true })),
      ball: null, plan: null, aiT: 0, aiStart: 0, timer: 0, clock: 0, trail: [], sunk: 0,
    };
    const H = () => HOLES[S.hole];

    function startHole() {
      S.pl.forEach((p) => { p.x = H().tee[0]; p.y = H().tee[1]; p.putts = 0; p.holed = false; p.cheer = 0; });
      S.phase = 'intro'; S.timer = 2.2; S.ball = null; S.trail = [];
      S.msg = { text: 'HOLE ' + (S.hole + 1), sub: 'Par ' + H().par, t: 2.2 };
    }
    startHole();

    const dist = (p) => Math.hypot(p.x - H().cup[0], p.y - H().cup[1]);
    function pickShooter() {
      const open = S.pl.filter((p) => !p.holed);
      open.sort((a, b) => dist(b) - dist(a) || a.idx - b.idx);
      return open[0].idx;
    }
    function beginTurn() {
      S.cur = pickShooter();
      const p = S.pl[S.cur];
      S.phase = 'aim'; S.power = 0; S.powT = 0; S.aiT = 0;
      S.angle = Math.atan2(H().cup[1] - p.y, H().cup[0] - p.x);
      if (!P[S.cur].human) { S.plan = plan(p); S.aiStart = S.angle; }
    }

    // ----- physics (shared by the game and the CPU planner) -----
    function millAngle(h, time) { return h.mill ? time * h.mill.w : 0; }
    function collideCircle(b, cx, cy, r, rest) {
      const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
      if (d < r + BR && d > 0.001) {
        const nx = dx / d, ny = dy / d;
        b.x = cx + nx * (r + BR); b.y = cy + ny * (r + BR);
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= (1 + rest) * vn * nx; b.vy -= (1 + rest) * vn * ny; b.hit = true; }
      }
    }
    function collideRect(b, r) {
      const [x, y, w, h] = r;
      const cx = U.clamp(b.x, x, x + w), cy = U.clamp(b.y, y, y + h);
      const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
      if (d < BR) {
        let nx, ny;
        if (d > 0.001) { nx = dx / d; ny = dy / d; b.x = cx + nx * BR; b.y = cy + ny * BR; }
        else { // centre inside the rect: push out the shortest way
          const l = b.x - x, rr = x + w - b.x, t = b.y - y, bb = y + h - b.y, m = Math.min(l, rr, t, bb);
          if (m === l) { nx = -1; ny = 0; b.x = x - BR; } else if (m === rr) { nx = 1; ny = 0; b.x = x + w + BR; }
          else if (m === t) { nx = 0; ny = -1; b.y = y - BR; } else { nx = 0; ny = 1; b.y = y + h + BR; }
        }
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; b.hit = true; }
      }
    }
    function step(b, dt, h, time) {
      const sub = 5, d = dt / sub;
      for (let s = 0; s < sub; s++) {
        b.x += b.vx * d; b.y += b.vy * d;
        const [l, t, r, bt] = h.area;
        if (b.x < l + BR) { b.x = l + BR; b.vx = Math.abs(b.vx) * 0.85; b.hit = true; }
        if (b.x > r - BR) { b.x = r - BR; b.vx = -Math.abs(b.vx) * 0.85; b.hit = true; }
        if (b.y < t + BR) { b.y = t + BR; b.vy = Math.abs(b.vy) * 0.85; b.hit = true; }
        if (b.y > bt - BR) { b.y = bt - BR; b.vy = -Math.abs(b.vy) * 0.85; b.hit = true; }
        for (const rc of h.rects) collideRect(b, rc);
        for (const c of h.circles) collideCircle(b, c[0], c[1], c[2], 1.05);
        if (h.mill) {
          const a = millAngle(h, time + s * d);
          for (const sgn of [0, Math.PI]) {
            const ex = Math.cos(a + sgn) * h.mill.len, ey = Math.sin(a + sgn) * h.mill.len;
            // closest point on the segment (pivot -> tip)
            const px = b.x - h.mill.x, py = b.y - h.mill.y;
            const L2 = ex * ex + ey * ey, tt = U.clamp((px * ex + py * ey) / L2, 0, 1);
            collideCircle(b, h.mill.x + ex * tt, h.mill.y + ey * tt, 4, 0.9);
          }
        }
        // friction (sand drags more)
        let f = FRIC;
        for (const s2 of h.sand) if (b.x > s2[0] && b.x < s2[0] + s2[2] && b.y > s2[1] && b.y < s2[1] + s2[3]) f = SAND;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0) { const ns = Math.max(0, sp - f * d); b.vx *= ns / sp; b.vy *= ns / sp; }
        // cup
        const cd = Math.hypot(b.x - h.cup[0], b.y - h.cup[1]);
        if (cd < CUP && Math.hypot(b.vx, b.vy) < 340) { b.holed = true; b.x = h.cup[0]; b.y = h.cup[1]; b.vx = b.vy = 0; return; }
        if (cd < CUP + 18 && Math.hypot(b.vx, b.vy) < 340 && cd > 0.5) { // gentle pull toward the cup
          const k = 90 * d / cd; b.vx += (h.cup[0] - b.x) * k; b.vy += (h.cup[1] - b.y) * k;
        }
        if (Math.hypot(b.vx, b.vy) < 6) { b.vx = b.vy = 0; b.done = true; return; }
      }
    }
    function shotSpeed(power) { return 90 + 720 * power; }
    function simulate(x, y, ang, power, h, time) {
      const b = { x, y, vx: Math.cos(ang) * shotSpeed(power), vy: Math.sin(ang) * shotSpeed(power), holed: false, done: false, hit: false };
      let best = Math.hypot(x - h.cup[0], y - h.cup[1]);
      for (let i = 0; i < 520 && !b.holed && !b.done; i++) step(b, 1 / 60, h, time + i / 60);
      return b;
    }
    function plan(p) {
      const h = H();
      const baseAng = Math.atan2(h.cup[1] - p.y, h.cup[0] - p.x);
      let best = null;
      for (let k = 0; k < 72; k++) {
        const ang = baseAng + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * (TAU / 72));
        for (let pw = 0.12; pw <= 1.0001; pw += 0.08) {
          const b = simulate(p.x, p.y, ang, pw, h, S.clock + 1.95);
          let sc = Math.hypot(b.x - h.cup[0], b.y - h.cup[1]);
          if (b.holed) sc -= 1000;
          sc += (b.hit ? 8 : 0);
          if (!best || sc < best.sc) best = { sc, ang, pw };
        }
      }
      const far = Math.hypot(p.x - h.cup[0], p.y - h.cup[1]);
      return { angle: best.ang + U.gauss() * (0.03 + far * 0.0001), power: U.clamp(best.pw * (1 + U.gauss() * 0.07), 0.05, 1) };
    }

    function putt(p, ang, power) {
      S.ball = { x: p.x, y: p.y, vx: Math.cos(ang) * shotSpeed(power), vy: Math.sin(ang) * shotSpeed(power), holed: false, done: false, hit: false, t: 0 };
      p.putts++; S.trail = []; S.phase = 'roll';
      TS.sfx.hit();
    }
    function settle() {
      const p = S.pl[S.cur], b = S.ball;
      p.x = b.x; p.y = b.y; S.phase = 'landed'; S.timer = 0.9;
      if (b.holed) {
        p.holed = true; p.cheer = 1.6; p.scores[S.hole] = p.putts;
        const diff = p.putts - H().par;
        S.msg = { text: p.putts === 1 ? 'HOLE IN ONE!' : 'IN THE CUP!', sub: U.NAMES[p.idx] + ' · ' + p.putts + (diff < 0 ? ' · under par!' : diff === 0 ? ' · par' : ' · +' + diff), t: 1.5 };
        S.timer = 1.7; TS.sfx.goal();
      } else if (p.putts >= MAX) {
        p.holed = true; p.scores[S.hole] = MAX + 1;
        S.msg = { text: 'PICK UP', sub: U.NAMES[p.idx] + ' takes a ' + (MAX + 1), t: 1.4 };
      }
    }

    function update(dt) {
      S.t += dt; S.clock += dt;
      S.pl.forEach((p) => { p.t += dt; p.cheer = Math.max(0, p.cheer - dt); });
      if (S.msg) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      const p = S.pl[S.cur];
      switch (S.phase) {
        case 'intro': S.timer -= dt; if (S.timer <= 0) beginTurn(); break;
        case 'aim':
          if (P[S.cur].human) {
            const pad = TS.input.pad(S.cur);
            S.angle += pad.x * (pad.y !== 0 ? 0.5 : 1.6) * dt + 0;
            if (pad.y) S.angle += -pad.y * 0.0; // vertical keys do nothing (reserved)
            if (pad.actP) { S.phase = 'power'; S.powT = 0; TS.sfx.click(); }
          } else {
            S.aiT += dt;
            S.angle = S.aiStart + (S.plan.angle - S.aiStart) * U.clamp(S.aiT / 0.9, 0, 1);
            if (S.aiT > 1.2) { S.phase = 'power'; S.powT = 0; S.aiT = 0; }
          }
          break;
        case 'power':
          S.powT += dt;
          if (P[S.cur].human) { S.power = U.tri(S.powT / 0.9); if (TS.input.pad(S.cur).actP) putt(p, S.angle, S.power); }
          else { S.power = S.plan.power * U.clamp(S.powT / 0.6, 0, 1); if (S.powT > 0.75) putt(p, S.angle, S.plan.power); }
          break;
        case 'roll': {
          const b = S.ball; b.t += dt;
          step(b, dt, H(), S.clock);
          S.trail.push([b.x, b.y]); if (S.trail.length > 30) S.trail.shift();
          if (b.holed || b.done) settle();
          break;
        }
        case 'landed':
          S.timer -= dt;
          if (S.timer <= 0) {
            if (S.pl.every((q) => q.holed)) { S.phase = 'summary'; S.timer = 3.2; S.msg = null; }
            else beginTurn();
          }
          break;
        case 'summary':
          S.timer -= dt;
          if (S.timer <= 0) { if (S.hole >= HOLES.length - 1) { S.phase = 'over'; S.timer = 1.2; } else { S.hole++; startHole(); } }
          break;
        case 'over':
          S.timer -= dt;
          if (S.timer <= 0 && !g.over) {
            const tot = S.pl.map((q) => q.scores.reduce((a, c) => a + c, 0));
            g.over = true;
            g.result = { winner: tot[0] === tot[1] ? null : (tot[0] < tot[1] ? 0 : 1), scores: tot, summary: 'Total putts — Henry ' + tot[0] + ', Theo ' + tot[1] + ' (lower wins). Par was ' + HOLES.reduce((a, c) => a + c.par, 0) + '.' };
          }
          break;
      }
    }

    // ---------- drawing ----------
    function drawCourse(g) {
      const h = H();
      g.fillStyle = '#244b2f'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#2a5835' : '#27502f'; g.fillRect(0, i * 38, 960, 39); }
      const [l, t, r, b] = h.area;
      g.fillStyle = '#00000044'; g.fillRect(l + 6, t + 8, r - l, b - t);
      g.fillStyle = '#4fb85b'; g.fillRect(l, t, r - l, b - t);
      for (let x = l; x < r; x += 40) { g.fillStyle = ((x - l) / 40) % 2 ? '#52be5e' : '#4aae56'; g.fillRect(x, t, 40, b - t); }
      h.sand.forEach((s) => { g.fillStyle = '#e8d08a'; TS.chars.rr(g, s[0], s[1], s[2], s[3], 30); g.fill(); g.fillStyle = '#d8bd74'; for (let k = 0; k < 30; k++) { g.fillRect(s[0] + 14 + (k * 37) % (s[2] - 28), s[1] + 14 + (k * 53) % (s[3] - 28), 3, 3); } });
      // tee mat
      g.fillStyle = '#2f7d3a'; TS.chars.rr(g, h.tee[0] - 24, h.tee[1] - 16, 48, 32, 6); g.fill();
      // border wall
      g.strokeStyle = '#8a5a2b'; g.lineWidth = 14; g.strokeRect(l - 7, t - 7, r - l + 14, b - t + 14);
      g.strokeStyle = '#b07a42'; g.lineWidth = 4; g.strokeRect(l - 10, t - 10, r - l + 20, b - t + 20);
      // obstacles
      h.rects.forEach((rc) => { g.fillStyle = '#00000033'; g.fillRect(rc[0] + 4, rc[1] + 6, rc[2], rc[3]); g.fillStyle = '#8a5a2b'; g.fillRect(rc[0], rc[1], rc[2], rc[3]); g.fillStyle = '#b07a42'; g.fillRect(rc[0], rc[1], rc[2], 5); });
      h.circles.forEach((c) => { g.fillStyle = '#00000033'; g.beginPath(); g.arc(c[0] + 4, c[1] + 6, c[2], 0, TAU); g.fill(); g.fillStyle = '#d62839'; g.beginPath(); g.arc(c[0], c[1], c[2], 0, TAU); g.fill(); g.fillStyle = '#ff6b6b'; g.beginPath(); g.arc(c[0], c[1], c[2] * 0.6, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(c[0], c[1], c[2] - 2, 0, TAU); g.stroke(); });
      if (h.mill) {
        const a = millAngle(h, S.clock);
        g.save(); g.translate(h.mill.x, h.mill.y); g.rotate(a);
        g.fillStyle = '#e9d8a6'; g.fillRect(-h.mill.len, -4, h.mill.len * 2, 8); g.strokeStyle = '#8a5a2b'; g.lineWidth = 2; g.strokeRect(-h.mill.len, -4, h.mill.len * 2, 8);
        g.restore();
        g.fillStyle = '#d62839'; g.beginPath(); g.arc(h.mill.x, h.mill.y, 9, 0, TAU); g.fill();
      }
      // cup + flag
      g.fillStyle = '#111'; g.beginPath(); g.arc(h.cup[0], h.cup[1], CUP, 0, TAU); g.fill();
      g.strokeStyle = '#ddd'; g.lineWidth = 3; g.beginPath(); g.moveTo(h.cup[0], h.cup[1]); g.lineTo(h.cup[0], h.cup[1] - 46); g.stroke();
      g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(h.cup[0], h.cup[1] - 46); g.lineTo(h.cup[0] + 26, h.cup[1] - 38); g.lineTo(h.cup[0], h.cup[1] - 30); g.fill();
    }
    function drawBall(g, x, y, col) {
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 2, y + 4, BR, BR * 0.55, 0, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(x, y, BR, 0, TAU); g.fill();
      g.fillStyle = '#ffffffaa'; g.beginPath(); g.arc(x - 2.5, y - 2.5, 2.5, 0, TAU); g.fill();
    }
    function draw(g) {
      drawCourse(g);
      const h = H();
      // waiting balls & golfers
      S.pl.forEach((p) => {
        if (p.holed) return;
        const showing = S.phase === 'roll' && p.idx === S.cur;
        if (!showing) drawBall(g, p.x, p.y, p.idx ? '#8ab8ff' : '#ff8a8a');
      });
      // aim guide
      if (S.phase === 'aim' || S.phase === 'power') {
        const p = S.pl[S.cur];
        const len = S.phase === 'power' ? 40 + S.power * 220 : 90;
        g.strokeStyle = '#ffffffcc'; g.lineWidth = 3; g.setLineDash([2, 8]); g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x + Math.cos(S.angle) * 14, p.y + Math.sin(S.angle) * 14); g.lineTo(p.x + Math.cos(S.angle) * len, p.y + Math.sin(S.angle) * len); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#fcbf49'; g.save(); g.translate(p.x + Math.cos(S.angle) * len, p.y + Math.sin(S.angle) * len); g.rotate(S.angle); g.beginPath(); g.moveTo(10, 0); g.lineTo(-4, -7); g.lineTo(-4, 7); g.fill(); g.restore();
      }
      // players
      S.pl.forEach((p) => {
        const active = p.idx === S.cur && (S.phase === 'aim' || S.phase === 'power' || S.phase === 'roll') && !p.holed;
        const px = p.holed ? (p.idx ? 880 : 820) : p.x + (p.idx ? 26 : -26), py = p.holed ? 575 : p.y + 20;
        TS.chars.draw(g, p.who, p.outfit, { x: px, y: p.holed ? py : py, scale: 0.55, t: p.t, cheer: p.cheer > 0, lift: p.cheer > 0 ? Math.abs(Math.sin(p.t * 9)) * 8 : 0, arm: active && S.phase === 'power' ? 1.2 : 0, facing: Math.cos(S.angle) >= 0 || !active ? 1 : -1 });
        if (active) { g.fillStyle = '#fcbf49'; g.beginPath(); g.moveTo(px, py - 66); g.lineTo(px - 7, py - 80); g.lineTo(px + 7, py - 80); g.fill(); }
      });
      if (S.ball && (S.phase === 'roll')) {
        g.strokeStyle = '#ffffff44'; g.lineWidth = 3; g.beginPath(); S.trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        drawBall(g, S.ball.x, S.ball.y, S.cur ? '#8ab8ff' : '#ff8a8a');
      }
      // hud
      U.panel(g, 120, 10, 200, 56, 14);
      U.text(g, 'Hole ' + (S.hole + 1) + ' / ' + HOLES.length, 132, 28, 20, '#fcbf49');
      U.text(g, 'Par ' + h.par, 132, 50, 14, '#fff', 'left', 700);
      U.panel(g, 960 - 278, 10, 220, 74, 14);
      S.pl.forEach((p, i) => {
        const tot = p.scores.reduce((a, c) => a + c, 0);
        U.text(g, U.NAMES[i].toUpperCase(), 960 - 266, 28 + i * 28, 15, U.TEAM[i]);
        U.text(g, 'this hole: ' + (p.holed ? p.scores[S.hole] : p.putts), 960 - 196, 28 + i * 28, 14, '#fff', 'left', 700);
        U.text(g, String(tot), 960 - 70, 28 + i * 28, 17, '#fff', 'right');
      });
      const cur = P[S.cur];
      if (S.phase === 'aim') U.hint(g, cur.human ? '◀ ▶ aim · Action to start the power meter' : U.NAMES[S.cur] + ' is lining up the putt…');
      else if (S.phase === 'power') U.meter(g, 330, 548, 300, 20, S.power, null, cur.human ? 'POWER · Action to putt' : 'POWER');
      if (S.phase === 'summary' || S.phase === 'over') {
        U.panel(g, 480 - 230, 150, 460, 270, 20);
        U.text(g, S.phase === 'over' ? 'Final scorecard' : 'Hole ' + (S.hole + 1) + ' complete', 480, 188, 32, '#fcbf49', 'center', 900);
        const cols = [480 - 120, 480 - 40, 480 + 40, 480 + 120, 480 + 200];
        HOLES.forEach((hh, i) => U.text(g, 'H' + (i + 1) + ' (' + hh.par + ')', cols[i] - 10, 232, 15, '#ffffffaa', 'center'));
        U.text(g, 'TOT', cols[4] - 10, 232, 15, '#ffffffaa', 'center');
        S.pl.forEach((p, i) => {
          const y = 290 + i * 54;
          U.text(g, U.NAMES[i].toUpperCase(), 480 - 215, y, 19, U.TEAM[i]);
          HOLES.forEach((hh, k) => U.text(g, p.scores[k] === undefined ? '–' : String(p.scores[k]), cols[k] - 10, y, 19, '#fff', 'center'));
          U.text(g, String(p.scores.reduce((a, c) => a + c, 0)), cols[4] - 10, y, 20, '#fcbf49', 'center');
        });
      }
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 215, '#fcbf49');
    }

    const g = {
      title: '⛳ Mini Putt',
      help: [
        'Four mini-golf holes with walls, bumpers, sand and a spinning windmill. Fewest putts wins!',
        '<b>◀ ▶</b> turn your aim, press <b>Action</b> to start the power meter, then press <b>Action</b> again to putt. Whoever is farthest from the hole goes next.',
        'Walls bounce the ball — use them! Sand slows it down a lot, and a ball moving too fast will skip right over the cup.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.minigolf = create;
})();
