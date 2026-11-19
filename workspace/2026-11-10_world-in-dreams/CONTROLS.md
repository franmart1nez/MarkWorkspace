# Controls

**In short:** double-click `projects/world-in-dreams/Start World in Dreams.cmd`,
the game opens at <http://localhost:5179>. Zoom into the streets with the mouse
wheel, click anyone to see what they are doing, double-click to follow them.

## Starting

| | |
| --- | --- |
| Requirement | Node.js 22 or newer. No other installation, no build step |
| Start | Double-click `Start World in Dreams.cmd`, or run `npm start` in `projects/world-in-dreams/` |
| Address | <http://localhost:5179> |
| New world | Type any text as the seed and press **New world**. The same seed always gives the same world and history |

## Mouse

| Input | Action |
| --- | --- |
| Drag | Move the map |
| Wheel | Zoom, from the whole region down to one room |
| Click | Inspect a person, animal, building, field or, zoomed out, a settlement. In a crowd, a short list of nearby people appears |
| Double-click a person | Follow them with the camera |
| Click a chronicle entry | Jump to that place or person |

## Keyboard

| Key | Action |
| --- | --- |
| `Space` | Pause or resume |
| `1` – `6` | Speed: ¼, 1, 6 or 30 game minutes, 3 or 12 game hours per real second |
| `.` | Pause and advance one minute |
| Arrow keys, `+` / `-` | Move and zoom the map |
| `C` / `R` | Frame the city / the whole region |
| `F` | Follow the selected person, or stop following |
| `/` | Search for people |
| `?` or `H` | Controls help |
| `Esc` | Close help or deselect |
| `Ctrl` + `S` | Save |

Shortcuts are ignored while you type in a box.

## Screen

| Area | What it holds |
| --- | --- |
| Top bar | Date and time, speeds, **City** and **Region** framing, **Names**, **Night**, the **Roofs** mode (automatic, selected building only, always on), the seed and **New world**, **Save**, **Load**, **Export**, **Import** |
| Map buttons | Zoom, **+1 min**, **Locate** the selection, hide the **Panel**, help, **Saves** (named checkpoints), **Advance** (to the next morning, the next season or a chosen time), **Settings** |
| **Inspect** tab | The selected person, animal, building, field or settlement: what they are doing, needs, household, money, history |
| **Region** tab | Settlements, food stores, wildlife, quests and **This year**: harvest, illness, deaths by cause, crimes, the law, trades, misfortune |
| **People** tab | Search by name, trade, species or settlement, with filters for place and living, dead or departed |
| Chronicle | Events with type filters, text and date search; **everyday** shows minor events |
| Overview map | Bottom right: click to move the camera |

## Saving

| Action | What happens |
| --- | --- |
| **Save** / `Ctrl+S` | Stores a manual checkpoint in this browser |
| **Saves** | Three named checkpoints plus the previous automatic copy, with seed, date and real time |
| Automatic recovery | Every 30 seconds and when the page is hidden. On the next start a banner offers **Restore** or **Keep current world** |
| **Export** / **Import** | Download or open a JSON file, independent of the browser |

Loading or restoring leaves the game paused. Saves from older versions of the
engine are refused with a message; start a new world.

## Opening an exact moment

The address can start the game at a chosen moment, for example:

`http://localhost:5179/?seed=dreams&days=10&minutes=300&view=-70,0,6&inspect=person:12&speed=0`

| Parameter | Meaning |
| --- | --- |
| `seed` | World seed (any text) |
| `days`, `minutes` | Time to simulate before showing the map; the world starts at 05:00 on day 1 |
| `view` | Camera centre and zoom: `x,y,pixels per metre`; 0,0 is the city centre |
| `inspect` | Open a card, for example `person:12`, `bld:40`, `field:7`, `site:0` |
| `follow` | `1` follows the inspected person |
| `speed` | Starting speed in game minutes per second; `0` is paused |
| `tab` | `inspect`, `region` or `people` |

## If something goes wrong

- **The port is in use:** another copy is already running. Open the address
  above or close the other window.
- **A save does not load:** it comes from an older engine version. Start a new
  world.
