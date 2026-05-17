# Legacy UI snapshot

Pre-rewrite menu / game / modal assets kept here for visual reference and
cherry-picking back into the live UI. None of these files are loaded by the
live game (`index.html` only references the v2 DOM + `game-v2.js`).

## What's here

| File                  | Was loaded by                                        | Notes                                                                 |
|-----------------------|------------------------------------------------------|-----------------------------------------------------------------------|
| `game.js`             | `<script src="game.js">` in old `index.html`         | 3289-line legacy game loop. Last commit before move: see git log.    |
| `layout.css`          | `<link rel="stylesheet" href="layout.css">`          | 3-column landscape grid for the legacy main menu.                     |
| `menu.css`            | `<link rel="stylesheet" href="menu.css">`            | Magic-stone button styling + parchment palette for legacy menu.       |
| `legacy-screens.html` | (snapshot) — body fragment, not a runnable page      | All legacy DOM: menu, game, modals (story / codex / settings / etc.) |

## Why it's preserved

The data-driven rewrite (`game-v2.js` + `mode-rules.js` + the `v2-root` DOM
block) replaced both the game loop and the UI in one pass. The visual polish
of the legacy menu (parchment background, magic-stone buttons, hat avatars,
arena layout) was set aside intentionally — the rewrite focused on correctness
of rule logic, not aesthetics. The user wants to cherry-pick visual elements
from the legacy UI back into the v2 screens in a future session.

## How to cherry-pick something back

1. Find the markup in `legacy-screens.html`. The file's top comment maps line
   ranges to screen sections so you can jump to e.g. "codex modal" quickly.
2. Find the matching CSS rules. The legacy rules in `style.css` (the live
   stylesheet) were *not* removed during cleanup — they're orphan now
   (selectors don't match any DOM), so the visual rules are still readable
   there. `layout.css` / `menu.css` (in this folder) hold layout-specific
   rules that aren't in `style.css`.
3. Adapt to v2 screen system:
   - Wrap inside `<div class="screen" id="screen-XYZ">` and add a case to
     `game-v2.js`'s `render()` switch.
   - Replace legacy event handlers (most used direct `addEventListener` on
     specific IDs) with `data-action="..."` attributes that funnel through
     `attachMenuListeners()`.
   - Replace legacy state reads (most used `Save.get()` directly) with
     `Save.readSettings()` / v2 APIs.

## What the legacy UI looked like

- Horizontal landscape only (the `#rotate-overlay` told mobile users to rotate)
- Main menu: 3 columns — 自我修煉 (practice) / 競速挑戰 (speed) / 巫師對決 (duel)
- In-game: HP bar + score + animated wizard avatars + hat character; duel had
  a dedicated "arena bar" with both players + center hat
- Codex / settings / tutorial / import / story all opened as modal overlays
  on top of the menu, rather than v2's full-screen routed screens
- Speed mode (60s time attack) was a top-level mode — removed in the rewrite
  per spec change

## What was already deleted in the rewrite (not preserved here)

- Speed mode game logic and UI
- Wizard character picker (PvP nicknames) — replaced by PvP/PvE setting
- Per-level HP/魔力 stat boxes (the rewrite tracks correctCount/wrongCount
  via reducer, not HP)
