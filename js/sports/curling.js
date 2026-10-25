// Curling: slide stones toward the house; hold Action to sweep and carry a stone farther. Closest stones score.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const SHEET = { l: 60, r: 920, t: 215, b: 445 };
  const HACK = { x: 140, y: 330 };
  const HOUSE = { x: 770, y: 330, r: 96 };
  const HOG = 500;           // a stone that stops short of this line is removed
  const SR = 16, FRIC = 90, SWEEP = 0.5;
  const ENDS = 2, STONES = 3;

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, end: 1, shot: 0, cur: 0, scores: [0, 0], stones: [], phase: 'aim', aimOff: 0, power: 0, powT: 0, cpu: null, cpuT: 0,
      cur_stone: null, msg: null, endT: 0, sweeping: false, sweepAnim: 0, endScore: null,
    };
    S.msg = { text: 'CURLING', sub: 'Closest to the button scores', t: 1.6 };

    const dir = () => { const dx = HOUSE.x - HACK.x, dy = HOUSE.y + S.aimOff - HACK.y, l = Math.hypot(dx, dy); return [dx / l, dy / l]; };

    function begin() {
      S.cur = S.shot % 2; S.phase = 'aim'; S.aimOff = 0; S.power = 0; S.powT = 0; S.cpuT = 0; S.cur_stone = null; S.state = 'play';
      if (!P[S.cur].human) {
        const off = U.clamp(U.gauss() * 16, -60, 60);
        const dist = Math.hypot(HOUSE.x - HACK.x, HOUSE.y + off - HACK.y);
        const target = dist + U.rnd(-25, 20);
        const v0 = Math.sqrt(2 * FRIC * target) * (1 + U.gauss() * 0.045);
        S.cpu = { off, p: U.clamp((v0 - 150) / 330, 0.05, 1), wait: U.rnd(0.9, 1.4) };
      }
      S.msg = { text: U.NAMES[S.cur], sub: 'End ' + S.end + ' · stone ' + (Math.floor((S.shot % (STONES * 2)) / 2) + 1) + ' of ' + STONES, t: 1.0 };
    }

    function release() {
      const [dx, dy] = dir();
      const v0 = 150 + 330 * S.power;
      const st = { x: HACK.x, y: HACK.y, vx: dx * v0, vy: dy * v0, team: S.cur, out: false, moving: true, v0 };
      S.stones.push(st); S.cur_stone = st; S.phase = 'slide'; S.cpuSweepOn = false;
      TS.sfx.swish();
    }

    function scoreEnd() {
      const live = S.stones.filter((s) => !s.out).map((s) => ({ team: s.team, d: Math.hypot(s.x - HOUSE.x, s.y - HOUSE.y) })).filter((s) => s.d < HOUSE.r + SR);
      live.sort((a, b) => a.d - b.d);
      let pts = 0, team = -1;
      if (live.length) {
        team = live[0].team;
        const oppBest = live.find((s) => s.team !== team);
        for (const s of live) { if (s.team !== team) break; if (!oppBest || s.d < oppBest.d) pts++; }
      }
      if (team >= 0) S.scores[team] += pts;
      S.endScore = { team, pts };
      S.msg = { text: team < 0 ? 'BLANK END' : U.NAMES[team].toUpperCase() + ' SCORES ' + pts, sub: S.scores[0] + ' – ' + S.scores[1], t: 2.2 };
      if (team >= 0) TS.sfx.goal();
      S.phase = 'endscore'; S.endT = 2.6;
    }

    function stonesMoving() { return S.stones.some((s) => !s.out && Math.hypot(s.vx, s.vy) > 3); }

    function update(dt) {
      S.t += dt; S.sweepAnim += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) begin(); return; }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) { g.over = true; g.result = { winner: S.scores[0] === S.scores[1] ? null : (S.scores[0] > S.scores[1] ? 0 : 1), scores: S.scores.slice(), summary: 'Curling — Henry ' + S.scores[0] + ', Theo ' + S.scores[1] }; }
        return;
      }
      const human = P[S.cur].human, pad = TS.input.pad(S.cur);
      if (S.phase === 'aim') {
        S.cpuT += dt;
        if (human) { S.aimOff = U.clamp(S.aimOff + pad.y * 110 * dt, -85, 85); if (S.cpuT > 0.35 && pad.actP) { S.phase = 'power'; S.powT = 0; TS.sfx.click(); } }
        else { S.aimOff += (S.cpu.off - S.aimOff) * Math.min(1, dt * 4); if (S.cpuT > S.cpu.wait) { S.phase = 'power'; S.powT = 0; } }
      } else if (S.phase === 'power') {
        S.powT += dt;
        if (human) { S.power = U.tri(S.powT / 0.9); if (pad.actP) release(); }
        else { S.power = S.cpu.p * U.clamp(S.powT / 0.6, 0, 1); if (S.powT > 0.75) { S.power = S.cpu.p; release(); } }
      } else if (S.phase === 'slide' || S.phase === 'settle') {
        // sweeping
        const st = S.cur_stone;
        let sweeping = false;
        if (S.phase === 'slide' && st && Math.hypot(st.vx, st.vy) > 3) {
          if (human) sweeping = pad.act;
          else {
            const v = Math.hypot(st.vx, st.vy);
            const stop = st.x + (st.vx / v) * (v * v) / (2 * FRIC);
            sweeping = stop < HOUSE.x - 10 && st.x < HOUSE.x;
          }
        }
        S.sweeping = sweeping;
        const steps = 3, h = dt / steps;
        for (let k = 0; k < steps; k++) {
          for (const s of S.stones) {
            if (s.out) continue;
            const v = Math.hypot(s.vx, s.vy);
            if (v > 0) {
              const f = FRIC * (s === st && sweeping ? SWEEP : 1);
              const nv = Math.max(0, v - f * h);
              s.vx *= nv / v; s.vy *= nv / v;
              if (nv < 3) { s.vx = s.vy = 0; }
            }
            s.x += s.vx * h; s.y += s.vy * h;
            if (s.y < SHEET.t + 6 || s.y > SHEET.b - 6 || s.x > SHEET.r + 10) { s.out = true; TS.sfx.thud(); }
          }
          for (let i = 0; i < S.stones.length; i++) for (let j = i + 1; j < S.stones.length; j++) {
            const a = S.stones[i], b = S.stones[j];
            if (a.out || b.out) continue;
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
            if (d < SR * 2 && d > 0.01) {
              const nx = dx / d, ny = dy / d, ov = (SR * 2 - d) / 2;
              a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
              const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (rv < 0) { const j2 = -(1 + 0.9) * rv / 2; a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny; TS.sfx.hit(); }
            }
          }
        }
        if (!stonesMoving()) {
          // remove stones that came up short of the hog line
          S.stones.forEach((s) => { if (!s.out && s.x < HOG) { s.out = true; if (s === st) S.msg = { text: 'SHORT!', sub: 'Stone removed', t: 1.1 }; } });
          S.shot++;
          if (S.shot % (STONES * 2) === 0) scoreEnd();
          else begin();
        }
      } else if (S.phase === 'endscore') {
        S.endT -= dt;
        if (S.endT <= 0) {
          if (S.end >= ENDS) { S.state = 'over'; S.t = 0; S.msg = { text: 'FINAL', sub: S.scores[0] + ' – ' + S.scores[1], t: 99 }; }
          else { S.end++; S.stones = []; begin(); }
        }
      }
      if (S.phase === 'slide' && S.cur_stone && !S.cur_stone.moving) S.phase = 'settle';
      if (S.phase === 'slide') { /* stays in slide until every stone stops */ }
    }

    function drawIce(g) {
      g.fillStyle = '#26324f'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 70; i++) { g.fillStyle = ['#e63946', '#fcbf49', '#4cc9f0', '#fff', '#ff70a6'][i % 5]; g.globalAlpha = 0.5; g.beginPath(); g.arc(i * 14 + 6, 110 + (i % 3) * 20, 6, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      const ice = g.createLinearGradient(0, SHEET.t, 0, SHEET.b);
      ice.addColorStop(0, '#e9f6ff'); ice.addColorStop(1, '#cfe9fb');
      g.fillStyle = ice; g.fillRect(SHEET.l, SHEET.t, SHEET.r - SHEET.l, SHEET.b - SHEET.t);
      g.strokeStyle = '#8fb3d1'; g.lineWidth = 6; g.strokeRect(SHEET.l, SHEET.t, SHEET.r - SHEET.l, SHEET.b - SHEET.t);
      // house
      for (const [r, c] of [[HOUSE.r, '#3a86ff'], [HOUSE.r * 0.66, '#ffffff'], [HOUSE.r * 0.33, '#e63946'], [HOUSE.r * 0.12, '#ffffff']]) { g.fillStyle = c; g.beginPath(); g.arc(HOUSE.x, HOUSE.y, r, 0, TAU); g.fill(); }
      g.strokeStyle = '#33557a'; g.lineWidth = 2; g.beginPath(); g.moveTo(SHEET.l, HOUSE.y); g.lineTo(SHEET.r, HOUSE.y); g.moveTo(HOUSE.x, SHEET.t); g.lineTo(HOUSE.x, SHEET.b); g.stroke();
      g.strokeStyle = '#e63946'; g.lineWidth = 4; g.beginPath(); g.moveTo(HOG, SHEET.t); g.lineTo(HOG, SHEET.b); g.stroke();
      U.text(g, 'HOG LINE', HOG + 6, SHEET.t - 12, 11, '#ffffff99', 'left');
      g.fillStyle = '#555'; g.beginPath(); g.ellipse(HACK.x - 12, HACK.y + 12, 14, 5, 0, 0, TAU); g.fill();
    }
    function drawStone(g, s) {
      g.fillStyle = '#0003'; g.beginPath(); g.ellipse(s.x + 3, s.y + 4, SR, SR * 0.9, 0, 0, TAU); g.fill();
      g.fillStyle = '#9aa3ad'; g.beginPath(); g.arc(s.x, s.y, SR, 0, TAU); g.fill();
      g.fillStyle = '#c6ccd3'; g.beginPath(); g.arc(s.x, s.y, SR * 0.8, 0, TAU); g.fill();
      g.fillStyle = U.TEAM[s.team]; g.beginPath(); g.arc(s.x, s.y, SR * 0.46, 0, TAU); g.fill();
    }
    function draw(g) {
      drawIce(g);
      S.stones.forEach((s) => { if (!s.out) drawStone(g, s); });
      // current stone ready
      if (S.state === 'play' && (S.phase === 'aim' || S.phase === 'power')) {
        drawStone(g, { x: HACK.x, y: HACK.y, team: S.cur });
        const [dx, dy] = dir();
        g.strokeStyle = '#fcbf49'; g.lineWidth = 3; g.setLineDash([3, 9]); g.lineCap = 'round';
        g.beginPath(); g.moveTo(HACK.x + dx * 24, HACK.y + dy * 24); g.lineTo(HACK.x + dx * 640, HACK.y + dy * 640); g.stroke(); g.setLineDash([]);
        g.strokeStyle = '#fcbf49'; g.beginPath(); g.arc(HOUSE.x, HOUSE.y + S.aimOff, 12, 0, TAU); g.stroke();
      }
      // broom + thrower
      const p = P[S.cur];
      TS.chars.draw(g, p.who, p.outfit, { x: 70, y: 520, scale: 1.3, t: S.t, arm: S.phase === 'power' ? 1.4 : 0.5, moving: S.sweeping });
      if (S.sweeping && S.cur_stone) {
        const s = S.cur_stone, off = Math.sin(S.sweepAnim * 28) * 10;
        g.strokeStyle = '#7b4a1e'; g.lineWidth = 4; g.beginPath(); g.moveTo(s.x + 30, s.y - 46); g.lineTo(s.x + 34, s.y + off); g.stroke();
        g.fillStyle = '#e8c27a'; g.fillRect(s.x + 24, s.y + off - 4, 20, 8);
        for (let k = 0; k < 4; k++) { g.fillStyle = '#ffffff99'; g.fillRect(s.x + 52 + k * 8, s.y - 8 + k * 5, 7, 2); }
      }
      U.scoreboard(g, S.scores, 'End ' + Math.min(ENDS, S.end) + '/' + ENDS, S.state === 'play' ? S.cur : -1);
      // stones remaining
      for (let i = 0; i < 2; i++) {
        const used = S.shot - (S.end - 1) * STONES * 2;
        for (let k = 0; k < STONES; k++) {
          const thrown = Math.floor(Math.max(0, used - i) / 2) > k || (used > STONES * 2);
          g.fillStyle = thrown ? '#ffffff33' : U.TEAM[i]; g.beginPath(); g.arc(120 + i * 640 + k * 28, 150, 10, 0, TAU); g.fill();
        }
      }
      if (S.state === 'play') {
        const human = P[S.cur].human;
        if (S.phase === 'aim') U.hint(g, human ? '▲ ▼ aim at the button · Action to set the power' : U.NAMES[S.cur] + ' lines up the stone…');
        else if (S.phase === 'power') U.meter(g, 330, 552, 300, 20, S.power, [0.5, 0.68], human ? 'THROW WEIGHT · Action to release' : 'THROW WEIGHT');
        else if (S.phase === 'slide' && human) U.hint(g, 'HOLD Action to SWEEP — it carries the stone farther!');
      }
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 150, '#fcbf49');
    }

    const g = {
      title: '🥌 Curling',
      help: [
        'Two ends of three stones each. Slide stones toward the target — the team with the stone closest to the <b>button</b> scores one point for each of its stones that beats the other team’s best.',
        '<b>▲ ▼</b> aim, press <b>Action</b> to start the weight meter, then <b>Action</b> to release (aim for the green zone). While the stone slides, <b>hold Action to sweep</b> — it reduces friction and carries the stone farther!',
        'Stones that stop short of the red hog line, or slide off the sheet, are removed. You can knock your rival’s stones out of the house!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.curling = create;
})();
