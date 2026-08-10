# How it works

A prize wheel for a 2-day booth. The wheel looks fair (8 equal slices), but the
winner is picked by code so the good prizes get spread out over both days
instead of being gone in the first hour. Leftover spins hand out a `Try Again`
(a generic consolation).

Single-page Next.js app. No backend. All state is in the browser's
`localStorage`. One operator, one laptop.

## Run it

```
npm install
npm run dev      # http://localhost:3000
npm run check    # runs the algorithm test (Node 24+)
npm run build    # static site -> ./out
```

## Files that matter

| File | What it does |
|------|--------------|
| `lib/lucky-draw.ts` | All the math. No React. This is the whole brain. |
| `lib/lucky-draw.check.ts` | A test that simulates the full 2-day event and asserts prizes clear. |
| `lib/use-draw-state.ts` | Loads/saves state to `localStorage`. |
| `components/wheel.tsx` | The Draw tab. Draws the SVG wheel, animates the spin. |
| `components/control.tsx` | The Control panel (behind the gear). Stock, odds, auto-pace, live counters. |
| `app/page.tsx` | Header + state. Owns the gear-toggled control panel and the rehearsal clock. |
| `app/globals.css` | Brand colors + fonts. |

## The data (one object in localStorage)

```ts
{
  items: {
    poleTrial: { label: "Pole Trial", qty: 8, priority: 1.4, boostPct: 0 },
    // ...one entry per prize, plus:
    wildcard:  { label: "Try Again", qty: Infinity, priority: 1, boostPct: 0 },
  },
  spinsPerBlock: 8,    // seed per 30-min block (set via "expected total spins")
  autoRate: true,      // pace from the live rolling 30-min spin rate
  spinLog: [ ...epochMs ],   // one timestamp per spin
  wildcardGiven: 0,    // how many "Try Again" have been redeemed
  eventDays: ["2026-08-12", "2026-08-13"],
  startHour: 10, endHour: 18,
}
```

- `qty` — stock left. Hits 0 → the item stops appearing (same as the old Python
  `quantity <= 0` skip).
- `priority` — used directly as a weight multiplier. `1` = normal, `1.4` = clear
  it faster. Hammock Trial, Hoop Trial, Pole Trial are `1.4`.
- `boostPct` — engine-only weight multiplier (`50` = ×1.5). No UI — the ★ priority
  toggle is the operator's lever now.
- Display names are **not** read from the stored `label`; all player-facing copy
  lives in `lib/content.json` (surfaced via `LABELS` in `lib/lucky-draw.ts`), so
  renames apply instantly even over old saved state.

## The algorithm (this is the important part)

All in `computeOdds(state, now)` in `lib/lucky-draw.ts`. Three steps.

**Step 1 — how many spins are left?**
`remainingSpins(state, now)` walks every 30-minute block from `now` to 6pm on
day 2 and adds up `spinsPerBlock` per block. The event runs 10am–6pm on both
days = 16 blocks/day, 32 blocks total, so `expectedTotalSpins = 32 ×
spinsPerBlock`. You set this in the UI as one intuitive number — **expected total
spins** — and the code back-solves `spinsPerBlock` from it. In auto mode (the
default) `spinsPerBlock` is replaced live by the actual number of spins in the
last 30 minutes, so pacing tracks real turnout instead of a guess. Until 5 spins
are on the clock it uses your estimate. Every block counts equally — the event
runs 10–6 both days with no busier/quieter weighting.

**Step 2 — how often should each prize come up?**
For each prize still in stock:

```
pace = qty / remainingSpins
```

That's the probability this prize should be drawn on the next spin so its stock
runs out exactly at the end. Example: 8 Pole Trials with ~250 spins left →
`8/250 = 0.032`, about 1 in every 31 spins.

**Step 3 — the `Try Again` soaks up whatever's left.**
Add up every prize's `pace`. Whatever probability is left over goes to `Try Again`:

```
P("Try Again") = 1 − sum(pace)
```

`Try Again` is simply whatever probability the real prizes don't need. Its size is
driven entirely by expected-spins vs. prizes: expect far more spins than prizes
and `Try Again` is high; expect spins ≈ prizes and `Try Again` ≈ 0. Example: 128 prizes with
~256 expected spins over the event → `sum(pace)` ≈ 0.5, so `Try Again` ≈ 50% on average.
(If you instead assumed ~2,880 spins, `Try Again` would be ~95% — there just aren't
enough prizes to give one on most spins.) As prizes sit unclaimed and time runs
down, `remainingSpins` shrinks, `pace` climbs, and `Try Again` drops. If you ever fall
behind (more stock than spins left), `sum(pace)` goes over 1, `Try Again` drops to 0, and
every spin is a real prize until you catch up. It self-corrects — no timers, no
scheduled jobs.

**Where priority comes in.** Priority (and a still-supported but now UI-less
`boostPct`) only changes the split *between real prizes*, never how much `Try Again`
shows up. The weight for a real prize is:

```
weight = qty × priority × (1 + boostPct/100)
```

Because `pace` is proportional to `qty`, giving each prize a share proportional
to that weight means — with priority/boost at defaults — each prize is drawn at
exactly its own `pace`. Raising `priority` above 1 (the trials use `1.4`) makes
that prize win more often, so it clears earlier. That's why the three trial
prizes empty out first.

**Sanity check.** `npm run check` runs a full 2-day simulation. Latest result:

```
sim@90: cleared 128/128 real prizes, 2752 wildcards handed out, 0 left over
sim@12 (under-attendance): priorities cleared, 0 real left
sim@90 auto-rate: priorities cleared, 0 real left
```

So at the planned rate everything clears, at a much lower turnout the priority
prizes still all go out, and it holds up whether pacing is fixed or auto-tuned
from the live spin rate.

## The wheel (Draw tab)

The 8 slices are drawn equal-size on purpose — the crowd sees a fair wheel. On
click:

1. `computeOdds` runs and `pickWinner` picks the winner (weighted random).
2. The wheel spins to land on that winner's slice — 5 full turns plus the offset
   to the slice, over exactly 3.5s, with a fast-start / slow-stop easing curve
   (`cubic-bezier(0.1, 0.9, 0.2, 1)`).
3. When the CSS transition ends, it shows the winner card + confetti with two
   buttons. **Redeem** calls `applyDraw` (drops the stock by one, or bumps the
   `Try Again` counter) and logs the spin; **Nevermind** closes and changes nothing — so
   stock only moves when a prize is actually handed over.

So the visual is decoration; the result was decided before the wheel moved.

## The Control panel

Hidden behind the **gear icon** in the top-right corner, so it's off the
event-facing wheel.

- **Stock** — `+`/`−` or type a number. Changes `qty`, which changes odds live.
- **Expected total spins** — the main dial (footfall over both days). It sets the
  baseline `Try Again` rate, shown right next to the field as you type.
- **★ clear first** toggle — flips a prize to higher priority so it empties out
  earlier. This is the lever for pushing a specific prize. (The old manual
  Boost % column was removed to keep the panel clean; `boostPct` still exists in
  the engine if you ever want it back.)
- **Auto-pace** checkbox — on by default; paces from the live rolling 30-min
  rate. Turn it off to pace purely from the expected-total estimate.
- **Live counters** — spins in the last 30 min, the per-block figure pacing is
  actually using (and whether it came from the live rate or the estimate), and
  real prizes left.
- **Rehearsal clock** — because today is before the event, set a fake date/time
  to preview how pacing behaves mid-event.

## The one thing to calibrate

Set **expected total spins** to your realistic footfall over the two days. That
single number sets the `Try Again` rate: if it's close to your prize count (128), almost
every spin gives a real prize and `Try Again` is rare; if it's much larger, `Try Again` fills the
gap so prizes last. The panel shows the resulting baseline `Try Again` % as you type.
Nothing else needs to change — the math adapts to whatever number you set, and in
auto mode it re-tunes itself from the live spin rate during the event.

## Deploying (later)

It's a static export (`npm run build` → `./out`), so it drops onto Vercel,
GitHub Pages, Netlify, etc. Because state is per-browser `localStorage`, run the
booth from one device. If you later want the wheel on a big screen and the
controls on a phone at the same time, that needs a small backend — not built yet.
