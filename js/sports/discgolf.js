// Disc golf: three holes, take turns throwing, fewest throws wins.
(function () {
  const TS = (window.TS = window.TS || {});
  TS.sports = TS.sports || {};

  const W = 960, H = 600;
  const TEAM = ['#e63946', '#3a86ff'];
  const NAMES = ['Henry', 'Theo'];
  const TAU = Math.PI * 2;
  const DECEL = 330, FADE = 1.25, MAX_THROWS = 7;

  const COURSE = [
    {
      par: 3, tee: { x: 90, y: 300 }, basket: { x: 830, y: 300 },
      trees: [{ x: 400, y: 235, r: 26 }, { x: 520, y: 385, r: 32 }, { x: 650, y: 300, r: 24 }, { x: 300, y: 380, r: 22 }],
    },
    {
      par: 3, tee: { x: 90, y: 520 }, basket: { x: 840, y: 100 },
      trees: [{ x: 350, y: 420, r: 28 }, { x: 480, y: 300, r: 34 }, { x: 640, y: 200, r: 28 }, { x: 300, y: 210, r: 24 }, { x: 740, y: 340, r: 26 }, { x: 200, y: 330, r: 22 }],
    },
    {
      par: 4, tee: { x: 880, y: 520 }, basket: { x: 110, y: 120 },
      trees: [{ x: 700, y: 430, r: 32 }, { x: 560, y: 310, r: 30 }, { x: 440, y: 170, r: 30 }, { x: 300, y: 270, r: 32 }, { x: 230, y: 350, r: 26 }, { x: 520, y: 480, r: 28 }, { x: 770, y: 260, r: 26 }, { x: 330, y: 120, r: 22 }],
    },
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const gauss = () => Math.random() + Math.random() + Math.random() - 1.5; // roughly ±1.5

  function newDisc(x, y, ang, power, curve) {
    const v0 = 160 + 560 * power;
    return { x, y, ang, v0, v: v0, curve, t: 0, hit: false, holed: false, done: false };
  }
  function stepDisc(d, dt, hole) {
    const frac = d.v / d.v0;
    const fade = d.hit ? 0 : (frac < 0.45 ? (1 - frac / 0.45) * FADE : 0);
    d.ang += ((d.hit ? 0 : d.curve * 0.6) - fade) * dt;
    d.x += Math.cos(d.ang) * d.v * dt;
    d.y += Math.sin(d.ang) * d.v * dt;
    d.v -= DECEL * dt;
    d.t += dt;
    if (Math.hypot(d.x - hole.basket.x, d.y - hole.basket.y) < 17 && (frac < 0.75 || d.hit)) {
      d.holed = true; d.done = true; d.x = hole.basket.x; d.y = hole.basket.y; return;
    }
    for (const tr of hole.trees) {
      const dx = d.x - tr.x, dy = d.y - tr.y, dist = Math.hypot(dx, dy) || 0.01;
      if (dist < tr.r + 4) {
        const nx = dx / dist, ny = dy / dist;
        d.x = tr.x + nx * (tr.r + 5); d.y = tr.y + ny * (tr.r + 5);
        const vx = Math.cos(d.ang) * d.v, vy = Math.sin(d.ang) * d.v;
        const dot = vx * nx + vy * ny;
        d.ang = Math.atan2(vy - 2 * dot * ny, vx - 2 * dot * nx);
        d.v = Math.min(d.v * 0.3, 110); d.v0 = Math.max(d.v, 1);
        d.hit = true;
      }
    }
    if (d.x < 14 || d.x > W - 14 || d.y < 14 || d.y > H - 14) {
      d.x = clamp(d.x, 14, W - 14); d.y = clamp(d.y, 14, H - 14); d.done = true;
    }
    if (d.v <= 0) d.done = true;
    if (d.done && !d.holed && Math.hypot(d.x - hole.basket.x, d.y - hole.basket.y) < 24) d.holed = true;
  }
  function simulate(x, y, ang, power, curve, hole) {
    const d = newDisc(x, y, ang, power, curve);
    for (let i = 0; i < 600 && !d.done; i++) stepDisc(d, 1 / 60, hole);
    return d;
  }

  function create(ctx) {
    const P = ctx.players.map((p, i) => ({
      idx: i, who: p.who, outfit: p.outfit, human: p.human,
      x: 0, y: 0, throws: 0, holed: false, scores: [], t: Math.random() * 5, cheer: 0,
    }));
    const S = {
      hole: 0, cur: 0, phase: 'intro', timer: 0, angle: 0, curve: 0, meter: 0, meterT: 0,
      disc: null, plan: null, aiT: 0, aiStart: null, msg: null, landNote: '', t: 0, trail: [],
    };
    const H0 = () => COURSE[S.hole];

    function startHole() {
      P.forEach((p) => { p.x = H0().tee.x; p.y = H0().tee.y; p.throws = 0; p.holed = false; p.cheer = 0; });
      S.phase = 'intro'; S.timer = 2.2; S.disc = null; S.trail = [];
      S.msg = { text: 'HOLE ' + (S.hole + 1), sub: 'Par ' + H0().par + ' · ' + Math.round(Math.hypot(H0().basket.x - H0().tee.x, H0().basket.y - H0().tee.y)) + ' ft', t: 2.2 };
    }
    startHole();

    function pickThrower() {
      const open = P.filter((p) => !p.holed);
      open.sort((a, b) => {
        const da = Math.hypot(a.x - H0().basket.x, a.y - H0().basket.y), db = Math.hypot(b.x - H0().basket.x, b.y - H0().basket.y);
        return db - da || a.idx - b.idx;
      });
      return open[0].idx;
    }
    function beginTurn() {
      S.cur = pickThrower();
      const p = P[S.cur];
      S.phase = 'aim'; S.curve = 0; S.meter = 0; S.meterT = 0; S.aiT = 0;
      S.angle = Math.atan2(H0().basket.y - p.y, H0().basket.x - p.x);
      if (!p.human) { S.plan = plan(p); S.aiStart = { angle: S.angle, curve: 0 }; }
    }

    // CPU brute-force plan using the same flight model the player faces.
    function plan(p) {
      const hole = H0();
      const base = Math.atan2(hole.basket.y - p.y, hole.basket.x - p.x);
      const dist = Math.hypot(hole.basket.x - p.x, hole.basket.y - p.y);
      let best = null;
      for (let da = -0.5; da <= 0.5001; da += 0.05) {
        for (let pw = 0.1; pw <= 1.0001; pw += 0.03) {
          for (const cv of [-0.6, -0.3, 0, 0.3, 0.6]) {
            const d = simulate(p.x, p.y, base + da, pw, cv, hole);
            let score = Math.hypot(d.x - hole.basket.x, d.y - hole.basket.y);
            if (d.holed) score -= 1000;
            if (d.hit) score += 70;
            if (!best || score < best.score) best = { score, angle: base + da, power: pw, curve: cv };
          }
        }
      }
      // humans-in-training noise: bigger misses on long throws
      const sa = 0.012 + dist * 0.00007, sp = 0.025 + dist * 0.00004;
      best.angle += gauss() * sa * 1.6;
      best.power = clamp(best.power + gauss() * sp * 1.6, 0.05, 1);
      return best;
    }

    function doThrow(p, angle, power, curve) {
      S.disc = newDisc(p.x, p.y, angle, power, curve);
      S.trail = [];
      p.throws++;
      S.phase = 'flight';
      TS.sfx.swish();
    }

    function land() {
      const p = P[S.cur], d = S.disc;
      p.x = d.x; p.y = d.y;
      S.timer = 1.1;
      if (d.holed) {
        p.holed = true; p.cheer = 2; p.scores[S.hole] = p.throws;
        const diff = p.throws - H0().par;
        const name = p.throws === 1 ? 'ACE!!' : ['', '', 'EAGLE!', 'BIRDIE!', 'PAR', 'BOGEY'][Math.max(0, Math.min(5, diff + 3))] || 'IN!';
        S.msg = { text: 'CHAINS!', sub: NAMES[p.idx] + ' holes out in ' + p.throws + (name ? ' · ' + (p.throws === 1 ? 'ACE!' : diff <= -2 ? 'Eagle!' : diff === -1 ? 'Birdie!' : diff === 0 ? 'Par' : diff === 1 ? 'Bogey' : '+' + diff) : ''), t: 1.6 };
        S.timer = 1.8;
        TS.sfx.goal();
      } else {
        const left = Math.round(Math.hypot(d.x - H0().basket.x, d.y - H0().basket.y));
        S.msg = { text: left + ' ft', sub: d.hit ? 'Clipped a tree!' : 'to the basket', t: 1.1 };
        if (p.throws >= MAX_THROWS) {
          p.holed = true; p.scores[S.hole] = MAX_THROWS + 1;
          S.msg = { text: 'PICK UP', sub: NAMES[p.idx] + ' takes a ' + (MAX_THROWS + 1), t: 1.4 };
        }
        TS.sfx.thud();
      }
      S.phase = 'landed';
    }

    function nextAfterLand() {
      if (P.every((p) => p.holed)) {
        S.phase = 'summary'; S.timer = 3.4;
        S.msg = null;
      } else beginTurn();
    }

    function update(dt) {
      S.t += dt;
      P.forEach((p) => { p.t += dt; p.cheer = Math.max(0, p.cheer - dt); });
      if (S.msg) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      const p = P[S.cur];

      switch (S.phase) {
        case 'intro':
          S.timer -= dt; if (S.timer <= 0) beginTurn();
          break;
        case 'aim':
          if (p.human) {
            const pad = TS.input.pad(p.idx);
            S.angle += pad.x * 1.5 * dt;
            S.curve = clamp(S.curve - pad.y * 1.3 * dt, -1, 1);
            if (pad.actP) { S.phase = 'power'; S.meterT = 0; TS.sfx.click(); }
          } else {
            S.aiT += dt;
            const k = clamp(S.aiT / 0.9, 0, 1);
            S.angle = lerp(S.aiStart.angle, S.plan.angle, k);
            S.curve = lerp(0, S.plan.curve, k);
            if (S.aiT > 1.2) { S.phase = 'power'; S.meterT = 0; S.aiT = 0; }
          }
          break;
        case 'power':
          if (p.human) {
            S.meterT += dt;
            S.meter = 0.5 - 0.5 * Math.cos(S.meterT * (TAU / 1.5));
            if (TS.input.pad(p.idx).actP) doThrow(p, S.angle, S.meter, S.curve);
          } else {
            S.aiT += dt;
            S.meter = S.plan.power * clamp(S.aiT / 0.7, 0, 1);
            if (S.aiT > 0.85) doThrow(p, S.angle, S.plan.power, S.plan.curve);
          }
          break;
        case 'flight': {
          const d = S.disc;
          const steps = 2;
          for (let i = 0; i < steps && !d.done; i++) stepDisc(d, dt / steps, H0());
          S.trail.push([d.x, d.y]);
          if (S.trail.length > 40) S.trail.shift();
          if (d.done) land();
          break;
        }
        case 'landed':
          S.timer -= dt; if (S.timer <= 0) nextAfterLand();
          break;
        case 'summary':
          S.timer -= dt;
          if (S.timer <= 0) {
            if (S.hole >= COURSE.length - 1) {
              S.phase = 'over'; S.timer = 1.2;
            } else { S.hole++; startHole(); }
          }
          break;
        case 'over':
          S.timer -= dt;
          if (S.timer <= 0 && !g.over) {
            const tot = P.map((q) => q.scores.reduce((a, b) => a + b, 0));
            g.over = true;
            g.result = {
              winner: tot[0] === tot[1] ? null : (tot[0] < tot[1] ? 0 : 1), scores: tot,
              summary: 'Total throws — Henry ' + tot[0] + ', Theo ' + tot[1] + ' (lower wins). Par was ' + COURSE.reduce((a, c) => a + c.par, 0) + '.',
            };
          }
          break;
      }
    }

    // ---------- drawing ----------
    function drawCourse(g) {
      const hole = H0();
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#3d8b40' : '#43964a'; g.fillRect(0, i * 38, W, 39); }
      // fairway
      g.save();
      g.strokeStyle = '#6fbf73'; g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = 0.55; g.lineWidth = 120;
      g.beginPath(); g.moveTo(hole.tee.x, hole.tee.y);
      g.quadraticCurveTo((hole.tee.x + hole.basket.x) / 2, (hole.tee.y + hole.basket.y) / 2 + (S.hole === 1 ? 60 : -50), hole.basket.x, hole.basket.y);
      g.stroke(); g.restore();
      // rough border
      g.strokeStyle = '#2d5a27'; g.lineWidth = 28; g.strokeRect(0, 0, W, H);
      // tee pad
      g.fillStyle = '#777'; TS.chars.rr(g, hole.tee.x - 28, hole.tee.y - 20, 56, 40, 6); g.fill();
      g.fillStyle = '#999'; TS.chars.rr(g, hole.tee.x - 24, hole.tee.y - 16, 48, 32, 5); g.fill();
      g.font = '800 11px "Trebuchet MS", sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('TEE', hole.tee.x, hole.tee.y + 26);
    }
    function drawBasket(g) {
      const b = H0().basket;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(b.x, b.y + 4, 22, 9, 0, 0, TAU); g.fill();
      g.strokeStyle = '#555'; g.lineWidth = 4; g.beginPath(); g.moveTo(b.x, b.y + 2); g.lineTo(b.x, b.y - 38); g.stroke();
      g.strokeStyle = '#cfd8e3'; g.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(b.x + i * 6, b.y - 36); g.lineTo(b.x + i * 4, b.y - 14); g.stroke(); }
      g.strokeStyle = '#e63946'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(b.x, b.y - 14, 18, 6, 0, 0, TAU); g.stroke();
      g.strokeStyle = '#e63946'; g.lineWidth = 3; g.beginPath(); g.ellipse(b.x, b.y - 38, 18, 6, 0, Math.PI, TAU); g.stroke();
      g.fillStyle = '#ffd166'; g.beginPath(); g.ellipse(b.x, b.y - 38, 18, 6, 0, 0, TAU); g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1;
    }
    function drawTree(g, tr) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(tr.x + 10, tr.y + tr.r * 0.9, tr.r * 1.2, tr.r * 0.55, 0, 0, TAU); g.fill();
      g.fillStyle = '#6b4423'; g.fillRect(tr.x - 4, tr.y, 8, tr.r * 0.9);
      const R = tr.r * 1.35;
      g.fillStyle = '#1f6f3a'; g.beginPath(); g.arc(tr.x, tr.y - tr.r * 0.5, R, 0, TAU); g.fill();
      g.fillStyle = '#2a8a49'; g.beginPath(); g.arc(tr.x - R * 0.2, tr.y - tr.r * 0.7, R * 0.75, 0, TAU); g.fill();
      g.fillStyle = '#3aa65c'; g.beginPath(); g.arc(tr.x - R * 0.35, tr.y - tr.r * 0.9, R * 0.38, 0, TAU); g.fill();
    }
    function drawPlayer(g, p0) {
      const other = P[1 - p0.idx];
      const crowded = Math.hypot(other.x - p0.x, other.y - p0.y) < 40;
      const p = crowded ? Object.assign({}, p0, { x: p0.x + (p0.idx ? 16 : -16), y: p0.y + (p0.idx ? 6 : -6) }) : p0;
      const active = S.phase !== 'summary' && S.phase !== 'intro' && S.phase !== 'over' && p.idx === S.cur && !p.holed;
      TS.chars.draw(g, p.who, p.outfit, {
        x: p.x, y: p.y + 14, scale: 0.55, t: p.t, facing: Math.cos(S.angle) >= 0 || !active ? 1 : -1,
        cheer: p.cheer > 0, lift: p.cheer > 0 ? Math.abs(Math.sin(p.t * 8)) * 8 : 0,
        arm: active && S.phase === 'power' ? 1.6 : 0,
      });
      g.font = '800 12px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const label = NAMES[p.idx].toUpperCase();
      const w = g.measureText(label).width + 12;
      g.fillStyle = TEAM[p.idx]; TS.chars.rr(g, p.x - w / 2, p.y - 66, w, 16, 8); g.fill();
      g.fillStyle = '#fff'; g.fillText(label, p.x, p.y - 58);
      if (active) {
        const by = Math.sin(S.t * 6) * 3;
        g.fillStyle = '#fcbf49'; g.beginPath(); g.moveTo(p.x, p.y - 70 + by); g.lineTo(p.x - 7, p.y - 82 + by); g.lineTo(p.x + 7, p.y - 82 + by); g.closePath(); g.fill();
      }
    }
    function drawDisc(g, x, y, h) {
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + 3, 7, 3, 0, 0, TAU); g.fill();
      g.save(); g.translate(x, y - h);
      g.fillStyle = '#ffd166'; g.beginPath(); g.ellipse(0, 0, 8, 3.8, 0, 0, TAU); g.fill();
      g.strokeStyle = '#e07a00'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#fff6'; g.beginPath(); g.ellipse(-2, -1, 3, 1.2, 0, 0, TAU); g.fill();
      g.restore();
    }
    function drawAim(g) {
      const p = P[S.cur];
      if (S.phase !== 'aim' && S.phase !== 'power') return;
      const dx = Math.cos(S.angle), dy = Math.sin(S.angle);
      g.save();
      g.setLineDash([2, 8]); g.lineCap = 'round'; g.strokeStyle = '#ffffffcc'; g.lineWidth = 3;
      const len = S.phase === 'aim' ? 150 : 40 + 0;
      g.beginPath(); g.moveTo(p.x + dx * 24, p.y + dy * 24); g.lineTo(p.x + dx * (S.phase === 'aim' ? len : 800), p.y + dy * (S.phase === 'aim' ? len : 800)); g.stroke();
      g.setLineDash([]);
      // curve hint arrow
      if (S.phase === 'aim') {
        const ex = p.x + dx * 150, ey = p.y + dy * 150;
        g.strokeStyle = '#fcbf49'; g.lineWidth = 4;
        const perp = [-dy, dx];
        g.beginPath(); g.moveTo(ex, ey); g.quadraticCurveTo(ex + dx * 20 + perp[0] * S.curve * 30, ey + dy * 20 + perp[1] * S.curve * 30, ex + dx * 38 + perp[0] * S.curve * 60, ey + dy * 38 + perp[1] * S.curve * 60); g.stroke();
      }
      if (S.phase === 'power') {
        const d = (160 + 560 * S.meter) ** 2 / (2 * DECEL);
        const mx = p.x + dx * d, my = p.y + dy * d;
        g.strokeStyle = '#fff'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(mx - 9, my - 9); g.lineTo(mx + 9, my + 9); g.moveTo(mx + 9, my - 9); g.lineTo(mx - 9, my + 9); g.stroke();
      }
      g.restore();
    }
    function drawMeter(g) {
      if (S.phase !== 'power') return;
      const x = W / 2 - 200, y = H - 54, w = 400, h = 24;
      g.fillStyle = '#0b132bdd'; TS.chars.rr(g, x - 10, y - 10, w + 20, h + 20, 14); g.fill();
      g.fillStyle = '#ffffff22'; TS.chars.rr(g, x, y, w, h, 10); g.fill();
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, '#6a994e'); grad.addColorStop(0.6, '#fcbf49'); grad.addColorStop(1, '#e63946');
      g.fillStyle = grad; TS.chars.rr(g, x, y, Math.max(8, w * S.meter), h, 10); g.fill();
      g.fillStyle = '#fff'; g.font = '800 13px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(P[S.cur].human ? 'Press Action to throw!' : 'POWER', W / 2, y + h / 2);
    }
    function drawHUD(g) {
      const hole = H0();
      g.fillStyle = '#0b132bdd'; TS.chars.rr(g, 12, 10, 200, 56, 14); g.fill();
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fcbf49'; g.font = '800 20px "Trebuchet MS", sans-serif';
      g.fillText('Hole ' + (S.hole + 1) + ' / ' + COURSE.length, 24, 28);
      g.fillStyle = '#fff'; g.font = '700 14px "Trebuchet MS", sans-serif';
      g.fillText('Par ' + hole.par, 24, 50);
      // scoreboard
      g.fillStyle = '#0b132bdd'; TS.chars.rr(g, W - 278, 10, 220, 74, 14); g.fill();
      g.font = '800 15px "Trebuchet MS", sans-serif';
      P.forEach((p, i) => {
        const tot = p.scores.reduce((a, b) => a + b, 0);
        g.fillStyle = TEAM[i]; g.textAlign = 'left'; g.fillText(NAMES[i].toUpperCase(), W - 266, 28 + i * 28);
        g.fillStyle = '#fff'; g.font = '700 14px "Trebuchet MS", sans-serif';
        g.fillText('this hole: ' + (p.holed ? p.scores[S.hole] : p.throws), W - 196, 28 + i * 28);
        g.textAlign = 'right'; g.font = '800 17px "Trebuchet MS", sans-serif';
        g.fillText(tot, W - 70, 28 + i * 28); g.font = '800 15px "Trebuchet MS", sans-serif';
      });
      // help line
      const p = P[S.cur];
      let hint = '';
      if (S.phase === 'aim') hint = p.human ? '◀ ▶ aim   ▲ ▼ curve   ACTION: start power' : NAMES[p.idx] + ' is lining up…';
      else if (S.phase === 'power' && !p.human) hint = NAMES[p.idx] + ' winds up…';
      if (hint) {
        g.font = '800 15px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
        const w = g.measureText(hint).width + 30;
        g.fillStyle = '#0b132bcc'; TS.chars.rr(g, W / 2 - w / 2, H - 46, w, 32, 16); g.fill();
        g.fillStyle = '#fff'; g.fillText(hint, W / 2, H - 30);
      }
      if (S.phase === 'aim') {
        // curve gauge
        const cx = W / 2, cy = H - 70;
        g.fillStyle = '#0b132bcc'; TS.chars.rr(g, cx - 90, cy - 12, 180, 24, 12); g.fill();
        g.fillStyle = '#ffffff33'; g.fillRect(cx - 78, cy - 1.5, 156, 3);
        g.fillStyle = '#fcbf49'; g.beginPath(); g.arc(cx + S.curve * 78, cy, 7, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.font = '700 11px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
        g.fillText('CURVE', cx, cy - 20);
      }
    }
    function drawMsg(g) {
      if (!S.msg) return;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.font = '900 72px "Trebuchet MS", sans-serif'; g.lineWidth = 12; g.strokeStyle = '#0b132b';
      g.strokeText(S.msg.text, W / 2, 230); g.fillStyle = '#fcbf49'; g.fillText(S.msg.text, W / 2, 230);
      if (S.msg.sub) {
        g.font = '800 28px "Trebuchet MS", sans-serif'; g.lineWidth = 8;
        g.strokeText(S.msg.sub, W / 2, 290); g.fillStyle = '#fff'; g.fillText(S.msg.sub, W / 2, 290);
      }
    }
    function drawSummary(g) {
      if (S.phase !== 'summary' && S.phase !== 'over') return;
      g.fillStyle = '#0b132bdd'; TS.chars.rr(g, W / 2 - 230, 150, 460, 270, 20); g.fill();
      g.strokeStyle = '#ffffff33'; g.lineWidth = 3; g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fcbf49'; g.font = '900 34px "Trebuchet MS", sans-serif';
      g.fillText(S.phase === 'over' ? 'Final scorecard' : 'Hole ' + (S.hole + 1) + ' complete', W / 2, 188);
      g.font = '800 17px "Trebuchet MS", sans-serif';
      const cols = [W / 2 - 150, W / 2 - 60, W / 2 + 20, W / 2 + 100, W / 2 + 180];
      g.fillStyle = '#ffffffaa';
      g.fillText('', cols[0], 232);
      COURSE.forEach((c, i) => g.fillText('H' + (i + 1) + ' (' + c.par + ')', cols[i + 1] - 20 + 20, 232));
      g.fillText('TOT', cols[4] + 0, 232);
      P.forEach((p, i) => {
        const y = 285 + i * 56;
        g.fillStyle = TEAM[i]; g.textAlign = 'left'; g.font = '800 20px "Trebuchet MS", sans-serif';
        g.fillText(NAMES[i].toUpperCase(), W / 2 - 215, y);
        g.textAlign = 'center'; g.fillStyle = '#fff';
        COURSE.forEach((c, h) => { g.fillText(p.scores[h] === undefined ? '–' : p.scores[h], cols[h + 1], y); });
        g.fillStyle = '#fcbf49'; g.fillText(p.scores.reduce((a, b) => a + b, 0), cols[4], y);
      });
    }

    function draw(g) {
      drawCourse(g);
      drawBasket(g);
      drawAim(g);
      const items = [];
      H0().trees.forEach((tr) => items.push({ y: tr.y + tr.r, f: () => drawTree(g, tr) }));
      P.forEach((p) => items.push({ y: p.y, f: () => drawPlayer(g, p) }));
      items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
      if (S.phase === 'flight' && S.disc) {
        g.strokeStyle = '#ffffff55'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); S.trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        const d = S.disc;
        const prog = d.hit ? 0 : clamp(1 - d.v / d.v0, 0, 1);
        drawDisc(g, d.x, d.y, Math.sin(prog * Math.PI) * 26);
      } else if (S.phase === 'landed' && S.disc && !P[S.cur].holed) {
        drawDisc(g, S.disc.x, S.disc.y, 0);
      }
      drawHUD(g);
      drawMeter(g);
      drawMsg(g);
      drawSummary(g);
    }

    const g = {
      title: '🥏 Disc Golf',
      help: [
        'Three holes. Fewest throws wins! Whoever is farthest from the basket throws next.',
        '<b>◀ ▶</b> aim · <b>▲ ▼</b> curve the disc · <b>Action</b> to start the power meter, then <b>Action</b> again to throw.',
        'Discs <b>fade left</b> at the end of their flight — curve right to compensate. Trees knock discs down!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }

  TS.sports.discgolf = create;
})();
