# NAS Spin the Wheel

Rigged lucky-draw wheel for the NAS event (12–13 Aug, 9am–6pm). Two views:

- **Draw** — the event-facing wheel. 8 equal-looking slices, 3.5s fast→slow
  stop. The winner is chosen by a pacing model, not the visual, so prizes
  deplete evenly across both days instead of vanishing early.
- **Control** (behind the corner gear) — stock +/−, live odds, a priority
  toggle, auto-pacing from the live rolling 30-min spin rate, and live counters.

## How the pacing works

`pace_i = qty_i / expectedRemainingSpins` is the chance item _i_ should be drawn
now so its stock hits zero right at 6pm on day 2. The `?` wildcard
(candies / hair tinsels) takes the leftover probability: it's high when real
prizes are ahead of schedule and drops to zero when they fall behind. Hammock,
Hoop Trial and Pole Trial are marked higher-priority so they clear first.

Spins-per-block is the main dial. It defaults to 90 (very high — that's ~2,880
spins for 128 prizes, so most early spins are `?`). Tune it to reality using the
live "spins this block" tracker.

State lives in `localStorage` on the operator's device — single kiosk.

## Dev

```
npm install
npm run dev      # http://localhost:3000
npm run check    # run the pacing-engine self-check (Node 24+)
npm run build    # static export to ./out
```
