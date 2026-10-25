// The sport-picking wheel.
(function () {
  const TS = (window.TS = window.TS || {});

  const SPORTS = [
    { id: 'hockey', blurb: 'Slap the puck into the net', label: 'Hockey', icon: '🏒', color: '#4cc9f0' },
    { id: 'baseball', blurb: 'Bat and pitch for runs', label: 'Baseball', icon: '⚾', color: '#e63946' },
    { id: 'basketball', blurb: 'Sink shots from the arc', label: 'Basketball', icon: '🏀', color: '#f77f00' },
    { id: 'soccer', blurb: 'Dribble, kick, score', label: 'Soccer', icon: '⚽', color: '#6a994e' },
    { id: 'bowling', blurb: 'Roll for strikes', label: 'Bowling', icon: '🎳', color: '#8338ec' },
    { id: 'discgolf', blurb: 'Throw round three holes', label: 'Disc Golf', icon: '🥏', color: '#e9a100' },
    { id: 'football', blurb: 'Kick through the uprights', label: 'Field Goals', icon: '🏈', color: '#8d5524' },
    { id: 'lacrosse', blurb: 'Scoop, throw, score', label: 'Lacrosse', icon: '🥍', color: '#2a9d8f' },
    { id: 'archery', blurb: 'Steady aim, hit the bullseye', label: 'Archery', icon: '🏹', color: '#d6336c' },
    { id: 'penalty', blurb: 'Shoot or save the spot kicks', label: 'Penalties', icon: '🥅', color: '#c9184a' },
    { id: 'sumo', blurb: 'Shove them out of the ring', label: 'Sumo', icon: '🥋', color: '#6d597a' },
    { id: 'swimming', blurb: 'Race two lengths, flip turn', label: 'Swimming', icon: '🏊', color: '#0096c7' },
    { id: 'tugofwar', blurb: 'Tap fast and pull hardest', label: 'Tug of War', icon: '🪢', color: '#9c6644' },
    { id: 'dodgeball', blurb: 'Dodge, catch, throw', label: 'Dodgeball', icon: '🔴', color: '#d00000' },
    { id: 'minigolf', blurb: 'Windmills, bumpers and sand', label: 'Mini Putt', icon: '⛳', color: '#2d936c' },
    { id: 'hurdles', blurb: 'Sprint and jump to win', label: 'Hurdles', icon: '🏃', color: '#3a86ff' },
  ];
  const TAU = Math.PI * 2;

  class Wheel {
    constructor(canvas, onDone) {
      this.c = canvas;
      this.g = canvas.getContext('2d');
      this.onDone = onDone;
      this.rot = Math.random() * TAU;
      this.spinning = false;
      this.t = 0;
      this.dur = 5;
      this.lastIdx = -1;
      this.kick = 0;
      this.winner = -1;
      this.glow = 0;
    }
    get seg() { return TAU / SPORTS.length; }
    idxAt(rot) {
      const a = (((-Math.PI / 2 - rot) % TAU) + TAU) % TAU;
      return Math.floor(a / this.seg) % SPORTS.length;
    }
    spin() {
      if (this.spinning) return false;
      const n = SPORTS.length;
      const target = Math.floor(Math.random() * n);
      const jitter = (Math.random() - 0.5) * this.seg * 0.7;
      let end = -Math.PI / 2 - (target + 0.5) * this.seg - jitter;
      const start = this.rot;
      const min = start + TAU * 5;
      end += TAU * Math.ceil((min - end) / TAU);
      this.from = start; this.to = end; this.target = target;
      this.t = 0; this.spinning = true; this.winner = -1; this.glow = 0;
      this.lastIdx = this.idxAt(start);
      return true;
    }
    update(dt) {
      this.kick = Math.max(0, this.kick - dt * 6);
      if (this.winner >= 0) this.glow += dt;
      if (!this.spinning) return;
      this.t += dt;
      const u = Math.min(1, this.t / this.dur);
      const e = 1 - Math.pow(1 - u, 4);
      this.rot = this.from + (this.to - this.from) * e;
      const idx = this.idxAt(this.rot);
      if (idx !== this.lastIdx) { this.lastIdx = idx; this.kick = 1; TS.sfx.tick(); }
      if (u >= 1) {
        this.spinning = false;
        this.winner = this.target;
        TS.sfx.wheelDone();
        if (this.onDone) this.onDone(SPORTS[this.target]);
      }
    }
    draw() {
      const g = this.g, W = 560, H = 610;
      const k = this.c.width / W;
      g.setTransform(k, 0, 0, k, 0, 0);
      const cx = W / 2, cy = H / 2 + 20, R = 240, n = SPORTS.length, seg = this.seg;
      g.clearRect(0, 0, W, H);

      // glow ring
      const grd = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R + 36);
      grd.addColorStop(0, '#fcbf4900'); grd.addColorStop(1, '#fcbf4966');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R + 36, 0, TAU); g.fill();

      g.save();
      g.translate(cx, cy);
      g.rotate(this.rot);
      for (let i = 0; i < n; i++) {
        const a0 = i * seg, a1 = a0 + seg;
        const win = i === this.winner;
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.closePath();
        g.fillStyle = SPORTS[i].color; g.fill();
        if (win) {
          g.fillStyle = 'rgba(255,255,255,' + (0.18 + 0.18 * Math.sin(this.glow * 8)) + ')';
          g.fill();
        }
        g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
        // label
        g.save();
        g.rotate(a0 + seg / 2);
        g.textBaseline = 'middle';
        g.fillStyle = '#fff';
        g.textAlign = 'right';
        g.font = '800 ' + (n > 12 ? 15 : 19) + 'px "Trebuchet MS", sans-serif';
        g.shadowColor = '#0008'; g.shadowBlur = 4; g.shadowOffsetY = 2;
        g.fillText(SPORTS[i].label, R - 16, 0);
        g.shadowBlur = 0; g.shadowOffsetY = 0;
        g.textAlign = 'center';
        g.font = (n > 12 ? 28 : 34) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        g.save(); g.translate(R * (n > 12 ? 0.4 : 0.37), 0); g.rotate(Math.PI / 2); g.fillText(SPORTS[i].icon, 0, 0); g.restore();
        g.restore();
      }
      // studs
      for (let i = 0; i < n * 2; i++) {
        const a = (i * seg) / 2;
        g.fillStyle = '#fcbf49';
        g.beginPath(); g.arc(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2), 5, 0, TAU); g.fill();
      }
      g.restore();

      // rim
      g.strokeStyle = '#fcbf49'; g.lineWidth = 10;
      g.beginPath(); g.arc(cx, cy, R + 4, 0, TAU); g.stroke();
      // hub
      g.fillStyle = '#14213d'; g.beginPath(); g.arc(cx, cy, 34, 0, TAU); g.fill();
      g.strokeStyle = '#fcbf49'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#fcbf49'; g.beginPath(); g.arc(cx, cy, 11, 0, TAU); g.fill();

      // pointer
      g.save();
      g.translate(cx, cy - R - 10);
      g.rotate(-this.kick * 0.35);
      g.fillStyle = '#fff'; g.strokeStyle = '#14213d'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-20, -24); g.lineTo(20, -24); g.lineTo(0, 30); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e63946'; g.beginPath(); g.arc(0, -14, 6, 0, TAU); g.fill();
      g.restore();
    }
  }

  TS.Wheel = Wheel;
  TS.SPORT_LIST = SPORTS;
})();
