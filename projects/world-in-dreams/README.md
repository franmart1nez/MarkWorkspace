# World in Dreams

A painted, top-down fantasy world that lives on its own. Version 0.3.5 is one
walled city and five villages where about 1,800 people are simulated minute by
minute: they sleep, eat, work, trade, pray, drink, fall ill, steal, marry and
die, while fields follow the seasons and wolves hunt at night. Personal
project; it runs in the browser on this computer.

## Run

| Command (in this folder) | What it does |
| --- | --- |
| `npm start` or double-click `Start World in Dreams.cmd` | Starts the game at <http://localhost:5179> |
| `npm test` | Runs the 31 engine and viewer tests |
| `npm run sim -- dreams 48 1` | Simulates one year of seed `dreams` headless and prints notable events |
| `npm run roadmap` | Refreshes the roadmap's progress tables after ticking tasks |

Requires Node.js 22 or newer; nothing to install.

## Documentation

| For | Read |
| --- | --- |
| The owner | The Workspace card `workspace/2026-11-10_world-in-dreams/`: Overview, Systems, Controls, Audit, Roadmap, Art bible |
| AI agents and developers | [AGENTS.md](AGENTS.md), then [docs/architecture.md](docs/architecture.md) and [docs/systems.md](docs/systems.md) |

## Folders

```
src/engine/   deterministic simulation (no DOM)
src/ui/       canvas viewer
test/         automated tests
scripts/      headless run, layout statistics, roadmap recount
docs/         architecture and systems
assets/       optional portraits
archive/      abandoned v0.1 code, not part of the game
```
