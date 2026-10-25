// Keyboard input. Player 0 = Henry, player 1 = Theo.
// With two humans: Henry uses WASD + Space, Theo uses arrows + Enter.
// With one human: that player can use WASD or arrows, and Space / Enter / F.
(function () {
  const TS = (window.TS = window.TS || {});
  const down = new Set();
  const pressed = new Set();
  const BLOCK = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  window.addEventListener('keydown', (e) => {
    if (BLOCK.includes(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  const any = (codes, set) => codes.some((c) => set.has(c));

  TS.input = {
    humans: [true, false],
    down: (code) => down.has(code),
    pressed: (code) => pressed.has(code),
    endFrame() { pressed.clear(); },
    pad(i) {
      const both = this.humans[0] && this.humans[1];
      let L, R, U, D, A;
      if (both) {
        if (i === 0) { L = ['KeyA']; R = ['KeyD']; U = ['KeyW']; D = ['KeyS']; A = ['Space', 'KeyF']; }
        else { L = ['ArrowLeft']; R = ['ArrowRight']; U = ['ArrowUp']; D = ['ArrowDown']; A = ['Enter', 'ShiftRight', 'Slash']; }
      } else {
        L = ['KeyA', 'ArrowLeft']; R = ['KeyD', 'ArrowRight']; U = ['KeyW', 'ArrowUp']; D = ['KeyS', 'ArrowDown'];
        A = ['Space', 'Enter', 'KeyF'];
      }
      return {
        x: (any(R, down) ? 1 : 0) - (any(L, down) ? 1 : 0),
        y: (any(D, down) ? 1 : 0) - (any(U, down) ? 1 : 0),
        act: any(A, down),
        actP: any(A, pressed),
      };
    },
  };
})();
