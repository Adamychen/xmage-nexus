# Release notes

One file per app version, named after it with no `v`: `docs/release-notes/0.9.0.md`. **The PR that
raises the version in `web/package.json` writes it**, in the same commit as the bump, because that
commit is what reaches players.

Two workflows read it:

- `.github/workflows/deploy.yml` publishes it as the body of the GitHub release of that version, as
  soon as the deploy to the server succeeds. That release is what lights the news bell in the client.
- `.github/workflows/release.yml` reuses it as the "What changed" block of the launcher release when
  its `notes` input is left empty, so the installers go out with the same text.

## Format

The bell renders this text through `playerNotes()` and `renderNewsMarkdown()`
(`web/src/system/news.ts`), which decide what survives:

- **Write for players**, in the project's voice: what they can now do, not which file changed.
- **Bullets under `**Group**` lines** (`**Board**`, `**Decks**`, `**Lobby**`). A group line is a
  heading in the panel. `-` and `*` bullets, `**bold**`, `` `code` `` and `[links](https://...)` all
  render; anything else is flattened to a paragraph.
- **`**Under the hood**`, `**For developers**` and `**Internals**` are dropped by the bell**, with
  everything under them, up to the next group or heading. Put the refactors and the CI work there:
  they stay in the GitHub release and never reach the panel.
- **No `# Download` heading and no raw HTML.** The download guide belongs to the launcher release and
  `gen-release-body.mjs` builds it; a `# Download` section here would be stripped anyway, and tags
  are removed before rendering.
- **No `## What's new in 0.9.0` heading**: the panel already shows the version.

## Example

```markdown
**Board**

- The opponent's revealed hand no longer covers the battlefield when you click through it.
- Attackers can be undeclared one by one before you confirm the attack.

**Decks**

- Importing from the join dialog leaves the deck in the gallery.

**Under the hood**

- The fake e2e suite runs in two lanes, so the heavy specs stop pinning a shard.
```
