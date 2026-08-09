// Hourly redemption simulation. Run: node scripts/hourly-sim.ts
// Uses the real pacing engine with auto (live rolling 30-min rate) ON, over the
// configured event (two 10am-6pm days). Each hour gets a random spin count in
// the given range; every spin is redeemed.
import {
  defaultState,
  computeOdds,
  pickWinner,
  applyDraw,
  ITEM_ORDER,
  LABELS,
  type ItemKey,
} from "../lib/lucky-draw.ts";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (day: string, h: number, min = 0) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
};

function runScenario(name: string, min: number, max: number, seed: number) {
  let s = defaultState(); // 2 days, autoRate=true, 10am-6pm
  const rng = mulberry32(seed);
  const startQty: Record<string, number> = {};
  for (const k of ITEM_ORDER) startQty[k] = s.items[k].qty;

  console.log(`\n=== ${name}: ${min}-${max} spins/hour, auto-rate ON ===`);
  console.log("day  hour   spins  real  ?      cumReal");

  let cumReal = 0;
  for (let di = 0; di < s.eventDays.length; di++) {
    const day = s.eventDays[di];
    for (let h = s.startHour; h < s.endHour; h++) {
      const spins = min + Math.floor(rng() * (max - min + 1));
      let real = 0;
      let wild = 0;
      for (let i = 0; i < spins; i++) {
        const now = at(day, h) + Math.floor((i / spins) * 3600 * 1000);
        const o = computeOdds(s, now);
        const w = pickWinner(o, rng) as ItemKey;
        s = applyDraw(s, w, now);
        if (w === "wildcard") wild++;
        else real++;
      }
      cumReal += real;
      console.log(
        `D${di + 1}  ${String(h).padStart(2)}-${h + 1}  ` +
          `${String(spins).padStart(5)}  ${String(real).padStart(4)}  ` +
          `${String(wild).padStart(5)}  ${String(cumReal).padStart(6)}`,
      );
    }
  }

  const realKeys = ITEM_ORDER.filter((k) => k !== "wildcard");
  const totalStart = realKeys.reduce((a, k) => a + startQty[k], 0);
  const totalLeft = realKeys.reduce((a, k) => a + s.items[k].qty, 0);
  console.log(
    `  totals: real redeemed ${totalStart - totalLeft}/${totalStart}, ` +
      `? given ${s.wildcardGiven}, real left ${totalLeft}`,
  );
  console.log(
    "  per prize redeemed: " +
      realKeys
        .map((k) => `${LABELS[k]} ${startQty[k] - s.items[k].qty}/${startQty[k]}`)
        .join(", "),
  );
}

runScenario("LOW", 20, 40, 101);
runScenario("MID", 40, 100, 202);
runScenario("HIGH", 100, 180, 303);
