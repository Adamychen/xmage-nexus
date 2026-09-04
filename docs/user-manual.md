# User manual — playing on XMage Nexus

The web client implements the full XMage experience in the browser: no install, one link, same rules engine as desktop.

## Login

The login screen has two independent sections:

- **Proxy** (host/port, default `127.0.0.1:8787`): the WebSocket bridge. For zero-install play, point this at a shared proxy.
- **XMage Server** (host/port, default `localhost:17171` or `beta.xmage.today:17171`): the target game server.

Note: anonymous login to the public server is intermittent (server-side handshake flake). If login hangs there, retry or use the local server; see `docs/testing.md`.

## Lobby

- Live tables, users, and room chat (broadcast ~2s). Filters, finished matches, leaderboard, and deck gallery/manager.
- **Create table** (wizard): game type, format/deck type, AI count, time limits, seats. The deck must be compatible with the chosen game (the dialog validates; `quitRatio` defaults to 100).
- **Join table**: pick a deck first. If the deck has printings the server will reject (unknown set/number or unimplemented card), a pre-join dialog lists each card with the reason, one-click suggestions for implemented printings, or "remove N and play".
- **Waiting room** (player mode): shows roster + chat. Owner starts when ready; anyone can leave; owner can delete the table. "Back to lobby" keeps your seat; the table card shows "go to table" to re-enter.

## During the game

- **Board**: your hand fans at the bottom (hover lifts it), battlefield bands (lands / creatures / other), stack, graveyard/exile/library piles with top-card preview, command zone, turn-order ring in multiplayer.
- **Priority**: when you have priority the action button lights up (orb on the board edge). `Space`/`Enter` passes, `F4` passes until something happens, `F9` passes to end of turn, holding `Ctrl` holds priority. Auto-pass settings are in the game screen; E2E never enables them.
- **Mana**: no color hints are sent — tap your lands on the board first, then pay from the pool. X-costs use the stepper.
- **Targeting**: valid targets glow; dotted animated arrows show the source. Arrows to players aim at the avatar.
- **Combat**: floating declare-attackers / declare-blockers UI; attackers tap and nudge toward the defender. Multi-blocker damage order is auto-assigned.
- **Mulligan**: London rules. Keep (`Mantener`) or mulligan down to N, then bottom N cards via the targeting prompt.
- **Card selection** (tutors, scry/surveil, hand reveal): HD grid modal; click to pick, multi-select where allowed. Thoughtseize-style discard: click the revealed card to discard it.
- **Sideboard** (Bo3/Bo5): two-column editor between games with drag/click swap and a submit timer.
- **Chat tabs**: game log (rules events) vs table talk are separate channels; the action feed shows match events only.

## Deck builder

- Live Scryfall search with full syntax (`t:creature c:red cmc<=3 o:haste`), filters, CMC sort, curve chart + color donut.
- Main + sideboard (the sideboard section is always visible; drag cards onto it or use the swap button).
- Import: paste list, `.dck`/text file, drag-drop, clipboard; normalizes Arena/plain formats across 9 locales.
- Export: Plain / DCK / Arena + clipboard. Live server validation marks bad printings with a badge and a top banner (repair or swap printing without leaving the builder).
- Sample-hand (Goldfish T1-3: land drops + playables), card inspector, alternate printings picker.

## Formats

- 1v1 Constructed (Standard/Modern/Pioneer/Legacy/Vintage/Pauper) at full parity: clocks, DFC/MDFC back-face, Sagas, sideboarding.
- Commander (up to 4, pod 2x2 or Arena view), Two-Headed Giant, Booster Draft/Sealed (8→4, 40-card build), Swiss/bracket tournaments, replay viewer.

## Troubleshooting for players

- Stuck login: check proxy address first, then server address; public server flakes — retry or go local.
- "Card not found" on join: use the suggested printing or remove the card; the server matches by (set, number), not by name.
- Table disappeared after create: re-enter from the table card ("go to table"); if the owner left before start, the server deletes it.
- No sound: browsers require a first click before audio unlocks; check Master/SFX sliders.
