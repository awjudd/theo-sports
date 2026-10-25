// Simon says: watch the pattern, then copy it. Last one standing wins.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  // 0 = up, 1 = right, 2 = down, 3 = left
  const COL = ['#4cc9f0', '#fcbf49', '#e63946', '#6a994e'];
  const ARROW = ['▲', '▶', '▼', '◀'];
  const TONE = [392, 523, 330, 262];

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, seq: [], phase: 'show', showIdx: 0, showT: 0, lit: -1, lastDir: [0, 0], pos: [0, 0], out: [false, false],
      flash: [-1, -1], flashT: [0, 0], round: 0, best: [0, 0], msg: null, endT: 0, cpuT: [0, 0], cpuFail: [false, false], inT: 0, finished: [false, false], stepped: [U.stepper(), U.stepper()],
    };
    const KEY = [{ ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }, { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }];
    const WASD = { KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
    S.msg = { text: 'SIMON SAYS', sub: 'Copy the pattern', t: 1.6 };

    function newRound() {
      S.round++; S.seq.push(Math.floor(Math.random() * 4));
      S.phase = 'show'; S.showIdx = 0; S.showT = -0.6; S.lit = -1; S.pos = [0, 0]; S.finished = [false, false]; S.inT = 0; S.cpuT = [0, 0]; S.state = 'play';
      S.cpuFail = [false, false];
      for (let i = 0; i < 2; i++) if (!P[i].human && !S.out[i]) {
        // chance of CPU slipping grows with length
        const p = Math.max(0.35, 0.99 - S.seq.length * 0.045);
        S.cpuFail[i] = Math.random() > Math.pow(p, 1) ;
      }
      S.msg = { text: 'ROUND ' + S.round, sub: S.seq.length + ' in the pattern', t: 0.9 };
    }

    function press(i, d) {
      if (S.out[i] || S.finished[i]) return;
      S.flash[i] = d; S.flashT[i] = 0.18; TS.sfx.tone(TONE[d], 0.12, 'triangle', 0.1);
      if (S.seq[S.pos[i]] === d) {
        S.pos[i]++;
        if (S.pos[i] >= S.seq.length) { S.finished[i] = true; }
      } else { S.out[i] = true; TS.sfx.thud(); }
    }

    function endRound() {
      for (let i = 0; i < 2; i++) if (!S.out[i]) S.best[i] = S.round;
      const alive = [0, 1].filter((i) => !S.out[i]);
      if (alive.length === 2) { S.msg = { text: 'NICE!', sub: 'Pattern grows…', t: 1.2 }; S.phase = 'pause'; S.endT = 1.3; return; }
      S.state = 'over'; S.t = 0;
      const w = alive.length === 1 ? alive[0] : null;
      S.msg = { text: w === null ? 'BOTH SLIPPED!' : U.NAMES[w].toUpperCase() + ' WINS!', sub: 'Longest pattern: ' + (S.round - (w === null ? 1 : 0)), t: 99 };
      S.winner = w;
      if (w !== null) TS.sfx.goal();
    }

    function update(dt) {
      S.t += dt;
      for (let i = 0; i < 2; i++) { S.flashT[i] = Math.max(0, S.flashT[i] - dt); if (S.flashT[i] <= 0) S.flash[i] = -1; }
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) newRound(); return; }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) {
          g.over = true;
          const w = S.winner === undefined ? null : S.winner;
          g.result = { winner: w, scores: S.best.slice(), summary: 'Longest pattern repeated — Henry ' + S.best[0] + ', Theo ' + S.best[1] };
        }
        return;
      }
      if (S.phase === 'show') {
        S.showT += dt;
        const step = 0.65;
        if (S.showT >= 0) {
          const idx = Math.floor(S.showT / step), within = S.showT - idx * step;
          if (idx >= S.seq.length) { S.phase = 'input'; S.inT = 0; S.lit = -1; return; }
          const on = within < step * 0.6 ? S.seq[idx] : -1;
          if (on !== S.lit && on >= 0) TS.sfx.tone(TONE[on], 0.2, 'triangle', 0.1);
          S.lit = on;
        }
      } else if (S.phase === 'input') {
        S.inT += dt;
        const two = P[0].human && P[1].human;
        for (let i = 0; i < 2; i++) {
          if (S.out[i] || S.finished[i]) continue;
          if (P[i].human) {
            const map = two ? (i ? KEY[1] : WASD) : Object.assign({}, KEY[0], WASD);
            for (const code in map) if (TS.input.pressed(code)) press(i, map[code]);
          } else {
            S.cpuT[i] -= dt;
            if (S.cpuT[i] <= 0) {
              const failHere = S.cpuFail[i] && S.pos[i] === Math.floor(S.seq.length * Math.random());
              press(i, failHere ? (S.seq[S.pos[i]] + 1 + Math.floor(Math.random() * 3)) % 4 : S.seq[S.pos[i]]);
              S.cpuT[i] = U.rnd(0.32, 0.55);
            }
          }
        }
        // time limit: 2.5s + 1s per item
        if (S.inT > 2.5 + S.seq.length * 1.1) { for (let i = 0; i < 2; i++) if (!S.finished[i]) S.out[i] = true; }
        if ([0, 1].every((i) => S.out[i] || S.finished[i])) { S.phase = 'pause'; endRound(); }
      } else if (S.phase === 'pause') {
        S.endT -= dt; if (S.endT <= 0 && S.state === 'play') newRound();
      }
    }

    function pad(g, cx, cy, i) {
      const sz = 70;
      const pos = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (let d = 0; d < 4; d++) {
        const lit = S.flash[i] === d || (S.phase === 'show' && S.lit === d);
        const x = cx + pos[d][0] * (sz + 6), y = cy + pos[d][1] * (sz + 6);
        g.fillStyle = lit ? COL[d] : COL[d] + '55';
        TS.chars.rr(g, x - sz / 2, y - sz / 2, sz, sz, 16); g.fill();
        if (lit) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); }
        U.text(g, ARROW[d], x, y, 34, lit ? '#fff' : '#ffffff99', 'center');
      }
    }
    function draw(g) {
      g.fillStyle = '#1a1038'; g.fillRect(0, 0, 960, 600);
      for (let k = 0; k < 30; k++) { g.fillStyle = '#ffffff' + (k % 3 ? '22' : '44'); g.beginPath(); g.arc((k * 173) % 960, (k * 97) % 600, 2 + (k % 3), 0, TAU); g.fill(); }
      for (let i = 0; i < 2; i++) {
        const cx = i ? 720 : 240;
        U.panel(g, cx - 200, 120, 400, 440, 22, '#2a1c5a');
        U.text(g, U.NAMES[i].toUpperCase(), cx, 150, 22, U.TEAM[i], 'center');
        pad(g, cx, 330, i);
        const dim = S.out[i];
        TS.chars.draw(g, P[i].who, P[i].outfit, { x: cx, y: 335, scale: 0.95, t: S.t + i, mood: dim ? 'sad' : (S.finished[i] ? 'cheer' : 'happy'), cheer: S.finished[i] && !dim && S.phase !== 'show' });
        // progress dots
        for (let k = 0; k < S.seq.length; k++) { g.fillStyle = k < S.pos[i] ? '#6a994e' : '#ffffff33'; g.beginPath(); g.arc(cx - (S.seq.length - 1) * 8 + k * 16, 520, 5, 0, TAU); g.fill(); }
        if (dim) U.text(g, 'OUT', cx, 480, 28, '#e63946', 'center', 900);
      }
      U.scoreboard(g, S.best, 'R' + S.round, -1);
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 70 + 40, '#fcbf49');
      if (S.state === 'play' && S.phase === 'show') U.hint(g, 'Watch the pattern…');
      else if (S.phase === 'input') {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: W A S D · Theo: arrow keys — repeat the pattern!' : 'Repeat the pattern with the arrow keys (or W A S D)!');
      }
    }

    const g = {
      title: '🔴 Simon Says',
      help: [
        'Watch the colored arrows light up in order, then <b>repeat the pattern</b> as quickly as you can. Each round adds one more!',
        'Press the arrow keys (or W A S D). One wrong key — or running out of time — and you’re out. Last one standing wins!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.simon = create;
})();
