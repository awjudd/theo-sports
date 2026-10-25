// Dodgeball: stay on your half, throw at your rival, dodge theirs — or catch it!
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const COURT = { l: 80, r: 880, t: 120, b: 540, mid: 480 };
  const PR = 20, BR = 10, LIVES = 3, TIME = 75;

  function create(ctx) {
    const P = ctx.players;
    const pl = [0, 1].map((i) => ({
      idx: i, x: i ? 740 : 220, y: 330, vx: 0, vy: 0, fx: i ? -1 : 1, fy: 0, lives: LIVES, cd: 0, inv: 0, hurt: 0, t: Math.random() * 3,
      ai: { throwT: U.rnd(0.8, 1.6), jitter: U.rnd(-1, 1) }, catchFlash: 0, power: false,
    }));
    const S = { state: 'intro', t: 0, cd: 3.2, left: TIME, balls: [], msg: null, ot: false, endT: 0, parts: [] };
    S.msg = { text: 'DODGEBALL', sub: 'Dodge, catch, throw!', t: 1.6 };

    function throwBall(p, aimX, aimY, power) {
      const sp = power ? 760 : 560;
      p.cd = 0.75;
      S.balls.push({ x: p.x + p.fx * 24, y: p.y + p.fy * 24 - 6, vx: p.fx * sp, vy: p.fy * sp, owner: p.idx, life: 3.2, power, bounce: 0 });
      TS.sfx.swish();
    }
    function hurt(p, power) {
      if (p.inv > 0) return;
      p.lives--; p.inv = 1.0; p.hurt = 0.5;
      TS.sfx.hit();
      for (let k = 0; k < 8; k++) S.parts.push({ x: p.x, y: p.y, vx: U.rnd(-180, 180), vy: U.rnd(-220, -20), life: 0.6, c: U.TEAM[p.idx] });
      S.msg = { text: p.lives > 0 ? 'HIT!' : 'OUT!', sub: U.NAMES[p.idx] + ' has ' + p.lives + ' left', t: 0.9 };
    }

    function cmd(p) {
      if (P[p.idx].human) { const pd = TS.input.pad(p.idx); return { x: pd.x, y: pd.y, act: pd.actP }; }
      const o = pl[1 - p.idx];
      let mx = 0, my = 0, act = false;
      // dodge the nearest incoming ball
      let danger = null, dt0 = 9;
      for (const b of S.balls) {
        if (b.owner === p.idx) continue;
        const toward = (p.x - b.x) * b.vx > 0;
        if (!toward) continue;
        const ttc = Math.abs(p.x - b.x) / Math.max(1, Math.abs(b.vx));
        const yAt = b.y + b.vy * ttc;
        if (ttc < 0.85 && Math.abs(yAt - p.y) < 44 && ttc < dt0) { danger = { yAt, ttc, b }; dt0 = ttc; }
      }
      if (danger) {
        my = p.y >= danger.yAt ? 1 : -1;
        if (p.y < COURT.t + 50) my = 1; if (p.y > COURT.b - 50) my = -1;
        if (danger.ttc < 0.2 && Math.hypot(danger.b.x - p.x, danger.b.y - p.y) < 70 && Math.random() < 0.025 && p.cd <= 0) act = true;
      } else {
        const want = o.y + p.ai.jitter * 30;
        my = Math.abs(want - p.y) > 16 ? Math.sign(want - p.y) * 0.7 : 0;
        // keep a little away from the centre line
        const home = p.idx ? 740 : 220;
        mx = Math.abs(home - p.x) > 30 ? Math.sign(home - p.x) * 0.5 : 0;
        p.ai.throwT -= dtNow;
        if (p.ai.throwT <= 0 && p.cd <= 0) {
          act = true; p.ai.throwT = U.rnd(0.9, 1.7); p.ai.jitter = U.rnd(-1, 1);
          const lead = o.vy * 0.25;
          const ax = o.x - p.x, ay = o.y + lead - p.y + U.gauss() * 26, l = Math.hypot(ax, ay);
          p.fx = ax / l; p.fy = ay / l;
        }
      }
      return { x: mx, y: my, act };
    }
    let dtNow = 0.016;

    function finish() {
      S.state = 'over'; S.t = 0;
      const w = pl[0].lives === pl[1].lives ? null : (pl[0].lives > pl[1].lives ? 0 : 1);
      S.msg = { text: w === null ? 'DRAW' : U.NAMES[w].toUpperCase() + ' WINS!', sub: pl[0].lives + ' – ' + pl[1].lives + ' lives', t: 99 };
      if (w !== null) TS.sfx.goal();
    }

    function update(dt) {
      dtNow = dt;
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      S.parts.forEach((q) => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 500 * dt; q.life -= dt; });
      S.parts = S.parts.filter((q) => q.life > 0);
      pl.forEach((p) => { p.t += dt; p.hurt = Math.max(0, p.hurt - dt); p.catchFlash = Math.max(0, p.catchFlash - dt); });
      if (S.state === 'intro') { if (S.t > 1.7) { S.state = 'count'; S.cd = 3.2; } return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'play'; S.msg = null; TS.sfx.go(); }
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) {
          const w = pl[0].lives === pl[1].lives ? null : (pl[0].lives > pl[1].lives ? 0 : 1);
          g.over = true; g.result = { winner: w, scores: [pl[0].lives, pl[1].lives], summary: 'Lives left — Henry ' + pl[0].lives + ', Theo ' + pl[1].lives };
        }
        return;
      }
      if (!S.ot) { S.left -= dt; if (S.left <= 0) { S.left = 0; if (pl[0].lives === pl[1].lives) { S.ot = true; S.msg = { text: 'SUDDEN DEATH', sub: 'Next hit wins', t: 2 }; } else { finish(); return; } } }
      for (const p of pl) {
        p.cd = Math.max(0, p.cd - dt); p.inv = Math.max(0, p.inv - dt);
        const c = cmd(p);
        let dx = c.x, dy = c.y; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        p.vx += (dx * 240 - p.vx) * Math.min(1, dt * 12); p.vy += (dy * 240 - p.vy) * Math.min(1, dt * 12);
        p.x += p.vx * dt; p.y += p.vy * dt;
        const lo = p.idx ? COURT.mid + PR + 6 : COURT.l + PR, hi = p.idx ? COURT.r - PR : COURT.mid - PR - 6;
        p.x = U.clamp(p.x, lo, hi); p.y = U.clamp(p.y, COURT.t + PR, COURT.b - PR);
        if (P[p.idx].human && l > 0.1) { p.fx = dx / Math.hypot(dx, dy); p.fy = dy / Math.hypot(dx, dy); }
        else if (!P[p.idx].human && l > 0.1 && p.cd > 0.3) { /* keep aim while recovering */ }
        if (c.act && p.cd <= 0) {
          // try to catch first
          const nearBall = S.balls.find((b) => b.owner !== p.idx && Math.hypot(b.x - p.x, b.y - p.y) < 70 && (p.x - b.x) * b.vx > 0);
          if (nearBall) {
            S.balls.splice(S.balls.indexOf(nearBall), 1);
            p.catchFlash = 0.8; p.power = true; p.cd = 0.3;
            hurt(pl[1 - p.idx], false);
            S.msg = { text: 'CAUGHT!', sub: U.NAMES[1 - p.idx] + ' loses a life', t: 1.1 };
            TS.sfx.win();
          } else {
            if (!P[p.idx].human) { /* aim already set by cmd */ }
            else if (Math.abs(p.fx) < 0.01 && Math.abs(p.fy) < 0.01) { p.fx = p.idx ? -1 : 1; }
            throwBall(p, 0, 0, p.power); p.power = false;
          }
        }
      }
      // balls
      for (const b of S.balls) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.y < COURT.t + BR) { b.y = COURT.t + BR; b.vy = Math.abs(b.vy); b.bounce++; }
        if (b.y > COURT.b - BR) { b.y = COURT.b - BR; b.vy = -Math.abs(b.vy); b.bounce++; }
        const o = pl[1 - b.owner];
        if (Math.hypot(b.x - o.x, b.y - o.y) < PR + BR && o.inv <= 0) { hurt(o, b.power); b.life = 0; }
      }
      S.balls = S.balls.filter((b) => b.life > 0 && b.x > COURT.l - 40 && b.x < COURT.r + 40);
      if (pl[0].lives <= 0 || pl[1].lives <= 0 || (S.ot && (pl[0].lives !== pl[1].lives))) { finish(); }
    }

    function drawHeart(g, x, y, on) {
      g.fillStyle = on ? '#e63946' : '#ffffff33';
      g.beginPath(); g.moveTo(x, y + 6); g.bezierCurveTo(x - 12, y - 4, x - 6, y - 12, x, y - 5); g.bezierCurveTo(x + 6, y - 12, x + 12, y - 4, x, y + 6); g.fill();
    }
    function draw(g) {
      g.fillStyle = '#1d2b4a'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 70; i++) { g.fillStyle = ['#e63946', '#fcbf49', '#4cc9f0', '#fff', '#ff70a6'][i % 5]; g.globalAlpha = 0.5; g.beginPath(); g.arc(i * 14 + 6, 100 + Math.sin(S.t * 3 + i) * 1.5, 6, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#c98a4b' : '#d29655'; g.fillRect(COURT.l - 30 + i * 105, COURT.t - 10, 105, COURT.b - COURT.t + 20); }
      g.fillStyle = '#e63946aa'; g.fillRect(COURT.l, COURT.t, COURT.mid - COURT.l, COURT.b - COURT.t); g.globalAlpha = 0.18; g.fillRect(COURT.l, COURT.t, COURT.mid - COURT.l, COURT.b - COURT.t);
      g.globalAlpha = 1;
      g.fillStyle = '#3a86ff'; g.globalAlpha = 0.18; g.fillRect(COURT.mid, COURT.t, COURT.r - COURT.mid, COURT.b - COURT.t); g.globalAlpha = 1;
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(COURT.l, COURT.t, COURT.r - COURT.l, COURT.b - COURT.t);
      g.beginPath(); g.moveTo(COURT.mid, COURT.t); g.lineTo(COURT.mid, COURT.b); g.stroke();
      g.beginPath(); g.arc(COURT.mid, (COURT.t + COURT.b) / 2, 46, 0, TAU); g.stroke();
      // players
      [...pl].sort((a, b) => a.y - b.y).forEach((p) => {
        const flash = p.inv > 0 && Math.floor(p.t * 20) % 2 === 0;
        if (!flash) {
          TS.chars.draw(g, P[p.idx].who, P[p.idx].outfit, {
            x: p.x, y: p.y + 24, scale: 0.78, t: p.t, moving: Math.hypot(p.vx, p.vy) > 40, facing: p.fx >= 0 ? 1 : -1,
            arm: p.cd > 0.5 ? 2.3 : 0, cheer: p.catchFlash > 0, mood: p.hurt > 0 ? 'sad' : undefined,
          });
        }
        for (let h = 0; h < LIVES; h++) drawHeart(g, p.x - 24 + h * 24, p.y - 72, h < p.lives);
        U.text(g, p.power ? '⚡ POWER THROW' : '', p.x, p.y - 90, 12, '#fcbf49', 'center');
        // aim marker
        g.fillStyle = U.TEAM[p.idx]; g.globalAlpha = 0.85;
        const a = Math.atan2(p.fy, p.fx);
        g.save(); g.translate(p.x + p.fx * 34, p.y + 24 + p.fy * 24); g.rotate(a); g.beginPath(); g.moveTo(9, 0); g.lineTo(-4, -6); g.lineTo(-4, 6); g.fill(); g.restore(); g.globalAlpha = 1;
      });
      // balls
      for (const b of S.balls) {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(b.x, b.y + 12, BR, 4, 0, 0, TAU); g.fill();
        g.fillStyle = b.power ? '#fcbf49' : '#e63946'; g.beginPath(); g.arc(b.x, b.y, BR, 0, TAU); g.fill();
        g.strokeStyle = '#7a1c24'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#ffffff88'; g.beginPath(); g.arc(b.x - 3, b.y - 3, 3, 0, TAU); g.fill();
      }
      S.parts.forEach((q) => { g.fillStyle = q.c; g.globalAlpha = Math.max(0, q.life * 1.6); g.fillRect(q.x, q.y, 6, 6); g.globalAlpha = 1; });
      const secs = Math.ceil(S.left);
      U.scoreboard(g, [pl[0].lives, pl[1].lives], S.ot ? 'SD' : Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'), -1);
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'GO!', '', 300, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 300, '#fcbf49');
      if (S.state === 'count' || (S.state === 'play' && S.left > TIME - 5)) U.hint(g, 'Move to dodge · Action to throw — or CATCH a ball that’s about to hit you!');
    }

    const g = {
      title: '🔴 Dodgeball',
      help: [
        'Everyone starts with three lives. Stay on your half of the court, throw balls at your rival, and dodge theirs!',
        'Move with the direction keys — you throw the way you’re facing (the little arrow). Press <b>Action</b> to throw.',
        '<b>Catch:</b> press <b>Action</b> when a ball is about to hit you and you’ll catch it — your rival loses a life and your next throw is a fast power throw!',
        'After 75 seconds, whoever has more lives wins.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.dodgeball = create;
})();
