# Getting started

**In short:** double-click `projects/world-in-dreams/Start World in Dreams.cmd`,
open <http://localhost:5179>, zoom into the streets with the mouse wheel and
click anyone to see what they are doing. Double-click a person to follow them.

## Requirements

- Node.js 22 or newer.
- Nothing to install: the project has no dependencies and no build step.
- Everything runs on this computer; nothing is published.

## Commands

Run them inside `projects/world-in-dreams/`.

| Command | What it does |
| --- | --- |
| `npm start` | Starts the local server; open <http://localhost:5179> |
| `npm test` | Runs the engine and viewer-helper tests |
| `npm run sim -- dreams 48 1` | Headless run: seed `dreams`, 48 days (one year), prints events of importance 1 or higher |
| `node scripts/layout-stats.mjs dreams` | Counts what the region generator produced for a seed |

## Viewer controls

| Input | Action |
| --- | --- |
| Drag | Pan the map |
| Mouse wheel | Zoom, from the whole region to a single street |
| Click | Inspect a person, animal, building, field or (zoomed out) settlement |
| Double-click a person | Follow them; the camera keeps them centred |
| `Space` | Pause / resume |
| `1` – `6` | Speed: ¼, 1, 6, 30 game minutes, 3 or 12 game hours per second |
| `.` | Pause and advance exactly one minute |
| Arrow keys | Pan the map |
| `+` / `-` | Zoom in / out |
| `/` | Open and focus people search |
| `?` / `H` | Open controls help; playback resumes when help closes |
| `C` / `R` | Frame the city / the whole region |
| `F` / `Esc` | Toggle following the selected person / close help or deselect |
| **Panel** | Hide or show the sidebar |
| **Names**, **Night** | Show place names; darken the map at night |
| **Interiors** | Close up, lift the roofs to show rooms, furniture and the people inside (a selected building always opens) |
| **New world** | Generate the region for the typed seed |
| **Save / Load** | Store in the browser |
| `Ctrl` / `Cmd` + `S` | Save the manual browser checkpoint |
| **Export / Import** | Save to or load from a JSON file |

People appear in the streets once you zoom in past roughly the whole-city view.
The **Region** tab lists settlements, food stores, wildlife and open quests,
and **This year**: the harvest outlook, illness going round, deaths by cause,
crimes, the law's work, abuses of power, trades, misfortune and vice.
Inspecting a person shows their nature (honest or crooked, mild or quick to
anger), the hours they keep and their record with the law; a closed workshop
says so. The chronicle has a **crime** filter. The **People** tab searches inhabitants by name, trade, species or settlement.
Combine words, filter by settlement and indoor/outdoor/away location, and use
Previous/Next to reach every result. Reset clears the search and filters.
Clicking a chronicle entry jumps to the person or place; new events preserve
your reading position. Links and chronicle entries also work with the keyboard.

Names, night lighting, chronicle filters and sidebar visibility are remembered
in this browser. Map shortcuts stay inactive while you type or use a select.

## Saving and recovery

**Save** keeps a manual checkpoint. A separate automatic recovery copy is saved
every 30 seconds and when the page is hidden or closed, when browser storage is
available. The status beside the toolbar reports success or a storage failure.
**Export** downloads a JSON copy independent of browser storage.

If an old recovery copy exists on startup, the banner offers **Restore** or
**Keep current world**. It protects that old copy until you choose. Restoring,
loading, importing or creating a world leaves playback paused. Replacing changed
progress offers Cancel, Save & continue, or Continue without saving.

The last seconds before a browser/process crash may be lost. If recovery cannot
be saved, use Export. Save-version compatibility is controlled by the engine.

See [Quality of life](QUALITY_OF_LIFE.md) for the implementation and checks.

The same seed always produces the same region **and** the same history.

## URL shortcuts

Useful to reopen an exact moment or share a reproducible case:

```
http://localhost:5179/?seed=isekai&days=10&minutes=300&view=-70,0,6&inspect=person:12&speed=0
```

| Parameter | Meaning |
| --- | --- |
| `seed` | World seed (any text) |
| `days`, `minutes` | Time to simulate before showing the map (the world starts at 05:00 on day 1) |
| `view` | Camera centre and scale: `x,y,pixels per metre` (0,0 is the city centre) |
| `inspect` | Opens a panel, for example `person:12`, `bld:40`, `field:7`, `site:0` |
| `follow` | `1` follows the inspected person |
| `speed` | Starting speed in game minutes per second (`0` paused) |
| `tab` | `inspect`, `region` or `people` |

## Optional portraits

Put a square image named after a species id in
`projects/world-in-dreams/assets/portraits/` (`human.png`, `catfolk.png`,
`elf.png`, `dwarf.png`, `halfling.png`, `foxfolk.png`). The person panel then
shows it instead of the coloured disc.

## Troubleshooting

- **Port in use:** another copy is already running; open the address above or
  close the other window.
- **A save does not load:** follow the version message shown by the current
  engine. Saves of the old continent version belong to
  `archive/v1-continent/index.html`. Invalid or incomplete imports leave the
  current world in place.
