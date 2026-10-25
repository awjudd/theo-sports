// Long drive: three swings each. Time the power, then time the accuracy. Farthest total wins.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const GROUND = 470, PXY = 2.6, TEE = 120; // screen px per yard, tee x
  const DRIVES = 3;

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, drive: 0, cur: 0, totals: [0, 0], drives: [[], []], phase: 'power', powT: 0, accT: 0, power: 0, acc: 0.5, ball: null, wind: 0,
      msg: null, cpu: null, cpuT: 0, cam: 0, trail: [], marks: [], endT: 0, swingT: 0,
    };
    S.msg = { text: 'LONG DRIVE', sub: 'Three swings each', t: 1.6 };

    function begin() {
      S.cur = S.drive % 2; S.phase = 'power'; S.powT = 0; S.accT = 0; S.power = 0; S.acc = 0.5; S.ball = null; S.cam = 0; S.trail = []; S.cpuT = 0; S.state = 'play'; S.swingT = 0;
      S.wind = Math.round(U.rnd(-12, 12));
      if (!P[S.cur].human) S.cpu = { p: U.clamp(0.86 + U.gauss() * 0.07, 0.4, 0.99), a: 0.5 + U.gauss() * 0.14, wait: U.rnd(0.8, 1.3) };
      S.msg = { text: U.NAMES[S.cur], sub: 'Drive ' + (Math.floor(S.drive / 2) + 1) + ' of ' + DRIVES, t: 1.0 };
    }

    function swing() {
      const err = (S.acc - 0.5) * 2;           // -1 hook … +1 slice
      const over = S.power > 0.95 ? 0.25 : 0;
      const e = Math.abs(err) + over;
      let yards = (70 + 260 * S.power) * (1 - 0.32 * Math.min(1, e)) + S.wind * 0.9;
      let tag = e < 0.12 ? 'PERFECT STRIKE' : (e < 0.35 ? 'NICE DRIVE' : (err < 0 ? 'HOOK' : 'SLICE'));
      if (e > 0.78) { yards = Math.max(30, yards * 0.35); tag = 'OUT OF BOUNDS!'; }
      yards = Math.max(20, Math.round(yards));
      S.ball = { u: 0, yards, tag, e, side: err, dur: 1.5 + yards / 190 };
      S.phase = 'flight'; S.swingT = 0.35;
      TS.sfx.hit();
    }

    function update(dt) {
      S.t += dt; S.swingT = Math.max(0, S.swingT - dt);
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) begin(); return; }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) { g.over = true; g.result = { winner: S.totals[0] === S.totals[1] ? null : (S.totals[0] > S.totals[1] ? 0 : 1), scores: S.totals.slice(), summary: 'Total distance — Henry ' + S.totals[0] + ' yd, Theo ' + S.totals[1] + ' yd' }; }
        return;
      }
      const human = P[S.cur].human, pad = TS.input.pad(S.cur);
      if (S.phase === 'power') {
        S.cpuT += dt;
        if (human) { if (S.cpuT > 0.4) { S.powT += dt; S.power = U.tri(S.powT / 0.8); if (pad.actP) { S.phase = 'acc'; S.accT = 0; TS.sfx.click(); } } }
        else { S.powT += dt; S.power = S.cpu.p * U.clamp(S.powT / 0.7, 0, 1); if (S.cpuT > S.cpu.wait + 0.8) { S.power = S.cpu.p; S.phase = 'acc'; S.accT = 0; } }
      } else if (S.phase === 'acc') {
        S.accT += dt;
        if (human) { S.acc = U.tri(S.accT / 0.55); if (pad.actP) swing(); }
        else { S.acc += (S.cpu.a - S.acc) * Math.min(1, dt * 8); if (S.accT > 0.55) { S.acc = S.cpu.a; swing(); } }
      } else if (S.phase === 'flight') {
        const b = S.ball;
        b.u = Math.min(1, b.u + dt / b.dur);
        const wx = TEE + b.yards * PXY * b.u;
        const wy = GROUND - 12 - Math.sin(b.u * Math.PI) * (60 + b.yards * 0.55);
        S.trail.push([wx, wy]); if (S.trail.length > 40) S.trail.shift();
        S.cam += (Math.max(0, wx - 420) - S.cam) * Math.min(1, dt * 6);
        if (b.u >= 1) {
          S.drives[S.cur].push(b.yards); S.totals[S.cur] += b.yards;
          S.marks.push({ x: TEE + b.yards * PXY, idx: S.cur, y: b.yards });
          S.msg = { text: b.yards + ' YARDS', sub: b.tag, t: 1.5 };
          if (b.tag === 'OUT OF BOUNDS!') TS.sfx.beep(); else if (b.e < 0.12) TS.sfx.goal(); else TS.sfx.thud();
          S.phase = 'result'; S.endT = 1.8;
        }
      } else if (S.phase === 'result') {
        S.endT -= dt;
        S.cam += (Math.max(0, TEE + S.ball.yards * PXY - 420) - S.cam) * Math.min(1, dt * 3);
        if (S.endT <= 0) {
          S.drive++;
          if (S.drive >= DRIVES * 2) { S.state = 'over'; S.t = 0; S.msg = { text: 'FINAL', sub: S.totals[0] + ' – ' + S.totals[1] + ' yd', t: 99 }; }
          else begin();
        }
      }
    }

    function draw(g) {
      const cam = S.cam;
      const sky = g.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#4aa3e8'); sky.addColorStop(1, '#cdeeff');
      g.fillStyle = sky; g.fillRect(0, 0, 960, GROUND);
      g.fillStyle = '#ffffffaa'; for (const [x, y, r] of [[200, 110, 34], [250, 104, 26], [640, 150, 32], [700, 142, 24]]) { const xx = ((x - cam * 0.2) % 1100 + 1100) % 1100 - 70; g.beginPath(); g.arc(xx, y, r, 0, TAU); g.fill(); }
      // hills + trees (parallax)
      g.fillStyle = '#7fb77e'; g.beginPath(); g.moveTo(0, 400); for (let x = 0; x <= 960; x += 40) g.lineTo(x, 380 - Math.sin((x + cam * 0.4) * 0.008) * 24 - Math.sin((x + cam * 0.4) * 0.021) * 10); g.lineTo(960, 470); g.lineTo(0, 470); g.fill();
      g.fillStyle = '#3d8b40'; g.fillRect(0, GROUND, 960, 130);
      for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#43964a' : '#3a8640'; g.fillRect(0, GROUND + i * 10, 960, 5); }
      // yard markers
      for (let y = 0; y <= 400; y += 50) {
        const x = TEE + y * PXY - cam;
        if (x < -20 || x > 980) continue;
        g.fillStyle = '#fff'; g.fillRect(x - 1, GROUND - 2, 2, 22);
        U.text(g, y + 'y', x, GROUND + 38, 13, '#fff', 'center');
      }
      // distance flags of previous drives
      S.marks.forEach((m) => {
        const x = m.x - cam; if (x < -10 || x > 970) return;
        g.strokeStyle = '#ddd'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, GROUND); g.lineTo(x, GROUND - 46); g.stroke();
        g.fillStyle = U.TEAM[m.idx]; g.beginPath(); g.moveTo(x, GROUND - 46); g.lineTo(x + 20, GROUND - 40); g.lineTo(x, GROUND - 34); g.fill();
      });
      // golfer + tee
      const p = P[S.cur];
      const tx = TEE - cam;
      g.fillStyle = '#ffffff'; g.fillRect(tx - 2, GROUND - 8, 4, 8);
      const back = S.phase === 'power' || S.phase === 'acc';
      TS.chars.draw(g, p.who, p.outfit, { x: tx - 46, y: GROUND + 22, scale: 1.45, t: S.t, arm: S.swingT > 0 ? 2.4 : (back ? 0.4 : 1.0), facing: 1 });
      g.strokeStyle = '#555'; g.lineWidth = 4; g.lineCap = 'round';
      const ang = S.swingT > 0 ? 0.7 : (back ? -2.1 : 0.3);
      g.beginPath(); g.moveTo(tx - 30, GROUND - 38); g.lineTo(tx - 30 + Math.cos(ang) * 70, GROUND - 38 + Math.sin(ang) * 70); g.stroke();
      const o = P[1 - S.cur];
      TS.chars.draw(g, o.who, o.outfit, { x: tx - 130, y: GROUND + 40, scale: 1.0, t: S.t + 1, facing: 1 });
      // ball
      if (S.ball && (S.phase === 'flight' || S.phase === 'result')) {
        const b = S.ball;
        g.strokeStyle = '#ffffff66'; g.lineWidth = 3; g.beginPath(); S.trail.forEach(([x, y], i) => (i ? g.lineTo(x - cam, y) : g.moveTo(x - cam, y))); g.stroke();
        const wx = TEE + b.yards * PXY * b.u, wy = GROUND - 12 - Math.sin(b.u * Math.PI) * (60 + b.yards * 0.55);
        g.fillStyle = '#0003'; g.beginPath(); g.ellipse(wx - cam, GROUND + 8, 7, 3, 0, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(wx - cam, wy, 6, 0, TAU); g.fill(); g.strokeStyle = '#ccc'; g.lineWidth = 1; g.stroke();
      } else g.fillStyle = '#fff', g.beginPath(), g.arc(tx, GROUND - 12, 6, 0, TAU), g.fill();
      // HUD
      U.scoreboard(g, S.totals, Math.min(DRIVES, Math.floor(S.drive / 2) + 1) + '/' + DRIVES, S.state === 'play' ? S.cur : -1);
      U.panel(g, 14, 90, 150, 56, 12);
      U.text(g, 'WIND', 26, 106, 12, '#ffffffaa');
      U.text(g, (S.wind === 0 ? 'calm' : Math.abs(S.wind) + ' mph ' + (S.wind > 0 ? '▶ tail' : '◀ head')), 26, 128, 15, '#fff');
      for (let i = 0; i < 2; i++) S.drives[i].forEach((y, k) => U.text(g, y + 'y', 30 + k * 58, 176 + i * 24, 14, U.TEAM[i], 'left'));
      if (S.state === 'play') {
        const human = P[S.cur].human;
        if (S.phase === 'power') U.meter(g, 330, 548, 300, 22, S.power, [0.78, 0.94], human ? 'POWER · Action to lock it' : 'POWER');
        else if (S.phase === 'acc') { U.meter(g, 330, 548, 300, 22, S.acc, [0.46, 0.54], human ? 'ACCURACY · Action in the middle!' : 'ACCURACY'); }
      }
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 200, '#fcbf49');
    }

    const g = {
      title: '🏌️ Long Drive',
      help: [
        'Three drives each — whoever hits the farthest total distance wins!',
        'Press <b>Action</b> to start the power meter, then <b>Action</b> to lock it (more power goes farther, but don’t over-swing at the very end). Then the <b>accuracy</b> marker sweeps back and forth — press <b>Action</b> when it’s in the <b>middle</b> for a perfect strike.',
        'A hook or slice loses distance, and a really bad one goes out of bounds. Watch the wind!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.longdrive = create;
})();
