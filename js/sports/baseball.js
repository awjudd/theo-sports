// Baseball: timing-based batting. Henry bats against Theo's pitching, then they swap.
(function () {
  const TS = (window.TS = window.TS || {});
  TS.sports = TS.sports || {};

  const W = 960, H = 600;
  const TEAM = ['#e63946', '#3a86ff'];
  const NAMES = ['Henry', 'Theo'];
  const TAU = Math.PI * 2;
  const INNINGS = 2, MAX_INNINGS = 5;
  const MOUND = { x: 480, y: 262 }, PLATE = { x: 480, y: 470 };
  const IDEAL = 0.94; // ball progress at which contact is perfect

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickW = (table) => {
    let r = Math.random(), acc = 0;
    for (const [k, w] of table) { acc += w; if (r < acc) return k; }
    return table[table.length - 1][0];
  };

  function create(ctx) {
    const P = ctx.players;
    const S = {
      state: 'intro', t: 0, inning: 1, half: 0, outs: 0, strikes: 0, balls: 0,
      bases: [false, false, false], runs: [0, 0], pitch: null, swing: -1, banner: null, flight: null,
      pending: null, endHalf: false, anim: 0, fieldT: 0,
    };

    const batterIdx = () => S.half;
    const batterHuman = () => P[S.half].human;

    function startHalf() {
      S.outs = 0; S.strikes = 0; S.balls = 0; S.bases = [false, false, false]; S.endHalf = false;
      S.state = 'intro'; S.t = 0;
      S.banner = { text: NAMES[S.half] + ' bats', sub: (S.half === 0 ? 'Top' : 'Bottom') + ' of inning ' + S.inning, t: 1.6 };
    }
    startHalf();

    function newPitch() {
      const isBall = Math.random() < 0.28;
      const curve = Math.random() < 0.35;
      const dur = curve ? rnd(1.0, 1.2) : rnd(0.75, 0.95);
      const side = Math.random() < 0.5 ? -1 : 1;
      S.pitch = {
        dur, e: 0, ball: isBall, curve,
        endX: isBall ? side * rnd(78, 125) : rnd(-26, 26),
        startX: curve ? side * 70 : 0,
        swung: false, cpuAt: null,
      };
      if (!batterHuman()) {
        const swingsAt = isBall ? Math.random() < 0.18 : Math.random() < 0.92;
        if (swingsAt) {
          const err = (Math.random() + Math.random() + Math.random() - 1.5) * 0.27;
          S.pitch.cpuAt = IDEAL + err / dur;
        }
      }
      S.swing = -1;
      S.state = 'pitch'; S.t = 0;
      TS.sfx.swish();
    }

    // ----- count / scoring -----
    function say(text, sub, color) { S.banner = { text, sub: sub || '', t: 1.5, color }; }

    function clearCount() { S.strikes = 0; S.balls = 0; }

    function addRuns(n) { S.runs[S.half] += n; }

    function out(text) {
      S.outs++; clearCount();
      if (S.outs >= 3) { S.endHalf = true; text += ' · 3 outs!'; }
      say(text, '', '#ff9f9f');
    }
    function strike() {
      S.strikes++;
      if (S.strikes >= 3) { out('STRIKE THREE!'); }
      else say('STRIKE ' + S.strikes, '', '#ffd166');
    }
    function foul() {
      if (S.strikes < 2) S.strikes++;
      say('FOUL BALL', S.strikes + ' strike' + (S.strikes === 1 ? '' : 's'), '#ffd166');
    }
    function ballCall() {
      S.balls++;
      if (S.balls >= 4) {
        clearCount();
        const b = S.bases; let runs = 0;
        if (!b[0]) b[0] = true; else if (!b[1]) b[1] = true; else if (!b[2]) b[2] = true; else runs = 1;
        addRuns(runs);
        say('WALK!', runs ? 'Run scores!' : 'Take your base', '#8ecae6');
      } else say('BALL ' + S.balls, '', '#8ecae6');
    }
    function hit(n) {
      clearCount();
      const nb = [false, false, false]; let runs = 0;
      for (let b = 2; b >= 0; b--) {
        if (S.bases[b]) { const dest = b + 1 + n; if (dest >= 4) runs++; else nb[dest - 1] = true; }
      }
      if (n >= 4) runs++; else nb[n - 1] = true;
      S.bases = nb; addRuns(runs);
      const label = ['', 'SINGLE!', 'DOUBLE!', 'TRIPLE!', 'HOME RUN!'][n];
      say(label, runs ? runs + ' run' + (runs > 1 ? 's' : '') + ' score!' : '', '#fcbf49');
      if (n === 4) TS.sfx.goal(); else TS.sfx.win();
    }

    // ----- swing resolution -----
    function resolveSwing(u, pitch) {
      const dur = pitch.dur;
      const err = (u - IDEAL) * dur; // seconds; negative = early
      const a = Math.abs(err);
      pitch.swung = true;
      S.swing = 0;
      let q = a < 0.05 ? 'perfect' : a < 0.095 ? 'good' : a < 0.16 ? 'weak' : 'miss';
      if (pitch.ball && q !== 'miss') q = Math.random() < 0.5 ? 'miss' : 'weak';
      let res;
      if (q === 'miss') res = 'miss';
      else if (q === 'perfect') res = pickW([['homer', 0.5], ['triple', 0.1], ['double', 0.4]]);
      else if (q === 'good') res = pickW([['double', 0.2], ['single', 0.4], ['flyout', 0.4]]);
      else res = pickW([['single', 0.15], ['groundout', 0.45], ['foul', 0.4]]);
      TS.sfx.hit();
      if (res === 'miss') {
        S.pending = { apply: strike };
        S.state = 'swingmiss'; S.t = 0;
        S.pitch.e = Math.max(S.pitch.e, pitch.dur * u);
        return;
      }
      // batted ball flight
      const dir = rnd(-1, 1);
      let tx = 480 + dir * 260, ty, hgt, label;
      if (res === 'homer') { ty = 60; hgt = 190; tx = 480 + dir * 330; }
      else if (res === 'triple') { ty = 150; hgt = 120; }
      else if (res === 'double') { ty = 175; hgt = 100; }
      else if (res === 'single') { ty = 250; hgt = 55; tx = 480 + dir * 200; }
      else if (res === 'flyout') { ty = 170; hgt = 150; tx = 480 + dir * 220; }
      else if (res === 'groundout') { ty = 300; hgt = 8; tx = 480 + dir * 150; }
      else { ty = 440; hgt = 80; tx = 480 + (Math.random() < 0.5 ? -1 : 1) * 420; } // foul
      S.flight = { x0: PLATE.x, y0: PLATE.y - 15, x1: tx, y1: ty, h: hgt, t: 0, dur: res === 'groundout' ? 0.7 : 1.2, res };
      const apply = {
        homer: () => hit(4), triple: () => hit(3), double: () => hit(2), single: () => hit(1),
        flyout: () => out('FLY OUT'), groundout: () => out('GROUNDED OUT'), foul,
      }[res];
      S.pending = { apply };
      S.state = 'flight'; S.t = 0;
    }

    // ----- update -----
    function update(dt) {
      S.t += dt; S.fieldT += dt;
      if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
      if (S.swing >= 0) S.swing += dt;

      switch (S.state) {
        case 'intro':
          if (S.t > 1.3) { S.state = 'windup'; S.t = 0; }
          break;
        case 'windup':
          if (S.t > 0.7) newPitch();
          break;
        case 'pitch': {
          const p = S.pitch;
          p.e += dt;
          const u = p.e / p.dur;
          const human = batterHuman();
          if (!p.swung) {
            if (human && TS.input.pad(batterIdx()).actP) resolveSwing(u, p);
            else if (!human && p.cpuAt !== null && u >= p.cpuAt) resolveSwing(u, p);
          }
          if (S.state === 'pitch' && u >= 1.12) {
            S.pending = { apply: p.ball ? ballCall : strike };
            S.state = 'called'; S.t = 0;
            if (!p.ball) TS.sfx.thud();
          }
          break;
        }
        case 'swingmiss':
          S.pitch.e += dt;
          if (S.t > 0.5) finishPlay();
          break;
        case 'called':
          S.pitch.e += dt * 0.5;
          if (S.t > 0.45) finishPlay();
          break;
        case 'flight':
          S.flight.t += dt;
          if (S.flight.t >= S.flight.dur) { S.state = 'result'; S.t = 0; applyPending(); }
          break;
        case 'result':
          if (S.t > 1.0) afterPlay();
          break;
        case 'over':
          if (S.t > 1.5 && !g.over) {
            g.over = true;
            const w = S.runs[0] === S.runs[1] ? null : (S.runs[0] > S.runs[1] ? 0 : 1);
            g.result = { winner: w, scores: S.runs.slice(), summary: 'Final score: Henry ' + S.runs[0] + ' – ' + S.runs[1] + ' Theo' };
          }
          break;
      }
    }

    function applyPending() { if (S.pending) { S.pending.apply(); S.pending = null; } }
    function finishPlay() { applyPending(); S.state = 'result'; S.t = 0; }

    function afterPlay() {
      // walk-off?
      if (S.half === 1 && S.inning >= INNINGS && S.runs[1] > S.runs[0]) return endGame();
      if (S.endHalf) {
        if (S.half === 0) { S.half = 1; startHalf(); return; }
        if (S.inning >= INNINGS && S.runs[0] !== S.runs[1]) return endGame();
        if (S.inning >= MAX_INNINGS) return endGame();
        S.inning++; S.half = 0; startHalf(); return;
      }
      S.state = 'windup'; S.t = 0; S.pitch = null; S.flight = null; S.swing = -1;
    }
    function endGame() {
      S.state = 'over'; S.t = 0; S.pitch = null; S.flight = null;
      S.banner = { text: 'GAME OVER', sub: 'Henry ' + S.runs[0] + ' – ' + S.runs[1] + ' Theo', t: 99 };
    }

    // ----- drawing -----
    function drawBackground(g) {
      const sky = g.createLinearGradient(0, 0, 0, 150);
      sky.addColorStop(0, '#5aa9e6'); sky.addColorStop(1, '#bfe3ff');
      g.fillStyle = sky; g.fillRect(0, 0, W, 150);
      // crowd
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 70; i++) {
          const x = i * 14 + (r % 2) * 7, y = 62 + r * 11;
          g.fillStyle = ['#e63946', '#fcbf49', '#f1faee', '#a8dadc', '#ff70a6', '#457b9d'][(i * 3 + r * 5) % 6];
          g.beginPath(); g.arc(x, y + Math.sin(S.fieldT * 4 + i) * 0.8, 5.5, 0, TAU); g.fill();
        }
      }
      // fence
      g.fillStyle = '#1b4332'; g.fillRect(0, 108, W, 34);
      g.fillStyle = '#2d6a4f'; g.fillRect(0, 108, W, 6);
      g.fillStyle = '#ffd166'; g.fillRect(0, 110, W, 2);
      g.font = '800 15px "Trebuchet MS", sans-serif'; g.fillStyle = '#ffffffcc'; g.textAlign = 'center'; g.textBaseline = 'middle';
      ['HENRY & THEO', 'SPORTS', 'GO TEAM!', 'DISC GOLF', 'LAX', 'HOCKEY'].forEach((t, i) => g.fillText(t, 80 + i * 160, 126));
      // outfield grass
      for (let i = 0; i < 12; i++) {
        g.fillStyle = i % 2 ? '#3f8f3f' : '#46a047';
        g.fillRect(0, 142 + i * 38.2, W, 39);
      }
      // warning track arc & infield dirt
      g.fillStyle = '#c08a54'; g.beginPath(); g.ellipse(480, 470, 360, 200, 0, Math.PI, TAU); g.fill();
      g.fillStyle = '#4aa84a'; g.beginPath(); g.ellipse(480, 462, 250, 120, 0, Math.PI, TAU); g.fill();
      g.fillStyle = '#c9965f'; g.beginPath(); g.ellipse(480, 470, 175, 70, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(MOUND.x, MOUND.y + 6, 44, 14, 0, 0, TAU); g.fill();
      g.fillStyle = '#b3814d'; g.beginPath(); g.ellipse(MOUND.x, MOUND.y + 6, 30, 9, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.fillRect(MOUND.x - 9, MOUND.y + 2, 18, 3);
      // base lines
      g.strokeStyle = '#ffffffcc'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(PLATE.x, PLATE.y); g.lineTo(PLATE.x - 360, PLATE.y - 190); g.moveTo(PLATE.x, PLATE.y); g.lineTo(PLATE.x + 360, PLATE.y - 190); g.stroke();
      // batter boxes
      g.lineWidth = 2;
      g.strokeRect(PLATE.x - 118, PLATE.y - 44, 62, 88); g.strokeRect(PLATE.x + 56, PLATE.y - 44, 62, 88);
      // home plate
      g.fillStyle = '#fff'; g.beginPath();
      g.moveTo(PLATE.x - 22, PLATE.y - 8); g.lineTo(PLATE.x + 22, PLATE.y - 8); g.lineTo(PLATE.x + 22, PLATE.y + 6); g.lineTo(PLATE.x, PLATE.y + 20); g.lineTo(PLATE.x - 22, PLATE.y + 6); g.closePath(); g.fill();
      g.strokeStyle = '#0003'; g.lineWidth = 1.5; g.stroke();
    }

    function drawZone(g) {
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.setLineDash([6, 6]);
      g.strokeRect(PLATE.x - 40, PLATE.y - 100, 80, 78);
      g.setLineDash([]);
    }

    function pitchPos(p) {
      const u = clamp(p.e / p.dur, 0, 1.25);
      const x = MOUND.x + lerp(p.startX, p.endX, Math.min(1, u)) + (u > 1 ? (u - 1) * p.endX * 2 : 0);
      const yEnd = PLATE.y - 62;
      const y = lerp(MOUND.y - 18, yEnd, Math.pow(Math.min(1, u), 1.25)) + (u > 1 ? (u - 1) * 120 : 0);
      const sc = 0.32 + 0.9 * Math.pow(Math.min(1, u), 1.7);
      return { x, y, sc, u };
    }

    function drawBall(g, x, y, r, spin) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y + r * 1.6, r, r * 0.35, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = '#d62828'; g.lineWidth = Math.max(1, r * 0.14);
      g.beginPath(); g.arc(x - r * 0.9, y, r * 0.85, -0.7 + spin, 0.7 + spin); g.stroke();
      g.beginPath(); g.arc(x + r * 0.9, y, r * 0.85, Math.PI - 0.7 + spin, Math.PI + 0.7 + spin); g.stroke();
      g.strokeStyle = '#0003'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    }

    function drawPitcher(g) {
      const pitcher = P[1 - S.half];
      let arm = 0;
      if (S.state === 'windup') { const u = S.t / 0.7; arm = u < 0.6 ? u / 0.6 * 3.1 : 3.1 - (u - 0.6) / 0.4 * 4.2; }
      else if (S.state === 'pitch') arm = -1.0 + Math.max(0, 0.6 - S.pitch.e) * 2;
      TS.chars.draw(g, pitcher.who, pitcher.outfit, { x: MOUND.x, y: MOUND.y + 6, scale: 0.55, t: S.fieldT, arm: Math.max(-1.1, arm), facing: 1 });
    }

    function drawBatter(g) {
      const b = P[S.half];
      const bx = PLATE.x - 96, by = PLATE.y + 62, sc = 1.35;
      // swing progress
      let sp = 0;
      if (S.swing >= 0) sp = clamp(S.swing / 0.2, 0, 1);
      const follow = S.swing >= 0 ? clamp((S.swing - 0.2) / 0.3, 0, 1) : 0;
      const ang = lerp(-1.25, 0.35, 1 - Math.pow(1 - sp, 3)) + follow * 0.9;
      TS.chars.draw(g, b.who, b.outfit, { x: bx, y: by, scale: sc, t: S.fieldT, arm: S.swing >= 0 ? 0.4 : 0.9, facing: 1 });
      // bat held at the hands
      const hx = bx + 22 * sc * 0.9, hy = by - 52 * sc;
      g.save(); g.translate(hx, hy); g.rotate(ang);
      g.lineCap = 'round';
      g.strokeStyle = '#d9a066'; g.lineWidth = 9; g.beginPath(); g.moveTo(-12, 0); g.lineTo(78, 0); g.stroke();
      g.strokeStyle = '#a56b2f'; g.lineWidth = 4; g.beginPath(); g.moveTo(-12, 0); g.lineTo(10, 0); g.stroke();
      g.restore();
    }

    function drawHUD(g) {
      // scoreboard
      g.fillStyle = '#0b132bdd'; TS.chars.rr(g, 12, 10, 190, 82, 14); g.fill();
      g.textBaseline = 'middle';
      g.font = '800 17px "Trebuchet MS", sans-serif'; g.textAlign = 'left';
      for (let i = 0; i < 2; i++) {
        g.fillStyle = TEAM[i]; g.fillRect(22, 22 + i * 26, 6, 18);
        g.fillStyle = S.half === i ? '#fcbf49' : '#fff';
        g.fillText(NAMES[i].toUpperCase(), 36, 31 + i * 26);
        g.textAlign = 'right'; g.fillText(S.runs[i], 190, 31 + i * 26); g.textAlign = 'left';
      }
      g.font = '700 13px "Trebuchet MS", sans-serif'; g.fillStyle = '#ffffffaa';
      g.fillText((S.half === 0 ? '▲ ' : '▼ ') + 'Inning ' + S.inning + ' / ' + INNINGS, 22, 82 - 0);
      // count + diamond
      g.fillStyle = '#0b132bdd'; TS.chars.rr(g, W - 236, 10, 178, 92, 14); g.fill();
      const dot = (x, y, on, c) => { g.fillStyle = on ? c : '#ffffff22'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); };
      g.font = '800 14px "Trebuchet MS", sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left';
      g.fillText('B', W - 222, 28); for (let i = 0; i < 3; i++) dot(W - 196 + i * 18, 28, S.balls > i, '#8ecae6');
      g.fillText('S', W - 222, 52); for (let i = 0; i < 2; i++) dot(W - 196 + i * 18, 52, S.strikes > i, '#ffd166');
      g.fillText('O', W - 222, 76); for (let i = 0; i < 2; i++) dot(W - 196 + i * 18, 76, S.outs > i, '#ff6b6b');
      const dx = W - 108, dy = 58;
      const base = (x, y, on) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = on ? '#fcbf49' : '#ffffff33'; g.fillRect(-7, -7, 14, 14); g.restore(); };
      base(dx + 24, dy, S.bases[0]); base(dx, dy - 24, S.bases[1]); base(dx - 24, dy, S.bases[2]);
      base(dx, dy + 24, false);
    }

    function drawBanner(g) {
      if (!S.banner) return;
      const b = S.banner;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(W / 2, 185);
      const k = Math.min(1, (1.5 - b.t) * 8 + 0.6);
      g.scale(1 + (1 - Math.min(1, k)) * 0.3, 1 + (1 - Math.min(1, k)) * 0.3);
      g.font = '900 78px "Trebuchet MS", sans-serif'; g.lineJoin = 'round';
      g.lineWidth = 12; g.strokeStyle = '#0b132b'; g.strokeText(b.text, 0, 0);
      g.fillStyle = b.color || '#fcbf49'; g.fillText(b.text, 0, 0);
      if (b.sub) {
        g.font = '800 32px "Trebuchet MS", sans-serif'; g.lineWidth = 8;
        g.strokeText(b.sub, 0, 62); g.fillStyle = '#fff'; g.fillText(b.sub, 0, 62);
      }
      g.restore();
    }

    function draw(g) {
      drawBackground(g);
      drawPitcher(g);
      drawZone(g);

      // ball in play
      if ((S.state === 'pitch' || S.state === 'swingmiss' || S.state === 'called') && S.pitch) {
        const bp = pitchPos(S.pitch);
        if (!(S.state === 'swingmiss' && S.t > 0.35)) drawBall(g, bp.x, bp.y, 11 * bp.sc, bp.u * 14);
      } else if (S.state === 'windup' && S.t > 0.45) {
        drawBall(g, MOUND.x + 14, MOUND.y - 52 - Math.sin(S.t * 3) * 2, 4, 0);
      }
      drawBatter(g);
      if (S.state === 'flight' && S.flight) {
        const f = S.flight, u = clamp(f.t / f.dur, 0, 1);
        const x = lerp(f.x0, f.x1, u), yb = lerp(f.y0, f.y1, u);
        const y = yb - Math.sin(u * Math.PI) * f.h;
        const r = lerp(11, f.res === 'homer' ? 3 : 5, u);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, yb, r, r * 0.4, 0, 0, TAU); g.fill();
        if (!(f.res === 'homer' && u > 0.96)) drawBall(g, x, y, r, u * 20);
      }
      // prompt
      if (S.state === 'pitch' && batterHuman() && !S.pitch.swung) {
        g.font = '800 18px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#0b132bcc'; TS.chars.rr(g, W / 2 - 150, 556, 300, 30, 15); g.fill();
        g.fillStyle = '#fff'; g.fillText('Swing when the ball reaches the plate!', W / 2, 571);
      } else if (S.state === 'windup' && batterHuman()) {
        g.font = '800 18px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#0b132bcc'; TS.chars.rr(g, W / 2 - 110, 556, 220, 30, 15); g.fill();
        g.fillStyle = '#fcbf49'; g.fillText(NAMES[S.half] + ': get ready…', W / 2, 571);
      }
      drawHUD(g);
      drawBanner(g);
    }

    const g = {
      title: '⚾ Baseball',
      help: [
        'Henry bats first against Theo’s pitching, then they swap. 2 innings, 3 outs each — ties go to extra innings.',
        'Press <b>Action</b> to swing — time it so the bat meets the ball right as it hits the plate. Perfect timing = home runs!',
        'Swinging at wild pitches (way outside) is a strike. Four balls is a walk.',
      ],
      over: false, result: null, update, draw, debug: S,
    };
    return g;
  }

  TS.sports.baseball = create;
})();
