// Cornhole: toss bean bags at the board. Aim left/right, then time the throw for distance.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const BOARD = { x: 480, y: 215, w: 200, h: 270, hx: 480, hy: 120 }; // drawn in perspective: hole near the top
  const ROUNDS = 4, BAGS = 2;
  const FAR = 150, NEAR = 440; // y range a bag can land on (screen y)

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, turn: 0, cur: 0, scores: [0, 0], bags: [], phase: 'aim', ax: 480, power: 0, powT: 0,
      bag: null, cpu: null, cpuT: 0, msg: null, pend: null, round: 1, thrown: [0, 0], endT: 0, extra: 0,
    };
    S.msg = { text: 'CORNHOLE', sub: 'In the hole = 3, on the board = 1', t: 1.6 };

    // landing y for a given power: the board spans y 150..370 on screen; the hole is at y = 195
    const HOLE = { x: 480, y: 205, r: 20 };
    const yOf = (p) => U.lerp(430, 150, U.clamp(p, 0, 1));

    function begin() {
      // each round: both players throw BAGS bags, alternating
      S.cur = S.turn % 2; S.phase = 'aim'; S.ax = 480; S.power = 0; S.powT = 0; S.bag = null; S.cpuT = 0; S.state = 'play';
      if (!P[S.cur].human) {
        const pw = U.clamp(0.8 + U.gauss() * 0.06, 0.4, 1);
        S.cpu = { ax: 480 + U.gauss() * 20, pw, wait: U.rnd(0.9, 1.5) };
      }
      S.msg = { text: U.NAMES[S.cur], sub: 'Round ' + S.round + ' · bag ' + (Math.floor((S.turn % (2 * BAGS)) / 2) + 1) + ' of ' + BAGS, t: 1.0 };
    }

    function toss() {
      const err = Math.abs(S.power - 0.8);
      const sx = 22 + err * 160, sy = 12 + err * 120;
      const x = S.ax + U.gauss() * sx, y = yOf(S.power) + U.gauss() * sy;
      S.bag = { u: 0, x, y, dur: 0.7 };
      const dx = x - HOLE.x, dy = y - HOLE.y;
      const onBoard = x > BOARD.x - BOARD.w * 0.5 + 6 && x < BOARD.x + BOARD.w * 0.5 - 6 && y > 110 && y < 372;
      let pts = 0;
      if (Math.hypot(dx, dy * 1.3) < HOLE.r) pts = 3; else if (onBoard) pts = 1;
      S.pend = pts;
      S.phase = 'flight'; TS.sfx.swish();
    }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) begin(); return; }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) { g.over = true; g.result = { winner: S.scores[0] === S.scores[1] ? null : (S.scores[0] > S.scores[1] ? 0 : 1), scores: S.scores.slice(), summary: 'Cornhole — Henry ' + S.scores[0] + ', Theo ' + S.scores[1] }; }
        return;
      }
      const human = P[S.cur].human, pad = TS.input.pad(S.cur);
      if (S.phase === 'aim') {
        S.cpuT += dt;
        if (human) { S.ax = U.clamp(S.ax + pad.x * 230 * dt, 480 - 110, 480 + 110); if (S.cpuT > 0.35 && pad.actP) { S.phase = 'power'; S.powT = 0; TS.sfx.click(); } }
        else { S.ax += (S.cpu.ax - S.ax) * Math.min(1, dt * 4); if (S.cpuT > S.cpu.wait) { S.phase = 'power'; S.powT = 0; } }
      } else if (S.phase === 'power') {
        S.powT += dt;
        if (human) { S.power = U.tri(S.powT / 0.7); if (pad.actP) toss(); }
        else { S.power = S.cpu.pw * U.clamp(S.powT / 0.5, 0, 1); if (S.powT > 0.6) { S.power = S.cpu.pw; toss(); } }
      } else if (S.phase === 'flight') {
        S.bag.u = Math.min(1, S.bag.u + dt / S.bag.dur);
        if (S.bag.u >= 1) {
          S.bags.push({ x: S.bag.x, y: S.bag.y, idx: S.cur, pts: S.pend });
          S.scores[S.cur] += S.pend;
          S.msg = { text: S.pend === 3 ? 'IN THE HOLE!' : (S.pend === 1 ? 'ON THE BOARD' : 'MISSED'), sub: S.pend ? '+' + S.pend : '', t: 1.1 };
          if (S.pend === 3) TS.sfx.goal(); else if (S.pend === 1) TS.sfx.thud(); else TS.sfx.beep();
          S.phase = 'result'; S.endT = 1.3;
        }
      } else if (S.phase === 'result') {
        S.endT -= dt;
        if (S.endT <= 0) {
          S.turn++;
          if (S.turn % (2 * BAGS) === 0) {
            S.round++; S.bags = [];
            if (S.round > ROUNDS) {
              if (S.scores[0] !== S.scores[1] || ++S.extra > 2) { S.state = 'over'; S.t = 0; S.msg = { text: 'FINAL', sub: S.scores[0] + ' – ' + S.scores[1], t: 99 }; return; }
              S.round = ROUNDS;
            }
          }
          begin();
        }
      }
    }

    function drawBoard(g) {
      // grass
      const sky = g.createLinearGradient(0, 0, 0, 100);
      sky.addColorStop(0, '#5aa9e6'); sky.addColorStop(1, '#bfe6ff');
      g.fillStyle = sky; g.fillRect(0, 0, 960, 110);
      g.fillStyle = '#4f9a50'; g.fillRect(0, 100, 960, 500);
      for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#559f56' : '#4a9149'; g.fillRect(0, 100 + i * 50, 960, 50); }
      // board (trapezoid)
      g.fillStyle = '#00000033'; g.beginPath(); g.moveTo(364, 392); g.lineTo(596, 392); g.lineTo(570, 112); g.lineTo(390, 112); g.fill();
      g.fillStyle = '#c98a4b'; g.beginPath(); g.moveTo(360, 380); g.lineTo(600, 380); g.lineTo(568, 108); g.lineTo(392, 108); g.closePath(); g.fill();
      g.strokeStyle = '#8a5a2b'; g.lineWidth = 8; g.stroke();
      g.fillStyle = '#3a86ff'; g.beginPath(); g.moveTo(386, 350); g.lineTo(574, 350); g.lineTo(554, 126); g.lineTo(406, 126); g.closePath(); g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
      g.fillStyle = '#fff'; g.font = '900 54px "Trebuchet MS"'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = 0.3; g.fillText('★', 480, 300); g.globalAlpha = 1;
      g.fillStyle = '#0d1b33'; g.beginPath(); g.ellipse(HOLE.x, HOLE.y, HOLE.r, HOLE.r * 0.75, 0, 0, TAU); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      // legs
      g.strokeStyle = '#8a5a2b'; g.lineWidth = 10; g.beginPath(); g.moveTo(380, 380); g.lineTo(372, 400); g.moveTo(580, 380); g.lineTo(588, 400); g.stroke();
    }
    function drawBag(g, x, y, col, s) {
      g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = '#0003'; g.beginPath(); g.ellipse(2, 8, 16, 6, 0, 0, TAU); g.fill();
      g.fillStyle = col; TS.chars.rr(g, -15, -11, 30, 22, 5); g.fill();
      g.strokeStyle = '#ffffff88'; g.lineWidth = 2; g.stroke();
      g.restore();
    }
    function draw(g) {
      drawBoard(g);
      S.bags.forEach((b) => drawBag(g, b.x, b.y, U.TEAM[b.idx], 0.9));
      // thrower
      const p = P[S.cur];
      TS.chars.draw(g, p.who, p.outfit, { x: 200, y: 560, scale: 1.7, t: S.t, arm: S.phase === 'flight' || S.phase === 'power' ? 2.2 : 0.3, cheer: S.phase === 'result' && S.pend === 3 });
      const o = P[1 - S.cur];
      TS.chars.draw(g, o.who, o.outfit, { x: 760, y: 560, scale: 1.2, t: S.t + 2 });
      // reticle
      if (S.state === 'play' && (S.phase === 'aim' || S.phase === 'power')) {
        const ty = S.phase === 'power' ? yOf(S.power) : yOf(0.8);
        g.strokeStyle = '#fcbf49'; g.lineWidth = 3; g.setLineDash([4, 6]);
        g.beginPath(); g.moveTo(S.ax, 430); g.lineTo(S.ax, S.phase === 'power' ? ty : 110); g.stroke(); g.setLineDash([]);
        g.beginPath(); g.arc(S.ax, ty, 11, 0, TAU); g.stroke();
      }
      if (S.bag && (S.phase === 'flight')) {
        const b = S.bag, u = b.u;
        drawBag(g, U.lerp(300, b.x, u), U.lerp(520, b.y, u) - Math.sin(u * Math.PI) * 170, U.TEAM[S.cur], U.lerp(1.3, 0.8, u));
      } else if (S.state === 'play' && S.phase !== 'result') drawBag(g, 300, 520, U.TEAM[S.cur], 1.3);
      U.scoreboard(g, S.scores, 'R' + Math.min(ROUNDS, S.round) + '/' + ROUNDS, S.state === 'play' ? S.cur : -1);
      if (S.state === 'play') {
        const human = P[S.cur].human;
        if (S.phase === 'aim') U.hint(g, human ? '◀ ▶ aim sideways · Action to start the throw meter' : U.NAMES[S.cur] + ' is lining up…');
        else if (S.phase === 'power') U.meter(g, 330, 552, 300, 20, S.power, [0.72, 0.88], human ? 'THROW · Action in the green' : 'THROW');
      }
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 440, '#fcbf49');
    }

    const g = {
      title: '🎒 Cornhole',
      help: [
        'Toss bean bags at the board — <b>3 points</b> for a bag in the hole, <b>1 point</b> for landing on the board. Four rounds of two bags each.',
        '<b>◀ ▶</b> aim sideways, press <b>Action</b> to start the throw meter, then press <b>Action</b> in the green zone for just the right distance. Too weak falls short, too strong sails past!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.cornhole = create;
})();
