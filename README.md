# Swiggy Delivery Climb

A Donkey Kong-style climbing platformer, built as a brand-modular ad unit and shipped with the
Swiggy skin. A delivery partner climbs a tower of girders, sweeps every rakhi, dodges the tiffin
drums the monkey rolls down, and reaches the customer at the top before the delivery clock runs out.

Vanilla TypeScript, one `<canvas>`, Vite. **Zero runtime dependencies.**

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # typecheck → brand gate → level validation → bundle
```

| script | what it does |
| --- | --- |
| `npm run dev` | dev server, brand plugin live-reloading on `brands/` edits |
| `npm run check` | `tsc --noEmit` |
| `npm run check:brand` | the brand gate — see below |
| `npm run validate` | static solvability check on every level |
| `npm run simulate` | headless bot plays the levels and reports clear times |
| `npm run brands` | list the brand slugs on disk |

`?level=N` and `?seed=N` boot straight into a level with a fixed RNG seed, so a bug report is a URL.
`?dev=mark` opens the render harness — the mark at six sizes across all three fallback tiers, every
widget state, and the layout bands drawn over the stage.

---

## Re-skinning to another brand

Copy `brands/swiggy/` to `brands/<slug>/`, edit the values, drop replacement artwork into
`public/brand/`, then:

```bash
BRAND=<slug> npm run dev
BRAND=<slug> npm run build
```

**Nothing under `src/` changes.** That is the contract, and `npm run check:brand` is what keeps it
true rather than aspirational.

### The one idea worth understanding

> **A brand says what its colours ARE. The game says where they GO.**

A brand module supplies about twenty-five primitives. `src/brand/theme.ts` derives the ~110 semantic
tokens the game actually paints with (`girderFace`, `agentBagEmblem`, `shutterClosed`, `btnOnBrand`,
`flameBody`, `hazardCaution` …) and **contains no colour literal of its own**. Screens read the derived tokens; screens never read
`brand.colors`.

The alternative — every brand declaring all hundred — makes the second brand cost as much as the
first, and a re-skin that expensive does not get done. It also moves a hundred decisions about *this
game* (which surface is elevated, which button is the hero) into a file about a *brand*, where the
next brand has to re-derive them and will get some of them wrong.

`BrandModule.theme` is a per-token escape hatch for the handful of cases the derivation gets wrong
for a particular brand. **If it is getting long, the derivation is wrong and should be fixed for
everyone instead.**

### Three things in the brand module that are not colours

- **`vocab`** — the words for the game's nouns. `config/copy.ts` writes `"Collect every
  {collectiblePl}"` once and the brand supplies the noun. That is the difference between a re-skin
  costing four words and costing forty rewritten sentences.
- **`colors.collectible` and `colors.characters`** — representational, not brand. A rakhi is
  gold-and-red because a rakhi is gold-and-red; deriving it from the brand's primary would give an
  orange rakhi under Swiggy and a teal one under the next brand, and both would be wrong.
- **`logo.fallback`** — the vector shape to draw before any artwork decodes, **declared** rather than
  coded. A hand-authored vector of one brand's mark is the least swappable thing a swappable brand
  system can contain: draw Swiggy's pin as arithmetic in the renderer and the next brand inherits a
  Swiggy-shaped logo in its own colours, which no amount of config will fix.

### Artwork

`AssetRef.rect` names a sub-rectangle of a source image in fractions, so one supplied lockup can
serve as the emblem, the wordmark and the full mark without re-encoding crops or redrawing a
trademark. The Swiggy cuts were **measured off the artwork's alpha channel**, not eyeballed — the
plate is 1% off square, which is real, and declaring it square would blit it 1% wide forever.

`logo.knockout` and `logo.maskable` are declared permissions, not assumptions: the renderer asks
before re-cutting the mark in one colour or using it as a clipping mask, and a brand that forbids
either quietly gets a plain treatment instead of a guideline violation shipped inside a game.

---

## The brand gate

`npm run check:brand` runs ten rules and reports **every** failure at once. Each exists because it is
a mistake somebody makes while being careful:

| rule | what it catches |
| --- | --- |
| U1 | a colour literal anywhere under `src/` |
| U2 | a file importing `@brand` directly instead of through `src/brand/index.ts` |
| U3 | `src/game/` or `src/core/` touching the DOM, `Date`, or `Math.random` |
| U4 | a save key not derived from the brand slug — two brands sharing a save slot |
| U5 | a colour literal in the derivation, which would survive every re-skin |
| U6 | a brand missing a required export, or declaring one as a computed value |
| R15 | a declared `aspect` that disagrees with the real file — a logo that blits distorted |
| S1 | `shadowBlur`/`filter` on the canvas — the Android frame-budget cliff |
| S3 | a gradient built from a logo token; the mark takes no treatment |
| S5 | `#FC8019`, the *superseded* Swiggy orange, which every colour aggregator still publishes |

R15 accounts for `rect`, so it compares the aspect of the **cut** rather than of the file.

---

## Architecture

Dependency direction is one-way: `config ← core ← game ← render/scenes`.

```
src/brand/     the contract, the derivation, and the single import site
src/config/    tuning (every number), theme (type/space/radius), copy (every string), levels
src/core/      fixed-timestep loop, seeded RNG, pool, events, versioned storage
src/game/      THE SIM — headless, no DOM, no Math.random
src/render/    viewport, shape kit, the three-tier mark, HUD, fx
src/input/     the one owner of the pointer and key streams
src/scenes/    director + screens; they take callbacks and navigate nothing
src/ui/        the DOM ad slot, synthesized sfx, haptics
tools/         the vendored Vite plugin, the gate, the validators, the headless bot
```

**The sim is headless on purpose.** Nothing in `src/game/` may touch `document`, `window`, `Date` or
`Math.random` (U3 enforces it). The payoff is `npm run simulate`: a bot imports the *real* engine
under bare Node and plays every level, so difficulty is measured before it ships rather than after.

**Scenes navigate nothing.** The entire flow is one block in `src/main.ts`. Adding a screen is a
change there and nowhere else — which is the only version of that change anybody can review.

**The banner is one derived line**, evaluated once per frame from outside every scene:

```ts
setAdVisible(!(scene instanceof PlayScene && scene.live));
```

A scene that shows and hides the banner itself gets it wrong on the one transition nobody tested. The
slot is DOM rather than canvas because a live ad tag renders its own iframe and cannot paint into a
2D context — `mountAdCreative()` is the integration point, already correct.

---

## Design notes worth not re-litigating

- **The playfield never scrolls.** DK's real skill is reading two girders ahead; a camera that hides
  the floor above reduces it to reaction-only. And "collect every rakhi" is a route-planning
  mechanic — route planning needs the route visible, or it becomes memorisation-by-death.
- **Girders are line segments, not tiles.** A tile grid cannot express a 1-in-12 slope without
  stair-stepping. Slopes alternate by floor, so barrels sweep right then left with no barrel-specific
  logic at all — that alternation *is* the level design.
- **You can never jump to the floor above** (65-unit apex against a 78-unit minimum gap). That single
  number is what makes ladders matter and the level a route rather than a climbing wall.
- **Collected rakhis persist across a death.** "Collect all N" plus "lose them on death" makes one
  mistake cost a full re-sweep of a level the player already proved they could sweep, which is the
  moment a casual player closes an ad unit. The chain *bonus* resets instead — a score penalty, which
  is the right currency.
- **The rubber band is never announced.** A player told the game was made easier for them has been
  insulted; a player who simply stops dying has been rescued.
- **The sprite is always bigger than the thing that kills you.** Shrunk hitboxes plus a 12% inert
  grace tail on barrels. Nobody notices; everybody feels it.
- **Every noun gets its own token, even when two are the same colour today.** The hazard lanes and
  the broken-ladder caps are both the caution colour — and they are separate tokens, because a brand
  that retints its ladder caps must not silently retint every hazard lane in the game.
- **Barrels are slate, not red.** A red barrel on orange girders is invisible, and red is the
  intuitive choice — so it is a trap worth naming. Red is reserved for wild barrels and the urgent
  timer.

## Typography

Swiggy's face is **Gilroy**, which is commercial and cannot ship. **Poppins** is the nominated
substitute, self-hosted from `public/fonts` as three latin-subset woff2 files (~8KB each, OFL) in
exactly the three weights the brand declares. Do not add a 600 — it is not shipped, and asking for it
makes the browser synthesise a smeared faux-bold that reads as a rendering bug rather than a missing
file.
