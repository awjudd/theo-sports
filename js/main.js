// App shell: screens, locker room UI, wheel, game lifecycle.
(function () {
  const TS = window.TS;
  const $ = (s) => document.querySelector(s);
  const chars = TS.chars;

  const screens = {
    title: $('#screen-title'),
    locker: $('#screen-locker'),
    wheel: $('#screen-wheel'),
    pick: $('#screen-pick'),
    game: $('#screen-game'),
  };
  let current = 'title';
  let time = 0;

  const MODES = [
    { id: '1p-henry', label: "1 Player · I'm Henry", humans: [true, false] },
    { id: '1p-theo', label: "1 Player · I'm Theo", humans: [false, true] },
    { id: '2p', label: '2 Players', humans: [true, true] },
  ];
  let mode = '1p-henry';
  try { mode = localStorage.getItem('ts.mode') || mode; } catch (e) {}
  if (!MODES.some((m) => m.id === mode)) mode = '1p-henry';
  const humans = () => MODES.find((m) => m.id === mode).humans;

  function show(name) {
    current = name;
    document.body.classList.toggle('in-game', name === 'game');
    for (const k in screens) screens[k].classList.toggle('active', k === name);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  // ---------- scale menus to fit the window ----------
  const wheelCanvas = $('#wheel');
  const hiRes = [[titleCanvas0(), 560, 320], [$('#preview'), 320, 400], [wheelCanvas, 560, 610]];
  function titleCanvas0() { return $('#title-canvas'); }
  function fitUI() {
    if (current === 'game') return;
    const el = screens[current];
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const s = Math.max(0.4, Math.min(3.2, (window.innerWidth - 24) / w, (window.innerHeight - 24) / h));
    el.style.transform = 'scale(' + s.toFixed(3) + ')';
    const k = Math.max(1, Math.min(3, s * (window.devicePixelRatio || 1)));
    for (const [cv, bw, bh] of hiRes) {
      const nw = Math.round(bw * k);
      if (cv.width !== nw) { cv.width = nw; cv.height = Math.round(bh * k); }
    }
  }

  // ---------- title ----------
  const titleCanvas = $('#title-canvas');
  const tg = titleCanvas.getContext('2d');
  function drawTitle() {
    const k = titleCanvas.width / 560;
    tg.setTransform(k, 0, 0, k, 0, 0);
    tg.clearRect(0, 0, 560, 320);
    const bounce = (o) => Math.abs(Math.sin(time * 3 + o)) * 14;
    chars.draw(tg, 'henry', chars.outfits.henry, { x: 175, y: 300, scale: 2.5, t: time, cheer: true, lift: bounce(0) });
    chars.draw(tg, 'theo', chars.outfits.theo, { x: 385, y: 300, scale: 2.5, t: time + 1, cheer: true, lift: bounce(1.4), facing: -1 });
  }

  // ---------- locker room ----------
  let lockerWho = 'henry';
  const preview = $('#preview');
  const pg = preview.getContext('2d');
  const optionsEl = $('#options');

  function makeSwatches(colors, selected, onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'swatches';
    colors.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (c.toLowerCase() === (selected || '').toLowerCase() ? ' sel' : '');
      b.style.background = c;
      b.title = c;
      b.addEventListener('click', () => { TS.sfx.click(); onPick(c); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function renderOptions() {
    optionsEl.innerHTML = '';
    const o = chars.outfits[lockerWho];
    for (const slot of chars.SLOTS) {
      const row = document.createElement('div');
      row.className = 'opt';
      const cur = o[slot.id];
      const idx = Math.max(0, slot.styles.findIndex((s) => s[0] === cur.s));
      row.innerHTML =
        '<div class="label">' + slot.label + '</div>' +
        '<div class="stepper"><button class="step prev" aria-label="Previous">◀</button>' +
        '<span class="val">' + slot.styles[idx][1] + '</span>' +
        '<button class="step next" aria-label="Next">▶</button></div>';
      const step = (d) => {
        const n = slot.styles.length;
        cur.s = slot.styles[(idx + d + n) % n][0];
        TS.sfx.click(); chars.save(); renderOptions();
      };
      row.querySelector('.prev').addEventListener('click', () => step(-1));
      row.querySelector('.next').addEventListener('click', () => step(1));
      const sw = makeSwatches(chars.PALETTE, cur.c, (c) => { cur.c = c; chars.save(); renderOptions(); });
      if (cur.s === 'none') sw.classList.add('dim');
      row.appendChild(sw);
      optionsEl.appendChild(row);
    }
    const hrow = document.createElement('div');
    hrow.className = 'opt';
    const hidx = Math.max(0, chars.HAIR_STYLES.findIndex((h) => h[0] === o.hairStyle));
    hrow.innerHTML =
      '<div class="label">Hair style</div>' +
      '<div class="stepper"><button class="step prev" aria-label="Previous">◀</button>' +
      '<span class="val">' + chars.HAIR_STYLES[hidx][1] + '</span>' +
      '<button class="step next" aria-label="Next">▶</button></div>';
    const hstep = (d) => {
      const n = chars.HAIR_STYLES.length;
      o.hairStyle = chars.HAIR_STYLES[(hidx + d + n) % n][0];
      TS.sfx.click(); chars.save(); renderOptions();
    };
    hrow.querySelector('.prev').addEventListener('click', () => hstep(-1));
    hrow.querySelector('.next').addEventListener('click', () => hstep(1));
    optionsEl.appendChild(hrow);
    for (const [key, label, colors] of [['hair', 'Hair color', chars.HAIRS], ['skin', 'Skin', chars.SKINS]]) {
      const row = document.createElement('div');
      row.className = 'opt only-sw';
      row.innerHTML = '<div class="label">' + label + '</div>';
      row.appendChild(makeSwatches(colors, o[key], (c) => { o[key] = c; chars.save(); renderOptions(); }));
      optionsEl.appendChild(row);
    }
  }

  function drawPreview() {
    const k = preview.width / 320;
    pg.setTransform(k, 0, 0, k, 0, 0);
    pg.clearRect(0, 0, 320, 400);
    chars.draw(pg, lockerWho, chars.outfits[lockerWho], { x: 160, y: 365, scale: 2.9, t: time, cheer: false });
  }

  document.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => {
      lockerWho = b.dataset.who;
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
      TS.sfx.click();
      renderOptions();
    })
  );
  $('#btn-random').addEventListener('click', () => { TS.sfx.click(); chars.randomize(lockerWho); renderOptions(); });
  $('#btn-reset').addEventListener('click', () => { TS.sfx.click(); chars.reset(lockerWho); renderOptions(); });

  const modesEl = $('#modes');
  function renderModes() {
    modesEl.innerHTML = '';
    MODES.forEach((m) => {
      const b = document.createElement('button');
      b.className = 'mode' + (m.id === mode ? ' sel' : '');
      b.textContent = m.label;
      b.addEventListener('click', () => {
        mode = m.id;
        try { localStorage.setItem('ts.mode', mode); } catch (e) {}
        TS.sfx.click(); renderModes();
      });
      modesEl.appendChild(b);
    });
  }

  // ---------- wheel ----------
  const wheelResult = $('#wheel-result');
  let pendingSport = null;
  let wheelTimer = 0;
  const wheel = new TS.Wheel($('#wheel'), (sport) => {
    wheelResult.textContent = sport.icon + ' ' + sport.label + '!';
    pendingSport = sport.id;
    wheelTimer = 1.6;
  });
  function doSpin() {
    if (current !== 'wheel') return;
    if (wheel.spin()) { wheelResult.innerHTML = '&nbsp;'; pendingSport = null; TS.sfx.click(); }
  }

  // ---------- game lifecycle ----------
  const gameCanvas = $('#game');
  const gctx = gameCanvas.getContext('2d');
  // Keep the backing store matched to the on-screen size so it stays sharp when large.
  function resizeGame() {
    const cssW = gameCanvas.parentElement.clientWidth || 960;
    const w = Math.min(2560, Math.max(960, Math.round(cssW * (window.devicePixelRatio || 1))));
    if (gameCanvas.width !== w) { gameCanvas.width = w; gameCanvas.height = Math.round(w * 0.625); }
  }
  window.addEventListener('resize', () => { if (current === 'game') resizeGame(); });
  const overlay = $('#overlay');
  const card = $('#overlay-card');
  let game = null;
  let gameId = null;
  let gstate = 'none'; // intro | playing | paused | result
  let resCanvas = null;
  let resWho = null;

  function controlsText() {
    if (mode === '2p') return 'Henry: <b>WASD</b> + <b>Space</b> &nbsp;·&nbsp; Theo: <b>Arrow keys</b> + <b>Enter</b>';
    return 'Move: <b>WASD</b> or <b>Arrows</b> &nbsp;·&nbsp; Action: <b>Space</b> or <b>Enter</b>';
  }

  let origin = 'wheel';
  function startSport(id, from) {
    gameId = id;
    origin = from || 'wheel';
    TS.input.humans = humans().slice();
    const players = ['henry', 'theo'].map((who, i) => ({ who, outfit: chars.outfits[who], human: humans()[i] }));
    game = TS.sports[id]({ players });
    show('game');
    showIntro();
  }

  function setOverlay(html) { card.innerHTML = html; overlay.classList.remove('hidden'); }
  function hideOverlay() { overlay.classList.add('hidden'); }

  function showIntro() {
    gstate = 'intro';
    setOverlay(
      '<h3>' + game.title + '</h3><ul class="help">' + game.help.map((h) => '<li>' + h + '</li>').join('') + '</ul>' +
      '<p class="ctrl">' + controlsText() + '</p>' +
      '<button class="btn big" id="ov-go">Play! <small>(Space)</small></button>'
    );
    $('#ov-go').addEventListener('click', beginPlay);
  }
  function beginPlay() {
    if (gstate !== 'intro') return;
    hideOverlay();
    gstate = 'playing';
    TS.input.endFrame();
    TS.sfx.go();
  }

  function showPause() {
    if (gstate !== 'playing') return;
    gstate = 'paused';
    setOverlay(
      '<h3>Paused</h3>' +
      '<button class="btn big" id="ov-resume">Resume</button>' +
      '<div class="row"><button class="btn small alt" id="ov-spin">' + againLabel() + '</button>' +
      '<button class="btn small alt" id="ov-locker">👕 Locker room</button></div>'
    );
    $('#ov-resume').addEventListener('click', resume);
    $('#ov-spin').addEventListener('click', toNext);
    $('#ov-locker').addEventListener('click', toLocker);
  }
  function resume() { if (gstate === 'paused') { hideOverlay(); gstate = 'playing'; } }

  function showResult() {
    gstate = 'result';
    const r = game.result;
    const names = ['Henry', 'Theo'];
    resWho = r.winner === null ? null : r.winner;
    const title = r.winner === null ? "It's a tie!" : names[r.winner] + ' wins!';
    const humanWon = r.winner !== null && humans()[r.winner];
    if (r.winner === null) TS.sfx.beep(); else if (humanWon || mode === '2p') TS.sfx.win(); else TS.sfx.lose();
    setOverlay(
      '<h3>' + title + '</h3>' +
      '<canvas id="res-canvas" width="420" height="230"></canvas>' +
      '<p>' + (r.summary || '') + '</p>' +
      '<div class="row"><button class="btn" id="ov-again">↻ Rematch</button>' +
      '<button class="btn alt" id="ov-spin">' + againLabel() + '</button>' +
      '<button class="btn alt" id="ov-locker">👕 Locker room</button></div>'
    );
    resCanvas = $('#res-canvas');
    $('#ov-again').addEventListener('click', () => startSport(gameId, origin));
    $('#ov-spin').addEventListener('click', toNext);
    $('#ov-locker').addEventListener('click', toLocker);
  }
  function drawResult() {
    if (!resCanvas) return;
    const g = resCanvas.getContext('2d');
    g.clearRect(0, 0, resCanvas.width, resCanvas.height);
    const r = game.result;
    const spots = [['henry', 110], ['theo', 310]];
    spots.forEach(([who, x], i) => {
      const won = r.winner === null || r.winner === i;
      chars.draw(g, who, chars.outfits[who], {
        x, y: 205, scale: won ? 1.7 : 1.4, t: time + i, cheer: won,
        lift: won ? Math.abs(Math.sin(time * 4 + i)) * 12 : 0, mood: won ? 'cheer' : 'sad', facing: i === 0 ? 1 : -1,
      });
    });
  }

  function leaveGame() { game = null; gstate = 'none'; resCanvas = null; hideOverlay(); }
  const againLabel = () => (origin === 'pick' ? '🎮 Pick a game' : '🎡 Spin again');
  function toNext() { leaveGame(); if (origin === 'pick') goPick(); else goWheel(); }
  function toLocker() { leaveGame(); goLocker(); }

  function goLocker() { show('locker'); renderOptions(); renderModes(); }
  function goPick() {
    show('pick');
    const grid = $('#sport-grid');
    grid.innerHTML = '';
    TS.SPORT_LIST.forEach((sp) => {
      const b = document.createElement('button');
      b.className = 'sport-card';
      b.style.setProperty('--c', sp.color);
      b.innerHTML = '<span class="ico">' + sp.icon + '</span><span class="nm">' + sp.label + '</span><span class="bl">' + sp.blurb + '</span>';
      b.addEventListener('click', () => { TS.sfx.click(); startSport(sp.id, 'pick'); });
      grid.appendChild(b);
    });
  }
  function goWheel() { show('wheel'); wheelResult.innerHTML = '&nbsp;'; pendingSport = null; wheelTimer = 0; }

  // ---------- wiring ----------
  $('#btn-play').addEventListener('click', () => { TS.sfx.click(); goLocker(); });
  $('#btn-pick').addEventListener('click', () => { TS.sfx.click(); goPick(); });
  $('#btn-pick-back').addEventListener('click', () => { TS.sfx.click(); goLocker(); });
  $('#btn-spin').addEventListener('click', () => { TS.sfx.click(); goWheel(); });
  $('#btn-back-locker').addEventListener('click', () => { TS.sfx.click(); goLocker(); });
  $('#btn-dospin').addEventListener('click', doSpin);
  $('#btn-menu').addEventListener('click', () => (gstate === 'paused' ? resume() : showPause()));
  const muteBtn = $('#mute');
  const syncMute = () => { muteBtn.textContent = TS.sfx.isMuted() ? '🔇' : '🔊'; };
  muteBtn.addEventListener('click', () => { TS.sfx.toggleMute(); syncMute(); });
  syncMute();
  const fsBtn = $('#fs');
  const fsOn = () => document.fullscreenElement || document.webkitFullscreenElement;
  fsBtn.addEventListener('click', () => {
    const el = document.documentElement;
    try {
      if (fsOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) {}
  });
  document.addEventListener('fullscreenchange', () => { fsBtn.textContent = fsOn() ? '✕' : '⛶'; if (current === 'game') resizeGame(); });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyM') { TS.sfx.toggleMute(); syncMute(); }
    if (current === 'game' && (e.code === 'Escape' || e.code === 'KeyP')) {
      if (gstate === 'paused') resume(); else showPause();
    }
  });

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    fitUI();

    if (current === 'title') drawTitle();
    else if (current === 'locker') drawPreview();
    else if (current === 'wheel') {
      if (TS.input.pressed('Space') || TS.input.pressed('Enter')) doSpin();
      wheel.update(dt);
      wheel.draw();
      if (wheelTimer > 0) {
        wheelTimer -= dt;
        if (wheelTimer <= 0 && pendingSport) { const id = pendingSport; pendingSport = null; startSport(id); }
      }
    } else if (current === 'game' && game) {
      if (gstate === 'intro') {
        if (TS.input.pressed('Space') || TS.input.pressed('Enter')) beginPlay();
      } else if (gstate === 'playing') {
        game.update(dt);
        if (game.over) showResult();
      } else if (gstate === 'result') {
        drawResult();
      }
      resizeGame();
      const k = gameCanvas.width / 960;
      gctx.setTransform(k, 0, 0, k, 0, 0);
      game.draw(gctx);
    }

    TS.input.endFrame();
    requestAnimationFrame(frame);
  }

  // expose for debugging / automated tests
  TS.app = { startSport, goLocker, goWheel, goPick, get game() { return game; }, get state() { return gstate; }, beginPlay };

  requestAnimationFrame(frame);
})();
