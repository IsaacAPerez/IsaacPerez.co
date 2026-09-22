# Isaac Perez design source library

This adapter points to the existing product source. It does not define another palette, type scale, or component family. The browser renderer and extraction logic are maintained once in `platform/tools/brand-studio/`.

## Source ownership

- `IsaacPerez.co/css/personal.css`
- `IsaacPerez.co/css/site.css`
- `IsaacPerez.co/css/photo.css`
- `IsaacPerez.co/css/legal.css`
- `IsaacPerez.co/js/personal.js`
- `IsaacPerez.co/index.html`

The adapter’s `roles` map semantic names to source symbols. Generated `brand/studio/catalog.json` records the exact source bytes and shared-tool fingerprint. Unsupported expressions stay visible as diagnostics; they are never filled in with a guessed value.

## Preview and validate

From this isolated checkout, point `BRAND_STUDIO_PLATFORM_ROOT` to the reviewed platform checkout and `BRAND_STUDIO_SOURCE_MAP` to a host-controlled JSON map of canonical repository names to local roots. No absolute machine paths are stored in the adapter.

```sh
./scripts/brand-studio.sh export
./scripts/brand-studio.sh check
./scripts/brand-studio.sh serve
```

`serve` binds loopback only. CodeByIP’s product Brand & Design System view reads this same catalog through its authenticated API. Neither surface changes source values. Studies preserve their original source fingerprint, record the current catalog separately, and become fresh only after Reset.

## Access and specimens

This is repo-only tooling. brand/ and the launcher are excluded from public deployment. The personal homepage and utility pages have distinct source families; the unlinked css/design-system.css is not authoritative. FIRSTUNIT branding stays inside the company section.

The initial shared browser provides source-backed foundation specimens. Product component files are fingerprinted for traceability but are not instantiated by the generic renderer. Real component examples must be registered explicitly with synthetic state and their existing access gate; a generic preview is never evidence of production rendering.

## Authority and generated output

Edit existing source and its applicable manual, then regenerate. Review source, catalog diagnostics, source fingerprint, and the actual product before accepting a change. Generated snapshots and design packs are read-only derivatives. A renderer copy is not maintained in this repository.

## Entry point

Use the repository-local launcher or CodeByIP. This static site has no authenticated developer shell; no public route was added. `.vercelignore` excludes the brand directory and launcher.

[Open this source catalog in CodeByIP](codebyip://tab/products?brand=isaac-perez-co).

The neutral browser uses source-derived foundation specimens. Actual product components remain in gated product Dev Tools; source registrations do not claim to reproduce those components in vanilla JavaScript. Native-only/computed expressions remain labeled. No generated catalog should be edited by hand.

## Shared tooling pin

This consumer is reviewed against [platform `2fcef736964befbb8fdffe81c593e5dcb7b698ab`](https://github.com/IsaacAPerez/platform/commit/2fcef736964befbb8fdffe81c593e5dcb7b698ab). The launcher requires that commit in `BRAND_STUDIO_PLATFORM_ROOT` (or the adjacent `platform` checkout). Update this reference deliberately when adopting shared tooling changes; regenerate and check the catalog afterward.
