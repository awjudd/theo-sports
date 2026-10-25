// Quick draw: wait for the signal, then press Action first. Best of five.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const NEED = 3;

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, wins: [0, 0], round: 1, phase: 'wait', wait: 0, sig: 0, times: [null, null], early: [false, false],
      cpuRt: [0, 0], msg: null, endT: 0, flash: 0, shot: [0, 0],
    };
    S.msg = { text: 'QUICK DRAW', sub: 'Wait for it…', t: 1.6 };

    function startRound() {
      S.phase = 'wait'; S.wait = U.rnd(1.6, 4.2); S.sig = 0; S.times = [null, null]; S.early = [false, false];
      S.cpuRt = [U.rnd(0.26, 0.5), U.rnd(0.26, 0.5)]; S.state = 'round'; S.msg = null; S.shot = [0, 0];
    }
    function decide() {
      let w = null, text, sub = '';
      const [a, b] = S.times;
      if (S.early[0] && S.early[1]) { text = 'BOTH TOO EARLY'; }
      else if (S.early[0]) { w = 1; text = 'TOO EARLY!'; sub = U.NAMES[0] + ' jumped the gun'; }
      else if (S.early[1]) { w = 0; text = 'TOO EARLY!'; sub = U.NAMES[1] + ' jumped the gun'; }
      else if (a !== null && (b === null || a < b)) { w = 0; text = U.NAMES[0].toUpperCase() + ' WINS THE DRAW!'; sub = a.toFixed(3) + ' s'; }
      else { w = 1; text = U.NAMES[1].toUpperCase() + ' WINS THE DRAW!'; sub = b.toFixed(3) + ' s'; }
      if (w !== null) { S.wins[w]++; S.shot[w] = 1; TS.sfx.hit(); }
      S.msg = { text, sub, t: 2.2 };
      S.phase = 'result'; S.endT = 2.4;
    }

    function update(dt) {
      S.t += dt; S.flash = Math.max(0, S.flash - dt * 3);
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      if (S.state === 'intro') { if (S.t > 1.7) startRound(); return; }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) { g.over = true; g.result = { winner: S.wins[0] > S.wins[1] ? 0 : 1, scores: S.wins.slice(), summary: 'Draws won — Henry ' + S.wins[0] + ', Theo ' + S.wins[1] }; }
        return;
      }
      if (S.phase === 'wait') {
        S.wait -= dt;
        for (let i = 0; i < 2; i++) if (P[i].human && TS.input.pad(i).actP) { S.early[i] = true; }
        if (S.early[0] || S.early[1]) { decide(); return; }
        if (S.wait <= 0) { S.phase = 'draw'; S.sig = 0; S.flash = 1; TS.sfx.go(); TS.sfx.tone(1200, 0.2, 'square', 0.09); }
      } else if (S.phase === 'draw') {
        S.sig += dt;
        for (let i = 0; i < 2; i++) {
          if (S.times[i] !== null) continue;
          if (P[i].human) { if (TS.input.pad(i).actP) S.times[i] = S.sig; }
          else if (S.sig >= S.cpuRt[i]) S.times[i] = S.cpuRt[i];
        }
        if (S.times[0] !== null || S.times[1] !== null) {
          // give the other player a short grace window of 30 ms to register
          if (S.sig > Math.min(...S.times.filter((x) => x !== null)) + 0.03 || (S.times[0] !== null && S.times[1] !== null)) decide();
        }
        if (S.sig > 2.5) decide();
      } else if (S.phase === 'result') {
        S.endT -= dt;
        if (S.endT <= 0) {
          if (S.wins[0] >= NEED || S.wins[1] >= NEED) { S.state = 'over'; S.t = 0; S.msg = { text: 'FINAL', sub: S.wins[0] + ' – ' + S.wins[1], t: 99 }; }
          else { S.round++; startRound(); }
        }
      }
    }

    function cowboy(g, i, x) {
      const p = P[i];
      const down = S.phase === 'result' && S.shot[1 - i] === 1;
      g.save(); g.translate(x, 510); g.rotate(down ? (i ? 1.2 : -1.2) : 0); g.translate(-x, -510);
      TS.chars.draw(g, p.who, p.outfit, { x, y: 510, scale: 2.0, t: S.t, facing: i ? -1 : 1, arm: S.phase === 'draw' || S.phase === 'result' ? 1.5 : 0, mood: down ? 'sad' : (S.shot[i] ? 'cheer' : 'happy'), cheer: S.shot[i] === 1 && S.phase === 'result' });
      g.restore();
      if (S.shot[i] === 1 && S.phase === 'result') { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x + (i ? -70 : 70), 420, 12 + Math.sin(S.t * 30) * 3, 0, TAU); g.fill(); }
    }
    function draw(g) {
      const sky = g.createLinearGradient(0, 0, 0, 380);
      sky.addColorStop(0, '#f9a65a'); sky.addColorStop(0.6, '#fcd9a0'); sky.addColorStop(1, '#ffe9c4');
      g.fillStyle = sky; g.fillRect(0, 0, 960, 380);
      g.fillStyle = '#fff3d0'; g.beginPath(); g.arc(480, 270, 90, 0, TAU); g.fill();
      g.fillStyle = '#b8683a'; g.beginPath(); g.moveTo(0, 380); g.lineTo(120, 270); g.lineTo(220, 330); g.lineTo(340, 240); g.lineTo(460, 380); g.fill();
      g.beginPath(); g.moveTo(500, 380); g.lineTo(640, 260); g.lineTo(760, 330); g.lineTo(880, 250); g.lineTo(960, 320); g.lineTo(960, 380); g.fill();
      g.fillStyle = '#e0a860'; g.fillRect(0, 380, 960, 220);
      g.fillStyle = '#cf9650'; for (let x = 0; x < 960; x += 80) g.fillRect(x + 20, 470 + (x % 3) * 25, 40, 4);
      // cactus
      g.fillStyle = '#4a8f3f'; g.fillRect(470, 340, 20, 70); g.fillRect(450, 360, 20, 10); g.fillRect(450, 350, 8, 20); g.fillRect(490, 370, 20, 10); g.fillRect(502, 358, 8, 22);
      cowboy(g, 0, 190); cowboy(g, 1, 770);
      if (S.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + S.flash * 0.6 + ')'; g.fillRect(0, 0, 960, 600); }
      U.scoreboard(g, S.wins, 'R' + Math.min(5, S.round), -1);
      if (S.state === 'round' && S.phase === 'wait') U.big(g, '…', 'wait for the signal', 200, '#fff');
      else if (S.phase === 'draw') { g.save(); g.translate(480, 190); const sc = 1 + Math.sin(S.sig * 40) * 0.05; g.scale(sc, sc); g.restore(); U.big(g, 'DRAW!', 'press Action NOW', 190, '#e63946'); }
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 190, '#fcbf49');
      if (S.state === 'round') {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: Space · Theo: Enter — but not before the signal!' : 'Press Action the instant you see DRAW! — too early and you lose the round');
      }
    }

    const g = {
      title: '🤠 Quick Draw',
      help: [
        'First to win three draws. Stand still and wait… when the screen flashes and says <b>DRAW!</b>, press <b>Action</b> as fast as you can.',
        '<b>Careful:</b> press too early and you lose the round!',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.quickdraw = create;
})();
