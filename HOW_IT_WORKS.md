# How it works

A prize wheel for a 2-day booth. The wheel looks fair (8 equal slices), but the
winner is picked by code so the good prizes get spread out over both days
instead of being gone in the first hour. Leftover spins hand out a `?`
(candy / hair tinsel).

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
| `app/page.tsx` | Tab switcher + header. Holds the state and the rehearsal clock. |
| `app/globals.css` | Brand colors + fonts (copied from the aerial-sports app). |

## The data (one object in localStorage)

```ts
{
  items: {
    poleTrial: { label: "Pole Trial", qty: 8, priority: 2, boostPct: 0 },
    // ...one entry per prize, plus:
    wildcard:  { label: "?", qty: Infinity, priority: 1, boostPct: 0 },
  },
  spinsPerBlock: 90,   // seed / fallback spins per 30-min block
  autoRate: true,      // pace from the live rolling 30-min spin rate
  spinLog: [ ...epochMs ],   // one timestamp per spin
  wildcardGiven: 0,    // how many "?" you've handed out
  eventDays: ["2026-08-12", "2026-08-13"],
  startHour: 9, endHour: 18,
  halfDemandFirstLastHour: true,
}
```

- `qty` — stock left. Hits 0 → the item stops appearing (same as the old Python
  `quantity <= 0` skip).
- `priority` — used directly as a weight multiplier. `1` = normal, `2` = clear
  it faster. Hammock, Hoop Trial, Pole Trial are `2`.
- `boostPct` — manual override from the Control tab. `50` means ×1.5.

## The algorithm (this is the important part)

All in `computeOdds(state, now)` in `lib/lucky-draw.ts`. Three steps.

**Step 1 — how many spins are left?**
`remainingSpins(state, now)` walks every 30-minute block from `now` to 6pm on
day 2 and adds up `spinsPerBlock` per block. The first and last hour of each day
count as half (you said those are quieter). So at the start of the event this is
roughly `2 days × 16 full-strength blocks × 90 ≈ 2,880` expected spins. In auto
mode (the default) that `90` is replaced live by the actual number of spins in
the last 30 minutes — normalized so a half-demand hour still projects a sensible
peak — so pacing tracks real turnout instead of a guess. Until 5 spins are on
the clock it uses the manual seed.

**Step 2 — how often should each prize come up?**
For each prize still in stock:

```
pace = qty / remainingSpins
```

That's the probability this prize should be drawn on the next spin so its stock
runs out exactly at the end. Example: 8 Pole Trials with 2,880 spins left →
`8/2880 = 0.0028`, about 1 in every 360 spins.

**Step 3 — the `?` soaks up whatever's left.**
Add up every prize's `pace`. Whatever probability is left over goes to `?`:

```
P("?") = 1 − sum(pace)
```

At the start there are only 128 real prizes but ~2,880 spins, so `sum(pace)` is
tiny (~0.044) and `?` gets ~95%. That's expected — there aren't enough real
prizes to give one on every spin, so most spins are candy. As prizes sit unclaimed
and time runs down, `remainingSpins` shrinks, `pace` climbs, and `?` drops. If you
ever fall behind (more stock than spins left), `sum(pace)` goes over 1, `?` drops
to 0, and every spin is a real prize until you catch up. It self-corrects — no
timers, no scheduled jobs.

**Where priority comes in.** Priority (and a still-supported but now UI-less
`boostPct`) only changes the split *between real prizes*, never how much `?`
shows up. The weight for a real prize is:

```
weight = qty × priority × (1 + boostPct/100)
```

Because `pace` is proportional to `qty`, giving each prize a share proportional
to that weight means — with priority/boost at defaults — each prize is drawn at
exactly its own `pace`. Bumping `priority` to 2 makes that prize win more often,
so it clears earlier. That's why the three trial prizes empty out first.

**Sanity check.** `npm run check` runs a full 2-day simulation. Latest result:

```
sim@90: cleared 128/128 real prizes, 2752 wildcards handed out, 0 left over
sim@12 (under-attendance): priorities cleared, 0 real left
```

So at the planned rate everything clears, and even if turnout is a third of
expected, the priority prizes still all go out.

## The wheel (Draw tab)

The 8 slices are drawn equal-size on purpose — the crowd sees a fair wheel. On
click:

1. `computeOdds` runs and `pickWinner` picks the winner (weighted random).
2. The wheel spins to land on that winner's slice — 5 full turns plus the offset
   to the slice, over exactly 3.5s, with a fast-start / slow-stop easing curve
   (`cubic-bezier(0.1, 0.9, 0.2, 1)`).
3. When the CSS transition ends, it shows the winner card + confetti and calls
   `applyDraw` to drop the stock by one (or bump the `?` counter).

So the visual is decoration; the result was decided before the wheel moved.

## The Control panel

Hidden behind the **gear icon** in the top-right corner, so it's off the
event-facing wheel.

- **Stock** — `+`/`−` or type a number. Changes `qty`, which changes odds live.
- **★ clear first** toggle — flips a prize to higher priority so it empties out
  earlier. This is the lever for pushing a specific prize. (The old manual
  Boost % column was removed to keep the panel clean; `boostPct` still exists in
  the engine if you ever want it back.)
- **Auto-pace** checkbox — on by default; paces from the live rolling 30-min
  rate. Turn it off to pin pacing to the fixed seed number instead.
- **Live counters** — spins in the last 30 min, the per-block figure pacing is
  actually using (and whether it came from the live rate or the seed), real
  prizes left, and `?` given vs. still needed.
- **Rehearsal clock** — because today is before the event, live odds would just
  show ~95% `?`. Set a fake date/time to preview how pacing behaves mid-event.

## The one thing to calibrate

You have 128 real prizes and the default assumes ~2,880 spins. That's ~22 spins
per prize, so most spins are `?`, and you'd hand out ~2,750 candies/tinsels over
two days. If that candy count is wrong, drop `spinsPerBlock` until the numbers
look right — the Control tab shows "`?` needed" so you can see it. Nothing else
needs to change; the math adapts to whatever number you set.

## Deploying (later)

It's a static export (`npm run build` → `./out`), so it drops onto Vercel,
GitHub Pages, Netlify, etc. Because state is per-browser `localStorage`, run the
booth from one device. If you later want the wheel on a big screen and the
controls on a phone at the same time, that needs a small backend — not built yet.
