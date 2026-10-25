// Skiing: a downhill slalom. Steer left/right through the gates and dodge the trees.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const GATES = 14, GATE_GAP = 190, GATE_W = 150;
  const LANE_X = [240, 720], LANE_W = 400;

  function course() {
    const gates = [], trees = [];
    let cx = 0;
    for (let i = 0; i < GATES; i++) {
      cx = U.clamp(cx + U.rnd(-120, 120), -130, 130);
      gates.push({ y: 500 + i * GATE_GAP, x: cx });
    }
    for (let i = 0; i < 26; i++) {
      const y = 380 + Math.random() * (GATES * GATE_GAP - 100);
      const x = (Math.random() < 0.5 ? -1 : 1) * U.rnd(90, 185);
      // keep trees out of the gates themselves
      const g = gates.find((q) => Math.abs(q.y - y) < 60);
      if (g && Math.abs(x - g.x) < GATE_W / 2 + 36) continue;
      trees.push({ x, y });
    }
    return { gates, trees, length: 500 + GATES * GATE_GAP + 300 };
  }

  function create(ctx) {
    const P = ctx.players;
    const C = course();
    const S = {
      state: 'intro', t: 0, cd: 3.2, time: 0, msg: null, done: 0, finishT: 0,
      r: P.map((p, i) => ({
        idx: i, x: 0, y: 0, vy: 0, vx: 0, penalty: 0, next: 0, stun: 0, flash: null, finished: false, ft: 0, t: Math.random() * 3,
        ai: { tx: 0 }, missed: 0, hit: 0,
      })),
    };
    S.msg = { text: 'SLALOM', sub: 'Through the gates!', t: 1.6 };

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      S.r.forEach((r) => { r.t += dt; if (r.flash) { r.flash.t -= dt; if (r.flash.t <= 0) r.flash = null; } });
      if (S.state === 'intro') { if (S.t > 1.7) { S.state = 'count'; S.cd = 3.2; } return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'race'; S.time = 0; TS.sfx.go(); }
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) {
          const tt = S.r.map((r) => r.ft + r.penalty);
          g.over = true; g.result = { winner: tt[0] === tt[1] ? null : (tt[0] < tt[1] ? 0 : 1), scores: tt, summary: 'Times (with penalties) — Henry ' + tt[0].toFixed(2) + 's, Theo ' + tt[1].toFixed(2) + 's' };
        }
        return;
      }
      S.time += dt;
      S.r.forEach((r, i) => {
        if (r.finished) { r.vy *= Math.exp(-2 * dt); r.y += r.vy * dt; return; }
        r.stun = Math.max(0, r.stun - dt);
        let steer = 0;
        if (P[i].human) steer = TS.input.pad(i).x;
        else {
          const gt = C.gates[r.next];
          let tx = gt ? gt.x : 0;
          if (r.ai.jit === undefined || Math.random() < dt) r.ai.jit = U.rnd(-30, 38);
          tx += r.ai.jit;
          // dodge trees ahead
          for (const t of C.trees) if (t.y > r.y && t.y - r.y < 170 && Math.abs(t.x - r.x) < 40) tx = r.x + (r.x >= t.x ? 60 : -60);
          steer = Math.abs(tx - r.x) > 8 ? Math.sign(tx - r.x) * 0.95 : 0;
        }
        const tvx = steer * 260;
        r.vx += (tvx - r.vx) * Math.min(1, dt * 7);
        r.x = U.clamp(r.x + r.vx * dt, -190, 190);
        // speed builds up, scrubbed by sharp turns and stuns
        const target = r.stun > 0 ? 80 : 360 - Math.abs(r.vx) * 0.22;
        r.vy += (target - r.vy) * Math.min(1, dt * 1.6);
        r.y += r.vy * dt;
        // trees
        for (const t of C.trees) {
          if (Math.abs(t.y - r.y) < 22 && Math.abs(t.x - r.x) < 26 && r.stun <= 0) {
            r.stun = 0.7; r.hit++; r.flash = { text: 'CRASH!', t: 0.8, c: '#e63946' }; r.vy *= 0.25; TS.sfx.thud();
          }
        }
        // gates
        const gt = C.gates[r.next];
        if (gt && r.y >= gt.y) {
          const ok = Math.abs(r.x - gt.x) < GATE_W / 2;
          if (ok) { r.flash = { text: 'GATE ✓', t: 0.5, c: '#6a994e' }; r.vy += 14; TS.sfx.tone(700, 0.08, 'triangle', 0.08); }
          else { r.penalty += 1.5; r.missed++; r.flash = { text: 'MISSED +1.5s', t: 0.9, c: '#fcbf49' }; TS.sfx.beep(); }
          r.next++;
        }
        if (r.y >= C.length - 120 && !r.finished) {
          r.finished = true; r.ft = S.time; S.done++;
          if (S.done === 1) { S.msg = { text: U.NAMES[i].toUpperCase() + ' IS DOWN!', sub: (r.ft + r.penalty).toFixed(2) + ' s', t: 99 }; TS.sfx.goal(); S.finishT = 0; }
        }
      });
      if (S.done >= 1) S.finishT += dt;
      if (S.done >= 2 || (S.done === 1 && S.finishT > 3)) {
        S.r.forEach((r) => { if (!r.finished) r.ft = S.time + (C.length - 120 - r.y) / 300; });
        S.state = 'over'; S.t = 0;
        const tt = S.r.map((r) => r.ft + r.penalty);
        S.msg = { text: tt[0] === tt[1] ? 'DEAD HEAT' : U.NAMES[tt[0] < tt[1] ? 0 : 1].toUpperCase() + ' WINS!', sub: 'with penalties: ' + tt[0].toFixed(2) + 's vs ' + tt[1].toFixed(2) + 's', t: 99 };
      }
    }

    function drawLane(g, i) {
      const r = S.r[i], cx = LANE_X[i], camY = r.y - 150;
      g.save(); g.beginPath(); g.rect(cx - LANE_W / 2, 70, LANE_W, 530); g.clip();
      g.fillStyle = '#f4f9ff'; g.fillRect(cx - LANE_W / 2, 70, LANE_W, 530);
      // snow texture
      g.fillStyle = '#dbe9f7';
      for (let k = 0; k < 40; k++) { const sy = ((k * 131 - camY * 0.9) % 560 + 560) % 560 + 70; g.fillRect(cx - LANE_W / 2 + ((k * 97) % LANE_W), sy, 26, 3); }
      const sx = (x) => cx + x, sy = (y) => 150 + (y - r.y) + 70;
      // finish line
      const fy = sy(C.length - 120);
      for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? '#111' : '#fff'; g.fillRect(cx - LANE_W / 2 + k * 25, fy, 25, 14); }
      // gates
      C.gates.forEach((gt, k) => {
        const y = sy(gt.y); if (y < 30 || y > 640) return;
        const passed = k < r.next;
        const col = k % 2 ? '#e63946' : '#3a86ff';
        for (const sgn of [-1, 1]) {
          const x = sx(gt.x + sgn * GATE_W / 2);
          g.strokeStyle = '#555'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x, y - 36); g.stroke();
          g.fillStyle = passed ? '#aaa' : col; g.beginPath(); g.moveTo(x, y - 36); g.lineTo(x + sgn * 24, y - 28); g.lineTo(x, y - 20); g.fill();
        }
        if (!passed) { g.strokeStyle = col + '55'; g.lineWidth = 2; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(sx(gt.x - GATE_W / 2), y); g.lineTo(sx(gt.x + GATE_W / 2), y); g.stroke(); g.setLineDash([]); }
      });
      // trees
      C.trees.forEach((t) => {
        const y = sy(t.y); if (y < 20 || y > 660) return;
        g.fillStyle = '#6b4423'; g.fillRect(sx(t.x) - 4, y - 4, 8, 14);
        g.fillStyle = '#1f6f3a'; g.beginPath(); g.moveTo(sx(t.x), y - 52); g.lineTo(sx(t.x) - 24, y + 2); g.lineTo(sx(t.x) + 24, y + 2); g.fill();
        g.fillStyle = '#2a8a49'; g.beginPath(); g.moveTo(sx(t.x), y - 34); g.lineTo(sx(t.x) - 20, y - 8); g.lineTo(sx(t.x) + 20, y - 8); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(sx(t.x), y - 52); g.lineTo(sx(t.x) - 9, y - 36); g.lineTo(sx(t.x) + 9, y - 36); g.fill();
      });
      // skier
      const flashing = r.stun > 0 && Math.floor(S.t * 18) % 2 === 0;
      g.fillStyle = '#0002'; g.beginPath(); g.ellipse(sx(r.x), 235, 18, 6, 0, 0, TAU); g.fill();
      if (!flashing) {
        g.save(); g.translate(sx(r.x), 235); g.rotate(U.clamp(r.vx / 700, -0.4, 0.4)); g.translate(-sx(r.x), -235);
        g.strokeStyle = U.TEAM[i]; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(sx(r.x) - 12, 214); g.lineTo(sx(r.x) - 12, 244); g.moveTo(sx(r.x) + 12, 214); g.lineTo(sx(r.x) + 12, 244); g.stroke();
        TS.chars.draw(g, P[i].who, P[i].outfit, { x: sx(r.x), y: 232, scale: 0.7, t: r.t, moving: false, arm: 0.9, mood: r.stun > 0 ? 'sad' : 'happy', cheer: r.finished });
        g.restore();
      }
      if (r.flash) U.text(g, r.flash.text, sx(r.x), 150, 22, r.flash.c, 'center', 900);
      g.restore();
      g.strokeStyle = U.TEAM[i]; g.lineWidth = 5; g.strokeRect(cx - LANE_W / 2, 70, LANE_W, 530);
      U.panel(g, cx - LANE_W / 2 + 8, 78, 190, 26, 13);
      U.text(g, U.NAMES[i].toUpperCase() + ' · gates ' + Math.min(r.next, GATES) + '/' + GATES, cx - LANE_W / 2 + 18, 91, 13, U.TEAM[i]);
      if (r.penalty) U.text(g, '+' + r.penalty.toFixed(1) + 's', cx + LANE_W / 2 - 14, 91, 14, '#e63946', 'right');
    }
    function draw(g) {
      g.fillStyle = '#8fb8de'; g.fillRect(0, 0, 960, 600);
      for (let k = 0; k < 18; k++) { g.fillStyle = '#ffffff55'; g.beginPath(); g.arc((k * 163 + S.t * 14) % 960, 30 + (k * 37) % 40, 3, 0, TAU); g.fill(); }
      drawLane(g, 0); drawLane(g, 1);
      U.panel(g, 380, 8, 200, 54, 14);
      U.text(g, S.state === 'race' || S.state === 'over' ? S.time.toFixed(1) + ' s' : '0.0 s', 480, 36, 24, '#fcbf49', 'center');
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'GO!', '', 300, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 300, '#fcbf49');
      if (S.state === 'count' || (S.state === 'race' && S.time < 5)) {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: A / D steer      Theo: ◀ ▶ steer — ski through every gate!' : '◀ ▶ (or A / D) to steer — ski through every pair of flags, dodge the trees!');
      }
    }

    const g = {
      title: '⛷️ Skiing',
      help: [
        'A downhill slalom — you each race down your own run. Fastest time wins!',
        'Steer with <b>◀ ▶</b> (or A / D). Ski between each pair of flags — <b>missing a gate adds 1.5 seconds</b>. Hitting a tree makes you crash and lose speed.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.skiing = create;
})();
