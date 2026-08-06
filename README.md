# Pradsgaard Labs

Source for [pradsgaardlabs.com](https://pradsgaardlabs.com) — the home page for
**Pradsgaard Labs**, the independent software company of
[Morten Pradsgaard](https://github.com/Mopra), CTO at
[Optipeople](https://optipeople.com/).

## Projects

| Project | What it is |
| --- | --- |
| [exit1.dev](https://exit1.dev) | Free uptime and SSL monitoring that alerts you the moment a website or service goes down. |
| [qgn.app](https://qgn.app) | Quick Gen — instant screenshots and screen recording for Windows, captured straight to the clipboard from a single hotkey. |
| [nvoke.run](https://nvoke.run) | Write a Node.js function in the browser and deploy it instantly to a live HTTPS endpoint. |
| [day3.app](https://day3.app) | Email for product teams — send product updates, billed by what you send rather than by subscriber count. |

## This repo

A single static page served by GitHub Pages from `main`, with no build step.

- [`index.html`](index.html) — the whole site, styles and JSON-LD inline
- [`contributions.svg`](contributions.svg) — GitHub contribution graph, regenerated daily
- [`scripts/generate-contributions.mjs`](scripts/generate-contributions.mjs) — fetches the
  contribution calendar and rewrites the SVG plus the block between the
  `contrib:start` / `contrib:end` markers in `index.html`
- [`.github/workflows/contributions.yml`](.github/workflows/contributions.yml) — runs the
  script on a daily cron, commits when the graph changed, then asks Pages to rebuild

Regenerating the graph locally needs a classic PAT with `read:user` scope
(`GITHUB_TOKEN` cannot read the contribution calendar):

```bash
GH_CONTRIB_TOKEN=<token> node scripts/generate-contributions.mjs
```

## Contact

morten@pradsgaardlabs.com

Pradsgaard Labs · Bogfinkevej 2, 7400 Herning, Denmark · CVR DK46156153
