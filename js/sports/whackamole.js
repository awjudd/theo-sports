// Whack-a-mole: each player has a 3x3 board and a 3x3 block of keys. Most points in 30 seconds.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const TIME = 30;
  const KEYS = [
    ['KeyQ', 'KeyW', 'KeyE', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC'],
    ['KeyU', 'KeyI', 'KeyO', 'KeyJ', 'KeyK', 'KeyL', 'KeyM', 'Comma', 'Period'],
  ];
  const LABEL = [['Q', 'W', 'E', 'A', 'S', 'D', 'Z', 'X', 'C'], ['U', 'I', 'O', 'J', 'K', 'L', 'M', ',', '.']];
  const BOARD = [{ x: 60, y: 170 }, { x: 510, y: 170 }];
  const CELL = 130;

  function create(ctx) {
    const P = ctx.players;
    const two = P[0].human && P[1].human;
    const S = {
      state: 'intro', t: 0, cd: 0, left: TIME, score: [0, 0], msg: null, combo: [0, 0],
      holes: [0, 1].map(() => Array.from({ length: 9 }, () => ({ mole: null, flash: null }))),
      spawnT: [0.5, 0.5], cpuT: [1, 1], bonk: [[], []],
    };
    S.msg = { text: 'WHACK-A-MOLE', sub: '30 seconds', t: 1.6 };
    const humanOf = (i) => P[i].human;

    function spawn(i) {
      const free = S.holes[i].map((h, k) => (h.mole ? -1 : k)).filter((k) => k >= 0);
      if (!free.length) return;
      const k = free[Math.floor(Math.random() * free.length)];
      const r = Math.random();
      const kind = r < 0.1 ? 'gold' : (r < 0.24 ? 'bomb' : 'mole');
      S.holes[i][k].mole = { kind, life: kind === 'gold' ? 0.8 : U.rnd(0.9, 1.5), age: 0 };
    }
    function whack(i, k) {
      const h = S.holes[i][k];
      const m = h.mole;
      if (!m) { S.combo[i] = 0; h.flash = { t: 0.25, text: '·', c: '#fff' }; return; }
      let pts = 0, txt, c;
      if (m.kind === 'mole') { S.combo[i]++; pts = 1 + Math.floor(S.combo[i] / 4); txt = '+' + pts; c = '#6a994e'; TS.sfx.hit(); }
      else if (m.kind === 'gold') { S.combo[i]++; pts = 5; txt = '+5'; c = '#fcbf49'; TS.sfx.win(); }
      else { S.combo[i] = 0; pts = -3; txt = '-3'; c = '#e63946'; TS.sfx.thud(); }
      S.score[i] = Math.max(0, S.score[i] + pts);
      h.mole = null; h.flash = { t: 0.5, text: txt, c };
    }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) { S.state = 'count'; S.cd = 3.2; } return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'play'; TS.sfx.go(); }
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) { g.over = true; g.result = { winner: S.score[0] === S.score[1] ? null : (S.score[0] > S.score[1] ? 0 : 1), scores: S.score.slice(), summary: 'Final score: Henry ' + S.score[0] + ' – ' + S.score[1] + ' Theo' }; }
        return;
      }
      S.left -= dt;
      if (S.left <= 0) { S.left = 0; S.state = 'over'; S.t = 0; S.msg = { text: 'TIME!', sub: S.score[0] + ' – ' + S.score[1], t: 99 }; TS.sfx.beep(); return; }
      const rate = 0.55 - 0.25 * (1 - S.left / TIME);
      for (let i = 0; i < 2; i++) {
        S.spawnT[i] -= dt;
        if (S.spawnT[i] <= 0) { spawn(i); S.spawnT[i] = rate * U.rnd(0.7, 1.3); }
        S.holes[i].forEach((h) => {
          if (h.flash) { h.flash.t -= dt; if (h.flash.t <= 0) h.flash = null; }
          if (h.mole) { h.mole.age += dt; if (h.mole.age >= h.mole.life) { if (h.mole.kind === 'mole') S.combo[i] = 0; h.mole = null; } }
        });
        if (humanOf(i)) {
          const set = two ? i : 0; // one human can use the Henry grid on their board
          const keys = KEYS[set];
          for (let k = 0; k < 9; k++) if (TS.input.pressed(keys[k])) whack(i, k);
          if (!two && !humanOf(1 - i)) { /* both CPU: nothing */ }
        } else {
          S.cpuT[i] -= dt;
          if (S.cpuT[i] <= 0) {
            const live = S.holes[i].map((h, k) => (h.mole && h.mole.kind !== 'bomb' && h.mole.age > 0.25 ? k : -1)).filter((k) => k >= 0);
            if (live.length && Math.random() < 0.9) whack(i, live[Math.floor(Math.random() * live.length)]);
            S.cpuT[i] = U.rnd(0.5, 0.85);
          }
        }
      }
    }

    function drawMole(g, cx, cy, m, i) {
      const u = m.age / m.life;
      const rise = Math.min(1, m.age / 0.15) * (u > 0.85 ? (1 - u) / 0.15 : 1);
      const h = 54 * rise;
      g.save();
      g.beginPath(); g.rect(cx - 40, cy - 70, 80, 70); g.clip();
      const by = cy + 10 - h;
      if (m.kind === 'bomb') {
        g.fillStyle = '#222'; g.beginPath(); g.arc(cx, by + 22, 24, 0, TAU); g.fill();
        g.fillStyle = '#ffffff44'; g.beginPath(); g.arc(cx - 8, by + 14, 6, 0, TAU); g.fill();
        g.strokeStyle = '#a56200'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + 12, by); g.quadraticCurveTo(cx + 22, by - 10, cx + 16, by - 18); g.stroke();
        g.fillStyle = Math.floor(S.t * 12) % 2 ? '#fcbf49' : '#e63946'; g.beginPath(); g.arc(cx + 16, by - 20, 5, 0, TAU); g.fill();
      } else {
        g.fillStyle = m.kind === 'gold' ? '#fcbf49' : '#8d5524';
        g.beginPath(); g.ellipse(cx, by + 24, 27, 30, 0, 0, TAU); g.fill();
        g.fillStyle = m.kind === 'gold' ? '#ffe28a' : '#c68642'; g.beginPath(); g.ellipse(cx, by + 32, 17, 15, 0, 0, TAU); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(cx - 10, by + 14, 4, 0, TAU); g.arc(cx + 10, by + 14, 4, 0, TAU); g.fill();
        g.fillStyle = '#e8a0a0'; g.beginPath(); g.arc(cx, by + 24, 5, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.fillRect(cx - 6, by + 31, 5, 7); g.fillRect(cx + 1, by + 31, 5, 7);
      }
      g.restore();
    }
    function draw(g) {
      g.fillStyle = '#5ab552'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#62bd59' : '#56ad4e'; g.fillRect(0, i * 50, 960, 50); }
      g.fillStyle = '#ffffff22'; g.fillRect(478, 100, 4, 480);
      for (let b = 0; b < 2; b++) {
        const o = BOARD[b];
        U.panel(g, o.x - 12, o.y - 18, CELL * 3 + 24, CELL * 3 + 20, 18, '#5b3a1e');
        for (let k = 0; k < 9; k++) {
          const cx = o.x + (k % 3) * CELL + CELL / 2, cy = o.y + Math.floor(k / 3) * CELL + CELL / 2 + 10;
          g.fillStyle = '#2d1b0c'; g.beginPath(); g.ellipse(cx, cy + 8, 46, 22, 0, 0, TAU); g.fill();
          const h = S.holes[b][k];
          if (h.mole) drawMole(g, cx, cy, h.mole, b);
          g.fillStyle = '#4a2f16'; g.beginPath(); g.ellipse(cx, cy + 14, 46, 18, 0, 0, Math.PI); g.fill();
          if (P[b].human) U.text(g, LABEL[two ? b : 0][k], o.x + (k % 3) * CELL + 14, o.y + Math.floor(k / 3) * CELL + 20, 14, '#ffffffaa', 'left');
          if (h.flash) { g.globalAlpha = Math.min(1, h.flash.t * 3); U.text(g, h.flash.text, cx, cy - 56 - (0.5 - h.flash.t) * 40, 26, h.flash.c, 'center', 900); g.globalAlpha = 1; }
        }
        U.text(g, U.NAMES[b].toUpperCase() + (S.combo[b] >= 4 ? '  🔥×' + (1 + Math.floor(S.combo[b] / 4)) : ''), o.x + CELL * 1.5, o.y - 38, 18, U.TEAM[b], 'center');
      }
      const secs = Math.ceil(S.left);
      U.scoreboard(g, S.score, '0:' + String(secs).padStart(2, '0'), -1);
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'GO!', '', 300, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 300, '#fcbf49');
      if (S.state === 'count' || (S.state === 'play' && S.left > TIME - 6)) U.hint(g, 'Press the key matching the hole! 🟤 mole +1 · 🟡 gold +5 · 💣 bomb −3');
    }

    const g = {
      title: '🔨 Whack-a-Mole',
      help: [
        'You each have a 3×3 board. Hit the key that matches the hole where a mole pops up — the letters are printed on your board. 30 seconds!',
        'Normal moles are <b>+1</b> (and more as your streak grows), golden moles are <b>+5</b>, but <b>bombs cost −3</b> — don’t hit those!',
        '<b>Henry:</b> Q W E / A S D / Z X C &nbsp;·&nbsp; <b>Theo (2 players):</b> U I O / J K L / M , .',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.whackamole = create;
})();
