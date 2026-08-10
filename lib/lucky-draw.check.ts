// Run: node lib/lucky-draw.check.ts   (Node 24+, strips types natively)
import assert from "node:assert";
import {
  defaultState,
  computeOdds,
  pickWinner,
  applyDraw,
  effectiveSpinsPerBlock,
  ITEM_ORDER,
  type ItemKey,
} from "./lucky-draw.ts";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const at = (day: string, h: number, min = 0) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
};

// Seeded RNG so the simulation is reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. Odds always sum to 1, at several points in time.
for (const t of [
  at("2026-08-12", 8), // before start
  at("2026-08-12", 9, 15),
  at("2026-08-12", 13),
  at("2026-08-13", 17, 45),
  at("2026-08-13", 20), // after end
]) {
  const o = computeOdds(defaultState(), t);
  assert(Math.abs(sum(ITEM_ORDER.map((k) => o.probs[k])) - 1) < 1e-9, "sum=1");
}

// 2. When spins vastly outnumber prizes, the "Try Again" wildcard dominates.
{
  const s = defaultState();
  s.spinsPerBlock = 90; // ~2880 spins vs 128 prizes
  const o = computeOdds(s, at("2026-08-12", 9, 15));
  assert(o.probs.wildcard > 0.8, `early wild high, got ${o.probs.wildcard}`);
}

// 3. A sold-out item never appears.
{
  const s = defaultState();
  s.items.poleTrial.qty = 0;
  const o = computeOdds(s, at("2026-08-12", 13));
  assert(o.probs.poleTrial === 0, "sold-out excluded");
}

// 4. Behind schedule (little time, stock left) => no "Try Again" at all.
{
  const o = computeOdds(defaultState(), at("2026-08-13", 17, 55));
  assert(o.probs.wildcard === 0, `behind => wild 0, got ${o.probs.wildcard}`);
  assert(o.behind, "behind flag set");
}

// 5. Higher priority beats an equal-stock normal item.
{
  const s = defaultState();
  s.items.gymBag.qty = 10; // same as hammock, but priority 1 vs 2
  const o = computeOdds(s, at("2026-08-12", 13));
  assert(o.probs.hammock > o.probs.gymBag, "priority raises share");
}

// 6. Manual boost raises the boosted item and lowers the rest.
{
  const base = computeOdds(defaultState(), at("2026-08-12", 13));
  const s = defaultState();
  s.items.keychain.boostPct = 200;
  const o = computeOdds(s, at("2026-08-12", 13));
  assert(o.probs.keychain > base.probs.keychain, "boost raises target");
  assert(o.probs.sticker < base.probs.sticker, "boost lowers others");
}

// 7. Rolling-rate feedback: pacing follows the live 30-min spin count.
{
  const s = defaultState();
  s.autoRate = true;
  const now = at("2026-08-12", 13, 0); // full-strength block
  s.spinLog = [];
  assert(
    effectiveSpinsPerBlock(s, now) === s.spinsPerBlock,
    "no data => manual seed",
  );
  s.spinLog = Array.from({ length: 30 }, (_, i) => now - i * 1000);
  assert(
    Math.round(effectiveSpinsPerBlock(s, now)) === 30,
    "in-event rolling count is used directly",
  );
  // Outside event hours it ignores the rolling count and uses the seed.
  const before = at("2026-08-12", 8, 0);
  s.spinLog = Array.from({ length: 30 }, (_, i) => before - i * 1000);
  assert(
    effectiveSpinsPerBlock(s, before) === s.spinsPerBlock,
    "outside event => manual seed",
  );
}

// 8. Full-event simulation: generate demand-shaped spins, draw at each,
//    assert the priority items fully clear and everything is paced out.
function simulate(seed: number, spinsPerBlock: number, autoRate = false) {
  let s = defaultState();
  s.spinsPerBlock = spinsPerBlock;
  s.autoRate = autoRate;
  const rng = mulberry32(seed);
  const startTotal = ITEM_ORDER.filter((k) => k !== "wildcard").reduce(
    (a, k) => a + s.items[k].qty,
    0,
  );

  for (const day of s.eventDays) {
    for (let h = s.startHour; h < s.endHour; h++) {
      for (const min of [0, 30]) {
        const n = spinsPerBlock;
        for (let i = 0; i < n; i++) {
          const now = at(day, h, min) + Math.floor((i / n) * 30 * 60 * 1000);
          const o = computeOdds(s, now);
          const winner = pickWinner(o, rng) as ItemKey;
          s = applyDraw(s, winner, now);
        }
      }
    }
  }

  const left = (k: ItemKey) => s.items[k].qty;
  const realLeft = ITEM_ORDER.filter((k) => k !== "wildcard").reduce(
    (a, k) => a + left(k),
    0,
  );
  return { s, startTotal, realLeft, left };
}

{
  const { startTotal, realLeft, left, s } = simulate(42, 90);
  // Priority items MUST be cleared.
  for (const k of ["hammock", "hoopTrial", "poleTrial"] as ItemKey[]) {
    assert(left(k) === 0, `priority ${k} not cleared: ${left(k)} left`);
  }
  // With ~2880 spins for 128 prizes, essentially everything should clear.
  assert(
    realLeft <= 2,
    `too much real stock left: ${realLeft}/${startTotal}`,
  );
  console.log(
    `sim@90: cleared ${startTotal - realLeft}/${startTotal} real prizes, ` +
      `${s.wildcardGiven} wildcards handed out, ${realLeft} left over`,
  );
}

// 9. Under-attendance (few spins) still front-loads the priority items:
//    they should clear even when common prizes are left behind.
{
  const { left, realLeft } = simulate(7, 12); // ~384 spins total
  for (const k of ["poleTrial", "hammock", "hoopTrial"] as ItemKey[]) {
    assert(left(k) === 0, `under-attendance: priority ${k} left ${left(k)}`);
  }
  console.log(`sim@12 (under-attendance): priorities cleared, ${realLeft} real left`);
}

// 10. Auto-rate mode: pacing driven by the live rolling rate still clears the
//     priority items and keeps leftovers small.
{
  const { startTotal, realLeft, left } = simulate(42, 90, true);
  for (const k of ["poleTrial", "hammock", "hoopTrial"] as ItemKey[]) {
    assert(left(k) === 0, `auto-rate: priority ${k} left ${left(k)}`);
  }
  assert(realLeft <= 6, `auto-rate: too much left: ${realLeft}/${startTotal}`);
  console.log(`sim@90 auto-rate: priorities cleared, ${realLeft} real left`);
}

console.log("all checks passed");
