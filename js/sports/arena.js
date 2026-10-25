// Hockey, soccer and lacrosse: one top-down "ball in a goal" engine with per-sport settings.
(function () {
  const TS = (window.TS = window.TS || {});
  TS.sports = TS.sports || {};

  const W = 960, H = 600;
  const L = 100, R = 860, T = 110, B = 540, CY = (T + B) / 2;
  const TEAM = ['#e63946', '#3a86ff'];
  const NAMES = ['HENRY', 'THEO'];
  const TAU = Math.PI * 2;

  const CFG = {
    hockey: {
      title: '🏒 Hockey', time: 60, speed: 270, slip: 3.4, pr: 20, br: 8, damp: 0.3, wallRest: 0.92,
      kick: 840, goalH: 140, collRest: 0.55, ai: 0.9,
      help: ['Push the puck with your body, or hit <b>Action</b> to slap it.', 'Score in the other goal — the net on the far side. First to lead after 60 seconds wins!'],
    },
    airhockey: {
      title: '💨 Air Hockey', time: 60, speed: 340, slip: 16, pr: 27, br: 14, damp: 0.1, wallRest: 0.97,
      kick: 900, goalH: 200, collRest: 0.92, ai: 0.95,
      help: ['Slide your paddle into the puck to knock it into the other goal — the puck barely slows down, so watch the bounces!', 'Press <b>Action</b> near the puck to smash it harder. Most goals in 60 seconds wins; ties go to overtime.'],
    },
    soccer: {
      title: '⚽ Soccer', time: 60, speed: 235, slip: 12, pr: 18, br: 12, damp: 1.5, wallRest: 0.75,
      kick: 720, goalH: 170, collRest: 0.4, ai: 0.88,
      help: ['Run into the ball to dribble it. Press <b>Action</b> to kick it the way you are facing.', 'Henry attacks the right goal, Theo attacks the left. Most goals in 60 seconds wins!'],
    },
    lacrosse: {
      title: '🥍 Lacrosse', time: 60, speed: 250, slip: 12, pr: 18, br: 8, damp: 1.3, wallRest: 0.7,
      kick: 780, goalH: 84, collRest: 0, ai: 0.9,
      help: ['Run over the ball to scoop it up in your stick. <b>Action</b> throws it where you are facing.', 'No ball? Get close to the other player and press <b>Action</b> to check them and steal it!'],
    },
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hyp = Math.hypot;

  function create(kind, ctx) {
    const C = CFG[kind];
    const look = kind === 'airhockey' ? 'hockey' : kind; // draws like hockey, tinted
    const AIR = kind === 'airhockey';
    const mid = (L + R) / 2;
    const players = [0, 1].map((i) => ({
      idx: i, who: ctx.players[i].who, outfit: ctx.players[i].outfit, human: ctx.players[i].human,
      x: i ? R - 190 : L + 190, y: CY, vx: 0, vy: 0, fx: i ? -1 : 1, fy: 0,
      r: C.pr, cd: 0, swing: 0, pickCd: 0, grace: 0, t: Math.random() * 5, moving: false,
      aiDelay: 0, aiJit: 0,
    }));
    const ball = { x: mid, y: CY, vx: 0, vy: 0, r: C.br, carrier: null, spin: 0 };
    const S = {
      state: 'countdown', timer: 3.2, left: C.time, ot: false, score: [0, 0],
      msg: null, confetti: [], lastScorer: -1, endTimer: 0, t: 0, otTime: 0,
    };
    // static crowd
    const crowd = [];
    for (let i = 0; i < 260; i++) {
      crowd.push({ x: rnd(0, W), y: rnd(8, 92), c: ['#e63946', '#fcbf49', '#4cc9f0', '#ffffff', '#8338ec', '#6a994e', '#ff70a6'][i % 7], s: rnd(5, 8) });
    }

    function resetPositions() {
      players.forEach((p, i) => {
        p.x = i ? R - 190 : L + 190; p.y = CY; p.vx = p.vy = 0; p.fx = i ? -1 : 1; p.fy = 0;
        p.cd = 0; p.swing = 0; p.pickCd = 0; p.grace = 0;
      });
      ball.x = mid; ball.y = CY; ball.vx = ball.vy = 0; ball.carrier = null;
    }

    function goalScored(scorer) {
      S.score[scorer]++;
      S.lastScorer = scorer;
      S.state = 'goal';
      S.timer = 2;
      S.msg = { text: 'GOAL!', sub: NAMES[scorer] + ' scores!', t: 2 };
      TS.sfx.goal();
      for (let i = 0; i < 60; i++) {
        S.confetti.push({ x: mid + rnd(-60, 60), y: CY, vx: rnd(-260, 260), vy: rnd(-420, -120), c: TEAM[scorer], c2: ['#fcbf49', '#fff', '#4cc9f0'][i % 3], life: rnd(1, 2) });
      }
      ball.carrier = null;
      if (S.ot || false) { /* sudden death handled in finish check */ }
    }

    function finish() {
      S.state = 'over';
      S.endTimer = 1.6;
      S.msg = { text: S.score[0] === S.score[1] ? 'DRAW' : 'FINAL', sub: S.score[0] + ' – ' + S.score[1], t: 99 };
    }

    // ---------- AI ----------
    function aiCmd(p) {
      const o = players[1 - p.idx];
      const goalX = p.idx === 0 ? R : L;
      const cmd = { x: 0, y: 0, act: false, aim: null };
      const sp = hyp(ball.x - p.x, ball.y - p.y);
      const steer = (tx, ty) => {
        const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
        if (d > 6) { cmd.x = dx / d; cmd.y = dy / d; }
      };
      const gdx = goalX - ball.x, gdy = CY - ball.y, gd = hyp(gdx, gdy) || 1;
      const gx = gdx / gd, gy = gdy / gd;

      if (kind === 'lacrosse' && ball.carrier === p) {
        const ty = CY + Math.sin(S.t * 1.3 + p.idx) * 90;
        steer(goalX + (p.idx ? 160 : -160), ty);
        const dg = Math.abs(goalX - p.x);
        if (dg < 300 && p.cd <= 0) {
          p.aiDelay -= 1 / 60;
          if (p.aiDelay <= 0) {
            const aimY = CY + rnd(-C.goalH * 0.3, C.goalH * 0.3);
            const ax = goalX - p.x, ay = aimY - p.y, ad = hyp(ax, ay);
            cmd.aim = [ax / ad, ay / ad]; cmd.act = true; p.aiDelay = rnd(0.2, 0.6);
          }
        }
        return cmd;
      }
      if (kind === 'lacrosse' && ball.carrier === o) {
        steer(o.x, o.y);
        if (hyp(o.x - p.x, o.y - p.y) < 48 && p.cd <= 0) cmd.act = true;
        return cmd;
      }
      // chase the ball, approaching from behind it (relative to the goal we attack)
      const along = (ball.x - p.x) * gx + (ball.y - p.y) * gy;
      let tx, ty;
      if (along < 12) {
        const side = p.y < ball.y ? -1 : 1;
        tx = ball.x - gx * 48 + -gy * side * 46;
        ty = ball.y - gy * 48 + gx * side * 46;
        if (hyp(p.x - ball.x, p.y - ball.y) > 120) { tx = ball.x - gx * 40; ty = ball.y - gy * 40; }
      } else {
        tx = ball.x - gx * (p.r + ball.r - 2); ty = ball.y - gy * (p.r + ball.r - 2);
      }
      steer(tx, ty);
      if (kind !== 'lacrosse' && sp < p.r + ball.r + 16 && along > 0 && p.cd <= 0) {
        p.aiDelay -= 1 / 60;
        if (p.aiDelay <= 0) {
          const aimY = CY + rnd(-C.goalH * 0.3, C.goalH * 0.3);
          const ax = goalX - ball.x, ay = aimY - ball.y, ad = hyp(ax, ay);
          cmd.aim = [ax / ad, ay / ad]; cmd.act = true; p.aiDelay = rnd(0.1, 0.45);
        }
      }
      return cmd;
    }

    // ---------- update ----------
    function update(dt) {
      S.t += dt;
      players.forEach((p) => { p.t += dt; });
      S.confetti.forEach((c) => { c.vy += 700 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt; });
      S.confetti = S.confetti.filter((c) => c.life > 0);
      if (S.msg && S.msg.t < 90) S.msg.t -= dt;

      if (S.state === 'countdown') {
        const before = Math.ceil(S.timer);
        S.timer -= dt;
        if (Math.ceil(S.timer) !== before && S.timer > 0) TS.sfx.beep();
        movePlayers(dt, true);
        if (S.timer <= 0) { S.state = 'play'; TS.sfx.go(); }
        return;
      }
      if (S.state === 'goal') {
        S.timer -= dt;
        movePlayers(dt, true);
        if (S.timer <= 0) {
          if (S.ot || S.left <= 0) {
            if (S.score[0] !== S.score[1]) { finish(); return; }
          }
          resetPositions(); S.state = 'countdown'; S.timer = 1.2; S.msg = null;
        }
        return;
      }
      if (S.state === 'over') {
        S.endTimer -= dt;
        if (S.endTimer <= 0 && !g.over) {
          g.over = true;
          const w = S.score[0] === S.score[1] ? null : (S.score[0] > S.score[1] ? 0 : 1);
          g.result = { winner: w, scores: S.score.slice(), summary: 'Final score: Henry ' + S.score[0] + ' – ' + S.score[1] + ' Theo' };
        }
        movePlayers(dt, true);
        return;
      }

      // play
      if (!S.ot) {
        S.left -= dt;
        if (S.left <= 0) {
          S.left = 0;
          if (S.score[0] !== S.score[1]) { finish(); TS.sfx.beep(); return; }
          S.ot = true; S.msg = { text: 'OVERTIME!', sub: 'Next goal wins (30s)', t: 2 };
        }
      }
      if (S.ot) {
        S.otTime += dt;
        if (S.otTime > 30) { finish(); return; }
      }
      movePlayers(dt, false);
      moveBall(dt);
    }

    function movePlayers(dt, frozen) {
      (Math.random() < 0.5 ? players : [players[1], players[0]]).forEach((p) => {
        p.cd = Math.max(0, p.cd - dt); p.swing = Math.max(0, p.swing - dt);
        p.pickCd = Math.max(0, p.pickCd - dt); p.grace = Math.max(0, p.grace - dt);
        let cmd = { x: 0, y: 0, act: false, aim: null };
        if (!frozen) {
          if (p.human) { const pd = TS.input.pad(p.idx); cmd = { x: pd.x, y: pd.y, act: pd.actP, aim: null }; }
          else cmd = aiCmd(p);
        }
        let dx = cmd.x, dy = cmd.y;
        const len = hyp(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        const sp = C.speed * (ball.carrier === p ? 0.92 : 1) * (p.human ? 1 : C.ai);
        const k = 1 - Math.exp(-C.slip * dt);
        p.vx += (dx * sp - p.vx) * k;
        p.vy += (dy * sp - p.vy) * k;
        p.x = clamp(p.x + p.vx * dt, L + p.r, R - p.r);
        p.y = clamp(p.y + p.vy * dt, T + p.r, B - p.r);
        if (len > 0.1) { p.fx = dx / len; p.fy = dy / len; }
        p.moving = hyp(p.vx, p.vy) > 40;
        if (cmd.act && p.cd <= 0) action(p, cmd.aim);
      });
      // body collisions
      const a = players[0], b = players[1];
      const d = hyp(b.x - a.x, b.y - a.y), min = a.r + b.r;
      if (d < min && d > 0.01) {
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        if (kind === 'lacrosse' && !frozen) tackle(a, b);
      }
    }

    function tackle(a, b) {
      const c = ball.carrier;
      if (!c) return;
      const o = c === a ? b : a;
      if (c.grace > 0 || o.pickCd > 0) return;
      ball.carrier = null;
      const ang = Math.atan2(c.y - o.y, c.x - o.x) + rnd(-0.8, 0.8);
      ball.vx = Math.cos(ang) * 230; ball.vy = Math.sin(ang) * 230;
      c.pickCd = 0.8;
      TS.sfx.thud();
    }

    function action(p, aim) {
      p.cd = 0.32; p.swing = 0.25;
      if (aim) { p.fx = aim[0]; p.fy = aim[1]; }
      const o = players[1 - p.idx];
      if (kind === 'lacrosse') {
        if (ball.carrier === p) {
          ball.carrier = null;
          ball.x = p.x + p.fx * 26; ball.y = p.y + p.fy * 26;
          ball.vx = p.fx * C.kick + p.vx * 0.3; ball.vy = p.fy * C.kick + p.vy * 0.3;
          p.pickCd = 0.45; TS.sfx.swish();
        } else if (ball.carrier === o && hyp(o.x - p.x, o.y - p.y) < p.r + o.r + 22 && o.grace <= 0) {
          ball.carrier = null;
          ball.vx = p.fx * 160; ball.vy = p.fy * 160;
          o.pickCd = 0.8; p.pickCd = 0; TS.sfx.thud();
        }
        return;
      }
      if (hyp(ball.x - p.x, ball.y - p.y) < p.r + ball.r + 20) {
        ball.vx = p.fx * C.kick + p.vx * 0.3; ball.vy = p.fy * C.kick + p.vy * 0.3;
        TS.sfx.hit();
      }
    }

    function moveBall(dt) {
      if (ball.carrier) {
        const c = ball.carrier;
        ball.x = c.x + c.fx * 28; ball.y = c.y + c.fy * 20; ball.vx = ball.vy = 0;
        return;
      }
      const steps = 3, h = dt / steps;
      for (let s = 0; s < steps; s++) {
        ball.x += ball.vx * h; ball.y += ball.vy * h;
        const f = Math.exp(-C.damp * h);
        ball.vx *= f; ball.vy *= f;
        const sp = hyp(ball.vx, ball.vy);
        if (sp > 1000) { ball.vx *= 1000 / sp; ball.vy *= 1000 / sp; }
        // walls and goal mouths
        const inMouth = Math.abs(ball.y - CY) < C.goalH / 2 - ball.r * 0.6;
        if (ball.y - ball.r < T) { ball.y = T + ball.r; ball.vy = Math.abs(ball.vy) * C.wallRest; }
        if (ball.y + ball.r > B) { ball.y = B - ball.r; ball.vy = -Math.abs(ball.vy) * C.wallRest; }
        if (ball.x - ball.r < L) {
          if (inMouth) { if (ball.x < L - 6) { goalScored(1); return; } }
          else { ball.x = L + ball.r; ball.vx = Math.abs(ball.vx) * C.wallRest; }
        }
        if (ball.x + ball.r > R) {
          if (inMouth) { if (ball.x > R + 6) { goalScored(0); return; } }
          else { ball.x = R - ball.r; ball.vx = -Math.abs(ball.vx) * C.wallRest; }
        }
        // players
        if (kind === 'lacrosse') {
          const near = players.filter((q) => q.pickCd <= 0 && hyp(ball.x - q.x, ball.y - q.y) < q.r + ball.r + 8);
          if (near.length) {
            let w = near[0];
            if (near.length > 1) {
              const d0 = hyp(ball.x - near[0].x, ball.y - near[0].y), d1 = hyp(ball.x - near[1].x, ball.y - near[1].y);
              w = Math.abs(d0 - d1) < 3 ? near[Math.random() < 0.5 ? 0 : 1] : (d0 < d1 ? near[0] : near[1]);
            }
            ball.carrier = w; w.grace = 1; ball.vx = ball.vy = 0; TS.sfx.click(); return;
          }
        }
        for (const p of players) {
          const dx = ball.x - p.x, dy = ball.y - p.y, d = hyp(dx, dy);
          if (kind === 'lacrosse') continue;
          const min = p.r + ball.r;
          if (d < min && d > 0.01) {
            const nx = dx / d, ny = dy / d;
            ball.x = p.x + nx * min; ball.y = p.y + ny * min;
            const rvx = ball.vx - p.vx, rvy = ball.vy - p.vy;
            const vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              ball.vx -= (1 + C.collRest) * vn * nx; ball.vy -= (1 + C.collRest) * vn * ny;
              if (-vn > 120) TS.sfx.thud();
            }
          }
        }
      }
    }

    // ---------- drawing ----------
    function drawField(g) {
      // stadium
      g.fillStyle = '#16213a'; g.fillRect(0, 0, W, H);
      crowd.forEach((c) => { g.fillStyle = c.c; g.globalAlpha = 0.85; g.fillRect(c.x, c.y + Math.sin(S.t * 3 + c.x) * 1.5, c.s, c.s); });
      g.globalAlpha = 1;
      g.fillStyle = '#0d1426'; g.fillRect(0, 96, W, 14);
      g.fillRect(0, B, W, H - B);

      if (look === 'hockey') {
        g.fillStyle = AIR ? '#1b3f7a' : '#e6f6fd'; g.fillRect(L, T, R - L, B - T);
        g.fillStyle = '#ffffff55';
        for (let i = 0; i < 18; i++) { g.fillRect(L + ((i * 97) % (R - L)), T + ((i * 53) % (B - T)), 60, 2); }
        g.strokeStyle = '#d63c4a'; g.lineWidth = 6; g.beginPath(); g.moveTo((L + R) / 2, T); g.lineTo((L + R) / 2, B); g.stroke();
        g.strokeStyle = '#3a6fd6'; g.lineWidth = 5;
        for (const x of [L + (R - L) / 3, R - (R - L) / 3]) { g.beginPath(); g.moveTo(x, T); g.lineTo(x, B); g.stroke(); }
        g.strokeStyle = '#d63c4a'; g.lineWidth = 3;
        g.beginPath(); g.arc((L + R) / 2, CY, 54, 0, TAU); g.stroke();
        for (const x of [L, R]) {
          g.fillStyle = '#7fb8e855'; g.strokeStyle = '#d63c4a'; g.lineWidth = 3;
          g.beginPath(); g.arc(x, CY, 62, x === L ? -Math.PI / 2 : Math.PI / 2, x === L ? Math.PI / 2 : -Math.PI / 2, false); g.closePath(); g.fill(); g.stroke();
        }
      } else if (kind === 'soccer') {
        for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3f8f3f' : '#46a047'; g.fillRect(L + i * ((R - L) / 12), T, (R - L) / 12 + 1, B - T); }
        g.strokeStyle = '#ffffffcc'; g.lineWidth = 3;
        g.beginPath(); g.moveTo((L + R) / 2, T); g.lineTo((L + R) / 2, B); g.stroke();
        g.beginPath(); g.arc((L + R) / 2, CY, 60, 0, TAU); g.stroke();
        g.strokeRect(L, CY - 110, 100, 220); g.strokeRect(R - 100, CY - 110, 100, 220);
        g.strokeRect(L, CY - 62, 38, 124); g.strokeRect(R - 38, CY - 62, 38, 124);
      } else {
        for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#4f9a3a' : '#59a843'; g.fillRect(L + i * ((R - L) / 9), T, (R - L) / 9 + 1, B - T); }
        g.strokeStyle = '#ffffffcc'; g.lineWidth = 3;
        g.beginPath(); g.moveTo((L + R) / 2, T); g.lineTo((L + R) / 2, B); g.stroke();
        for (const x of [L + 150, R - 150]) { g.beginPath(); g.moveTo(x, T); g.lineTo(x, B); g.stroke(); }
        g.beginPath(); g.arc((L + R) / 2, CY, 28, 0, TAU); g.stroke();
        g.fillStyle = '#ffffff22';
        for (const x of [L, R]) {
          g.beginPath(); g.arc(x, CY, 70, x === L ? -Math.PI / 2 : Math.PI / 2, x === L ? Math.PI / 2 : -Math.PI / 2); g.closePath(); g.fill(); g.stroke();
        }
      }
      // boards
      g.strokeStyle = look === 'hockey' ? '#f4f7ff' : '#ffffffee'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(L, CY - C.goalH / 2); g.lineTo(L, T); g.lineTo(R, T); g.lineTo(R, CY - C.goalH / 2); g.moveTo(L, CY + C.goalH / 2); g.lineTo(L, B); g.lineTo(R, B); g.lineTo(R, CY + C.goalH / 2); g.stroke();
      // goals
      for (const side of [-1, 1]) {
        const x = side < 0 ? L : R;
        const depth = 34 * side;
        g.fillStyle = 'rgba(255,255,255,.12)';
        g.fillRect(Math.min(x, x + depth), CY - C.goalH / 2, 34, C.goalH);
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
        for (let y = CY - C.goalH / 2; y <= CY + C.goalH / 2; y += 10) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + depth, y); g.stroke(); }
        for (let d = 0; d <= 34; d += 10) { g.beginPath(); g.moveTo(x + d * side, CY - C.goalH / 2); g.lineTo(x + d * side, CY + C.goalH / 2); g.stroke(); }
        g.strokeStyle = TEAM[side < 0 ? 0 : 1]; g.lineWidth = 5; // color = the team defending this goal
        g.beginPath(); g.moveTo(x + depth, CY - C.goalH / 2); g.lineTo(x, CY - C.goalH / 2); g.moveTo(x + depth, CY + C.goalH / 2); g.lineTo(x, CY + C.goalH / 2); g.moveTo(x + depth, CY - C.goalH / 2); g.lineTo(x + depth, CY + C.goalH / 2); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x, CY - C.goalH / 2, 5, 0, TAU); g.arc(x, CY + C.goalH / 2, 5, 0, TAU); g.fill();
      }
    }

    function drawBall(g) {
      const b = ball;
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath(); g.ellipse(b.x, b.y + b.r * 0.9, b.r * 1.0, b.r * 0.45, 0, 0, TAU); g.fill();
      const y = b.y - b.r * 0.5;
      if (look === 'hockey') {
        g.fillStyle = AIR ? '#ffd23f' : '#111'; g.fillRect(b.x - b.r, y - 3, b.r * 2, 7);
        g.beginPath(); g.ellipse(b.x, y - 3, b.r, b.r * 0.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#444'; g.beginPath(); g.ellipse(b.x, y - 3, b.r * 0.7, b.r * 0.32, 0, 0, TAU); g.fill();
      } else if (kind === 'soccer') {
        g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, y, b.r, 0, TAU); g.fill();
        g.strokeStyle = '#222'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#222';
        const a = (S.t * 3 + b.x * 0.05);
        for (let i = 0; i < 3; i++) { const t = a + i * 2.1; g.beginPath(); g.arc(b.x + Math.cos(t) * b.r * 0.5, y + Math.sin(t) * b.r * 0.5, b.r * 0.28, 0, TAU); g.fill(); }
      } else {
        g.fillStyle = '#ffb703'; g.beginPath(); g.arc(b.x, y, b.r, 0, TAU); g.fill();
        g.strokeStyle = '#a56200'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#ffffff88'; g.beginPath(); g.arc(b.x - 2, y - 2, 2, 0, TAU); g.fill();
      }
    }

    function drawStick(g, p) {
      if (kind === 'soccer') return;
      if (AIR) {
        const sw = p.swing > 0 ? 3 : 0;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(p.x + 3, p.y + 20, p.r, p.r * 0.55, 0, 0, TAU); g.fill();
        g.fillStyle = TEAM[p.idx]; g.beginPath(); g.ellipse(p.x, p.y + 14 - sw, p.r, p.r * 0.7, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffffff55'; g.beginPath(); g.ellipse(p.x, p.y + 14 - sw, p.r * 0.55, p.r * 0.38, 0, 0, TAU); g.fill();
        return;
      }
      const swing = p.swing > 0 ? Math.sin((1 - p.swing / 0.25) * Math.PI) * 0.9 : 0;
      const ang = Math.atan2(p.fy, p.fx) + swing * (p.fx >= 0 ? 1 : -1);
      const len = kind === 'hockey' ? 38 : 40;
      const sx = p.x + Math.cos(ang) * 6, sy = p.y - 6 + Math.sin(ang) * 4;
      const ex = p.x + Math.cos(ang) * len, ey = p.y + 4 + Math.sin(ang) * len * 0.55;
      g.lineCap = 'round';
      g.strokeStyle = '#7b4a1e'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = TEAM[p.idx]; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(sx + (ex - sx) * 0.1, sy + (ey - sy) * 0.1); g.lineTo(sx + (ex - sx) * 0.3, sy + (ey - sy) * 0.3); g.stroke();
      if (kind === 'hockey') {
        g.strokeStyle = '#222'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(ex - Math.sin(ang) * -6, ey + Math.cos(ang) * -3); g.lineTo(ex + 8 * Math.cos(ang), ey + 4); g.stroke();
      } else {
        g.strokeStyle = '#ddd'; g.lineWidth = 2.5; g.fillStyle = '#ffffff44';
        g.beginPath(); g.ellipse(ex + Math.cos(ang) * 5, ey + Math.sin(ang) * 3, 9, 6, ang, 0, TAU); g.fill(); g.stroke();
      }
    }

    function drawPlayer(g, p) {
      drawStick(g, p);
      const lift = 0;
      TS.chars.draw(g, p.who, p.outfit, {
        x: p.x, y: p.y + 12, scale: 0.62, t: p.t, moving: p.moving, facing: p.fx >= 0 ? 1 : -1,
        arm: p.swing > 0 ? 2.3 * Math.min(1, p.swing / 0.12) : 0,
        cheer: (S.state === 'goal' && S.lastScorer === p.idx) || (S.state === 'over' && S.score[p.idx] > S.score[1 - p.idx]),
        lift: lift,
        mood: S.state === 'goal' && S.lastScorer !== p.idx ? 'sad' : undefined,
      });
      // aim marker
      g.fillStyle = TEAM[p.idx];
      const ax = p.x + p.fx * (p.r + 12), ay = p.y + 12 + p.fy * (p.r + 6);
      const a = Math.atan2(p.fy, p.fx);
      g.save(); g.translate(ax, ay); g.rotate(a);
      g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(8, 0); g.lineTo(-4, -6); g.lineTo(-4, 6); g.closePath(); g.fill();
      g.restore(); g.globalAlpha = 1;
      // tag
      const tag = p.human ? (ctx.players[0].human && ctx.players[1].human ? 'P' + (p.idx + 1) : 'YOU') : 'CPU';
      g.font = '800 12px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
      const label = NAMES[p.idx] + ' · ' + tag;
      const w = g.measureText(label).width + 12;
      g.fillStyle = TEAM[p.idx]; TS.chars.rr(g, p.x - w / 2, p.y - 78, w, 17, 8); g.fill();
      g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(label, p.x, p.y - 69);
      if (ball.carrier === p) { g.fillStyle = '#fcbf49'; g.beginPath(); g.moveTo(p.x, p.y - 82); g.lineTo(p.x - 5, p.y - 90); g.lineTo(p.x + 5, p.y - 90); g.fill(); }
    }

    function drawHUD(g) {
      // scoreboard
      g.fillStyle = '#0b132bdd'; TS.chars.rr(g, W / 2 - 170, 8, 340, 62, 16); g.fill();
      g.strokeStyle = '#ffffff33'; g.lineWidth = 2; g.stroke();
      g.textBaseline = 'middle'; g.textAlign = 'center';
      g.font = '800 16px "Trebuchet MS", sans-serif';
      g.fillStyle = TEAM[0]; g.fillText('HENRY', W / 2 - 112, 24);
      g.fillStyle = TEAM[1]; g.fillText('THEO', W / 2 + 112, 24);
      g.fillStyle = '#fff'; g.font = '800 34px "Trebuchet MS", sans-serif';
      g.fillText(S.score[0], W / 2 - 112, 52); g.fillText(S.score[1], W / 2 + 112, 52);
      g.font = '800 26px "Trebuchet MS", sans-serif';
      const secs = Math.ceil(S.left);
      g.fillStyle = S.left < 10 && !S.ot ? '#ff6b6b' : '#fcbf49';
      g.fillText(S.ot ? 'OT ' + Math.max(0, Math.ceil(30 - S.otTime)) : Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'), W / 2, 40);
      g.font = '700 14px "Trebuchet MS", sans-serif'; g.fillStyle = '#ffffffaa'; g.textAlign = 'left';
      g.fillText(C.title, 14, 584);
    }

    function drawMessages(g) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      let big = null, sub = '';
      if (S.state === 'countdown') {
        big = S.timer > 0.2 ? String(Math.ceil(S.timer - 0.2)) : 'GO!';
      } else if (S.msg && S.msg.t > 0) { big = S.msg.text; sub = S.msg.sub; }
      if (!big) return;
      const pop = 1;
      g.save(); g.translate(W / 2, H / 2 - 20); g.scale(pop, pop);
      g.font = '900 96px "Trebuchet MS", sans-serif';
      g.lineWidth = 12; g.strokeStyle = '#0b132b'; g.lineJoin = 'round';
      g.strokeText(big, 0, 0); g.fillStyle = '#fcbf49'; g.fillText(big, 0, 0);
      if (sub) {
        g.font = '800 34px "Trebuchet MS", sans-serif'; g.lineWidth = 8;
        g.strokeText(sub, 0, 66); g.fillStyle = '#fff'; g.fillText(sub, 0, 66);
      }
      g.restore();
    }

    function draw(g) {
      drawField(g);
      const items = [...players.map((p) => ({ y: p.y, f: () => drawPlayer(g, p) })), { y: ball.carrier ? ball.y + 30 : ball.y - 2, f: () => drawBall(g) }];
      items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
      S.confetti.forEach((c) => { g.fillStyle = c.life % 0.3 > 0.15 ? c.c : c.c2; g.fillRect(c.x, c.y, 7, 5); });
      drawHUD(g);
      drawMessages(g);
    }

    const g = { title: C.title, help: C.help, over: false, result: null, update, draw, debug: { S, players, ball } };
    return g;
  }

  ['hockey', 'airhockey', 'soccer', 'lacrosse'].forEach((k) => { TS.sports[k] = (ctx) => create(k, ctx); });
})();
