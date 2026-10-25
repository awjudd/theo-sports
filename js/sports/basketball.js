// Basketball: a shooting contest. Time the meter, sink the most points.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const HOOP = { x: 800, y: 262 };
  const FLOOR = 500;
  const DIST = [110, 180, 250, 320, 390, 450];
  const PTS = [2, 2, 3, 3, 3, 5];
  const P_MAKE = [0.85, 0.75, 0.62, 0.52, 0.43, 0.3];

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, shot: 0, cur: 0, scores: [0, 0], made: [[], []], tm: 0, wait: 0,
      ball: null, msg: null, netT: 0, sudden: false, suddenN: 0, pend: null, lastPts: 0,
    };
    const shotCount = () => S.shot; // 0-based global shot number
    const spot = () => (S.sudden ? 3 : Math.floor(S.shot / 2));
    const dist = () => DIST[Math.min(spot(), DIST.length - 1)];
    const pts = () => (S.sudden ? 3 : PTS[spot()]);
    const spotX = () => HOOP.x - dist();
    const zhw = () => 0.13 - dist() * 0.00012;
    const period = () => 1.7 - dist() * 0.0006;

    function begin() {
      S.cur = S.shot % 2; S.state = 'ready'; S.tm = 0; S.wait = 0;
      const sp = S.sudden ? 'SUDDEN DEATH' : (spot() === 5 ? 'MONEY BALL · 5 pts' : (pts() + ' pointer'));
      S.msg = { text: U.NAMES[S.cur] + ' shoots', sub: sp, t: 1.2 };
    }
    function start() { S.state = 'intro'; S.t = 0; S.msg = { text: 'HOOPS', sub: 'Most points wins', t: 1.6 }; }
    start();

    function launch(kind) {
      const sx = spotX() + 16, sy = 372;
      const type = kind;
      let x1 = HOOP.x, y1 = HOOP.y, arc = 120 + dist() * 0.28, post;
      if (type === 'swish') { post = { vx: 0, vy: 40 }; }
      else if (type === 'rimin') { x1 = HOOP.x - 8; post = { vx: 10, vy: 20 }; }
      else if (type === 'rimout') { x1 = HOOP.x + (Math.random() < 0.5 ? -22 : 24); y1 = HOOP.y - 6; post = { vx: x1 < HOOP.x ? -170 : 150, vy: -240 }; }
      else if (type === 'short') { x1 = HOOP.x - 62; y1 = HOOP.y + 55; arc *= 0.8; post = { vx: -90, vy: 0 }; }
      else { x1 = HOOP.x + 30; y1 = HOOP.y - 40; post = { vx: -180, vy: -120 }; } // long: backboard
      S.ball = { x: sx, y: sy, x0: sx, y0: sy, x1, y1, arc, u: 0, dur: 0.85 + dist() * 0.0006, post, vx: 0, vy: 0, phase: 'fly', bounces: 0, type };
      S.state = 'flight';
      TS.sfx.swish();
    }

    function resolve(kind) {
      const made = kind === 'swish' || kind === 'rimin';
      S.pend = { made, kind };
    }

    function release(m) {
      const d = Math.abs(m - 0.5), z = zhw();
      let kind;
      if (d < z * 0.45) kind = 'swish';
      else if (d < z) kind = Math.random() < 0.75 ? 'rimin' : 'rimout';
      else if (d < z * 1.8) kind = 'rimout';
      else kind = m < 0.5 ? 'short' : 'long';
      resolve(kind); launch(kind);
    }
    function cpuShot() {
      const p = P_MAKE[Math.min(spot(), 5)] - (S.sudden ? 0.1 : 0);
      const r = Math.random();
      let kind;
      if (r < p * 0.6) kind = 'swish'; else if (r < p) kind = 'rimin';
      else if (r < p + (1 - p) * 0.55) kind = 'rimout'; else kind = Math.random() < 0.5 ? 'short' : 'long';
      resolve(kind); launch(kind);
    }

    function endResult() {
      S.shot++;
      const total = S.shot;
      if (!S.sudden && total >= 12) {
        if (S.scores[0] === S.scores[1]) { S.sudden = true; S.suddenN = 0; }
        else return finish();
      } else if (S.sudden && S.shot % 2 === 0) {
        if (S.scores[0] !== S.scores[1] || ++S.suddenN >= 3) return finish();
      }
      begin();
    }
    function finish() {
      S.state = 'over'; S.t = 0;
      S.msg = { text: 'FINAL', sub: S.scores[0] + ' – ' + S.scores[1], t: 99 };
    }

    function update(dt) {
      S.t += dt;
      S.netT = Math.max(0, S.netT - dt);
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) begin(); return; }
      if (S.state === 'ready') {
        S.tm += dt;
        const p = P[S.cur];
        if (p.human) {
          if (S.tm > 0.5 && TS.input.pad(S.cur).actP) release(U.tri((S.tm - 0.5) / (period() / 2)));
        } else if (S.tm > 1.1) cpuShot();
        return;
      }
      if (S.state === 'flight') {
        const b = S.ball;
        if (b.phase === 'fly') {
          b.u = Math.min(1, b.u + dt / b.dur);
          b.x = U.lerp(b.x0, b.x1, b.u);
          b.y = U.lerp(b.y0, b.y1, b.u) - 4 * b.arc * b.u * (1 - b.u);
          if (b.u >= 1) {
            b.phase = 'drop'; b.vx = b.post.vx; b.vy = b.post.vy;
            if (S.pend.made) { S.netT = 0.5; TS.sfx.swish(); } else TS.sfx.thud();
          }
        } else {
          b.vy += 1500 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.y > FLOOR - 12) {
            b.y = FLOOR - 12; b.vy = -b.vy * 0.45; b.vx *= 0.7; b.bounces++;
            if (b.bounces === 1) {
              if (S.pend.made) {
                S.scores[S.cur] += pts(); S.made[S.cur].push(pts());
                S.msg = { text: S.pend.kind === 'swish' ? 'SWISH!' : 'BUCKET!', sub: '+' + pts() + (spot() === 5 && !S.sudden ? ' · money ball!' : ''), t: 1.3 };
                TS.sfx.win();
              } else {
                S.msg = { text: S.pend.kind === 'short' ? 'AIRBALL' : 'NO GOOD', sub: '', t: 1.1 };
              }
            }
            if (b.bounces >= 3 || Math.abs(b.vy) < 60) { S.state = 'result'; S.t = 0; }
          }
        }
        return;
      }
      if (S.state === 'result') { if (S.t > 1.1) endResult(); return; }
      if (S.state === 'over' && S.t > 1.6 && !g.over) {
        g.over = true;
        g.result = { winner: S.scores[0] === S.scores[1] ? null : (S.scores[0] > S.scores[1] ? 0 : 1), scores: S.scores.slice(), summary: 'Final score: Henry ' + S.scores[0] + ' – ' + S.scores[1] + ' Theo' };
      }
    }

    // ---------- drawing ----------
    function drawCourt(g) {
      const wall = g.createLinearGradient(0, 0, 0, FLOOR);
      wall.addColorStop(0, '#2a3a6b'); wall.addColorStop(1, '#46598f');
      g.fillStyle = wall; g.fillRect(0, 0, 960, FLOOR);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = ['#e63946', '#fcbf49', '#4cc9f0', '#ffffff', '#ff70a6', '#8338ec'][i % 6];
        g.globalAlpha = 0.5; g.beginPath(); g.arc(20 + i * 24, 70 + (i % 3) * 14 + Math.sin(S.t * 3 + i) * 1.5, 7, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#c98a4b'; g.fillRect(0, FLOOR - 8, 960, 108);
      for (let x = 0; x < 960; x += 60) { g.fillStyle = x % 120 ? '#d29655' : '#c58446'; g.fillRect(x, FLOOR - 8, 60, 108); }
      g.fillStyle = '#0003'; g.fillRect(0, FLOOR - 8, 960, 4);
      // spot markers
      DIST.forEach((d, i) => {
        const x = HOOP.x - d;
        const cur = !S.sudden && i === spot() && S.state !== 'over';
        g.fillStyle = cur ? '#fcbf49' : '#ffffff55';
        g.beginPath(); g.ellipse(x + 16, FLOOR + 22, cur ? 22 : 14, cur ? 7 : 5, 0, 0, TAU); g.fill();
        U.text(g, String(PTS[i]), x + 16, FLOOR + 46, 14, cur ? '#fcbf49' : '#ffffffaa', 'center');
      });
      // hoop
      g.fillStyle = '#555'; g.fillRect(HOOP.x + 70, 200, 10, FLOOR - 200);
      g.fillStyle = '#777'; g.fillRect(HOOP.x + 28, 214, 46, 8);
      g.fillStyle = '#ffffffee'; U.panel(g, HOOP.x + 24, 170, 12, 110, 3, '#ffffffee');
      g.strokeStyle = '#e63946'; g.lineWidth = 3; g.strokeRect(HOOP.x + 24, 222, 12, 36);
    }
    function drawNet(g) {
      const sag = S.netT > 0 ? Math.sin(S.netT * 24) * 5 * (S.netT / 0.5) : 0;
      g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.5;
      for (let i = 0; i <= 6; i++) {
        const tx = HOOP.x - 28 + i * 9.3, bx = HOOP.x - 18 + i * 6.1 + sag;
        g.beginPath(); g.moveTo(tx, HOOP.y); g.lineTo(bx, HOOP.y + 46); g.stroke();
      }
      for (let r = 1; r <= 3; r++) {
        const yy = HOOP.y + r * 12, inset = r * 3;
        g.beginPath(); g.moveTo(HOOP.x - 28 + inset, yy); g.lineTo(HOOP.x + 28 - inset + sag * 0.5, yy); g.stroke();
      }
    }
    function drawRimFront(g) {
      g.strokeStyle = '#ff6b2b'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(HOOP.x - 30, HOOP.y); g.lineTo(HOOP.x + 28, HOOP.y); g.stroke();
    }
    function drawBall(g, x, y, r) {
      g.fillStyle = '#ff8c32'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = '#7a3d0c'; g.lineWidth = 1.6; g.stroke();
      g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
      g.beginPath(); g.arc(x - r * 1.05, y, r * 0.8, -0.9, 0.9); g.arc(x + r * 1.05, y, r * 0.8, Math.PI - 0.9, Math.PI + 0.9); g.stroke();
    }
    function drawPlayers(g) {
      const shooting = S.state === 'flight' && S.ball && S.ball.phase === 'fly' && S.ball.u < 0.4;
      for (let i = 0; i < 2; i++) {
        const p = P[i];
        const isCur = i === S.cur && S.state !== 'over' && S.state !== 'intro';
        const x = isCur ? spotX() + 16 : (i ? 90 : 40);
        const won = S.state === 'over' && S.scores[i] >= S.scores[1 - i];
        TS.chars.draw(g, p.who, p.outfit, {
          x, y: FLOOR + 14, scale: isCur ? 1.15 : 0.8, t: S.t + i, facing: isCur ? 1 : 1,
          arm: isCur && (S.state === 'ready' ? 0.9 : shooting || S.state === 'flight' ? 2.6 : 0) , cheer: won || (!isCur && S.state === 'result' && S.pend && S.pend.made && false),
        });
        if (!isCur) U.text(g, U.NAMES[i].toUpperCase(), x, FLOOR - 78, 12, U.TEAM[i], 'center');
      }
    }
    function draw(g) {
      drawCourt(g);
      drawNet(g);
      drawPlayers(g);
      // ball: in hand while ready
      if (S.state === 'ready') drawBall(g, spotX() + 38, 392, 13);
      else if (S.ball && S.state !== 'intro' && S.state !== 'over') {
        const b = S.ball, sc = 13;
        if (b.phase === 'drop' && S.pend && S.pend.made && b.y < HOOP.y + 50) { drawBall(g, b.x, b.y, sc); drawNet(g); }
        else drawBall(g, b.x, b.y, sc);
      }
      drawRimFront(g);
      U.scoreboard(g, S.scores, S.sudden ? 'OT' : Math.min(6, Math.floor(S.shot / 2) + 1) + '/6', S.state === 'ready' ? S.cur : -1);
      if (S.state === 'ready') {
        const z = zhw();
        const m = P[S.cur].human && S.tm > 0.5 ? U.tri((S.tm - 0.5) / (period() / 2)) : 0.5;
        if (P[S.cur].human) {
          U.meter(g, 330, 548, 300, 20, m, [0.5 - z * 0.45, 0.5 + z * 0.45], 'RELEASE IN THE GREEN');
          g.fillStyle = '#6a994e66'; g.fillRect(330 + 300 * (0.5 - z), 548, 300 * z * 2, 20);
        } else U.hint(g, U.NAMES[S.cur] + ' lines up the shot…');
      }
      // shot tally
      for (let i = 0; i < 2; i++) {
        S.made[i].forEach((v, k) => { g.fillStyle = U.TEAM[i]; g.beginPath(); g.arc(30 + k * 20, 90 + i * 22, 8, 0, TAU); g.fill(); U.text(g, String(v), 30 + k * 20, 90 + i * 22, 10, '#fff', 'center'); });
      }
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 180, '#fcbf49');
    }

    const g = {
      title: '🏀 Basketball',
      help: [
        'A shooting contest: 6 shots each, getting farther from the hoop every time. The last one is a <b>5-point money ball</b>!',
        'Press <b>Action</b> when the moving marker is in the <b>green zone</b>. Farther shots have a smaller zone and a faster marker.',
        'Tied at the end? Sudden-death 3-pointers.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.basketball = create;
})();
