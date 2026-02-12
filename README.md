# PARADOX

A lightweight puzzle prototype based on the core concept:

> **You are both the solution and the problem.**

## Gameplay

- **Move:** `WASD` / arrow keys (smooth movement, not tile-step)
- **Interact:** `E`
- **Rewind:** `R`
- **Reset current level:** `N`
- **Next level:** `M` (only after finishing current level)

## Important behavior update

- You **cannot die** anymore. Crossing your ghost only triggers a short timeline warning effect.
- Resetting the level (`N`) never kills the player and never changes to a different level.
- The **goal tile is blocked until the door is unlocked**, so you can’t finish by bypassing door logic.
- Each level requires at least one rewind/copy before completion.

## Custom photos / models

Two supported ways:

1. Put files in `assets/models/` using names from `assets/models/README.md`.
2. Use the in-game uploader panel to pick images from your computer (stored in browser local storage).

Uploaded images override file-based assets and persist until you click **Clear uploaded photos**.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
