# Launch & Marketing Plan — @candlekit/charts

How to take this from a private repo to a noticed open-source project. Ordered by
leverage. Not shipped to npm (excluded via `.npmignore`).

---

## 0. Positioning (decide first — everything else flows from it)

**One-liner:** "The orchestration layer lightweight-charts leaves out — drawing
tools, indicators, measurement, and deterministic replay — in one tree-shakeable,
framework-agnostic package."

**Who it's for:** developers building trading/charting UIs who already reach for
lightweight-charts and end up re-implementing drawing tools, an indicator
framework, and replay every time.

**Why it wins (the wedge):** lightweight-charts is the most-used free chart lib
but is deliberately low-level. There is no well-maintained, typed, plugin-based
"batteries-included" layer on top. That gap is the entire pitch. Lead with
**replay + drawing + indicators working together**, since that combo is what
people struggle to build.

**Honest framing (avoid backlash):** never imply TradingView affiliation; always
credit lightweight-charts (Apache-2.0) and the MPL drawing runtime. The
plugin/extensibility story is the differentiator vs. just forking.

---

## 1. Pre-launch (make it credible before anyone arrives)

These determine whether a visitor stars or bounces in the first 20 seconds.

1. **Live demo site** — deploy the examples to GitHub Pages / Vercel / Netlify.
   A hosted, interactive candlestick chart you can draw on and replay is worth
   more than any README paragraph. Add the URL to the repo "About" + README top.
2. **StackBlitz / CodeSandbox templates** — one per example. "Edit in browser"
   buttons convert lurkers into triers with zero install friction.
3. **Real screenshots + a GIF** — replace the README placeholders. A 10-second
   GIF of drawing a trendline + scrubbing replay is the single highest-ROI asset.
   Pin it at the top of the README.
4. **README above the fold** — badges, one-liner, GIF, 5-line quick start. People
   decide from the first screen.
5. **Repo hygiene** — description, topics/tags (`charts`, `lightweight-charts`,
   `trading`, `technical-analysis`, `react`, `typescript`, `replay`,
   `drawing-tools`), social-preview image, MIT license shown, CI badge green.
6. **npm presence** — publish `0.1.0` (or `0.1.0-beta`). An unpublished package
   can't be `npm install`ed, which kills momentum from any post. Reserve the
   `@candlekit` scope/org on npm early.
7. **CHANGELOG + semver discipline** — signals "maintained," which is what
   evaluators actually screen for.

## 2. Launch channels (where the audience is)

Sequence over ~2 weeks; don't blast everywhere on day one.

| Channel | Angle | Notes |
| --- | --- | --- |
| **Show HN** (news.ycombinator.com) | "Show HN: A batteries-included layer over TradingView's lightweight-charts" | Post Tue–Thu ~14:00 UTC. Title = outcome, not features. Be in comments all day. Link the live demo, not the repo. |
| **r/algotrading**, **r/quant**, **r/options** | "I open-sourced the charting toolkit from my options dashboard" | The replay + indicators combo resonates hard with this crowd. Lead with the GIF. |
| **r/javascript**, **r/reactjs**, **r/webdev** | "Tree-shakeable, framework-agnostic charting toolkit (TS)" | Emphasize architecture/plugin system/DX, not finance. |
| **lightweight-charts Discussions / Discord** | "Built an extension layer — feedback welcome" | This is the warmest audience; they have the exact pain. Don't spam — contribute genuinely. |
| **dev.to / Hashnode / Medium** | Tutorial: "Build a replayable candlestick chart with drawing tools in 50 lines" | SEO long-tail; link demo + repo. Cross-post. |
| **X/Twitter + LinkedIn** | The GIF + one-liner + demo link | Tag/relate to lightweight-charts, fintech-dev, indie-hacker circles. Thread the architecture. |
| **Product Hunt** | Only after demo + docs are polished | Dev tools do okay; not the primary driver. Schedule, line up first comments. |
| **Awesome lists** | PRs to `awesome-javascript`, `awesome-react-components`, charting/fintech awesome lists | Durable, compounding referral traffic. |

## 3. Content / SEO (compounding, post-launch)

- **Comparison page** — "candlekit vs. building it yourself on lightweight-charts"
  and a feature matrix vs. alternatives (Highcharts Stock, ECharts, TradingView
  widget, klinecharts). Honest pros/cons earns trust + ranks.
- **Recipe docs** — "Add RSI", "Persist drawings to a backend", "Replay a trading
  session", "Sync two charts". Each targets a search query.
- **Answer questions** — Stack Overflow / Reddit / GitHub issues on
  lightweight-charts about drawing tools / indicators / replay → mention candlekit
  where genuinely relevant.
- **Keep the demo first-class** — every doc links to a live, editable example.

## 4. Community & retention (turn stars into users into contributors)

- Label `good first issue` / `help wanted`; the extensible indicator + drawing
  frameworks are perfect contribution surfaces.
- Respond to issues fast in the first 90 days — early responsiveness sets the
  project's reputation.
- `AGENTS.md` + `CODEBASE_MAP.md` already lower the contributor ramp (and make it
  AI-agent friendly — increasingly a real adoption vector).
- Ship a small thing weekly at first (an indicator, a docs recipe, a demo). Steady
  visible activity > one big launch.

## 5. Metrics to watch

npm weekly downloads, GitHub stars/forks, demo-site visits, issue response time,
referral sources. Optimize for **downloads + returning demo visitors**, not stars
(vanity).

## 6. Risks / watch-outs

- **Drawing runtime is git-only (MPL).** Friction for installers and a smell for
  evaluators. Mitigations: document clearly (done), consider publishing a mirror
  or vendoring with attribution, or shipping a lighter built-in drawing fallback.
- **Trademark.** Keep "Lightweight Charts™" attribution + non-affiliation
  prominent; never use TradingView marks in branding.
- **"Why not just use X?"** Pre-empt with the comparison page.
- **Bus factor.** A solo project reads as risky; visible roadmap + responsiveness
  + a couple of merged external PRs counter this.

## 7. First-week checklist

- [ ] Publish to npm (reserve `@candlekit` scope)
- [ ] Deploy live demo; add URL to repo About + README
- [ ] Replace README screenshot placeholders with real GIF + images
- [ ] Add repo topics + social-preview image
- [ ] StackBlitz template for the React + drawing examples
- [ ] Write the launch tutorial post (dev.to)
- [ ] Show HN (mid-week), then Reddit the following day
- [ ] PR to 1–2 awesome lists
