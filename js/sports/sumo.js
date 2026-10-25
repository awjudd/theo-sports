// Sumo: shove your rival out of the ring. First to two rounds.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const C = { x: 480, y: 335 }, RING = 225, R = 32;

  function create(ctx) {
    const P = ctx.players;
    const mk = (i) => ({ idx: i, x: C.x + (i ? 110 : -110), y: C.y, vx: 0, vy: 0, fx: i ? -1 : 1, fy: 0, dash: 0, cd: 0, t: Math.random() * 4, out: false, outT: 0, ai: { wait: 0 } });
    const S = { ft: 0, state: 'intro', t: 0, cd: 0, wins: [0, 0], round: 1, msg: null, pl: [mk(0), mk(1)], endT: 0, shake: 0, parts: [] };
    S.msg = { text: 'SUMO', sub: 'Push them out!', t: 1.6 };

    function startRound() {
      S.pl = [mk(0), mk(1)]; S.ft = 0; S.cd = 3.2; S.state = 'count'; S.msg = null; S.parts = [];
    }

    function cmd(p) {
      if (P[p.idx].human) { const pd = TS.input.pad(p.idx); return { x: pd.x, y: pd.y, act: pd.actP }; }
      const o = S.pl[1 - p.idx];
      const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1;
      const distC = Math.hypot(p.x - C.x, p.y - C.y);
      let tx, ty, act = false;
      if (distC > ringNow() - 85) { tx = C.x - p.x; ty = C.y - p.y; }      // too near the edge: retreat to the middle
      else {
        // approach, but try to get the rival between us and the edge
        const ox = o.x - C.x, oy = o.y - C.y, od = Math.hypot(ox, oy) || 1;
        tx = (o.x - (ox / od) * 36) - p.x; ty = (o.y - (oy / od) * 36) - p.y;
        if (d < 100 && p.cd <= 0 && Math.random() < dtNow * 2.2) act = true;
      }
      const l = Math.hypot(tx, ty) || 1;
      const sk = 0.82;
      return { x: (tx / l) * sk, y: (ty / l) * sk, act };
    }
    let dtNow = 0.016;
    const ringNow = () => RING - Math.max(0, S.ft - 18) * 7;

    function update(dt) {
      dtNow = dt;
      S.t += dt; S.shake = Math.max(0, S.shake - dt * 3);
      S.parts.forEach((q) => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.life -= dt; });
      S.parts = S.parts.filter((q) => q.life > 0);
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) startRound(); return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'fight'; TS.sfx.go(); }
        S.pl.forEach((p) => { p.t += dt; });
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.6 && !g.over) {
          g.over = true;
          g.result = { winner: S.wins[0] > S.wins[1] ? 0 : 1, scores: S.wins.slice(), summary: 'Rounds won — Henry ' + S.wins[0] + ', Theo ' + S.wins[1] };
        }
        return;
      }
      if (S.state === 'between') {
        S.endT -= dt; S.pl.forEach((p) => { p.t += dt; if (p.out) { p.x += p.vx * dt; p.y += p.vy * dt; } });
        if (S.endT <= 0) { if (S.wins[0] >= 2 || S.wins[1] >= 2) { S.state = 'over'; S.t = 0; S.msg = { text: 'FINAL', sub: S.wins[0] + ' – ' + S.wins[1], t: 99 }; } else { S.round++; startRound(); } }
        return;
      }
      // fight
      S.ft += dt;
      for (const p of S.pl) {
        p.t += dt; p.cd = Math.max(0, p.cd - dt); p.dash = Math.max(0, p.dash - dt);
        const c = cmd(p);
        const l = Math.hypot(c.x, c.y);
        let ax = c.x, ay = c.y;
        if (l > 1) { ax /= l; ay /= l; }
        if (l > 0.1) { p.fx = ax / Math.max(l, 1); p.fy = ay / Math.max(l, 1); const fl = Math.hypot(p.fx, p.fy) || 1; p.fx /= fl; p.fy /= fl; }
        p.vx += ax * 1100 * dt; p.vy += ay * 1100 * dt;
        if (c.act && p.cd <= 0) { p.dash = 0.22; p.cd = 1.1; p.vx += p.fx * 520; p.vy += p.fy * 520; TS.sfx.swish(); }
        const f = Math.exp(-3.4 * dt); p.vx *= f; p.vy *= f;
        const sp = Math.hypot(p.vx, p.vy), max = p.dash > 0 ? 560 : 250;
        if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      const a = S.pl[0], b = S.pl[1];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < R * 2) {
        const nx = dx / d, ny = dy / d, ov = R * 2 - d;
        a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const boostA = a.dash > 0 ? 1.7 : 1, boostB = b.dash > 0 ? 1.7 : 1;
          const j = -(1 + 0.75) * rv / 2;
          a.vx -= j * nx * boostB; a.vy -= j * ny * boostB; b.vx += j * nx * boostA; b.vy += j * ny * boostA;
          S.shake = 0.5; TS.sfx.thud();
          for (let k = 0; k < 6; k++) S.parts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: U.rnd(-150, 150), vy: U.rnd(-200, -20), life: 0.5 });
        }
      }
      // out of the ring?
      for (const p of S.pl) {
        if (Math.hypot(p.x - C.x, p.y - C.y) > ringNow() + R * 0.4) {
          const winner = 1 - p.idx;
          p.out = true;
          S.wins[winner]++; S.state = 'between'; S.endT = 2.2;
          S.msg = { text: U.NAMES[winner].toUpperCase() + ' WINS!', sub: S.wins[0] + ' – ' + S.wins[1], t: 2.2 };
          TS.sfx.goal();
          break;
        }
      }
    }

    function draw(g) {
      g.fillStyle = '#2a1b14'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU, rr = RING + 78 + (i % 3) * 22;
        g.fillStyle = ['#e63946', '#fcbf49', '#f1faee', '#4cc9f0', '#ff70a6', '#8338ec'][i % 6]; g.globalAlpha = 0.8;
        g.beginPath(); g.arc(C.x + Math.cos(a) * rr * 1.25, C.y + Math.sin(a) * rr * 0.78 + Math.sin(S.t * 4 + i) * 1.5, 8, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      const sh = S.shake ? Math.sin(S.t * 80) * 3 * S.shake : 0;
      g.save(); g.translate(sh, 0);
      // platform
      g.fillStyle = '#7b5a3a'; g.beginPath(); g.arc(C.x, C.y + 14, RING + 18, 0, TAU); g.fill();
      g.fillStyle = '#d9b97a'; g.beginPath(); g.arc(C.x, C.y, RING + 10, 0, TAU); g.fill();
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 10; g.beginPath(); g.arc(C.x, C.y, RING, 0, TAU); g.stroke();
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 3;
      for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU; g.beginPath(); g.moveTo(C.x + Math.cos(a) * (RING - 5), C.y + Math.sin(a) * (RING - 5)); g.lineTo(C.x + Math.cos(a + 0.05) * (RING + 5), C.y + Math.sin(a + 0.05) * (RING + 5)); g.stroke(); }
      g.strokeStyle = '#f5f5f5'; g.lineWidth = 5;
      for (const sx of [-34, 34]) { g.beginPath(); g.moveTo(C.x + sx, C.y - 18); g.lineTo(C.x + sx, C.y + 18); g.stroke(); }
      if (ringNow() < RING - 1) { g.strokeStyle = '#e63946'; g.lineWidth = 6; g.setLineDash([12, 8]); g.beginPath(); g.arc(C.x, C.y, ringNow(), 0, TAU); g.stroke(); g.setLineDash([]); }
      // fighters (back to front)
      [...S.pl].sort((p, q) => p.y - q.y).forEach((p) => {
        const wide = (g2) => {
          g2.save(); g2.translate(p.x, p.y + 38); g2.scale(1.35, 1); g2.translate(-p.x, -p.y - 38);
          TS.chars.draw(g2, P[p.idx].who, P[p.idx].outfit, { x: p.x, y: p.y + 38, scale: 0.95, t: p.t, moving: Math.hypot(p.vx, p.vy) > 40, facing: p.fx >= 0 ? 1 : -1, arm: p.dash > 0 ? 1.4 : 0.7, mood: p.out ? 'sad' : undefined });
          g2.restore();
        };
        wide(g);
        g.fillStyle = U.TEAM[p.idx]; g.beginPath(); g.moveTo(p.x + p.fx * 44, p.y + 38 + p.fy * 20); g.lineTo(p.x + p.fx * 34 - p.fy * 7, p.y + 38 + p.fy * 15 + p.fx * 5); g.lineTo(p.x + p.fx * 34 + p.fy * 7, p.y + 38 + p.fy * 15 - p.fx * 5); g.fill();
        if (p.cd <= 0 && S.state === 'fight') U.text(g, '⚡', p.x, p.y - 74, 18, '#fcbf49', 'center');
      });
      S.parts.forEach((q) => { g.fillStyle = '#fff'; g.globalAlpha = Math.max(0, q.life * 2); g.beginPath(); g.arc(q.x, q.y, 3, 0, TAU); g.fill(); g.globalAlpha = 1; });
      g.restore();
      U.scoreboard(g, S.wins, 'R' + Math.min(3, S.round), -1);
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'FIGHT!', '', 140, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 140, '#fcbf49');
      if (S.state === 'count' || (S.state === 'fight' && S.t < 3.5)) U.hint(g, 'Move to push · Action to DASH (⚡ = ready) · don’t get shoved out of the ring');
    }

    const g = {
      title: '🥋 Sumo',
      help: [
        'Best of three rounds. Shove your rival out of the ring — or keep from being pushed out yourself!',
        'Move with the direction keys. Press <b>Action</b> to <b>dash</b> in the direction you’re facing — a dash hits much harder, but it needs a moment to recharge (⚡ shows when it’s ready).',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.sumo = create;
})();
