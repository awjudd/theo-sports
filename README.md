# Henry & Theo Sports

A browser game — no build step, no dependencies. Open `index.html` (or serve the folder with any static server, e.g. `python3 -m http.server`).

- **Characters** – ten to choose from (Henry, Theo, Mia, Max, Zoe, Leo, Ava, Finn, Bolt the robot and Pip the alien). The character-select screen picks who plays as Player 1 and Player 2.
- **Locker room** – dress Henry and Theo: hats, shirts, necklaces, pants, shoes, glasses, hair style (twelve styles) and skin. Outfits and your character picks are saved in `localStorage`.
- **Wheel** – spin to pick one of twenty-six games: hockey, baseball, soccer, lacrosse, disc golf, basketball (shooting contest), bowling, field goals, archery, hurdles, penalty shootout, sumo, swimming, tug of war, dodgeball, mini putt, air hockey, volleyball, whack-a-mole, quick draw, Simon says, cornhole, darts, skiing, racing and boxing.
- **Modes** – 1 player (as Henry or Theo, the other is a CPU) or 2 players on one keyboard.
- **Choose a Game** – skip the wheel and pick any of the twenty-six games from a menu.

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
- `js/sports/baseball.js`, `js/sports/discgolf.js`, `basketball.js`, `bowling.js`, `football.js`, `archery.js`, `hurdles.js`, `penalty.js`, `sumo.js`, `swimming.js`, `tugofwar.js`, `dodgeball.js`, `minigolf.js`, `volleyball.js`, `whackamole.js`, `quickdraw.js`, `simon.js`, `cornhole.js`, `darts.js`, `skiing.js`, `racing.js`, `boxing.js` – the other games (air hockey lives in `arena.js`)
- `js/sports/common.js` – shared HUD helpers for the contest-style sports
- `js/main.js` – screens, locker-room UI and game lifecycle
