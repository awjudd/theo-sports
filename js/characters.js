// Henry & Theo: outfit data + procedural canvas renderer.
// Characters are drawn in "unit" space: feet at (0,0), head top at about y = -102.
(function () {
  const TS = (window.TS = window.TS || {});

  const PALETTE = [
    '#e63946', '#f77f00', '#fcbf49', '#6a994e', '#2a9d8f', '#4cc9f0',
    '#3a86ff', '#8338ec', '#ff70a6', '#ffffff', '#2b2d42', '#8d5524',
  ];
  const SKINS = ['#ffdbb4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
  const HAIRS = ['#1a1a1a', '#2b1b0e', '#6b4423', '#c69c3a', '#f2d16b', '#d14a2a', '#9a9a9a', '#e87ac2'];

  const SLOTS = [
    { id: 'hat', label: 'Hat', styles: [['none', 'No hat'], ['cap', 'Ball cap'], ['beanie', 'Beanie'], ['cowboy', 'Cowboy'], ['crown', 'Crown'], ['tophat', 'Top hat'], ['headband', 'Headband']] },
    { id: 'shirt', label: 'Shirt', styles: [['tee', 'T-shirt'], ['stripes', 'Stripes'], ['hoodie', 'Hoodie'], ['jersey', 'Jersey'], ['tank', 'Tank top']] },
    { id: 'necklace', label: 'Necklace', styles: [['none', 'None'], ['chain', 'Gold chain'], ['pearls', 'Pearls'], ['medal', 'Medal'], ['pendant', 'Gem pendant'], ['bandana', 'Bandana']] },
    { id: 'pants', label: 'Pants', styles: [['shorts', 'Shorts'], ['long', 'Long pants'], ['jogger', 'Joggers'], ['overalls', 'Overalls']] },
    { id: 'shoes', label: 'Shoes', styles: [['sneakers', 'Sneakers'], ['boots', 'Boots'], ['cleats', 'Cleats'], ['sandals', 'Sandals']] },
    { id: 'glasses', label: 'Glasses', styles: [['none', 'None'], ['round', 'Round'], ['shades', 'Sunglasses'], ['goggles', 'Goggles']] },
  ];

  const HAIR_STYLES = [['spiky', 'Spiky'], ['sidepart', 'Side part'], ['mop', 'Mop top'], ['buzz', 'Buzz cut'], ['curly', 'Curly'], ['mohawk', 'Mohawk'], ['afro', 'Afro'], ['bald', 'Bald']];

  const DEFAULTS = {
    henry: {
      hat: { s: 'cap', c: '#3a86ff' },
      shirt: { s: 'jersey', c: '#e63946' },
      necklace: { s: 'chain', c: '#fcbf49' },
      pants: { s: 'shorts', c: '#2b2d42' },
      shoes: { s: 'sneakers', c: '#ffffff' },
      glasses: { s: 'none', c: '#2b2d42' },
      hair: '#6b4423',
      hairStyle: 'spiky',
      skin: '#f1c27d',
    },
    theo: {
      hat: { s: 'beanie', c: '#f77f00' },
      shirt: { s: 'stripes', c: '#4cc9f0' },
      necklace: { s: 'pendant', c: '#8338ec' },
      pants: { s: 'jogger', c: '#3a86ff' },
      shoes: { s: 'sneakers', c: '#e63946' },
      glasses: { s: 'none', c: '#2b2d42' },
      hair: '#f2d16b',
      hairStyle: 'sidepart',
      skin: '#ffdbb4',
    },
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const outfits = { henry: clone(DEFAULTS.henry), theo: clone(DEFAULTS.theo) };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('ts.outfits') || 'null');
      if (saved) {
        for (const who of ['henry', 'theo']) {
          const s = saved[who];
          if (!s) continue;
          for (const slot of SLOTS) {
            if (s[slot.id] && slot.styles.some((x) => x[0] === s[slot.id].s)) outfits[who][slot.id] = s[slot.id];
          }
          if (typeof s.hair === 'string') outfits[who].hair = s.hair;
          if (HAIR_STYLES.some((x) => x[0] === s.hairStyle)) outfits[who].hairStyle = s.hairStyle;
          if (typeof s.skin === 'string') outfits[who].skin = s.skin;
        }
      }
    } catch (e) { /* ignore corrupt storage */ }
  }
  function save() {
    try { localStorage.setItem('ts.outfits', JSON.stringify(outfits)); } catch (e) {}
  }
  function reset(who) { outfits[who] = clone(DEFAULTS[who]); save(); }
  function randomize(who) {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const o = outfits[who];
    for (const slot of SLOTS) o[slot.id] = { s: pick(slot.styles)[0], c: pick(PALETTE) };
    o.hair = pick(HAIRS);
    o.hairStyle = pick(HAIR_STYLES)[0];
    o.skin = pick(SKINS);
    save();
  }

  // ---------- drawing helpers ----------
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  const TAU = Math.PI * 2;

  // ---------- body parts ----------
  function shoe(g, sh) {
    const c = sh.c;
    if (sh.s === 'boots') {
      g.fillStyle = c; rr(g, -7.5, -15, 15, 15, 3); g.fill();
      g.fillStyle = shade(c, -0.4); rr(g, -8.5, -3, 17, 3.5, 1.5); g.fill();
      g.fillStyle = shade(c, -0.25); rr(g, -7.5, -15, 15, 3, 1.5); g.fill();
    } else if (sh.s === 'sandals') {
      g.fillStyle = shade(c, -0.2); rr(g, -8, -2.5, 16, 3, 1.5); g.fill();
      g.fillStyle = c; rr(g, -5.5, -6, 11, 3, 1.5); g.fill();
      rr(g, -1.5, -8, 3, 6, 1); g.fill();
    } else {
      g.fillStyle = c; rr(g, -8.5, -8, 17, 8, 4); g.fill();
      g.fillStyle = shade('#ffffff', -0.05); rr(g, -9, -2.5, 18, 3.5, 1.7); g.fill();
      g.strokeStyle = shade(c, c === '#ffffff' ? -0.3 : 0.5); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-3, -6.5); g.lineTo(3, -6.5); g.moveTo(-3, -4.5); g.lineTo(3, -4.5); g.stroke();
      if (sh.s === 'cleats') {
        g.fillStyle = '#222';
        for (const x of [-6.5, -2, 2.5, 7]) g.fillRect(x - 1, 0.8, 2, 2);
      }
    }
  }

  function legs(g, o, sw) {
    const pc = o.pants.c, ps = o.pants.s;
    for (const side of [-1, 1]) {
      const lift = Math.max(0, sw * side) * 5;
      g.save();
      g.translate(side * 8.5, -lift);
      g.fillStyle = o.skin; rr(g, -4.5, -37, 9, 33, 4); g.fill();
      g.fillStyle = pc;
      if (ps === 'shorts') { rr(g, -6.5, -38, 13, 17, 4); g.fill(); }
      else if (ps === 'jogger') {
        rr(g, -7, -38, 14, 31, 4); g.fill();
        g.fillStyle = shade(pc, -0.25); rr(g, -6.2, -12, 12.4, 6, 3); g.fill();
      } else { rr(g, -6.5, -38, 13, 33, 3); g.fill(); }
      shoe(g, o.shoes);
      g.restore();
    }
  }

  function arm(g, o, side, ang) {
    const s = o.shirt.s, c = o.shirt.c;
    g.save();
    g.translate(side * 15, -62);
    g.rotate(ang);
    g.fillStyle = o.skin; rr(g, -4, -1, 8, 25, 4); g.fill();
    g.beginPath(); g.arc(0, 25, 4.8, 0, TAU); g.fill();
    if (s !== 'tank') {
      const len = s === 'hoodie' ? 23 : 11;
      g.fillStyle = s === 'jersey' ? shade(c, -0.12) : c;
      rr(g, -5, -2.5, 10, len, 4); g.fill();
      if (s === 'hoodie') { g.fillStyle = shade(c, -0.25); rr(g, -5, len - 4, 10, 4, 2); g.fill(); }
      if (s === 'jersey') { g.fillStyle = '#fff'; g.fillRect(-5, 7, 10, 2); }
    }
    g.restore();
  }

  function torso(g, who, o) {
    const s = o.shirt.s, c = o.shirt.c;
    const w = s === 'tank' ? 13 : 15.5;
    if (s === 'hoodie') {
      g.fillStyle = shade(c, -0.25);
      g.beginPath(); g.ellipse(0, -66, 14, 8, 0, 0, TAU); g.fill();
    }
    g.fillStyle = c;
    rr(g, -w, -67, w * 2, 37, 7); g.fill();
    if (s === 'stripes') {
      g.save(); rr(g, -w, -67, w * 2, 37, 7); g.clip();
      g.fillStyle = c === '#ffffff' ? '#cde' : '#ffffffcc';
      for (let y = -62; y < -30; y += 9) g.fillRect(-20, y, 40, 4.5);
      g.restore();
    }
    if (s === 'jersey') {
      g.fillStyle = '#ffffffee'; g.fillRect(-w, -33, w * 2, 3);
      g.fillStyle = shade(c, c === '#ffffff' ? -0.6 : -0.45);
      g.font = 'bold 20px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(who === 'henry' ? '8' : '4', 0, -48);
    }
    if (s === 'hoodie') {
      g.fillStyle = shade(c, -0.18); rr(g, -9.5, -47, 19, 10, 4); g.fill();
      g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-3.5, -65); g.lineTo(-3.5, -55); g.moveTo(3.5, -65); g.lineTo(3.5, -55); g.stroke();
    }
    // collar / neck
    g.fillStyle = o.skin;
    g.beginPath(); g.ellipse(0, -67, s === 'hoodie' ? 5 : 6.5, 4.2, 0, 0, Math.PI); g.fill();
    if (s === 'tee' || s === 'jersey') {
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(0, -67, 6.8, 4.6, 0, 0.05, Math.PI - 0.05); g.stroke();
    }
  }

  function bib(g, o) {
    if (o.pants.s !== 'overalls') return;
    const c = o.pants.c;
    g.fillStyle = c; rr(g, -9.5, -57, 19, 26, 3); g.fill();
    g.fillRect(-11, -66, 3.5, 11); g.fillRect(7.5, -66, 3.5, 11);
    g.fillStyle = '#fcbf49';
    g.beginPath(); g.arc(-9.3, -56, 1.8, 0, TAU); g.arc(9.3, -56, 1.8, 0, TAU); g.fill();
    g.fillStyle = shade(c, -0.25); rr(g, -4.5, -48, 9, 6, 1.5); g.fill();
  }

  function necklace(g, n) {
    if (n.s === 'none') return;
    const c = n.c;
    const B = (t) => { // quadratic curve from (-8.5,-67) via (0,-50) to (8.5,-67)
      const u = 1 - t;
      return [u * u * -8.5 + 2 * u * t * 0 + t * t * 8.5, u * u * -67 + 2 * u * t * -49 + t * t * -67];
    };
    if (n.s === 'chain') {
      g.strokeStyle = c; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-8.5, -67); g.quadraticCurveTo(0, -49, 8.5, -67); g.stroke();
      g.strokeStyle = shade(c, 0.5); g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-8.5, -67); g.quadraticCurveTo(0, -49, 8.5, -67); g.stroke();
    } else if (n.s === 'pearls') {
      for (let i = 0; i <= 8; i++) {
        const [x, y] = B(i / 8);
        g.fillStyle = c; g.beginPath(); g.arc(x, y + 1, 2.7, 0, TAU); g.fill();
        g.fillStyle = '#ffffff99'; g.beginPath(); g.arc(x - 0.8, y, 0.9, 0, TAU); g.fill();
      }
    } else if (n.s === 'medal') {
      g.strokeStyle = '#d62839'; g.lineWidth = 3; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(-7, -67); g.lineTo(0, -52); g.lineTo(7, -67); g.stroke();
      g.fillStyle = c; g.beginPath(); g.arc(0, -47, 7, 0, TAU); g.fill();
      g.strokeStyle = shade(c, -0.4); g.lineWidth = 1.5; g.stroke();
      g.fillStyle = shade(c, -0.3); g.beginPath(); g.arc(0, -47, 3.2, 0, TAU); g.fill();
    } else if (n.s === 'pendant') {
      g.strokeStyle = '#d9dde8'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-8.5, -67); g.quadraticCurveTo(0, -49, 8.5, -67); g.stroke();
      g.fillStyle = c; g.beginPath();
      g.moveTo(0, -57); g.lineTo(5, -52); g.lineTo(0, -44); g.lineTo(-5, -52); g.closePath(); g.fill();
      g.strokeStyle = '#ffffffaa'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#ffffff88'; g.beginPath(); g.moveTo(0, -55); g.lineTo(2.5, -52); g.lineTo(0, -52); g.closePath(); g.fill();
    } else if (n.s === 'bandana') {
      g.fillStyle = c; g.beginPath();
      g.moveTo(-12, -68); g.lineTo(12, -68); g.lineTo(0, -50); g.closePath(); g.fill();
      g.fillStyle = shade(c, -0.25); g.fillRect(-12.5, -69, 25, 4);
      g.fillStyle = '#ffffffcc';
      for (const [x, y] of [[-5, -62], [4, -63], [0, -57]]) { g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
    }
  }

  // Hair behind the head (only the afro needs this).
  function hairBack(g, style, col) {
    if (style !== 'afro') return;
    g.fillStyle = col;
    for (const [x, y, r] of [[0, -94, 25], [-17, -86, 14], [17, -86, 14], [-10, -105, 14], [10, -105, 14]]) {
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }

  // Hair on the front of the head.
  function hair(g, style, col) {
    if (style === 'bald') return;
    g.fillStyle = col;
    if (style === 'mohawk') {
      g.globalAlpha = 0.35; g.beginPath(); g.arc(0, -82, 19.6, Math.PI, TAU); g.lineTo(17, -90); g.quadraticCurveTo(0, -88, -17, -90); g.closePath(); g.fill(); g.globalAlpha = 1;
      for (const [x, h] of [[-9, 14], [-3, 20], [3, 22], [9, 15]]) {
        g.beginPath(); g.moveTo(x - 4, -96); g.lineTo(x, -96 - h); g.lineTo(x + 4, -96); g.closePath(); g.fill();
      }
      rr(g, -6, -104, 12, 12, 4); g.fill();
      return;
    }
    g.beginPath();
    g.arc(0, -82, style === 'buzz' ? 19.8 : 20.5, Math.PI, TAU);
    if (style === 'buzz') {
      g.lineTo(17.5, -90); g.quadraticCurveTo(0, -87, -17.5, -90);
      g.globalAlpha = 0.55;
    } else if (style === 'mop') {
      g.lineTo(19, -80); g.lineTo(15, -80);
      g.quadraticCurveTo(8, -88, 0, -82);
      g.quadraticCurveTo(-8, -88, -15, -80);
      g.lineTo(-19, -80);
    } else if (style === 'sidepart') {
      g.lineTo(17, -88); g.quadraticCurveTo(4, -92, -6, -85); g.quadraticCurveTo(-13, -82, -17, -80);
    } else {
      g.lineTo(17, -90); g.quadraticCurveTo(0, -84, -17, -90);
    }
    g.closePath(); g.fill();
    g.globalAlpha = 1;
    if (style === 'spiky') {
      for (const a of [-1.0, -0.5, 0, 0.5, 1.0]) {
        const ang = -Math.PI / 2 + a;
        const p1 = [Math.cos(ang - 0.28) * 19.5, -82 + Math.sin(ang - 0.28) * 19.5];
        const p2 = [Math.cos(ang + 0.28) * 19.5, -82 + Math.sin(ang + 0.28) * 19.5];
        const tip = [Math.cos(ang) * 25.5, -82 + Math.sin(ang) * 25.5];
        g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(tip[0], tip[1]); g.lineTo(p2[0], p2[1]); g.closePath(); g.fill();
      }
    } else if (style === 'curly' || style === 'afro') {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const ang = Math.PI + (i / (n - 1)) * Math.PI;
        g.beginPath(); g.arc(Math.cos(ang) * 17, -82 + Math.sin(ang) * 17, 6.5, 0, TAU); g.fill();
      }
    } else if (style === 'sidepart') {
      rr(g, -21, -88, 5, 11, 2.5); g.fill(); rr(g, 16, -88, 5, 11, 2.5); g.fill();
      g.strokeStyle = shade(col, -0.35); g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-6, -85); g.quadraticCurveTo(-3, -95, 4, -100); g.stroke();
    } else if (style === 'mop') {
      rr(g, -21, -88, 5, 10, 2.5); g.fill(); rr(g, 16, -88, 5, 10, 2.5); g.fill();
    }
  }

  function face(g, o, t, mood) {
    g.fillStyle = o.skin;
    g.beginPath(); g.arc(-19, -80, 4.2, 0, TAU); g.arc(19, -80, 4.2, 0, TAU); g.fill();
    g.beginPath(); g.arc(0, -82, 19, 0, TAU); g.fill();
  }
  function features(g, o, t, mood) {
    const blink = (t % 4) > 3.86;
    g.fillStyle = '#222';
    for (const x of [-7, 7]) {
      g.beginPath(); g.ellipse(x, -80, 2.7, blink ? 0.5 : (mood === 'cheer' ? 2 : 3), 0, 0, TAU); g.fill();
      if (!blink) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 0.9, -81.2, 0.9, 0, TAU); g.fill(); g.fillStyle = '#222'; }
    }
    g.fillStyle = 'rgba(255,100,100,.3)';
    g.beginPath(); g.arc(-12, -74.5, 3.5, 0, TAU); g.arc(12, -74.5, 3.5, 0, TAU); g.fill();
    g.strokeStyle = '#7a3b2e'; g.lineWidth = 1.9; g.lineCap = 'round';
    if (mood === 'cheer') {
      g.fillStyle = '#7a2e2e'; g.beginPath(); g.ellipse(0, -72, 6, 4.8, 0, 0, Math.PI); g.fill();
      g.fillStyle = '#fff'; g.fillRect(-4, -76.2, 8, 1.8);
    } else if (mood === 'sad') {
      g.beginPath(); g.arc(0, -68, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    } else {
      g.beginPath(); g.arc(0, -76, 6, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
    }
  }

  function glasses(g, gl) {
    if (gl.s === 'none') return;
    const c = gl.c;
    if (gl.s === 'round') {
      g.strokeStyle = c; g.lineWidth = 1.9;
      for (const x of [-7.5, 7.5]) {
        g.fillStyle = 'rgba(200,230,255,.28)';
        g.beginPath(); g.arc(x, -80, 6.6, 0, TAU); g.fill(); g.stroke();
      }
      g.beginPath(); g.moveTo(-1, -81); g.lineTo(1, -81); g.moveTo(-14, -81); g.lineTo(-19, -83); g.moveTo(14, -81); g.lineTo(19, -83); g.stroke();
    } else if (gl.s === 'shades') {
      g.fillStyle = '#111'; g.strokeStyle = c; g.lineWidth = 1.8;
      rr(g, -15, -85, 13.5, 9.5, 3.5); g.fill(); g.stroke();
      rr(g, 1.5, -85, 13.5, 9.5, 3.5); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-1.5, -82); g.lineTo(1.5, -82); g.stroke();
      g.fillStyle = '#ffffff55'; g.fillRect(-12.5, -83.5, 4, 1.8); g.fillRect(4, -83.5, 4, 1.8);
    } else if (gl.s === 'goggles') {
      g.fillStyle = shade(c, -0.1); rr(g, -21, -85.5, 42, 6, 3); g.fill();
      g.fillStyle = c + 'aa'; g.strokeStyle = '#222'; g.lineWidth = 2;
      rr(g, -15, -87, 13, 12, 5); g.fill(); g.stroke();
      rr(g, 2, -87, 13, 12, 5); g.fill(); g.stroke();
      g.fillStyle = '#ffffff77'; g.fillRect(-12, -85, 4, 2); g.fillRect(5, -85, 4, 2);
    }
  }

  function hat(g, h) {
    if (h.s === 'none') return;
    const c = h.c;
    const dk = shade(c, -0.25);
    if (h.s === 'cap') {
      g.fillStyle = c; g.beginPath(); g.arc(0, -85, 21.5, Math.PI, TAU); g.closePath(); g.fill();
      g.fillStyle = dk; rr(g, -23, -91.5, 46, 6, 3); g.fill();
      g.fillStyle = shade(c, 0.35); g.beginPath(); g.arc(0, -106.5, 2.4, 0, TAU); g.fill();
      g.strokeStyle = dk; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -106); g.lineTo(0, -91); g.stroke();
    } else if (h.s === 'beanie') {
      g.fillStyle = c; g.beginPath(); g.arc(0, -83, 22, Math.PI, TAU); g.closePath(); g.fill();
      g.fillStyle = dk; rr(g, -22.5, -92, 45, 10, 4); g.fill();
      g.strokeStyle = shade(c, -0.45); g.lineWidth = 1;
      for (let x = -18; x <= 18; x += 5) { g.beginPath(); g.moveTo(x, -91); g.lineTo(x, -83); g.stroke(); }
      g.fillStyle = shade(c, 0.35); g.beginPath(); g.arc(0, -106.5, 6, 0, TAU); g.fill();
    } else if (h.s === 'cowboy') {
      g.fillStyle = dk; g.beginPath(); g.ellipse(0, -91, 33, 7, 0, 0, TAU); g.fill();
      g.fillStyle = c; rr(g, -15, -113, 30, 24, 8); g.fill();
      g.fillStyle = shade(c, -0.5); g.fillRect(-15, -97, 30, 4.5);
      g.fillStyle = c; g.beginPath(); g.ellipse(0, -92.5, 24, 4.5, 0, Math.PI, TAU); g.fill();
    } else if (h.s === 'crown') {
      g.fillStyle = c; g.strokeStyle = shade(c, -0.45); g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-16, -89); g.lineTo(-17, -110); g.lineTo(-8, -98); g.lineTo(0, -113);
      g.lineTo(8, -98); g.lineTo(17, -110); g.lineTo(16, -89); g.closePath(); g.fill(); g.stroke();
      const gems = ['#e63946', '#3a86ff', '#e63946'];
      [[-11, -94], [0, -95], [11, -94]].forEach(([x, y], i) => { g.fillStyle = gems[i]; g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill(); });
      g.fillStyle = '#fff'; for (const [x, y] of [[-17, -110], [0, -113], [17, -110]]) { g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill(); }
    } else if (h.s === 'tophat') {
      g.fillStyle = dk; g.beginPath(); g.ellipse(0, -91, 27, 5.5, 0, 0, TAU); g.fill();
      g.fillStyle = c; rr(g, -15.5, -123, 31, 33, 3); g.fill();
      g.fillStyle = shade(c, c === '#2b2d42' ? 0.4 : -0.45); g.fillRect(-15.5, -99, 31, 7);
      g.fillStyle = '#ffffff22'; g.fillRect(-11, -121, 4, 28);
    } else if (h.s === 'headband') {
      g.fillStyle = c; rr(g, -20.5, -94, 41, 7, 3); g.fill();
      g.fillStyle = shade(c, -0.2);
      g.beginPath(); g.moveTo(19, -91); g.lineTo(28, -97); g.lineTo(26, -90); g.lineTo(29, -84); g.closePath(); g.fill();
    }
  }

  // ---------- main entry ----------
  // pose: x, y, scale, t, moving, facing(+1/-1), arm (right-arm raise, radians), cheer, lift, mood
  function draw(g, who, o, pose) {
    const p = pose || {};
    const t = p.t || 0;
    const sc = p.scale || 1;
    const flip = p.facing < 0 ? -1 : 1;
    const moving = !!p.moving;
    const sw = moving ? Math.sin(t * 11) : 0;
    const bob = moving ? Math.abs(Math.sin(t * 11)) * 2.5 : Math.sin(t * 2.4) * 1.1;
    const lift = p.lift || 0;
    const mood = p.mood || (p.cheer ? 'cheer' : 'happy');

    g.save();
    g.translate(p.x || 0, p.y || 0);
    g.scale(sc * flip, sc);
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(0, 0, Math.max(10, 22 - lift * 0.15), 6, 0, 0, TAU); g.fill();
    g.translate(0, -lift);
    legs(g, o, sw);
    g.translate(0, -bob);

    let armL = 0.14 + sw * 0.5;
    let armR = -0.14 - sw * 0.5;
    if (p.arm) armR = -p.arm;
    if (p.cheer) {
      const w = Math.sin(t * 9) * 0.3;
      armL = 2.6 + w; armR = -2.6 - w;
    }
    arm(g, o, -1, armL);
    torso(g, who, o);
    bib(g, o);
    arm(g, o, 1, armR);
    necklace(g, o.necklace);
    hairBack(g, o.hairStyle, o.hair);
    face(g, o);
    hair(g, o.hairStyle, o.hair);
    features(g, o, t, mood);
    glasses(g, o.glasses);
    hat(g, o.hat);
    g.restore();
  }

  TS.chars = { PALETTE, SKINS, HAIRS, HAIR_STYLES, SLOTS, DEFAULTS, outfits, load, save, reset, randomize, draw, shade, rr };
  load();
})();
