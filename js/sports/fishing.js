// Fishing: cast, wait for a bite, hook it, then reel without snapping the line. Heaviest haul in 60 seconds wins.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const TIME = 60;
  const BOARD = [{ x: 30 }, { x: 500 }], BW = 430;
  const FISH = [
    { id: 'small', name: 'Sardine', pts: 1, amp: 0.45, freq: 2.4, rate: 0.55, w: 0.5, c: '#9ad1d4', size: 0.7 },
    { id: 'med', name: 'Trout', pts: 3, amp: 0.65, freq: 2.9, rate: 0.4, w: 0.3, c: '#e29578', size: 1.0 },
    { id: 'big', name: 'Bass', pts: 6, amp: 0.85, freq: 3.2, rate: 0.3, w: 0.15, c: '#6a994e', size: 1.4 },
    { id: 'gold', name: 'GOLDEN FISH', pts: 15, amp: 1.05, freq: 3.8, rate: 0.23, w: 0.05, c: '#fcbf49', size: 1.2 },
  ];
  const pickFish = () => { let r = Math.random(), a = 0; for (const f of FISH) { a += f.w; if (r < a) return f; } return FISH[0]; };

  function create(ctx) {
    const P = ctx.players;
    const mk = (i) => ({ idx: i, ph: 'idle', pt: 0, wait: 0, fish: null, tension: 0.4, prog: 0, score: 0, caught: [], t: Math.random() * 3, flash: null, cpu: null, hold: false, ripples: [] });
    const S = { state: 'intro', t: 0, cd: 0, left: TIME, pl: [mk(0), mk(1)], msg: null };
    S.msg = { text: 'FISHING', sub: '60 seconds on the lake', t: 1.6 };

    function say(p, text, c) { p.flash = { text, t: 1.1, c }; }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      S.pl.forEach((p) => { p.t += dt; if (p.flash) { p.flash.t -= dt; if (p.flash.t <= 0) p.flash = null; } p.ripples.forEach((r) => (r.t += dt)); p.ripples = p.ripples.filter((r) => r.t < 1); });
      if (S.state === 'intro') { if (S.t > 1.7) { S.state = 'count'; S.cd = 3.2; } return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'play'; TS.sfx.go(); }
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) { g.over = true; g.result = { winner: S.pl[0].score === S.pl[1].score ? null : (S.pl[0].score > S.pl[1].score ? 0 : 1), scores: S.pl.map((p) => p.score), summary: 'Haul — Henry ' + S.pl[0].score + ', Theo ' + S.pl[1].score + ' points' }; }
        return;
      }
      S.left -= dt;
      if (S.left <= 0) { S.left = 0; S.state = 'over'; S.t = 0; const a = S.pl[0].score, b = S.pl[1].score; S.msg = { text: a === b ? 'TIE' : U.NAMES[a > b ? 0 : 1].toUpperCase() + ' WINS!', sub: a + ' – ' + b, t: 99 }; TS.sfx.beep(); return; }
      for (const p of S.pl) {
        const human = P[p.idx].human;
        const pd = human ? TS.input.pad(p.idx) : null;
        const press = human ? pd.actP : false, held = human ? pd.act : false;
        p.pt += dt;
        if (p.ph === 'idle') {
          if (human ? (press && p.pt > 0.3) : p.pt > U.rnd(0.5, 1.2) && Math.random() < dt * 3) { p.ph = 'wait'; p.pt = 0; p.wait = U.rnd(1.4, 3.8); p.ripples.push({ t: 0 }); TS.sfx.swish(); }
        } else if (p.ph === 'wait') {
          if (human && press) { p.ph = 'idle'; p.pt = -0.4; say(p, 'TOO EARLY', '#fcbf49'); }
          else if (p.pt >= p.wait) { p.ph = 'bite'; p.pt = 0; p.ripples.push({ t: 0 }); TS.sfx.tone(900, 0.12, 'square', 0.07); }
        } else if (p.ph === 'bite') {
          const react = human ? press : p.pt > U.rnd(0.25, 0.55);
          if (react) {
            p.fish = pickFish(); p.ph = 'reel'; p.pt = 0; p.tension = 0.4; p.prog = 0; p.hold = false;
            if (!human) { p.cpu = { win: Math.random() < [0.92, 0.74, 0.55, 0.38][FISH.indexOf(p.fish)], dur: U.rnd(2.2, 4.2) / (0.6 + p.fish.rate) }; }
            TS.sfx.hit();
          } else if (p.pt > 0.9) { p.ph = 'idle'; p.pt = 0; say(p, 'IT GOT AWAY', '#ff9f9f'); }
        } else if (p.ph === 'reel') {
          const f = p.fish;
          if (human) {
            p.tension += (held ? 0.85 : -0.75) * dt;
            p.tension += Math.sin(p.pt * f.freq + p.idx) * f.amp * 0.55 * dt + Math.sin(p.pt * f.freq * 2.3) * f.amp * 0.3 * dt;
            p.tension = U.clamp(p.tension, 0, 1.02);
            if (p.tension >= 1) { p.ph = 'result'; p.pt = 0; p.res = 'snap'; say(p, 'LINE SNAPPED!', '#e63946'); TS.sfx.thud(); }
            else {
              if (p.tension > 0.3 && p.tension < 0.72) p.prog += f.rate * dt; else p.prog = Math.max(0, p.prog - 0.12 * dt);
              if (p.prog >= 1) { p.ph = 'result'; p.pt = 0; p.res = 'catch'; }
            }
          } else {
            p.tension = 0.5 + Math.sin(p.pt * 5) * 0.18; p.prog = U.clamp(p.pt / p.cpu.dur, 0, 1);
            if (p.pt >= p.cpu.dur) { p.ph = 'result'; p.pt = 0; p.res = p.cpu.win ? 'catch' : 'snap'; if (!p.cpu.win) { say(p, 'LINE SNAPPED!', '#e63946'); TS.sfx.thud(); } }
          }
          if (p.ph === 'result' && p.res === 'catch') {
            p.score += p.fish.pts; p.caught.push(p.fish); say(p, p.fish.name + '! +' + p.fish.pts, p.fish.c); if (p.fish.id === 'gold') TS.sfx.goal(); else TS.sfx.win();
          }
        } else if (p.ph === 'result') {
          if (p.pt > 1.2) { p.ph = 'idle'; p.pt = 0; p.fish = null; }
        }
      }
    }

    function fishShape(g, x, y, f, flip, a) {
      g.save(); g.translate(x, y); g.scale(flip, 1); g.rotate(a || 0);
      const s = f.size * 18;
      g.fillStyle = f.c; g.beginPath(); g.ellipse(0, 0, s * 1.6, s * 0.8, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-s * 1.4, 0); g.lineTo(-s * 2.4, -s * 0.8); g.lineTo(-s * 2.4, s * 0.8); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 0.9, -s * 0.2, s * 0.22, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(s * 0.95, -s * 0.2, s * 0.1, 0, TAU); g.fill();
      g.restore();
    }
    function drawBoard(g, p) {
      const x0 = BOARD[p.idx].x, cx = x0 + BW / 2;
      g.save(); g.beginPath(); g.rect(x0, 100, BW, 480); g.clip();
      const sky = g.createLinearGradient(0, 100, 0, 290); sky.addColorStop(0, '#6fb8ee'); sky.addColorStop(1, '#d9f0ff');
      g.fillStyle = sky; g.fillRect(x0, 100, BW, 190);
      g.fillStyle = '#7fb77e'; g.beginPath(); g.moveTo(x0, 290); g.quadraticCurveTo(x0 + 140, 240, x0 + 260, 280); g.quadraticCurveTo(x0 + 350, 250, x0 + BW, 285); g.lineTo(x0 + BW, 300); g.lineTo(x0, 300); g.fill();
      const water = g.createLinearGradient(0, 290, 0, 580); water.addColorStop(0, '#3fb7ee'); water.addColorStop(1, '#14639a');
      g.fillStyle = water; g.fillRect(x0, 290, BW, 290);
      g.strokeStyle = '#ffffff33'; g.lineWidth = 2; for (let k = 0; k < 9; k++) { const x = x0 + ((k * 97 + S.t * 14) % BW), y = 305 + (k * 41) % 250; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 4, x + 20, y); g.stroke(); }
      // swimming fish silhouettes
      for (let k = 0; k < 4; k++) { const fx = x0 + ((k * 130 + S.t * (14 + k * 4)) % (BW + 80)) - 40, fy = 400 + k * 38; g.globalAlpha = 0.25; fishShape(g, fx, fy, FISH[k % 3], 1); g.globalAlpha = 1; }
      // dock + angler
      g.fillStyle = '#8a5a2b'; g.fillRect(x0, 292, 150, 14); g.fillStyle = '#6b4423'; for (const dx of [14, 70, 126]) g.fillRect(x0 + dx, 306, 8, 70);
      const bx = x0 + 300, by = p.ph === 'bite' ? 362 + Math.sin(p.t * 40) * 4 : 352 + Math.sin(p.t * 2 + p.idx) * 2;
      TS.chars.draw(g, P[p.idx].who, P[p.idx].outfit, { x: x0 + 90, y: 296, scale: 1.25, t: p.t, arm: p.ph === 'reel' ? 1.0 : 0.4, mood: p.ph === 'result' && p.res === 'catch' ? 'cheer' : (p.res === 'snap' && p.ph === 'result' ? 'sad' : 'happy'), cheer: p.ph === 'result' && p.res === 'catch' });
      const rodTip = [x0 + 150, 184 + (p.ph === 'reel' ? Math.sin(p.t * 20) * 3 : 0)];
      g.strokeStyle = '#6b4423'; g.lineWidth = 4; g.beginPath(); g.moveTo(x0 + 108, 238); g.lineTo(rodTip[0], rodTip[1]); g.stroke();
      if (p.ph !== 'idle' && p.ph !== 'result') {
        g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(rodTip[0], rodTip[1]); g.quadraticCurveTo((rodTip[0] + bx) / 2, 230 + (p.ph === 'reel' ? p.tension * 30 : 0), bx, by); g.stroke();
        g.fillStyle = '#e63946'; g.beginPath(); g.arc(bx, by, 7, Math.PI, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 7, 0, Math.PI); g.fill();
        if (p.ph === 'bite') U.text(g, '!', bx, by - 36, 44, '#fcbf49', 'center', 900);
      }
      p.ripples.forEach((r) => { g.strokeStyle = 'rgba(255,255,255,' + (1 - r.t) * 0.7 + ')'; g.lineWidth = 2; g.beginPath(); g.ellipse(bx, 358, 10 + r.t * 40, 4 + r.t * 12, 0, 0, TAU); g.stroke(); });
      if (p.ph === 'reel') {
        const f = p.fish;
        fishShape(g, bx + 10 + Math.sin(p.t * 6) * 6, 380 + Math.cos(p.t * 4) * 8, f, -1, Math.sin(p.t * 9) * 0.25);
        // tension + progress
        U.panel(g, x0 + 20, 520, BW - 40, 50, 12);
        g.fillStyle = '#ffffff22'; g.fillRect(x0 + 120, 530, BW - 150, 14);
        g.fillStyle = '#6a994e66'; g.fillRect(x0 + 120 + (BW - 150) * 0.3, 530, (BW - 150) * 0.42, 14);
        g.fillStyle = p.tension > 0.9 ? '#e63946' : '#fff'; g.fillRect(x0 + 120 + (BW - 150) * p.tension - 3, 526, 6, 22);
        U.text(g, 'TENSION', x0 + 30, 537, 12, '#ffffffaa');
        g.fillStyle = '#ffffff22'; g.fillRect(x0 + 120, 552, BW - 150, 10);
        g.fillStyle = f.c; g.fillRect(x0 + 120, 552, (BW - 150) * p.prog, 10);
        U.text(g, 'CATCH', x0 + 30, 557, 12, '#ffffffaa');
      }
      g.restore();
      U.text(g, U.NAMES[p.idx].toUpperCase(), cx, 128, 18, U.TEAM[p.idx], 'center');
      U.text(g, String(p.score), cx, 168, 40, '#fff', 'center', 900);
      p.caught.slice(-8).forEach((f, k) => fishShape(g, x0 + 40 + k * 46, 212, Object.assign({}, f, { size: 0.55 }), 1));
      if (p.flash) U.text(g, p.flash.text, cx, 250, 26, p.flash.c, 'center', 900);
      // prompts for humans
      if (P[p.idx].human && S.state === 'play') {
        const tip = p.ph === 'idle' ? 'Action: CAST' : (p.ph === 'wait' ? 'wait for the bite…' : (p.ph === 'bite' ? 'HOOK IT! Action!' : (p.ph === 'reel' ? 'HOLD Action to reel · keep it in the green' : '')));
        if (tip) U.text(g, tip, cx, 500, 15, '#fff', 'center');
      }
    }
    function draw(g) {
      g.fillStyle = '#16213a'; g.fillRect(0, 0, 960, 600);
      S.pl.forEach((p) => drawBoard(g, p));
      g.fillStyle = '#ffffff22'; g.fillRect(478, 100, 4, 480);
      const secs = Math.ceil(S.left);
      U.scoreboard(g, S.pl.map((p) => p.score), '0:' + String(secs).padStart(2, '0'), -1);
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'CAST!', '', 330, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 330, '#fcbf49');
    }

    const g = {
      title: '🎣 Fishing',
      help: [
        'You each fish your own spot of the lake for 60 seconds. The biggest haul wins!',
        'Press <b>Action</b> to <b>cast</b>. Wait for the bobber to dunk and the <b>!</b> to appear, then press <b>Action</b> fast to hook the fish. Don’t go too early!',
        'To reel it in, <b>hold Action</b> to reel and release to ease off. Keep the tension marker inside the <b>green zone</b> — too tight and the line snaps, too loose and the fish slips away. Sardine +1, Trout +3, Bass +6, Golden fish +15!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.fishing = create;
})();
