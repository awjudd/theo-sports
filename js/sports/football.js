// Football: field-goal kicking contest. Aim into the wind, then time your kick.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const DISTS = [22, 28, 34, 40, 46];
  const BASE_Y = 352; // where the goalposts meet the grass

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, kick: 0, cur: 0, scores: [0, 0], results: [[], []], phase: 'aim',
      aim: 0, wind: 0, power: 0, powT: 0, ball: null, msg: null, cpu: null, cpuT: 0, extra: 0, dist: DISTS[0],
      swing: 0,
    };
    const hw = () => 1500 / S.dist;          // half-width between the uprights, in pixels
    const ph = () => 3200 / S.dist;          // upright height
    const needMin = () => 0.45 + S.dist * 0.0092;
    const sweet = () => needMin() + 0.07;

    function begin() {
      S.cur = S.kick % 2;
      const round = Math.floor(S.kick / 2);
      S.dist = round < DISTS.length ? DISTS[round] : 48;
      S.wind = Math.round(U.rnd(-1, 1) * 1.0 * (14 + S.dist * 0.9));
      S.aim = 0; S.power = 0; S.powT = 0; S.phase = 'aim'; S.ball = null; S.swing = 0; S.cpuT = 0;
      if (!P[S.cur].human) {
        const wcomp = -S.wind * (0.55 + U.rnd(0, 0.45));
        S.cpu = { aim: U.clamp(wcomp + U.gauss() * 16, -90, 90), power: U.clamp(sweet() + U.gauss() * 0.11 - 0.02, 0.2, 1) };
      }
      S.state = 'play';
      S.msg = { text: U.NAMES[S.cur], sub: S.dist + '-yard attempt', t: 1.2 };
    }
    S.t = 0; S.msg = { text: 'FIELD GOALS', sub: 'Kick through the uprights', t: 1.6 };

    function kick() {
      const p = S.power;
      const ideal = sweet();
      const off = Math.abs(p - ideal);
      const sigma = 5 + Math.max(0, off - 0.05) * 160;
      const lateral = S.aim + S.wind + U.gauss() * sigma;
      const long = p >= needMin();
      const good = long && Math.abs(lateral) < hw();
      const tx = 480 + lateral;
      const crossbar = BASE_Y - ph() * 0.4;
      const ty = long ? crossbar - 38 - (p - needMin()) * 60 : crossbar + 46 + (needMin() - p) * 160;
      S.ball = { u: 0, x0: 480, y0: 520, x1: tx, y1: ty, good, long, lateral, dur: 0.95 + S.dist * 0.006 };
      S.phase = 'flight'; S.swing = 0.4;
      TS.sfx.hit();
    }

    function after() {
      S.kick++;
      const roundsDone = Math.floor(S.kick / 2);
      if (S.kick % 2 === 0 && roundsDone >= DISTS.length) {
        if (S.scores[0] !== S.scores[1] || ++S.extra >= 3) return finish();
      }
      begin();
    }
    function finish() {
      S.state = 'over'; S.t = 0;
      S.msg = { text: 'FINAL', sub: S.scores[0] + ' – ' + S.scores[1], t: 99 };
    }

    function update(dt) {
      S.t += dt; S.swing = Math.max(0, S.swing - dt);
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) { begin(); } return; }
      if (S.state === 'over') {
        if (S.t > 1.6 && !g.over) {
          g.over = true;
          g.result = { winner: S.scores[0] === S.scores[1] ? null : (S.scores[0] > S.scores[1] ? 0 : 1), scores: S.scores.slice(), summary: 'Field goals — Henry ' + S.scores[0] + ', Theo ' + S.scores[1] };
        }
        return;
      }
      const human = P[S.cur].human;
      const pad = TS.input.pad(S.cur);
      if (S.phase === 'aim') {
        S.cpuT += dt;
        if (human) {
          S.aim = U.clamp(S.aim + pad.x * 110 * dt, -100, 100);
          if (S.cpuT > 0.5 && pad.actP) { S.phase = 'power'; S.powT = 0; TS.sfx.click(); }
        } else {
          S.aim += (S.cpu.aim - S.aim) * Math.min(1, dt * 3);
          if (S.cpuT > 1.4) { S.phase = 'power'; S.powT = 0; }
        }
      } else if (S.phase === 'power') {
        S.powT += dt;
        if (human) {
          S.power = U.tri(S.powT / 0.7);
          if (pad.actP) kick();
        } else {
          S.power = S.cpu.power * U.clamp(S.powT / 0.55, 0, 1);
          if (S.powT > 0.65) { S.power = S.cpu.power; kick(); }
        }
      } else if (S.phase === 'flight') {
        const b = S.ball;
        b.u = Math.min(1, b.u + dt / b.dur);
        if (b.u >= 1 && S.phase === 'flight') {
          S.phase = 'result'; S.t = 0;
          if (b.good) {
            S.scores[S.cur] += 3; S.results[S.cur].push(true);
            S.msg = { text: 'IT’S GOOD!', sub: '+3', t: 1.5 }; TS.sfx.goal();
          } else {
            S.results[S.cur].push(false);
            S.msg = { text: b.long ? (b.lateral < 0 ? 'WIDE LEFT' : 'WIDE RIGHT') : 'SHORT', sub: '', t: 1.4 }; TS.sfx.thud();
          }
        }
      } else if (S.phase === 'result') {
        if (S.t > 1.7) after();
      }
    }

    // ---------- drawing ----------
    function drawField(g) {
      const sky = g.createLinearGradient(0, 0, 0, BASE_Y);
      sky.addColorStop(0, '#4a7fd1'); sky.addColorStop(1, '#bfe0ff');
      g.fillStyle = sky; g.fillRect(0, 0, 960, BASE_Y);
      // stands
      for (let r = 0; r < 5; r++) {
        for (let i = 0; i < 68; i++) {
          g.fillStyle = ['#e63946', '#fcbf49', '#f1faee', '#4cc9f0', '#8338ec', '#ff70a6'][(i * 7 + r * 3) % 6];
          g.globalAlpha = 0.55; g.beginPath(); g.arc(i * 14.5 + (r % 2) * 7, 240 + r * 22 + Math.sin(S.t * 3 + i) * 1.2, 6, 0, TAU); g.fill();
        }
      }
      g.globalAlpha = 1;
      g.fillStyle = '#26324f'; g.fillRect(0, BASE_Y - 22, 960, 24);
      // grass in perspective
      g.fillStyle = '#3d8b40'; g.beginPath(); g.moveTo(0, BASE_Y); g.lineTo(960, BASE_Y); g.lineTo(960, 600); g.lineTo(0, 600); g.fill();
      for (let i = 0; i < 12; i++) {
        const y0 = BASE_Y + Math.pow(i / 12, 1.6) * 248, y1 = BASE_Y + Math.pow((i + 1) / 12, 1.6) * 248;
        g.fillStyle = i % 2 ? '#43964a' : '#3a8640'; g.fillRect(0, y0, 960, y1 - y0 + 1);
      }
      g.strokeStyle = '#ffffff99'; g.lineWidth = 3;
      for (let i = 1; i <= 4; i++) { const y = BASE_Y + Math.pow(i / 5, 1.6) * 248; g.beginPath(); g.moveTo(0, y); g.lineTo(960, y); g.stroke(); }
    }
    function drawPosts(g) {
      const w = hw(), h = ph(), cb = BASE_Y - h * 0.4;
      g.strokeStyle = '#ffd23f'; g.lineWidth = Math.max(4, 160 / S.dist); g.lineCap = 'round';
      g.beginPath();
      g.moveTo(480, BASE_Y + 6); g.lineTo(480, cb);
      g.moveTo(480 - w, cb); g.lineTo(480 + w, cb);
      g.moveTo(480 - w, cb); g.lineTo(480 - w, BASE_Y - h);
      g.moveTo(480 + w, cb); g.lineTo(480 + w, BASE_Y - h);
      g.stroke();
    }
    function drawBall(g, x, y, s) {
      g.fillStyle = 'rgba(0,0,0,.25)';
      if (!S.ball || S.ball.u === 0) { g.beginPath(); g.ellipse(x, y + 14 * s, 18 * s, 5 * s, 0, 0, TAU); g.fill(); }
      g.save(); g.translate(x, y); g.rotate(S.ball ? S.ball.u * 9 : -0.4); g.scale(s, s);
      g.fillStyle = '#8b4513'; g.beginPath(); g.ellipse(0, 0, 18, 10, 0, 0, TAU); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, 0); g.lineTo(6, 0); g.moveTo(-3, -3); g.lineTo(-3, 3); g.moveTo(0, -3); g.lineTo(0, 3); g.moveTo(3, -3); g.lineTo(3, 3); g.stroke();
      g.beginPath(); g.ellipse(0, 0, 11, 10, 0, 0.5, Math.PI - 0.5); g.stroke();
      g.restore();
    }
    function drawWind(g) {
      U.panel(g, 14, 90, 150, 70, 14);
      U.text(g, 'WIND', 28, 108, 13, '#ffffffaa');
      const mph = Math.abs(S.wind);
      U.text(g, Math.round(mph / 3) + ' mph', 28, 138, 20, '#fff');
      g.strokeStyle = '#4cc9f0'; g.fillStyle = '#4cc9f0'; g.lineWidth = 5; g.lineCap = 'round';
      const dir = Math.sign(S.wind) || 1, len = 8 + Math.min(40, mph * 0.5);
      const cx = 118, cy = 130 + Math.sin(S.t * 4) * 1.5;
      g.beginPath(); g.moveTo(cx - dir * len / 2, cy); g.lineTo(cx + dir * len / 2, cy); g.stroke();
      g.beginPath(); g.moveTo(cx + dir * (len / 2 + 9), cy); g.lineTo(cx + dir * (len / 2 - 1), cy - 7); g.lineTo(cx + dir * (len / 2 - 1), cy + 7); g.fill();
    }
    function draw(g) {
      drawField(g);
      drawPosts(g);
      // aim marker on the grass
      if (S.state === 'play' && (S.phase === 'aim' || S.phase === 'power')) {
        const ax = 480 + S.aim * (0.3 + 0.7 * 1);
        g.strokeStyle = '#fcbf49'; g.lineWidth = 3; g.setLineDash([3, 9]);
        g.beginPath(); g.moveTo(480, 520); g.lineTo(480 + S.aim, BASE_Y - 20); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#fcbf49'; g.beginPath(); g.moveTo(480 + S.aim, BASE_Y - 38); g.lineTo(480 + S.aim - 9, BASE_Y - 20); g.lineTo(480 + S.aim + 9, BASE_Y - 20); g.fill();
      }
      // kicker + sideline partner
      const k = P[S.cur], o = P[1 - S.cur];
      TS.chars.draw(g, o.who, o.outfit, { x: 90, y: 590, scale: 1.0, t: S.t + 1, cheer: S.state === 'play' && S.phase === 'result' && S.ball && S.ball.good && false });
      TS.chars.draw(g, k.who, k.outfit, { x: 410, y: 548, scale: 1.2, t: S.t, arm: S.swing > 0 ? 1.8 : 0, moving: S.swing > 0 });
      // ball
      if (S.ball && S.phase !== 'aim') {
        const b = S.ball, u = b.u;
        const x = U.lerp(b.x0, b.x1, u), y = U.lerp(b.y0, b.y1, u) - 4 * 150 * u * (1 - u);
        drawBall(g, x, y, U.lerp(1.05, 0.26, u));
      } else if (S.state !== 'over') drawBall(g, 480, 530, 1.05);
      drawWind(g);
      U.scoreboard(g, S.scores, Math.min(5, Math.floor(S.kick / 2) + 1) + '/5', S.state === 'play' ? S.cur : -1);
      // tally
      for (let i = 0; i < 2; i++) S.results[i].forEach((ok, n) => { g.fillStyle = ok ? '#6a994e' : '#e63946'; g.beginPath(); g.arc(30 + n * 22, 186 + i * 24, 8, 0, TAU); g.fill(); U.text(g, ok ? '✓' : '✗', 30 + n * 22, 186 + i * 24, 11, '#fff', 'center'); });
      if (S.state === 'play') {
        const human = P[S.cur].human;
        if (S.phase === 'aim') U.hint(g, human ? '◀ ▶ aim into the wind · Action to start the kick meter' : U.NAMES[S.cur] + ' lines up the kick…');
        else if (S.phase === 'power') {
          U.meter(g, 330, 552, 300, 20, S.power, [needMin(), Math.min(1, sweet() + 0.07)], human ? 'KICK POWER · Action in the green' : 'KICK POWER');
        }
      }
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 150, '#fcbf49');
    }

    const g = {
      title: '🏈 Field Goals',
      help: [
        'Five field-goal kicks each, from farther and farther away. A good kick is worth <b>3 points</b>.',
        '<b>◀ ▶</b> aim — the <b>wind</b> will push the ball sideways, so aim into it! Then press <b>Action</b> to start the kick meter and press again inside the <b>green zone</b>.',
        'Too weak and it falls short; too hard and it gets wild.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.football = create;
})();
