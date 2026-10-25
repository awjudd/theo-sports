// Tug of war: mash left/right faster than your rival. Best of three pulls.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, cd: 0, m: 0, pw: [0, 0], wins: [0, 0], round: 1, msg: null,
      step: [U.stepper(), U.stepper()], cpu: [0, 0], cpuSkill: 1, endT: 0, pull: [0, 0], shake: 0,
    };
    S.msg = { text: 'TUG OF WAR', sub: 'Best of three', t: 1.6 };

    function startRound() {
      S.m = 0; S.pw = [0, 0]; S.pt = 0; S.cd = 3.2; S.state = 'count'; S.cpuSkill = U.rnd(0.86, 1.04); S.msg = null;
    }

    function update(dt) {
      S.t += dt; S.shake = Math.max(0, S.shake - dt * 4);
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) startRound(); return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'pull'; TS.sfx.go(); }
        return;
      }
      if (S.state === 'between') {
        S.endT -= dt;
        if (S.endT <= 0) { if (S.wins[0] >= 2 || S.wins[1] >= 2) { S.state = 'over'; S.t = 0; S.msg = { text: 'FINAL', sub: S.wins[0] + ' – ' + S.wins[1], t: 99 }; } else { S.round++; startRound(); } }
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.6 && !g.over) {
          g.over = true;
          g.result = { winner: S.wins[0] > S.wins[1] ? 0 : 1, scores: S.wins.slice(), summary: 'Pulls won — Henry ' + S.wins[0] + ', Theo ' + S.wins[1] };
        }
        return;
      }
      // pulling
      for (let i = 0; i < 2; i++) {
        let stepped = false;
        if (P[i].human) stepped = S.step[i](TS.input.pad(i).x);
        else {
          S.cpu[i] -= dt;
          if (S.cpu[i] <= 0) { stepped = true; S.cpu[i] = (0.17 + U.rnd(0, 0.06)) / S.cpuSkill; }
        }
        S.pw[i] *= Math.exp(-2.2 * dt);
        if (stepped) { S.pw[i] += 1; S.pull[i] = 0.12; }
        S.pull[i] = Math.max(0, S.pull[i] - dt);
      }
      S.m += (S.pw[1] - S.pw[0]) * 0.26 * dt; // positive = Theo pulling Henry toward the right
      S.pt += dt;
      if (S.pt > 12) S.m += (S.m || (Math.random() - 0.5)) * 0.25 * dt; // sudden-death nudge so a pull always ends
      S.m = U.clamp(S.m, -1.05, 1.05);
      if (Math.abs(S.m) >= 1) {
        const winner = S.m > 0 ? 1 : 0; // the rope (and everyone) moves toward the stronger puller
        S.wins[winner]++; S.state = 'between'; S.endT = 2;
        S.msg = { text: U.NAMES[winner].toUpperCase() + ' WINS THE PULL!', sub: S.wins[0] + ' – ' + S.wins[1], t: 2 };
        TS.sfx.goal();
      }
    }

    function draw(g) {
      // sky + crowd + grass
      const sky = g.createLinearGradient(0, 0, 0, 300);
      sky.addColorStop(0, '#5aa9e6'); sky.addColorStop(1, '#cfeaff');
      g.fillStyle = sky; g.fillRect(0, 0, 960, 330);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 70; i++) {
        g.fillStyle = ['#e63946', '#fcbf49', '#f1faee', '#4cc9f0', '#ff70a6'][(i * 3 + r) % 5]; g.globalAlpha = 0.75;
        g.beginPath(); g.arc(i * 14 + (r % 2) * 7, 215 + r * 18 + Math.sin(S.t * 4 + i) * 1.5, 6, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#4f9a50'; g.fillRect(0, 300, 960, 300);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#559f56' : '#4a9149'; g.fillRect(0, 300 + i * 38, 960, 38); }
      // mud pit in the middle
      g.fillStyle = '#6b4a2b'; g.beginPath(); g.ellipse(480, 480, 130, 38, 0, 0, TAU); g.fill();
      g.fillStyle = '#7d5833'; g.beginPath(); g.ellipse(480, 476, 105, 28, 0, 0, TAU); g.fill();
      // centre marker line
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(480, 400); g.lineTo(480, 540); g.stroke(); g.setLineDash([]);
      // players
      const off = S.m * 120;
      for (let i = 0; i < 2; i++) {
        const base = i === 0 ? 200 : 760;
        const x = base + off + (S.shake ? Math.sin(S.t * 60) * 2 : 0);
        const lean = S.pull[i] > 0 ? 1 : 0.7;
        g.save(); g.translate(x, 540); g.rotate((i === 0 ? -1 : 1) * 0.28 * lean); g.translate(-x, -540);
        TS.chars.draw(g, P[i].who, P[i].outfit, { x, y: 540, scale: 1.8, t: S.t * 2, arm: 0.0, facing: i === 0 ? 1 : -1, mood: 'cheer', moving: false });
        g.restore();
        // power bar
        const f = U.clamp(S.pw[i] / 5, 0, 1);
        U.panel(g, i === 0 ? 20 : 760, 560, 180, 22, 11);
        g.fillStyle = U.TEAM[i]; TS.chars.rr(g, i === 0 ? 24 : 764, 564, 172 * f, 14, 7); g.fill();
      }
      // rope
      const lx = 200 + off + 90, rx = 760 + off - 90;
      g.strokeStyle = '#d9b57b'; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(lx, 500); g.quadraticCurveTo(480 + off, 506 + Math.sin(S.t * 10) * 1.5, rx, 500); g.stroke();
      g.strokeStyle = '#a9824a'; g.lineWidth = 2;
      for (let k = 0; k < 24; k++) { const x = lx + (rx - lx) * (k / 24); g.beginPath(); g.moveTo(x, 495); g.lineTo(x + 6, 508); g.stroke(); }
      // flag on rope
      g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(480 + off, 500); g.lineTo(480 + off, 450); g.lineTo(508 + off, 462); g.lineTo(480 + off, 474); g.fill();
      // win zones
      g.fillStyle = TEAM_FILL(0); g.fillRect(60, 405, 4, 130);
      g.fillStyle = TEAM_FILL(1); g.fillRect(896, 405, 4, 130);
      // header
      U.scoreboard(g, S.wins, 'R' + Math.min(3, S.round), -1);
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'PULL!', '', 160, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 160, '#fcbf49');
      if (S.state === 'count' || (S.state === 'pull' && S.t < 99 && Math.abs(S.m) < 0.01 + 0.2)) {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: tap A / D · Theo: tap ◀ ▶  — as fast as you can!' : 'Tap ◀ ▶ (or A / D) back and forth as fast as you can!');
      }
    }
    function TEAM_FILL(i) { return U.TEAM[i]; }

    const g = {
      title: '🪢 Tug of War',
      help: [
        'Best of three pulls. Drag the rope until the flag is pulled over your line!',
        '<b>Tap left and right back and forth</b> as fast as you can — the faster you tap, the harder you pull. Mashing a single key does nothing.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.tugofwar = create;
})();
