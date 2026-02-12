# PARADOX

A lightweight puzzle prototype based on the core concept:

> **You are both the solution and the problem.**

## Gameplay

- **Move:** `WASD` / arrow keys
- **Interact:** `E`
- **Rewind:** `R` (spawns a ghost replay and resets you to level start)
- **Next level / reset:** `N`

## Included prototype levels

1. **Level 1 — Basic Cooperation**
   - Two simultaneous buttons open the door.
2. **Level 3 — Timing Puzzle**
   - Use your past self to hold a switch while you push a box.
3. **Level 6 — Paradox Protocol**
   - Colliding with your own ghost triggers a timeline break.

## Technical notes

The prototype demonstrates the requested systems:

- **Action recorder** stores frame-by-frame position and interaction data.
- **Ghost replay system** replays prior timelines from rewind points.
- **Timeline manager** handles loop creation, resets, and paradox handling.
- **Puzzle engine** includes walls, doors, switches/buttons, boxes, and a goal tile.

## Run locally

Any static server works:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
