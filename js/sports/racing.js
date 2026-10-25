// Racing: three laps around an oval. Steer left/right; Action for a turbo boost.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const C = { x: 480, y: 330 }, RX = 340, RY = 190, BAND = [0.72, 1.28];
  const LAPS = 3, MAXV = 300, GRASS = 120;

  const qOf = (x, y) => Math.hypot((x - C.x) / RX, (y - C.y) / RY);
  const thOf = (x, y) => Math.atan2((y - C.y) / RY, (x - C.x) / RX);

  function create(ctx) {
    const P = ctx.players;
    const mk = (i) => {
      const th = Math.PI / 2 + 0.02, q = i ? 1.12 : 0.88;
      return {
        idx: i, x: C.x + Math.cos(th) * RX * q, y: C.y + Math.sin(th) * RY * q, ang: Math.PI, v: 0, boost: 0, charges: 3, th0: th, prev: th, prog: 0, lap: 0, t: Math.random() * 3,
        finished: false, ft: 0, off: false, trail: [], cpuBoostT: U.rnd(3, 6), bump: 0,
      };
    };
    const S = { state: 'intro', t: 0, cd: 3.2, time: 0, msg: null, done: 0, finishT: 0, car: [mk(0), mk(1)], sparks: [] };
    S.msg = { text: 'RACING', sub: '3 laps', t: 1.6 };

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      S.sparks.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; });
      S.sparks = S.sparks.filter((s) => s.life > 0);
      if (S.state === 'intro') { if (S.t > 1.7) { S.state = 'count'; S.cd = 3.2; } return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'race'; S.time = 0; TS.sfx.go(); }
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) {
          const w = S.car[0].ft === S.car[1].ft ? null : (S.car[0].ft < S.car[1].ft ? 0 : 1);
          g.over = true; g.result = { winner: w, scores: S.car.map((c) => c.ft), summary: 'Race times — Henry ' + S.car[0].ft.toFixed(2) + 's, Theo ' + S.car[1].ft.toFixed(2) + 's' };
        }
        return;
      }
      S.time += dt;
      S.car.forEach((c, i) => {
        c.t += dt; c.bump = Math.max(0, c.bump - dt);
        let steer = 0, wantBoost = false;
        if (c.finished) { c.v *= Math.exp(-1.5 * dt); }
        else if (P[i].human) { const pd = TS.input.pad(i); steer = pd.x; wantBoost = pd.actP; }
        else {
          const th = thOf(c.x, c.y), q = qOf(c.x, c.y);
          const look = th + 0.3, tq = 1.0;
          const tx = C.x + Math.cos(look) * RX * tq, ty = C.y + Math.sin(look) * RY * tq;
          let da = Math.atan2(ty - c.y, tx - c.x) - c.ang;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          steer = U.clamp(da * 2.2, -1, 1);
          c.cpuBoostT -= dt; if (c.cpuBoostT <= 0 && c.charges > 0) { wantBoost = true; c.cpuBoostT = U.rnd(4, 8); }
        }
        if (wantBoost && c.charges > 0 && c.boost <= 0) { c.charges--; c.boost = 1.1; TS.sfx.tone(300, 0.4, 'sawtooth', 0.08, 500); }
        c.boost = Math.max(0, c.boost - dt);
        const q = qOf(c.x, c.y);
        c.off = q < BAND[0] || q > BAND[1];
        const top = (c.off ? GRASS : MAXV * (!P[i].human ? 0.96 : 1)) * (c.boost > 0 ? 1.55 : 1);
        if (!c.finished) c.v += (top - c.v) * Math.min(1, dt * (c.off ? 3 : 1.2));
        c.ang += steer * 2.7 * dt * U.clamp(c.v / 160, 0.3, 1.1);
        c.x += Math.cos(c.ang) * c.v * dt; c.y += Math.sin(c.ang) * c.v * dt;
        c.x = U.clamp(c.x, 20, 940); c.y = U.clamp(c.y, 90, 580);
        if (c.off && c.v > 100 && Math.random() < dt * 20) S.sparks.push({ x: c.x, y: c.y, vx: U.rnd(-60, 60), vy: U.rnd(-60, 60), life: 0.35 });
        // lap progress along the oval (clockwise on screen = increasing theta)
        const th = thOf(c.x, c.y);
        let d = th - c.prev; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
        c.prog += d; c.prev = th;
        const lapNow = Math.floor(Math.max(0, c.prog) / TAU);
        if (lapNow > c.lap && !c.finished) {
          c.lap = lapNow;
          if (c.lap >= LAPS) {
            c.finished = true; c.ft = S.time; S.done++;
            if (S.done === 1) { S.msg = { text: U.NAMES[i].toUpperCase() + ' WINS!', sub: c.ft.toFixed(2) + ' s', t: 99 }; TS.sfx.goal(); S.finishT = 0; }
          } else S.msg = { text: 'LAP ' + (c.lap + 1), sub: U.NAMES[i], t: 0.9 };
        }
      });
      const a = S.car[0], b = S.car[1];
      const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy);
      if (dd < 26 && dd > 0.1) { const nx = dx / dd, ny = dy / dd, ov = (26 - dd) / 2; a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov; a.v *= 0.97; b.v *= 0.97; if (dd < 22) TS.sfx.thud(); }
      if (S.done >= 1) S.finishT += dt;
      if (S.done >= 2 || (S.done === 1 && S.finishT > 4)) {
        S.car.forEach((c) => { if (!c.finished) c.ft = S.time + Math.max(0, (LAPS * TAU - c.prog) / TAU) * 10; });
        S.state = 'over'; S.t = 0;
      }
    }

    function drawTrack(g) {
      g.fillStyle = '#3f8f3f'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#43964a' : '#3b8a40'; g.fillRect(0, i * 50, 960, 50); }
      // crowd
      for (let i = 0; i < 70; i++) { g.fillStyle = ['#e63946', '#fcbf49', '#4cc9f0', '#fff', '#ff70a6'][i % 5]; g.globalAlpha = 0.7; g.beginPath(); g.arc(i * 14 + 6, 28 + Math.sin(S.t * 3 + i) * 1.5, 6, 0, TAU); g.arc(i * 14 + 6, 580 + Math.sin(S.t * 3 + i) * 1.5, 6, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      // track: outer ellipse filled dark, inner ellipse filled grass
      const ell = (q, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(C.x, C.y, RX * q, RY * q, 0, 0, TAU); g.fill(); };
      ell(BAND[1] + 0.05, '#fff'); ell(BAND[1], '#4a4f5c');
      ell(BAND[0], '#ffffff'); ell(BAND[0] - 0.05, '#3f8f3f');
      g.fillStyle = '#4a9f4d'; g.beginPath(); g.ellipse(C.x, C.y, RX * (BAND[0] - 0.05), RY * (BAND[0] - 0.05), 0, 0, TAU); g.fill();
      // red/white curbs
      for (const q of [BAND[0], BAND[1]]) {
        g.lineWidth = 7; g.strokeStyle = '#e63946'; g.setLineDash([16, 16]); g.beginPath(); g.ellipse(C.x, C.y, RX * q, RY * q, 0, 0, TAU); g.stroke(); g.setLineDash([]);
      }
      // dashed centre line
      g.strokeStyle = '#ffffff55'; g.lineWidth = 3; g.setLineDash([18, 22]); g.beginPath(); g.ellipse(C.x, C.y, RX, RY, 0, 0, TAU); g.stroke(); g.setLineDash([]);
      // start line (bottom)
      g.fillStyle = '#fff'; for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#111' : '#fff'; g.fillRect(C.x + 4, C.y + RY * BAND[0] + k * ((RY * (BAND[1] - BAND[0])) / 8), 10, (RY * (BAND[1] - BAND[0])) / 8); }
      U.text(g, 'START / FINISH', C.x + 40, C.y + RY * 1.0 + 70, 13, '#ffffffaa', 'left');
    }
    function drawCar(g, c, i) {
      g.save(); g.translate(c.x, c.y); g.rotate(c.ang);
      g.fillStyle = '#0004'; g.fillRect(-14, -8, 30, 20);
      if (c.boost > 0) { g.fillStyle = '#ffb703'; g.beginPath(); g.moveTo(-14, -5); g.lineTo(-36 - Math.random() * 10, 0); g.lineTo(-14, 5); g.fill(); }
      g.fillStyle = U.TEAM[i]; TS.chars.rr(g, -15, -10, 30, 20, 6); g.fill();
      g.fillStyle = '#ffffff88'; g.fillRect(2, -8, 8, 16);
      g.fillStyle = '#222'; g.fillRect(-12, -12, 8, 4); g.fillRect(-12, 8, 8, 4); g.fillRect(6, -12, 8, 4); g.fillRect(6, 8, 8, 4);
      g.fillStyle = P[i].outfit.skin; g.beginPath(); g.arc(-2, 0, 6, 0, TAU); g.fill();
      g.fillStyle = P[i].outfit.hat.s !== 'none' ? P[i].outfit.hat.c : P[i].outfit.hair; g.beginPath(); g.arc(-2, 0, 6, Math.PI * 0.5, Math.PI * 1.5, true); g.fill();
      g.restore();
    }
    function draw(g) {
      drawTrack(g);
      S.sparks.forEach((s) => { g.fillStyle = '#7a5a2b'; g.globalAlpha = Math.max(0, s.life * 3); g.fillRect(s.x, s.y, 4, 4); g.globalAlpha = 1; });
      S.car.forEach((c, i) => drawCar(g, c, i));
      // HUD
      for (let i = 0; i < 2; i++) {
        const c = S.car[i], x = i ? 700 : 20;
        U.panel(g, x, 72, 240, 56, 14);
        U.text(g, U.NAMES[i].toUpperCase(), x + 12, 90, 15, U.TEAM[i]);
        U.text(g, 'LAP ' + Math.min(LAPS, c.lap + 1) + '/' + LAPS, x + 228, 90, 15, '#fff', 'right');
        for (let k = 0; k < 3; k++) { g.fillStyle = k < c.charges ? '#ffb703' : '#ffffff33'; g.beginPath(); g.arc(x + 20 + k * 22, 114, 7, 0, TAU); g.fill(); }
        U.text(g, 'TURBO', x + 96, 114, 11, '#ffffffaa');
        if (c.off) U.text(g, 'OFF TRACK!', x + 228, 114, 13, '#fcbf49', 'right', 900);
      }
      U.panel(g, 380, 8, 200, 54, 14);
      U.text(g, S.state === 'race' || S.state === 'over' ? S.time.toFixed(1) + ' s' : '0.0 s', 480, 36, 24, '#fcbf49', 'center');
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'GO!', '', 330, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 330, '#fcbf49');
      if (S.state === 'count' || (S.state === 'race' && S.time < 5)) {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: A / D steer · Space turbo      Theo: ◀ ▶ steer · Enter turbo' : '◀ ▶ (or A / D) steer · Action for a turbo boost (3 per race) — stay on the track!');
      }
    }

    const g = {
      title: '🏎️ Racing',
      help: [
        'Three laps around the oval. Your car drives itself — you steer! First across the line wins.',
        'Steer with <b>◀ ▶</b> (or A / D). Press <b>Action</b> for a <b>turbo boost</b> — you only have three. Driving on the grass slows you way down, so stay on the track.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.racing = create;
})();
