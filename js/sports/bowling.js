// Bowling: top-down lane, five frames each. Pick a spot, aim, then power.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const LANE = { l: 380, r: 580, top: 56, foul: 520 };
  const CX = (LANE.l + LANE.r) / 2;
  const GUT = 30;
  const BALL_R = 12, PIN_R = 8;
  const FRAMES = 5;

  function rackPins() {
    const pins = [];
    const headY = 172;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        const x = CX + (i - row / 2) * 26, y = headY - row * 23;
        pins.push({ x, y, hx: x, hy: y, vx: 0, vy: 0, down: false, hit: false, fade: 0 });
      }
    }
    return pins;
  }

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, frame: 0, cur: 0, roll: 0, pins: rackPins(), phase: 'pos',
      x0: CX, angle: 0, aimT: 0, powT: 0, power: 0, ball: null, simT: 0, quiet: 0,
      card: [[], []], scores: [0, 0], msg: null, cpuT: 0, plan: null, before: 0, bonus: [0, 0],
    };
    const standing = () => S.pins.filter((p) => !p.down).length;

    // Frame f belongs to round floor(f/2); Henry first then Theo.
    function beginRoll() {
      const round = Math.floor(S.frame / 2);
      S.cur = S.frame % 2;
      S.phase = 'pos'; S.x0 = CX; S.angle = 0; S.aimT = 0; S.powT = 0; S.cpuT = 0; S.ball = null;
      S.before = standing();
      if (!P[S.cur].human) planCpu();
      S.msg = { text: U.NAMES[S.cur], sub: 'Frame ' + (round + 1) + ' · Roll ' + (S.roll + 1), t: 1.1 };
    }
    function newFrame() {
      S.pins = rackPins(); S.roll = 0; beginRoll();
    }
    newFrame();
    S.state = 'intro'; S.t = 0;

    function planCpu() {
      const alive = S.pins.filter((p) => !p.down);
      let tx = CX + 4, ty = 150;
      if (alive.length && S.roll > 0) { tx = alive.reduce((a, p) => a + p.hx, 0) / alive.length; ty = alive.reduce((a, p) => a + p.hy, 0) / alive.length; }
      const x0 = U.clamp(tx + U.gauss() * 26, CX - 85, CX + 85);
      const a = Math.atan2(tx - x0, LANE.foul - ty) + U.gauss() * 0.085;
      S.plan = { x0, angle: a, power: U.clamp(0.72 + U.gauss() * 0.16, 0.3, 1) };
    }

    function roll() {
      const speed = 330 + 560 * S.power;
      S.ball = { x: S.x0, y: LANE.foul, vx: Math.sin(S.angle) * speed, vy: -Math.cos(S.angle) * speed, gutter: false, done: false };
      S.phase = 'rolling'; S.simT = 0; S.quiet = 0;
      TS.sfx.swish();
    }

    function collide(a, b, ma, mb, rest) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      const nx = dx / d, ny = dy / d;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv >= 0) return false;
      const j = (-(1 + rest) * rv) / (1 / ma + 1 / mb);
      a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny;
      b.vx += (j / mb) * nx; b.vy += (j / mb) * ny;
      return true;
    }

    function simulate(dt) {
      const sub = 4, h = dt / sub;
      for (let s = 0; s < sub; s++) {
        const b = S.ball;
        if (b && !b.done) {
          b.x += b.vx * h; b.y += b.vy * h;
          if (!b.gutter && (b.x - BALL_R < LANE.l - 6 || b.x + BALL_R > LANE.r + 6)) {
            b.gutter = true; b.x = b.x < CX ? LANE.l - GUT / 2 : LANE.r + GUT / 2;
            const sp = Math.hypot(b.vx, b.vy); b.vx = 0; b.vy = -sp; TS.sfx.thud();
          }
          if (b.y < 30) b.done = true;
        }
        const ball = S.ball && !S.ball.done && !S.ball.gutter ? S.ball : null;
        for (const p of S.pins) {
          p.x += p.vx * h; p.y += p.vy * h;
          const f = Math.exp(-3.2 * h); p.vx *= f; p.vy *= f;
          if (p.y < LANE.top + PIN_R) { p.y = LANE.top + PIN_R; p.vy = Math.abs(p.vy) * 0.3; }
          if (p.x < LANE.l - GUT + PIN_R) { p.x = LANE.l - GUT + PIN_R; p.vx = Math.abs(p.vx) * 0.3; }
          if (p.x > LANE.r + GUT - PIN_R) { p.x = LANE.r + GUT - PIN_R; p.vx = -Math.abs(p.vx) * 0.3; }
        }
        if (ball) {
          const bm = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
          for (const p of S.pins) {
            if (Math.hypot(p.x - ball.x, p.y - ball.y) < BALL_R + PIN_R) {
              if (collide(bm, p, 5, 1, 0.4)) { if (!p.hit) TS.sfx.hit(); p.hit = true; p.down = true; }
              const d = Math.hypot(p.x - ball.x, p.y - ball.y) || 1;
              p.x = ball.x + ((p.x - ball.x) / d) * (BALL_R + PIN_R); p.y = ball.y + ((p.y - ball.y) / d) * (BALL_R + PIN_R);
            }
          }
          ball.vx = bm.vx * 0.999; ball.vy = bm.vy * 0.999;
        }
        for (let i = 0; i < S.pins.length; i++) {
          for (let j = i + 1; j < S.pins.length; j++) {
            const a = S.pins[i], c = S.pins[j];
            const d = Math.hypot(a.x - c.x, a.y - c.y);
            if (d < PIN_R * 2 && (a.vx || a.vy || c.vx || c.vy)) {
              if (Math.hypot(a.vx - c.vx, a.vy - c.vy) > 130 && (a.hit || c.hit)) { a.down = true; c.down = true; a.hit = true; c.hit = true; }
              collide(a, c, 1, 1, 0.5);
              const ov = (PIN_R * 2 - d) / 2 + 0.01, nx = (c.x - a.x) / (d || 1), ny = (c.y - a.y) / (d || 1);
              a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
            }
          }
        }
      }
      // pins that slid far from home count as knocked too
      for (const p of S.pins) if (!p.down && Math.hypot(p.x - p.hx, p.y - p.hy) > 24) p.down = true;
    }

    function finishRoll() {
      const knocked = S.before - standing();
      S.card[S.cur].push(knocked);
      let gain = knocked, text, sub = '';
      const strike = S.roll === 0 && standing() === 0;
      const spare = S.roll === 1 && standing() === 0;
      if (strike) { gain += 5; text = 'STRIKE!'; sub = '+15'; TS.sfx.goal(); }
      else if (spare) { gain += 3; text = 'SPARE!'; sub = '+3 bonus'; TS.sfx.win(); }
      else if (knocked === 0) { text = S.ball && S.ball.gutter ? 'GUTTER BALL' : 'MISS'; }
      else { text = knocked + ' PIN' + (knocked > 1 ? 'S' : ''); }
      S.scores[S.cur] += gain;
      S.msg = { text, sub: sub || (gain !== knocked ? '' : ''), t: 1.4 };
      S.phase = 'after'; S.t = 0; S.endFrame = strike || S.roll === 1;
    }

    function next() {
      if (S.endFrame) {
        S.frame++;
        if (S.frame >= FRAMES * 2) {
          S.state = 'over'; S.t = 0;
          S.msg = { text: 'GAME OVER', sub: S.scores[0] + ' – ' + S.scores[1], t: 99 };
          return;
        }
        newFrame();
      } else {
        S.pins = S.pins.filter((p) => !p.down);
        S.roll = 1; beginRoll();
      }
    }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.5) S.state = 'play'; return; }
      if (S.state === 'over') {
        if (S.t > 1.6 && !g.over) {
          g.over = true;
          g.result = { winner: S.scores[0] === S.scores[1] ? null : (S.scores[0] > S.scores[1] ? 0 : 1), scores: S.scores.slice(), summary: 'Final score: Henry ' + S.scores[0] + ' – ' + S.scores[1] + ' Theo' };
        }
        return;
      }
      const human = P[S.cur].human;
      const pad = TS.input.pad(S.cur);
      if (S.phase === 'pos') {
        S.cpuT += dt;
        if (human) {
          S.x0 = U.clamp(S.x0 + pad.x * 170 * dt, CX - 85, CX + 85);
          if (S.cpuT > 0.4 && pad.actP) { S.phase = 'aim'; S.aimT = 0; TS.sfx.click(); }
        } else {
          S.x0 += (S.plan.x0 - S.x0) * Math.min(1, dt * 4);
          if (S.cpuT > 1.1) { S.x0 = S.plan.x0; S.phase = 'aim'; S.aimT = 0; S.cpuT = 0; }
        }
      } else if (S.phase === 'aim') {
        S.aimT += dt;
        if (human) {
          S.angle = Math.sin(S.aimT * 2.4) * 0.22;
          if (pad.actP) { S.phase = 'power'; S.powT = 0; TS.sfx.click(); }
        } else {
          S.cpuT += dt;
          S.angle += (S.plan.angle - S.angle) * Math.min(1, dt * 5);
          if (S.cpuT > 0.7) { S.angle = S.plan.angle; S.phase = 'power'; S.powT = 0; S.cpuT = 0; }
        }
      } else if (S.phase === 'power') {
        S.powT += dt;
        if (human) {
          S.power = U.tri(S.powT / 0.65);
          if (pad.actP) roll();
        } else {
          S.power = S.plan.power * U.clamp(S.powT / 0.5, 0, 1);
          if (S.powT > 0.6) { S.power = S.plan.power; roll(); }
        }
      } else if (S.phase === 'rolling') {
        S.simT += dt; simulate(dt);
        const moving = S.pins.some((p) => Math.hypot(p.vx, p.vy) > 14);
        S.quiet = moving || (S.ball && !S.ball.done) ? 0 : S.quiet + dt;
        if (S.quiet > 0.4 || S.simT > 5.5) finishRoll();
      } else if (S.phase === 'after') {
        if (S.t > 1.6) next();
      }
    }

    // ---------- drawing ----------
    function drawLane(g) {
      g.fillStyle = '#1a1230'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#201638' : '#251a42'; g.fillRect(0, i * 38, 960, 39); }
      g.fillStyle = '#0b0714'; g.fillRect(LANE.l - GUT, LANE.top - 10, GUT, 520); g.fillRect(LANE.r, LANE.top - 10, GUT, 520);
      const wood = g.createLinearGradient(LANE.l, 0, LANE.r, 0);
      wood.addColorStop(0, '#d9a45c'); wood.addColorStop(0.5, '#e8b972'); wood.addColorStop(1, '#d9a45c');
      g.fillStyle = wood; g.fillRect(LANE.l, LANE.top, LANE.r - LANE.l, 480);
      g.strokeStyle = '#00000018'; g.lineWidth = 1;
      for (let x = LANE.l; x <= LANE.r; x += 10) { g.beginPath(); g.moveTo(x, LANE.top); g.lineTo(x, LANE.foul + 20); g.stroke(); }
      g.fillStyle = '#fff'; g.fillRect(LANE.l, LANE.foul + 12, LANE.r - LANE.l, 4);
      g.fillStyle = '#c0392b';
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(CX + i * 24, 438 + Math.abs(i) * 8); g.lineTo(CX + i * 24 - 5, 450 + Math.abs(i) * 8); g.lineTo(CX + i * 24 + 5, 450 + Math.abs(i) * 8); g.fill(); }
      g.fillStyle = '#111'; g.fillRect(LANE.l - GUT, 28, LANE.r - LANE.l + GUT * 2, 30);
      g.fillStyle = '#2a2a2a'; g.fillRect(LANE.l - GUT, 28, LANE.r - LANE.l + GUT * 2, 4);
    }
    function drawPin(g, p) {
      g.save(); g.translate(p.x, p.y);
      if (p.down) {
        g.globalAlpha = 0.85; g.rotate((p.hx * 0.07) % 3);
        g.fillStyle = '#e6e6e6'; g.beginPath(); g.ellipse(0, 0, 4, 9, 0, 0, TAU); g.fill();
        g.fillStyle = '#d62828'; g.fillRect(-4, -2, 8, 3);
      } else {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(2, 3, 8, 4, 0, 0, TAU); g.fill();
        g.fillStyle = '#fafafa'; g.beginPath(); g.arc(0, 0, PIN_R, 0, TAU); g.fill();
        g.fillStyle = '#d62828'; g.beginPath(); g.arc(0, 0, 4.2, 0, TAU); g.fill();
        g.fillStyle = '#fafafa'; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill();
      }
      g.restore();
    }
    function drawBall(g, x, y) {
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 3, y + 5, BALL_R, BALL_R * 0.8, 0, 0, TAU); g.fill();
      const gr = g.createRadialGradient(x - 4, y - 4, 2, x, y, BALL_R);
      gr.addColorStop(0, U.TEAM[S.cur] === '#e63946' ? '#ff8a8a' : '#8ab8ff'); gr.addColorStop(1, U.TEAM[S.cur]);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, BALL_R, 0, TAU); g.fill();
      g.fillStyle = '#111'; for (const [dx, dy] of [[-3, -3], [3, -2], [0, 3]]) { g.beginPath(); g.arc(x + dx, y + dy, 1.8, 0, TAU); g.fill(); }
    }
    function drawCard(g) {
      for (let i = 0; i < 2; i++) {
        const x = i ? 786 : 12, y = 90;
        U.panel(g, x, y, 162, 250, 14);
        U.text(g, U.NAMES[i].toUpperCase(), x + 12, y + 20, 16, U.TEAM[i]);
        U.text(g, String(S.scores[i]), x + 150, y + 20, 22, '#fff', 'right');
        // pins per frame (derived from the roll list)
        let idx = 0;
        for (let f = 0; f < FRAMES; f++) {
          const r1 = S.card[i][idx], isStrike = r1 === 10;
          const r2 = isStrike ? undefined : S.card[i][idx + 1];
          idx += isStrike ? 1 : 2;
          const rowY = y + 52 + f * 38;
          U.text(g, 'F' + (f + 1), x + 12, rowY, 12, '#ffffff88');
          const cur = S.cur === i && Math.floor(S.frame / 2) === f && S.state !== 'over';
          g.strokeStyle = cur ? '#fcbf49' : '#ffffff33'; g.lineWidth = 2;
          g.strokeRect(x + 40, rowY - 14, 52, 28); g.strokeRect(x + 92, rowY - 14, 52, 28);
          const a = r1 === undefined ? '' : (isStrike ? 'X' : (r1 === 0 ? '–' : r1));
          let b = '';
          if (!isStrike && r2 !== undefined) b = (r1 + r2 === 10 ? '/' : (r2 === 0 ? '–' : r2));
          U.text(g, String(a), x + 66, rowY, 18, '#fff', 'center');
          U.text(g, String(b), x + 118, rowY, 18, '#fff', 'center');
        }
      }
    }
    function draw(g) {
      drawLane(g);
      S.pins.forEach((p) => drawPin(g, p));
      if (S.state !== 'over' && S.phase !== 'after') {
        if (S.ball) drawBall(g, S.ball.x, S.ball.y);
        else {
          drawBall(g, S.x0, LANE.foul);
          if (S.phase === 'aim' || S.phase === 'power') {
            g.strokeStyle = '#fcbf49'; g.lineWidth = 3; g.setLineDash([3, 9]); g.lineCap = 'round';
            g.beginPath(); g.moveTo(S.x0, LANE.foul - 16); g.lineTo(S.x0 + Math.sin(S.angle) * 440, LANE.foul - 16 - Math.cos(S.angle) * 440); g.stroke(); g.setLineDash([]);
          }
        }
      }
      // bowler
      const p = P[S.cur];
      TS.chars.draw(g, p.who, p.outfit, { x: S.x0 + (S.x0 < CX ? -44 : 44), y: 590, scale: 0.85, t: S.t, arm: S.phase === 'rolling' ? 1.2 : 0 });
      drawCard(g);
      U.scoreboard(g, S.scores, 'F' + (Math.floor(S.frame / 2) + 1) + '/' + FRAMES, S.cur);
      if (S.state === 'play' || S.state === 'intro') {
        const human = P[S.cur].human;
        if (S.phase === 'pos') U.hint(g, human ? '◀ ▶ choose where to stand · Action to lock' : U.NAMES[S.cur] + ' picks a spot…');
        else if (S.phase === 'aim' && human) U.hint(g, 'Action to lock the angle');
        else if (S.phase === 'power') U.meter(g, 380, 560, 200, 18, S.power, [0.7, 0.95], human ? 'POWER · Action to roll' : 'POWER');
      }
      if (S.msg) U.big(g, S.msg.text, S.msg.sub, 280, '#fcbf49');
    }

    const g = {
      title: '🎳 Bowling',
      help: [
        'Five frames each, taking turns. Knock down as many pins as you can in two rolls — a <b>strike</b> is worth +5 bonus, a <b>spare</b> +3.',
        '<b>◀ ▶</b> choose where to stand, then press <b>Action</b> to lock it. A swinging line sets your angle — press <b>Action</b> to lock — then time the <b>power</b> meter.',
        'Stay on the lane: a gutter ball scores nothing!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.bowling = create;
})();
