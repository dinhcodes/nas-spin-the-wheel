# NAS Spin the Wheel

Rigged lucky-draw wheel for the NAS event (12–13 Aug, 9am–6pm). Two views:

- **Draw** — the event-facing wheel. 8 equal-looking slices, 3.5s fast→slow
  stop. The winner is chosen by a pacing model, not the visual, so prizes
  deplete evenly across both days instead of vanishing early.
- **Control** (behind the corner gear) — stock +/−, live odds, a priority
  toggle, auto-pacing from the live rolling 30-min spin rate, and live counters.

## How the pacing works

`pace_i = qty_i / expectedRemainingSpins` is the chance item _i_ should be drawn
now so its stock hits zero right at 6pm on day 2. The `?` wildcard takes the
leftover probability: it's high when real prizes are ahead of schedule and drops
to zero when they fall behind. Hammock Trial, Hoop Trial and Pole Trial are
marked higher-priority so they clear first.

**Expected total spins** is the main dial — set it to your realistic footfall.
Close to the prize count (128) → almost every spin is a real prize; much larger →
`?` fills the gap. During the event, auto mode re-tunes pacing from the live
rolling 30-min spin rate.

State lives in `localStorage` on the operator's device — single kiosk.

## Dev

```
npm install
npm run dev      # http://localhost:3000
npm run check    # run the pacing-engine self-check (Node 24+)
npm run build    # static export to ./out
```
