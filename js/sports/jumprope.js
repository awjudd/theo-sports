// Jump rope: hop over the rope as it swings under your feet. It gets faster and faster. Most jumps wins.
(function () {
  const TS = (window.TS = window.TS || {});
  const U = TS.ui;
  const TAU = Math.PI * 2;
  const AIR = 0.5;                       // seconds in the air
  const GROUND = 480;
  const PANEL = [{ x: 30 }, { x: 500 }]; // each player's half of the screen (430 wide)

  function create(ctx) {
    const P = ctx.players;
    const mk = (i) => ({ idx: i, theta: Math.PI * 0.35, jumpT: -1, jumps: 0, out: false, outT: 0, t: Math.random() * 3, flash: null, cpu: { due: null, slip: U.rnd(0.8, 1.2) } });
    const S = { state: 'intro', t: 0, cd: 0, time: 0, pl: [mk(0), mk(1)], msg: null, endT: 0 };
    S.msg = { text: 'JUMP ROPE', sub: 'Hop the rope!', t: 1.6 };
    const omega = () => 4.1 + S.time * 0.05;

    function timeToCross(p) {
      let d = ((Math.PI - p.theta) % TAU + TAU) % TAU;
      return d / omega();
    }

    function update(dt) {
      S.t += dt;
      if (S.msg && S.msg.t < 90) { S.msg.t -= dt; if (S.msg.t <= 0) S.msg = null; }
      S.pl.forEach((p) => { p.t += dt; if (p.flash) { p.flash.t -= dt; if (p.flash.t <= 0) p.flash = null; } });
      if (S.state === 'intro') { if (S.t > 1.7) { S.state = 'count'; S.cd = 3.2; } return; }
      if (S.state === 'count') {
        const before = Math.ceil(S.cd); S.cd -= dt;
        if (Math.ceil(S.cd) !== before && S.cd > 0) TS.sfx.beep();
        if (S.cd <= 0) { S.state = 'play'; S.time = 0; TS.sfx.go(); }
        S.pl.forEach((p) => { p.theta += 0; });
        return;
      }
      if (S.state === 'over') {
        if (S.t > 1.8 && !g.over) { g.over = true; g.result = { winner: S.pl[0].jumps === S.pl[1].jumps ? null : (S.pl[0].jumps > S.pl[1].jumps ? 0 : 1), scores: S.pl.map((p) => p.jumps), summary: 'Jumps — Henry ' + S.pl[0].jumps + ', Theo ' + S.pl[1].jumps }; }
        return;
      }
      S.time += dt;
      for (const p of S.pl) {
        if (p.out) { p.outT += dt; continue; }
        // input
        let want = false;
        if (P[p.idx].human) want = TS.input.pad(p.idx).actP || TS.input.pad(p.idx).y < 0 && false;
        else {
          const ttc = timeToCross(p);
          if (p.cpu.due === null) p.cpu.due = 0.27 + U.gauss() * 0.06 * p.cpu.slip + (Math.random() < Math.min(0.2, 0.01 + S.time * 0.0035) ? U.rnd(0.14, 0.24) : 0);
          if (ttc <= p.cpu.due && p.jumpT < 0) { want = true; p.cpu.due = null; }
        }
        if (want && p.jumpT < 0) { p.jumpT = 0; TS.sfx.swish(); }
        if (p.jumpT >= 0) { p.jumpT += dt; if (p.jumpT > AIR) p.jumpT = -1; }
        const prev = p.theta;
        p.theta += omega() * dt;
        // rope crosses the ground at theta = PI (mod 2PI)
        const a = Math.floor((prev - Math.PI) / TAU), b = Math.floor((p.theta - Math.PI) / TAU);
        if (b > a) {
          const h = p.jumpT >= 0 ? Math.sin((p.jumpT / AIR) * Math.PI) : 0;
          if (h > 0.22) { p.jumps++; p.flash = { text: String(p.jumps), t: 0.5, c: '#6a994e' }; TS.sfx.tone(500 + Math.min(500, p.jumps * 15), 0.07, 'triangle', 0.07); }
          else { p.out = true; p.outT = 0; p.flash = { text: 'TRIPPED!', t: 1.4, c: '#e63946' }; TS.sfx.thud(); }
        }
      }
      const [a, b] = S.pl;
      const done = (a.out && b.out) || (a.out && b.jumps > a.jumps) || (b.out && a.jumps > b.jumps);
      if (done && S.state === 'play') {
        S.state = 'over'; S.t = 0;
        const w = a.jumps === b.jumps ? null : (a.jumps > b.jumps ? 0 : 1);
        S.msg = { text: w === null ? 'DRAW' : U.NAMES[w].toUpperCase() + ' WINS!', sub: a.jumps + ' – ' + b.jumps + ' jumps', t: 99 };
        if (w !== null) TS.sfx.goal();
      }
    }

    function drawPlayer(g, p) {
      const x0 = PANEL[p.idx].x, cx = x0 + 215;
      g.fillStyle = p.idx ? '#2d3f7a' : '#7a2d3a'; g.globalAlpha = 0.18; g.fillRect(x0, 100, 430, 480); g.globalAlpha = 1;
      g.fillStyle = '#d9b57b'; g.fillRect(x0, GROUND, 430, 100);
      for (let k = 0; k < 6; k++) { g.fillStyle = '#c9a56b'; g.fillRect(x0 + 10 + k * 70, GROUND + 14 + (k % 2) * 20, 40, 4); }
      const h = p.out ? 0 : (p.jumpT >= 0 ? Math.sin((p.jumpT / AIR) * Math.PI) * 78 : 0);
      // rope behind (upper half) then character then rope front
      const ctrl = GROUND - 90 - 200 * Math.cos(p.theta);
      const handY = GROUND - 62, hx = 64;
      const rope = (col) => { g.strokeStyle = col; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - hx, handY); g.quadraticCurveTo(cx, Math.min(ctrl, GROUND + 30), cx + hx, handY); g.stroke(); };
      const front = Math.cos(p.theta) < 0; // rope in front of the body when it is in the lower half of the swing
      if (!front) rope('#fcbf49');
      const pose = p.out ? { mood: 'sad', arm: 0 } : { mood: 'happy' };
      TS.chars.draw(g, P[p.idx].who, P[p.idx].outfit, Object.assign({ x: cx, y: GROUND + 14, scale: 1.45, t: p.t * 2, lift: h * 0.85, arm: p.out ? 0 : 0.7 }, pose));
      if (front) rope('#fcbf49');
      g.fillStyle = '#7b4a1e'; g.fillRect(cx - hx - 6, handY - 8, 10, 16); g.fillRect(cx + hx - 4, handY - 8, 10, 16);
      U.text(g, U.NAMES[p.idx].toUpperCase(), cx, 128, 20, U.TEAM[p.idx], 'center');
      U.text(g, String(p.jumps), cx, 178, 48, '#fff', 'center', 900);
      if (p.flash) U.text(g, p.flash.text, cx, 270 - (0.5 - Math.min(0.5, p.flash.t)) * 30, p.flash.text === 'TRIPPED!' ? 34 : 28, p.flash.c, 'center', 900);
      if (p.out) U.text(g, 'OUT', cx, 330, 40, '#e63946', 'center', 900);
    }
    function draw(g) {
      g.fillStyle = '#5ab552'; g.fillRect(0, 0, 960, 600);
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#62bd59' : '#56ad4e'; g.fillRect(0, i * 50, 960, 50); }
      g.fillStyle = '#ffffff33'; g.fillRect(478, 100, 4, 480);
      S.pl.forEach((p) => drawPlayer(g, p));
      const sp = Math.min(9, omega()) / 9;
      U.scoreboard(g, S.pl.map((p) => p.jumps), 'SPEED ' + Math.round(sp * 100) + '%', -1);
      if (S.state === 'count') U.big(g, S.cd > 0.2 ? String(Math.ceil(S.cd - 0.2)) : 'JUMP!', '', 300, '#fcbf49');
      else if (S.msg) U.big(g, S.msg.text, S.msg.sub, 300, '#fcbf49');
      if (S.state === 'count' || (S.state === 'play' && S.time < 6)) {
        const two = P[0].human && P[1].human;
        U.hint(g, two ? 'Henry: Space to jump · Theo: Enter to jump — jump as the rope comes down!' : 'Press Action to jump just as the rope swings down toward your feet!');
      }
    }

    const g = {
      title: '🪘 Jump Rope',
      help: [
        'Each of you jumps your own rope, and it gets faster and faster. Jump over it as many times as you can without tripping!',
        'Press <b>Action</b> to jump a moment <b>before</b> the rope comes down to your feet — you need to be in the air when it passes. Trip and you’re out. The most jumps wins.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }
  TS.sports.jumprope = create;
})();
