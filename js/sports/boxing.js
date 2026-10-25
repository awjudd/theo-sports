// Boxing: three rounds. Jab with Action, hold ▼ to guard. Win on points or by knockout.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const RING = { l: 130, r: 830, y: 470 };
  const ROUNDS = 3, RTIME = 40, HP = 100, REACH = 118;

  function create(ctx) {
    const P = ctx.players;
    const mk = (i) => ({ idx: i, x: i ? 640 : 320, vx: 0, hp: HP, cd: 0, punch: 0, block: false, stun: 0, t: Math.random() * 3, pts: 0, stamina: 100, ai: { t: 0.3, mode: 0 }, hurt: 0 });
    const S = { state: 'intro', t: 0, cd: 0, round: 1, left: RTIME, f: [mk(0), mk(1)], rounds: [0, 0], msg: null, endT: 0, flashes: [], shake: 0 };
    S.msg = { text: 'BOXING', sub: '3 rounds', t: 1.6 };

    function startRound() {
      S.f = [mk(0), mk(1)].map((n, i) => { n.pts = S.f[i].pts; return n; });
      S.left = RTIME; S.cd = 2.5; S.state = 'count'; S.msg = null;
    }

    function hit(att, def, heavy) {
      const dmg = heavy ? 16 : 9;
      if (def.block) { def.hp -= dmg * 0.15; def.stamina = Math.max(0, def.stamina - 14); S.msg = null; S.flashes.push({ x: def.x, y: 330, t: 0.3, text: 'BLOCK', c: '#4cc9f0' }); TS.sfx.thud(); return; }
      def.hp -= dmg; def.stun = 0.25; def.hurt = 0.3; def.vx += (def.x > att.x ? 1 : -1) * 180; att.pts += heavy ? 3 : 2; S.shake = 0.4;
      S.flashes.push({ x: def.x, y: 300, t: 0.4, text: heavy ? 'BAM!' : 'POW!', c: heavy ? '#e63946' : '#fcbf49' }); TS.sfx.hit();
    }

    function cmd(p) {
      if (P[p.idx].human) { const pd = TS.input.pad(p.idx); return { x: pd.x, block: pd.y > 0, punch: pd.actP }; }
      const o = S.f[1 - p.idx];
      const d = Math.abs(o.x - p.x), dir = Math.sign(o.x - p.x);
      p.ai.t -= dtNow;
      let x = 0, block = false, punch = false;
      if (p.ai.t <= 0) { p.ai.mode = Math.random() < 0.55 ? 0 : (Math.random() < 0.5 ? 1 : 2); p.ai.t = U.rnd(0.35, 0.8); }
      if (o.punch > 0.05 && d < REACH + 20 && Math.random() < 0.6) block = true;
      else if (p.ai.mode === 0) { // approach and jab
        if (d > REACH - 18) x = dir * 0.8; else if (d < 60) x = -dir * 0.6;
        if (d < REACH && p.cd <= 0 && Math.random() < dtNow * 4) punch = true;
      } else if (p.ai.mode === 1) { x = d < 190 ? -dir * 0.7 : 0; if (Math.random() < dtNow * 1.2 && d < REACH + 10) punch = true; }
      else { block = Math.random() < 0.5; }
      return { x: x * 0.85, block, punch };
    }
    let dtNow = 0.016;

    function update(dt) {
      dtNow = dt; S.t += dt; S.shake = Math.max(0, S.shake - dt * 3);
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      S.flashes.forEach((f) => { f.t -= dt; }); S.flashes = S.flashes.filter((f) => f.t > 0);
      S.f.forEach((p) => { p.t += dt; });
      if (S.state === 'intro') { if (S.t > 1.7) startRound(); return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'fight'; TS.sfx.go(); S.msg = { text: 'FIGHT!', sub: '', t: 0.7 }; }
        return;
      }
      if (S.state === 'between') {
        S.endT -= dt;
        if (S.endT <= 0) {
          if (S.round >= ROUNDS || S.ko) finish();
          else { S.round++; startRound(); }
        }
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.9 && !g.over) {
          g.over = true;
          g.result = { winner: S.winner === undefined ? null : S.winner, scores: S.rounds.slice(), summary: S.how };
        }
        return;
      }
      S.left -= dt;
      for (const p of S.f) {
        p.cd = Math.max(0, p.cd - dt); p.punch = Math.max(0, p.punch - dt); p.stun = Math.max(0, p.stun - dt); p.hurt = Math.max(0, p.hurt - dt);
        p.stamina = Math.min(100, p.stamina + 18 * dt);
        const c = cmd(p);
        p.block = c.block && p.stun <= 0 && p.punch <= 0;
        if (p.stun <= 0 && !p.block) p.vx += (c.x * 260 - p.vx) * Math.min(1, dt * 10); else p.vx *= Math.exp(-6 * dt);
        p.x = U.clamp(p.x + p.vx * dt, RING.l + 40, RING.r - 40);
        if (c.punch && p.cd <= 0 && p.stun <= 0 && !p.block && p.stamina >= 12) {
          p.punch = 0.22; p.cd = 0.42; p.stamina -= 14; TS.sfx.swish();
          const o = S.f[1 - p.idx];
          const d = Math.abs(o.x - p.x);
          if (d < REACH && Math.sign(o.x - p.x) === (p.idx ? -1 : 1)) {
            // land on the first active frame
            p.pending = 0.09;
          }
        }
        if (p.pending !== undefined) {
          p.pending -= dt;
          if (p.pending <= 0) {
            const o = S.f[1 - p.idx];
            if (Math.abs(o.x - p.x) < REACH + 6) hit(p, o, p.stamina > 70);
            delete p.pending;
          }
        }
      }
      // keep fighters from overlapping
      const a = S.f[0], b = S.f[1];
      if (b.x - a.x < 100) { const m = (100 - (b.x - a.x)) / 2; a.x -= m; b.x += m; }
      if (S.f.some((p) => p.hp <= 0)) {
        const loser = S.f[0].hp <= 0 ? 0 : 1;
        S.rounds[1 - loser] = 3; S.ko = true; S.winner = 1 - loser; S.how = U.NAMES[1 - loser] + ' wins by knockout!';
        S.state = 'between'; S.endT = 1.8; S.msg = { text: 'KNOCKOUT!', sub: U.NAMES[1 - loser] + ' wins', t: 1.8 }; TS.sfx.goal();
        return;
      }
      if (S.left <= 0) {
        S.state = 'between'; S.endT = 2;
        const sc = [S.f[0].hp + S.f[0].pts * 0.5, S.f[1].hp + S.f[1].pts * 0.5];
        const w = Math.abs(sc[0] - sc[1]) < 0.5 ? -1 : (sc[0] > sc[1] ? 0 : 1);
        if (w >= 0) S.rounds[w]++;
        S.msg = { text: w < 0 ? 'ROUND DRAWN' : U.NAMES[w].toUpperCase() + ' TAKES THE ROUND', sub: S.rounds[0] + ' – ' + S.rounds[1], t: 2 };
        TS.sfx.beep();
      }
    }
    function finish() {
      S.state = 'over'; S.t = 0;
      if (!S.ko) {
        S.winner = S.rounds[0] === S.rounds[1] ? null : (S.rounds[0] > S.rounds[1] ? 0 : 1);
        S.how = 'Rounds won — Henry ' + S.rounds[0] + ', Theo ' + S.rounds[1];
      }
      S.msg = { text: S.winner === null ? 'DRAW' : U.NAMES[S.winner].toUpperCase() + ' WINS!', sub: S.how, t: 99 };
    }

    function drawFighter(g, p) {
      const pl = P[p.idx];
      const dir = p.idx ? -1 : 1;
      const lean = p.block ? -0.12 * dir : (p.punch > 0 ? 0.18 * dir : 0);
      const down = p.hp <= 0;
      g.save(); g.translate(p.x, RING.y); g.rotate(down ? dir * -1.4 : lean + (p.hurt > 0 ? -0.18 * dir : 0)); g.translate(-p.x, -RING.y);
      TS.chars.draw(g, pl.who, pl.outfit, { x: p.x, y: RING.y, scale: 1.8, t: p.t, moving: Math.abs(p.vx) > 40, facing: dir, arm: p.punch > 0 ? 1.55 : (p.block ? 2.4 : 0.9), mood: p.hurt > 0 || down ? 'sad' : 'happy' });
      g.restore();
      // gloves
      const gx = p.x + dir * (p.punch > 0 ? 100 : p.block ? 36 : 56), gy = RING.y - (p.block ? 120 : 98);
      g.fillStyle = U.TEAM[p.idx]; g.beginPath(); g.arc(gx, gy, 20, 0, TAU); g.fill();
      g.fillStyle = '#ffffff55'; g.beginPath(); g.arc(gx - 5, gy - 6, 7, 0, TAU); g.fill();
    }
    function draw(g) {
      const sh = S.shake ? Math.sin(S.t * 90) * 4 * S.shake : 0;
      g.fillStyle = '#1b1530'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 90; i++) { g.fillStyle = ['#e63946', '#fcbf49', '#4cc9f0', '#fff', '#ff70a6'][i % 5]; g.globalAlpha = 0.45; g.beginPath(); g.arc((i * 11) % 960, 70 + (i % 5) * 18, 6, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      g.save(); g.translate(sh, 0);
      // ring
      g.fillStyle = '#9fb7d9'; g.fillRect(90, 470, 780, 130);
      g.fillStyle = '#7a95bd'; for (let x = 90; x < 870; x += 60) g.fillRect(x, 470, 30, 130);
      g.fillStyle = '#e8eef7'; g.fillRect(90, 462, 780, 12);
      for (const [y, c] of [[250, '#e63946'], [310, '#ffffff'], [370, '#3a86ff']]) { g.strokeStyle = c; g.lineWidth = 7; g.beginPath(); g.moveTo(106, y); g.lineTo(854, y); g.stroke(); }
      g.fillStyle = '#555'; for (const x of [106, 854]) g.fillRect(x - 7, 210, 14, 262);
      for (const x of [106, 854]) for (const [y, c] of [[250, '#e63946'], [310, '#fff'], [370, '#3a86ff']]) { g.fillStyle = c; g.fillRect(x - 8, y - 8, 16, 16); }
      [...S.f].forEach((p) => drawFighter(g, p));
      S.flashes.forEach((f) => { g.globalAlpha = Math.min(1, f.t * 4); U.text(g, f.text, f.x, f.y - (0.4 - f.t) * 80, 28, f.c, 'center', 900); g.globalAlpha = 1; });
      g.restore();
      // bars
      for (let i = 0; i < 2; i++) {
        const p = S.f[i], x = i ? 520 : 40;
        U.panel(g, x, 80, 400, 42, 14);
        g.fillStyle = '#ffffff22'; TS.chars.rr(g, x + 10, 90, 380, 14, 7); g.fill();
        g.fillStyle = p.hp > 35 ? '#6a994e' : '#e63946'; const w = 380 * U.clamp(p.hp / HP, 0, 1); if (w > 2) { TS.chars.rr(g, i ? x + 10 + 380 - w : x + 10, 90, w, 14, 7); g.fill(); }
        g.fillStyle = '#4cc9f0'; g.fillRect(i ? x + 10 + 380 - 380 * (p.stamina / 100) : x + 10, 108, 380 * (p.stamina / 100), 5);
        U.text(g, U.NAMES[i].toUpperCase(), i ? x + 390 : x + 10, 134, 12, U.TEAM[i], i ? 'right' : 'left');
      }
      const secs = Math.ceil(S.left);
      U.scoreboard(g, S.rounds, 'R' + S.round + '  0:' + String(secs).padStart(2, '0'), -1);
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'FIGHT!', '', 250, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 250, '#fcbf49');
      if (S.state === 'count' || (S.state === 'fight' && S.round === 1 && S.left > RTIME - 6)) {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: A / D move · Space punch · S guard      Theo: ◀ ▶ · Enter punch · ▼ guard' : '◀ ▶ move · Action to punch · hold ▼ to guard (punching costs stamina)');
      }
    }

    const g = {
      title: '🥊 Boxing',
      help: [
        'Three rounds, 40 seconds each. Win by landing more punches — or knock your rival out!',
        'Move in and out with <b>◀ ▶</b>, press <b>Action</b> to punch (it uses stamina, which slowly refills), and hold <b>▼</b> to guard against punches. Don’t just stand there!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.boxing = create;
})();
