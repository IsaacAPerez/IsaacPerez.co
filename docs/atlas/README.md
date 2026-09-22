# IsaacPerez.co — architecture atlas

`IsaacPerez.co` mapped as something you can click around, plus its text twin. Both are
generated from **one** file, which is the only one anyone edits.

| File | What it is | Edit it? |
|---|---|---|
| `data.mjs` | The single source: structures, flows, chapters, decisions, open questions. | **Yes — this one.** |
| `build.mjs` | `data.mjs` → `atlas.html` + `SYSTEM.md`. Byte-identical across all 12 fleet repos. | No |
| `template.html` | The isometric renderer. Byte-identical across all 12 fleet repos. | No |
| `atlas.html` | The interactive map (15 structures, 7 chapters). Generated. | Never |
| `SYSTEM.md` | The text twin — decisions table, every structure, the flows, the question index. Generated. | Never |

## Rebuild

```bash
node docs/atlas/build.mjs
```

Never hand-edit `atlas.html` or `SYSTEM.md` — the next rebuild silently discards it.

## Where it shows up

The CodeByIP app reads this folder over `GET /api/product-atlas/isaac-perez-co` and renders
the map inside **IsaacPerez.co**'s product tab, alongside how many commits have landed since
`data.mjs` was last committed. That drift number is the point: an atlas is a drawn
picture and can go stale while still looking right, so when you change how IsaacPerez.co
works, change `data.mjs` in the same commit.

Open questions are tracked by ID (`Q-<code><n>`) in `SYSTEM.md`. Answering one means
editing its entry in `data.mjs` to `{ q, r: 'the answer (YYYY-MM-DD)' }` and rebuilding.

The atlas format comes from the [`system-atlas`](https://github.com/inkboard/system-atlas)
skill.
