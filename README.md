# js13k-2026
A game about unicorns and rainbows in less than 13KB 

## Size gate

The submission ZIP must be **strictly below 13 KiB** (`zipBytes < 13,312`),
stricter than the official js13kGames limit. The gate builds the game with
the [js13k-forge](https://github.com/pit025/js13k-forge) submodule
(`tools/js13k-forge`), verifies that `index.html` sits at the ZIP root, and
rejects builds that still depend on local or external resources outside the
archive. It runs on every pull request targeting `main` and on every push to
`main`, and the GitHub Pages deploy refuses to publish unless it passes (see
`.github/workflows/size-gate.yml` and `.github/workflows/deploy.yml`).

Run it locally (Node 22+, matching CI):

```sh
git submodule update --init --recursive   # fetch tools/js13k-forge
npm ci --prefix tools/js13k-forge         # install the toolchain (once)
npm test                                  # build + enforce the size gate
```

The gate prints a size summary (ZIP size, budget, bytes remaining/over) and
writes build artifacts to `.js13k/` (`game.zip`, `report.json`; gitignored).
