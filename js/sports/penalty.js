// Penalty shootout: shooter aims and times the kick, keeper dives.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const GOAL = { l: 230, r: 730, top: 200, bot: 410 };
  const GCX = (GOAL.l + GOAL.r) / 2;
  const KICKS = 5;

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, kick: 0, cur: 0, scores: [0, 0], marks: [[], []], phase: 'aim',
      ax: GCX, ay: 300, power: 0, powT: 0, ball: null, kx: GCX, ky: 360, kTarget: { x: GCX, y: 360 },
      kLocked: false, msg: null, cpu: null, cpuT: 0, extra: 0, result: null, dive: 0,
    };
    const shooter = () => S.kick % 2;
    const keeper = () => 1 - S.kick % 2;

    function begin() {
      S.cur = shooter();
      S.ax = GCX; S.ay = 300; S.power = 0; S.powT = 0; S.phase = 'aim'; S.ball = null; S.cpuT = 0;
      S.kx = GCX; S.ky = 372; S.kTarget = { x: GCX, y: 372 }; S.kLocked = false; S.dive = 0;
      if (!P[S.cur].human) {
        const side = Math.random() < 0.5 ? -1 : 1;
        S.cpu = { x: GCX + side * U.rnd(60, 235), y: U.rnd(228, 385), power: U.clamp(0.8 + U.gauss() * 0.1, 0.3, 1), wait: U.rnd(1.0, 1.7) };
      }
      S.state = 'play';
      S.msg = { text: U.NAMES[S.cur] + ' shoots', sub: U.NAMES[keeper()] + ' keeps', t: 1.1 };
    }
    S.msg = { text: 'PENALTIES', sub: 'Shoot or save!', t: 1.6 };

    function kick() {
      const off = Math.abs(S.power - 0.8);
      const err = Math.max(0, off - 0.12) * 520 + U.gauss() * 7;
      const ang = Math.random() * TAU;
      const fx = S.ax + Math.cos(ang) * err, fy = S.ay + Math.sin(ang) * err * 0.7 - (S.power > 0.97 ? 80 : 0);
      S.ball = { u: 0, fx, fy, dur: 0.55 };
      S.phase = 'flight';
      // CPU keeper decides now (partially reads the shot)
      if (!P[keeper()].human) {
        const reads = Math.random() < 0.42;
        const tx = reads ? fx + U.gauss() * 40 : GCX + (Math.random() < 0.5 ? -1 : 1) * U.rnd(0, 230);
        const ty = reads ? fy : U.rnd(270, 390);
        S.kTarget = { x: U.clamp(tx, GOAL.l + 20, GOAL.r - 20), y: U.clamp(ty, 250, 385) };
        S.kLocked = true;
      }
      TS.sfx.hit();
    }

    function settle() {
      const b = S.ball, kx = S.kx, ky = S.ky;
      const inFrame = b.fx > GOAL.l + 6 && b.fx < GOAL.r - 6 && b.fy > GOAL.top + 6 && b.fy < GOAL.bot;
      const post = !inFrame && b.fy > GOAL.top - 10 && (Math.abs(b.fx - GOAL.l) < 12 || Math.abs(b.fx - GOAL.r) < 12 || (Math.abs(b.fy - GOAL.top) < 12 && b.fx > GOAL.l && b.fx < GOAL.r));
      let res;
      if (inFrame && Math.hypot(b.fx - kx, b.fy - (ky - 30)) < 78) res = 'saved';
      else if (inFrame) res = 'goal';
      else res = post ? 'post' : 'miss';
      S.result = res;
      S.marks[S.cur].push(res === 'goal');
      if (res === 'goal') { S.scores[S.cur]++; S.msg = { text: 'GOAL!', sub: '', t: 1.3 }; TS.sfx.goal(); }
      else if (res === 'saved') { S.msg = { text: 'SAVED!', sub: U.NAMES[keeper()] + ' denies it', t: 1.3 }; TS.sfx.thud(); }
      else if (res === 'post') { S.msg = { text: 'OFF THE POST!', sub: '', t: 1.3 }; TS.sfx.hit(); }
      else { S.msg = { text: 'WIDE!', sub: '', t: 1.2 }; TS.sfx.beep(); }
      S.phase = 'result'; S.t = 0;
    }

    function after() {
      S.kick++;
      const done = [S.marks[0].length, S.marks[1].length];
      const left = [Math.max(0, KICKS - done[0]), Math.max(0, KICKS - done[1])];
      let over = false;
      if (S.kick <= KICKS * 2) {
        // decided early?
        if (S.scores[0] > S.scores[1] + left[1]) over = true;
        if (S.scores[1] > S.scores[0] + left[0]) over = true;
      } else if (S.kick % 2 === 0) {
        if (S.scores[0] !== S.scores[1]) over = true;
        else if (++S.extra >= 4) over = true;
      }
      if (over) { S.state = 'over'; S.t = 0; S.msg = { text: 'FINAL', sub: S.scores[0] + ' – ' + S.scores[1], t: 99 }; }
      else begin();
    }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) begin(); return; }
      if (S.state === 'over') {
        if (S.t > 1.7 && !g.over) {
          g.over = true;
          g.result = { winner: S.scores[0] === S.scores[1] ? null : (S.scores[0] > S.scores[1] ? 0 : 1), scores: S.scores.slice(), summary: 'Penalty shootout — Henry ' + S.scores[0] + ', Theo ' + S.scores[1] };
        }
        return;
      }
      const sh = P[shooter()].human, kp = P[keeper()].human;
      const shPad = TS.input.pad(shooter()), kpPad = TS.input.pad(keeper());
      // keeper follows target (human: held direction keys until locked)
      if (kp && S.phase === 'flight' && !S.kLocked) {
        const tx = GCX + kpPad.x * 205, ty = kpPad.y < 0 ? 262 : (kpPad.y > 0 ? 388 : 335);
        S.kTarget = { x: tx, y: ty };
        if (S.ball.u > 0.4) S.kLocked = true;
      }
      if (S.phase === 'flight') {
        const k = Math.min(1, dt * 7);
        S.kx += (S.kTarget.x - S.kx) * k; S.ky += (S.kTarget.y - S.ky) * k;
      }
      if (S.phase === 'aim') {
        S.cpuT += dt;
        if (sh) {
          S.ax = U.clamp(S.ax + shPad.x * 260 * dt, GOAL.l - 90, GOAL.r + 90);
          S.ay = U.clamp(S.ay + shPad.y * 200 * dt, GOAL.top - 60, GOAL.bot);
          if (S.cpuT > 0.4 && shPad.actP) { S.phase = 'power'; S.powT = 0; TS.sfx.click(); }
        } else {
          S.ax += (S.cpu.x - S.ax) * Math.min(1, dt * 4); S.ay += (S.cpu.y - S.ay) * Math.min(1, dt * 4);
          if (S.cpuT > S.cpu.wait) { S.phase = 'power'; S.powT = 0; }
        }
      } else if (S.phase === 'power') {
        S.powT += dt;
        if (sh) { S.power = U.tri(S.powT / 0.6); if (shPad.actP) kick(); }
        else { S.power = S.cpu.power * U.clamp(S.powT / 0.45, 0, 1); if (S.powT > 0.55) { S.power = S.cpu.power; kick(); } }
      } else if (S.phase === 'flight') {
        S.ball.u = Math.min(1, S.ball.u + dt / S.ball.dur);
        S.dive = S.ball.u;
        if (S.ball.u >= 1) settle();
      } else if (S.phase === 'result') {
        if (S.t > 1.7) after();
      }
    }

    // ---------- drawing ----------
    function drawScene(g) {
      const sky = g.createLinearGradient(0, 0, 0, 200);
      sky.addColorStop(0, '#2c4a8a'); sky.addColorStop(1, '#6a8fd8');
      g.fillStyle = sky; g.fillRect(0, 0, 960, 220);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 70; i++) {
        g.fillStyle = ['#e63946', '#fcbf49', '#f1faee', '#4cc9f0', '#ff70a6', '#8338ec'][(i * 5 + r) % 6]; g.globalAlpha = 0.6;
        g.beginPath(); g.arc(i * 14 + (r % 2) * 7, 92 + r * 20 + Math.sin(S.t * 3 + i) * 1.3, 6, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#1f2b4d'; g.fillRect(0, 180, 960, 40);
      for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#3f8f3f' : '#46a047'; g.fillRect(0, 220 + i * 38, 960, 39); }
      // penalty box lines
      g.strokeStyle = '#ffffffcc'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(150, 412); g.lineTo(810, 412); g.stroke();
      g.beginPath(); g.moveTo(80, 600); g.lineTo(150, 412); g.moveTo(880, 600); g.lineTo(810, 412); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(GCX, 520, 5, 0, TAU); g.fill();
    }
    function drawGoal(g) {
      g.fillStyle = '#ffffff12'; g.fillRect(GOAL.l, GOAL.top, GOAL.r - GOAL.l, GOAL.bot - GOAL.top);
      g.strokeStyle = '#ffffff44'; g.lineWidth = 1;
      for (let x = GOAL.l; x <= GOAL.r; x += 16) { g.beginPath(); g.moveTo(x, GOAL.top); g.lineTo(x, GOAL.bot); g.stroke(); }
      for (let y = GOAL.top; y <= GOAL.bot; y += 16) { g.beginPath(); g.moveTo(GOAL.l, y); g.lineTo(GOAL.r, y); g.stroke(); }
    }
    function drawFrame(g) {
      g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(GOAL.l, GOAL.bot); g.lineTo(GOAL.l, GOAL.top); g.lineTo(GOAL.r, GOAL.top); g.lineTo(GOAL.r, GOAL.bot); g.stroke();
    }
    function drawBall(g, x, y, s) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y + 18 * s, 18 * s, 5 * s, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 18 * s, 0, TAU); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#222'; for (let i = 0; i < 3; i++) { const a = S.t * 6 * (S.ball ? 1 : 0) + i * 2.1; g.beginPath(); g.arc(x + Math.cos(a) * 8 * s, y + Math.sin(a) * 8 * s, 4.5 * s, 0, TAU); g.fill(); }
    }
    function draw(g) {
      drawScene(g);
      drawGoal(g);
      // keeper
      const kp = P[keeper()];
      const diving = S.phase === 'flight' || S.phase === 'result';
      const dx = S.kx - GCX;
      g.save(); g.translate(S.kx, S.ky + 52); g.rotate(diving ? U.clamp(dx / 260, -1, 1) * 0.9 : 0); g.translate(-S.kx, -S.ky - 52);
      TS.chars.draw(g, kp.who, kp.outfit, { x: S.kx, y: S.ky + 52, scale: 1.25, t: S.t, arm: 0, cheer: S.phase === 'result' && S.result === 'saved', mood: S.phase === 'result' && S.result === 'goal' ? 'sad' : undefined });
      g.restore();
      drawFrame(g);
      // target reticle
      if (S.state === 'play' && (S.phase === 'aim' || S.phase === 'power')) {
        g.strokeStyle = '#fcbf49'; g.lineWidth = 3;
        g.beginPath(); g.arc(S.ax, S.ay, 16, 0, TAU); g.moveTo(S.ax - 24, S.ay); g.lineTo(S.ax - 8, S.ay); g.moveTo(S.ax + 8, S.ay); g.lineTo(S.ax + 24, S.ay); g.moveTo(S.ax, S.ay - 24); g.lineTo(S.ax, S.ay - 8); g.moveTo(S.ax, S.ay + 8); g.lineTo(S.ax, S.ay + 24); g.stroke();
      }
      // shooter
      const sp = P[shooter()];
      TS.chars.draw(g, sp.who, sp.outfit, { x: 380, y: 590, scale: 1.35, t: S.t, moving: S.phase === 'flight' && S.ball.u < 0.2, arm: 0 });
      // ball
      if (S.ball && S.phase !== 'aim' && S.phase !== 'power') {
        const b = S.ball, u = b.u;
        drawBall(g, U.lerp(GCX, b.fx, u), U.lerp(520, b.fy, u) - Math.sin(u * Math.PI) * 50, U.lerp(1.2, 0.55, u));
      } else drawBall(g, GCX, 520, 1.2);
      U.scoreboard(g, S.scores, Math.min(KICKS, Math.floor(S.kick / 2) + 1) + '/' + KICKS, S.state === 'play' ? S.cur : -1);
      for (let i = 0; i < 2; i++) S.marks[i].forEach((ok, n) => { g.fillStyle = ok ? '#6a994e' : '#e63946'; g.beginPath(); g.arc(30 + n * 22, 100 + i * 24, 8, 0, TAU); g.fill(); U.text(g, ok ? '✓' : '✗', 30 + n * 22, 100 + i * 24, 11, '#fff', 'center'); });
      if (S.state === 'play') {
        const sh = P[shooter()].human, kp2 = P[keeper()].human;
        if (S.phase === 'aim') U.hint(g, sh ? '◀ ▶ ▲ ▼ aim your shot · Action to start the power meter' : U.NAMES[shooter()] + ' is lining up…' + (kp2 ? '  Keeper: get ready!' : ''));
        else if (S.phase === 'power') U.meter(g, 330, 552, 300, 20, S.power, [0.68, 0.92], sh ? 'POWER · Action in the green' : 'POWER');
        else if (S.phase === 'flight' && kp2 && !S.kLocked) U.hint(g, 'KEEPER: hold ◀ ▶ ▲ ▼ to dive!');
      }
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 150, '#fcbf49');
    }

    const g = {
      title: '🥅 Penalty Shootout',
      help: [
        'Five penalty kicks each — take turns shooting and keeping. Most goals wins; ties go to sudden death.',
        '<b>Shooting:</b> aim with the direction keys, press <b>Action</b> to start the power meter, then <b>Action</b> again in the green zone. Bad timing sends it wild!',
        '<b>Keeping:</b> as soon as the ball is kicked, <b>hold a direction</b> (◀ ▶ for left/right, ▲ for high, ▼ for low) to dive. Your dive locks in partway through the shot.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.penalty = create;
})();
