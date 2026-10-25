// Swimming: a 50 m freestyle race (two lengths). Alternate left/right to stroke; press Action to flip at the wall.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const POOL = { x: 70, w: 820, len: 25 };
  const PX = POOL.w / POOL.len;
  const LANE_Y = [250, 390];

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, cd: 3.2, time: 0, msg: null, done: 0, finishT: 0,
      r: P.map((p, i) => ({
        idx: i, d: 0, v: 0, step: U.stepper(), cpuT: U.rnd(0.1, 0.2), cpuSkill: U.rnd(0.9, 1.05), strokes: 0, arm: 0,
        turned: false, turnWait: 0, flipPress: -9, flash: null, finished: false, ft: 0, t: Math.random() * 3,
      })),
    };
    S.msg = { text: 'SWIMMING', sub: '50 m freestyle', t: 1.6 };
    const pos = (r) => (r.d <= POOL.len ? r.d : 2 * POOL.len - r.d); // metres along the pool, 0..25
    const dirOf = (r) => (r.d <= POOL.len ? 1 : -1);

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      S.r.forEach((r) => { r.t += dt; r.arm += dt * (3 + r.v * 2.2); if (r.flash) { r.flash.t -= dt; if (r.flash.t <= 0) r.flash = null; } });
      if (S.state === 'intro') { if (S.t > 1.7) { S.state = 'count'; S.cd = 3.2; } return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'race'; S.time = 0; TS.sfx.go(); }
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) {
          g.over = true;
          g.result = { winner: S.r[0].ft === S.r[1].ft ? null : (S.r[0].ft < S.r[1].ft ? 0 : 1), scores: S.r.map((r) => r.ft), summary: 'Times — Henry ' + S.r[0].ft.toFixed(2) + 's, Theo ' + S.r[1].ft.toFixed(2) + 's' };
        }
        return;
      }
      S.time += dt;
      S.r.forEach((r, i) => {
        if (r.finished) { r.v *= Math.exp(-3 * dt); r.d += r.v * dt; return; }
        const human = P[i].human;
        let stroked = false, flip = false;
        if (human) { const pad = TS.input.pad(i); stroked = r.step(pad.x) && r.turnWait <= 0; flip = pad.actP; }
        else {
          r.cpuT -= dt;
          if (r.cpuT <= 0 && r.turnWait <= 0) { stroked = true; r.cpuT = (0.2 + U.rnd(0, 0.06)) / r.cpuSkill; }
          if (!r.turned && r.d > POOL.len - 1.1 && r.flipPress < -5 && Math.random() < dt * 8) flip = true;
        }
        if (stroked) { r.v += 0.34; r.strokes++; }
        if (flip) r.flipPress = S.time;
        r.turnWait = Math.max(0, r.turnWait - dt);
        r.v = Math.max(0, r.v - (0.34 * r.v + (r.turnWait > 0 ? 3 : 0)) * dt);
        const prev = r.d;
        r.d += r.v * dt;
        // the wall at 25 m
        if (!r.turned && prev < POOL.len && r.d >= POOL.len) {
          r.turned = true;
          const dtp = S.time - r.flipPress; // time since the press (negative press = early)
          if (r.flipPress > -5 && dtp >= 0 && dtp <= 0.7) { r.v += 0.8; r.flash = { text: 'PERFECT TURN!', t: 0.9, c: '#6a994e' }; TS.sfx.win(); }
          else { r.v *= 0.35; r.turnWait = 0.5; r.flash = { text: 'SLOW TURN', t: 0.9, c: '#fcbf49' }; TS.sfx.thud(); }
        }
        if (r.d >= 2 * POOL.len && !r.finished) {
          r.finished = true; r.ft = S.time - (r.d - 2 * POOL.len) / Math.max(1, r.v); S.done++;
          if (S.done === 1) { S.msg = { text: U.NAMES[i].toUpperCase() + ' WINS!', sub: r.ft.toFixed(2) + ' s', t: 99 }; TS.sfx.goal(); S.finishT = 0; }
        }
      });
      if (S.done >= 1) S.finishT += dt;
      if (S.done >= 2 || (S.done === 1 && S.finishT > 1.6)) {
        S.r.forEach((r) => { if (!r.finished) r.ft = S.time + (2 * POOL.len - r.d) / 3; });
        S.state = 'over'; S.t = 0;
      }
    }

    function drawSwimmer(g, r, i) {
      const y = LANE_Y[i], m = pos(r), dir = dirOf(r);
      const x = POOL.x + m * PX;
      const flipping = r.turnWait > 0;
      g.save(); g.translate(x, y); g.scale(dir, 1);
      // wake
      g.strokeStyle = '#ffffffaa'; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(-18 - k * 12, 0, 6 + k * 4, -1.2, 1.2); g.stroke(); }
      // body
      g.fillStyle = flipping ? '#ffffff55' : '#00000022'; g.beginPath(); g.ellipse(-6, 4, 30, 10, 0, 0, TAU); g.fill();
      g.fillStyle = U.TEAM[i]; g.beginPath(); g.ellipse(-8, 0, 26, 9, 0, 0, TAU); g.fill();
      // arms
      const a1 = Math.sin(r.arm) * 1.1, a2 = Math.sin(r.arm + Math.PI) * 1.1;
      g.strokeStyle = P[i].outfit.skin; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(8, -6); g.lineTo(8 + Math.cos(a1 - 0.5) * 24, -6 + Math.sin(a1 - 0.5) * 20 - 6); g.stroke();
      g.beginPath(); g.moveTo(8, 6); g.lineTo(8 + Math.cos(a2 - 0.5) * 24, 6 + Math.sin(a2 + 0.5) * 20 + 6); g.stroke();
      // head with cap + goggles
      g.fillStyle = P[i].outfit.skin; g.beginPath(); g.arc(24, 0, 11, 0, TAU); g.fill();
      g.fillStyle = U.TEAM[i]; g.beginPath(); g.arc(24, 0, 11, Math.PI * 0.5, Math.PI * 1.5, true); g.fill();
      g.fillStyle = '#9ad8ff'; g.fillRect(31, -5, 4, 10);
      g.restore();
      // splash
      if (r.v > 0.5) {
        for (let k = 0; k < 4; k++) { g.fillStyle = '#ffffffaa'; g.beginPath(); g.arc(x + dir * (30 + Math.sin(r.arm * 2 + k) * 8), y + (k - 1.5) * 6, 2, 0, TAU); g.fill(); }
      }
      if (r.flash) U.text(g, r.flash.text, x, y - 42, 20, r.flash.c, 'center', 900);
    }
    function draw(g) {
      g.fillStyle = '#d9c9a8'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#d1c19f' : '#dccdae'; g.fillRect(i * 40, 0, 40, 600); }
      // crowd
      for (let i = 0; i < 70; i++) { g.fillStyle = ['#e63946', '#fcbf49', '#3a86ff', '#6a994e', '#8338ec'][i % 5]; g.globalAlpha = 0.7; g.beginPath(); g.arc(i * 14 + 6, 40 + (i % 3) * 14, 6, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      // pool
      g.fillStyle = '#0d6fa8'; U.panel(g, POOL.x - 14, 110, POOL.w + 28, 400, 10, '#f5f5f5');
      const water = g.createLinearGradient(0, 120, 0, 500);
      water.addColorStop(0, '#3fb7ee'); water.addColorStop(1, '#1d86c8');
      g.fillStyle = water; g.fillRect(POOL.x, 120, POOL.w, 380);
      // lane ropes
      for (const y of [185, 320, 455]) {
        for (let x = POOL.x; x < POOL.x + POOL.w; x += 18) { g.fillStyle = (x / 18) % 2 ? '#e63946' : '#fff'; g.beginPath(); g.arc(x + 9, y, 5, 0, TAU); g.fill(); }
      }
      // ripples
      g.strokeStyle = '#ffffff22'; g.lineWidth = 2;
      for (let k = 0; k < 14; k++) { const x = POOL.x + ((k * 97 + S.t * 18) % POOL.w), y = 135 + (k * 53) % 360; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 5, x + 20, y); g.stroke(); }
      // wall + turn marker
      g.fillStyle = '#fff'; g.fillRect(POOL.x + POOL.w - 4, 120, 4, 380);
      g.fillStyle = '#ffffff55'; g.fillRect(POOL.x + POOL.w - 60, 120, 4, 380);
      g.fillStyle = '#000'; g.fillRect(POOL.x + POOL.w - 4, 120, 4, 6);
      for (let i = 0; i < 2; i++) drawSwimmer(g, S.r[i], i);
      // progress
      U.panel(g, 140, 8, 680, 40, 14);
      g.fillStyle = '#ffffff33'; g.fillRect(170, 26, 620, 4);
      S.r.forEach((r, i) => { g.fillStyle = U.TEAM[i]; g.beginPath(); g.arc(170 + 620 * U.clamp(r.d / (2 * POOL.len), 0, 1), 28, 7, 0, TAU); g.fill(); });
      U.text(g, S.state === 'race' || S.state === 'over' ? S.time.toFixed(1) + ' s' : '0.0 s', 836, 28, 16, '#fcbf49', 'left');
      // turn cue
      S.r.forEach((r, i) => { if (P[i].human && S.state === 'race' && !r.turned && r.d > POOL.len - 5) U.text(g, 'FLIP TURN: press Action!', POOL.x + POOL.w - 110, LANE_Y[i] - 38, 18, '#fff', 'center', 900); });
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'GO!', '', 540, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 540, '#fcbf49');
      if (S.state === 'count' || (S.state === 'race' && S.time < 4)) {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: tap A / D · flip Space      Theo: tap ◀ ▶ · flip Enter' : 'Tap ◀ ▶ (or A / D) to swim · press Action at the wall to flip');
      }
    }

    const g = {
      title: '🏊 Swimming',
      help: [
        'A 50-metre freestyle: swim one length, flip at the wall, swim back. First to touch the wall wins!',
        '<b>Tap left and right back and forth</b> as fast as you can to stroke. When you reach the far wall, press <b>Action</b> just before touching for a speedy flip turn — miss it and you’ll lose time.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.swimming = create;
})();
