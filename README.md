# Henry & Theo Sports

A browser game — no build step, no dependencies. Open `index.html` (or serve the folder with any static server, e.g. `python3 -m http.server`).

- **Locker room** – dress Henry and Theo: hats, shirts, necklaces, pants, shoes, glasses, hair and skin. Outfits are saved in `localStorage`.
- **Wheel** – spin to pick one of five sports: hockey, baseball, soccer, disc golf, lacrosse.
- **Modes** – 1 player (as Henry or Theo, the other is a CPU) or 2 players on one keyboard.

## Controls

| | Move | Action |
|---|---|---|
| 1 player | WASD / arrows | Space / Enter / F |
| 2 players – Henry | WASD | Space |
| 2 players – Theo | Arrows | Enter |

`Esc` pauses, `M` mutes.

## Layout

- `js/characters.js` – outfit data and the procedural character renderer
- `js/wheel.js` – the spin wheel
- `js/sports/arena.js` – hockey, soccer and lacrosse (shared top-down engine)
- `js/sports/baseball.js`, `js/sports/discgolf.js` – the other two sports
- `js/main.js` – screens, locker-room UI and game lifecycle
