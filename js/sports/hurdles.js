// Hurdles: a 100 m race. Alternate left/right to sprint, press Action to jump.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const LEN = 100, PX = 62;
  const HURDLES = [18, 30, 42, 54, 66, 78, 90];
  const LANES = [250, 430];
  const AIR = 0.55;

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, cd: 3.4, time: 0, cam: [0, 0], msg: null, done: 0, finishT: 0,
      r: P.map((p, i) => ({
        idx: i, x: 0, v: 0, lastDir: 0, steps: 0, air: -1, stumble: 0, next: 0, finished: false, ft: 0,
        cpuStep: U.rnd(0.1, 0.2), cpuSkill: U.rnd(0.9, 1.05), cpuJump: null, flash: null, t: Math.random() * 3,
      })),
    };
    S.msg = { text: 'HURDLES', sub: 'First to 100 m', t: 1.6 };

    function jump(r) {
      if (r.air >= 0 || r.stumble > 0) return;
      r.air = 0; TS.sfx.swish();
    }
    function step(r) { r.v += 0.52; r.steps++; }

    function passHurdle(r) {
      const t = r.air;
      if (t >= 0 && t >= 0.12 && t <= 0.44) { r.v += 0.4; r.flash = { text: 'CLEAN', t: 0.7, c: '#6a994e' }; }
      else if (t >= 0) { r.v *= 0.62; r.flash = { text: 'CLIPPED', t: 0.8, c: '#fcbf49' }; TS.sfx.thud(); }
      else { r.v *= 0.3; r.stumble = 0.55; r.flash = { text: 'CRASH!', t: 0.9, c: '#e63946' }; TS.sfx.hit(); }
    }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      S.r.forEach((r) => { r.t += dt; if (r.flash) { r.flash.t -= dt; if (r.flash.t <= 0) r.flash = null; } });
      if (S.state === 'intro') { if (S.t > 1.7) { S.state = 'count'; S.cd = 3.2; } return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd);
        S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'race'; S.time = 0; TS.sfx.go(); }
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) {
          const w = S.r[0].ft === S.r[1].ft ? null : (S.r[0].ft < S.r[1].ft ? 0 : 1);
          g.over = true;
          g.result = { winner: w, scores: S.r.map((r) => r.ft), summary: 'Times — Henry ' + S.r[0].ft.toFixed(2) + 's, Theo ' + S.r[1].ft.toFixed(2) + 's' };
        }
        return;
      }
      S.time += dt;
      S.r.forEach((r, i) => {
        if (r.finished) { r.v *= Math.exp(-3 * dt); r.x += r.v * dt; return; }
        const human = P[i].human;
        r.stumble = Math.max(0, r.stumble - dt);
        if (r.air >= 0) { r.air += dt; if (r.air > AIR) r.air = -1; }
        if (human) {
          const pad = TS.input.pad(i);
          const dir = pad.x;
          if (dir !== 0 && dir !== r.lastDir && r.stumble <= 0) step(r);
          if (dir !== 0) r.lastDir = dir;
          if (pad.actP) jump(r);
        } else {
          r.cpuStep -= dt;
          if (r.cpuStep <= 0 && r.stumble <= 0) { step(r); r.cpuStep = (0.165 + U.rnd(0, 0.05)) / r.cpuSkill; }
          const nh = HURDLES[r.next];
          if (nh !== undefined) {
            if (r.cpuJump === null) r.cpuJump = (r.v * 0.27) + U.gauss() * 0.9 + (Math.random() < 0.12 ? 2.8 : 0);
            if (nh - r.x <= r.cpuJump) { jump(r); r.cpuJump = null; }
          }
        }
        r.v = Math.max(0, r.v - (0.37 * r.v + (r.stumble > 0 ? 6 : 0)) * dt);
        const prev = r.x;
        r.x += r.v * dt;
        while (HURDLES[r.next] !== undefined && prev < HURDLES[r.next] && r.x >= HURDLES[r.next]) { passHurdle(r); r.next++; }
        if (r.x >= LEN && !r.finished) {
          r.finished = true; r.ft = S.time - (r.x - LEN) / Math.max(1, r.v);
          S.done++;
          if (S.done === 1) { S.msg = { text: U.NAMES[i].toUpperCase() + ' WINS!', sub: r.ft.toFixed(2) + ' s', t: 99 }; TS.sfx.goal(); S.finishT = 0; }
        }
      });
      if (S.done >= 1) { S.finishT += dt; }
      if (S.done >= 2 || (S.done === 1 && S.finishT > 1.6)) {
        S.r.forEach((r) => { if (!r.finished) r.ft = S.time + (LEN - r.x) / 6; });
        S.state = 'over'; S.t = 0;
      }
      // each lane has its own camera, so both tracks stay on screen whoever is ahead
      S.r.forEach((r, i) => {
        const camT = U.clamp(r.x * PX - 300, 0, LEN * PX - 560);
        S.cam[i] += (camT - S.cam[i]) * Math.min(1, dt * 8);
      });
    }

    // ---------- drawing ----------
    function sx(m, i) { return m * PX - S.cam[i] + 120; }
    function drawTrack(g) {
      const sky = g.createLinearGradient(0, 0, 0, 150);
      sky.addColorStop(0, '#5aa9e6'); sky.addColorStop(1, '#cfeaff');
      g.fillStyle = sky; g.fillRect(0, 0, 960, 150);
      for (let i = 0; i < 80; i++) {
        const x = ((i * 15 - Math.max(S.cam[0], S.cam[1]) * 0.3) % 1200 + 1200) % 1200 - 120;
        g.fillStyle = ['#e63946', '#fcbf49', '#f1faee', '#4cc9f0', '#ff70a6'][i % 5]; g.globalAlpha = 0.7;
        g.beginPath(); g.arc(x, 100 + (i % 4) * 11, 6, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#26324f'; g.fillRect(0, 150, 960, 30);
      g.fillStyle = '#3d8b40'; g.fillRect(0, 180, 960, 420);
      for (let i = 0; i < 2; i++) {
        const y = LANES[i];
        g.fillStyle = '#c8553d'; g.fillRect(0, y - 96, 960, 130);
        g.fillStyle = '#d6644a'; g.fillRect(0, y - 96, 960, 8);
        g.fillStyle = '#ffffffcc'; g.fillRect(0, y - 98, 960, 4); g.fillRect(0, y + 32, 960, 4);
      }
      for (let i = 0; i < 2; i++) {
        const y = LANES[i];
        for (let m = 0; m <= LEN; m += 10) {
          const x = sx(m, i);
          if (x < -40 || x > 1000) continue;
          g.fillStyle = '#ffffff88'; g.fillRect(x - 1, y - 96, 2, 14);
          U.text(g, m + 'm', x, y - 74, 12, '#ffffffcc', 'center');
        }
        const fx = sx(LEN, i);
        for (let r = 0; r < 13; r++) for (let c = 0; c < 2; c++) {
          g.fillStyle = (r + c) % 2 ? '#111' : '#fff';
          g.fillRect(fx + c * 10, y - 96 + r * 10, 10, 10);
        }
        U.panel(g, 10, y - 90, 118, 24, 12, '#0b132b99');
        U.text(g, U.NAMES[i].toUpperCase() + ' ' + Math.max(0, Math.min(LEN, S.r[i].x)).toFixed(0) + ' m', 22, y - 78, 13, U.TEAM[i]);
      }
    }
    function drawHurdle(g, x, y, i) {
      g.fillStyle = '#00000033'; g.beginPath(); g.ellipse(x, y, 14, 4, 0, 0, TAU); g.fill();
      g.strokeStyle = '#eee'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x - 8, y - 34); g.moveTo(x + 10, y); g.lineTo(x + 8, y - 34); g.stroke();
      g.fillStyle = i % 2 ? '#e63946' : '#fcbf49'; g.fillRect(x - 13, y - 40, 26, 8);
    }
    function draw(g) {
      drawTrack(g);
      for (let i = 0; i < 2; i++) {
        const r = S.r[i], y = LANES[i];
        HURDLES.forEach((h, k) => drawHurdle(g, sx(h, i), y + 14, k));
        const air = r.air >= 0 ? Math.sin((r.air / AIR) * Math.PI) * 52 : 0;
        const stumbling = r.stumble > 0;
        TS.chars.draw(g, P[i].who, P[i].outfit, {
          x: sx(r.x, i), y: y + 22, scale: 1.0, t: r.t * (0.4 + r.v * 0.18), moving: r.v > 0.6 && !stumbling,
          lift: air, arm: r.air >= 0 ? 1.0 : 0, mood: stumbling ? 'sad' : (r.finished ? 'cheer' : 'happy'), cheer: r.finished && !stumbling,
        });
        const px = sx(r.x, i);
        if (r.flash) U.text(g, r.flash.text, px, y - 92, 22, r.flash.c, 'center', 900);
        // next-hurdle cue for humans
        const nh = HURDLES[r.next];
        if (P[i].human && nh !== undefined && S.state === 'race' && nh - r.x < 7 && nh - r.x > 0 && r.air < 0) {
          U.text(g, 'JUMP!', sx(nh, i) - 10, y - 20, 16, '#fff', 'center', 900);
        }
      }
      // progress bar
      U.panel(g, 140, 8, 680, 40, 14);
      g.fillStyle = '#ffffff33'; g.fillRect(170, 26, 620, 4);
      S.r.forEach((r, i) => { g.fillStyle = U.TEAM[i]; g.beginPath(); g.arc(170 + 620 * U.clamp(r.x / LEN, 0, 1), 28, 7, 0, TAU); g.fill(); });
      U.text(g, S.state === 'race' || S.state === 'over' ? S.time.toFixed(1) + ' s' : '0.0 s', 836, 28, 16, '#fcbf49', 'left');
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'GO!', '', 330, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 330, '#fcbf49');
      if (S.state === 'count' || (S.state === 'race' && S.time < 4)) {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: A / D alternate · Space jump     Theo: ◀ ▶ alternate · Enter jump' : 'Alternate ◀ ▶ (or A / D) to sprint · Action to jump the hurdles');
      }
    }

    const g = {
      title: '🏃 Hurdles',
      help: [
        'A 100-metre race with seven hurdles. First across the line wins!',
        '<b>Tap left and right back and forth</b> as fast as you can to sprint — mashing the same key does nothing.',
        'Press <b>Action</b> a moment before each hurdle to jump it. Jump too early or late and you clip it; don’t jump at all and you crash!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.hurdles = create;
})();
