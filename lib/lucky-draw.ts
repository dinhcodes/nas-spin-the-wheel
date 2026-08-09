// Lucky-draw pacing engine.
//
// The wheel shows 8 equal-looking segments, but the winner is chosen here by a
// self-correcting pace model so prizes deplete evenly across the whole event
// (12-13 Aug, 9am-6pm) instead of vanishing in hour one.
//
// Core idea:
//   pace_i = qty_i / expectedRemainingSpins   -> P this item should be drawn now
//            so its stock hits zero right at the end.
//   P("?") = 1 - sum(pace)  -> the "?" wildcard absorbs the slack when real
//            prizes are ahead of schedule, and shrinks to 0 when they fall behind.
// Priority and manual boost only reshape the split *among real items*; they do
// not manufacture extra "?".

export type ItemKey =
  | "poleCloth"
  | "gymBag"
  | "hammock"
  | "hoopTrial"
  | "poleTrial"
  | "keychain"
  | "sticker"
  | "wildcard";

export interface Item {
  label: string;
  qty: number; // ignored for wildcard (unlimited filler)
  priority: number; // acts directly as a weight multiplier: 1 normal, 2 higher
  boostPct: number; // manual operator override, e.g. 50 => x1.5
}

export interface State {
  items: Record<ItemKey, Item>;
  spinsPerBlock: number; // seed / fallback expected spins per 30-min block at peak
  autoRate: boolean; // drive pacing from the live rolling spin rate
  spinLog: number[]; // epoch-ms timestamps, one per spin
  wildcardGiven: number; // how many "?" have been redeemed
  eventDays: string[]; // ["2026-08-12","2026-08-13"], local time
  startHour: number; // 10
  endHour: number; // 18 (exclusive)
}

export const ITEM_ORDER: ItemKey[] = [
  "poleCloth",
  "gymBag",
  "hammock",
  "hoopTrial",
  "poleTrial",
  "keychain",
  "sticker",
  "wildcard",
];

export const HIGHER_PRIORITY: ItemKey[] = ["hammock", "hoopTrial", "poleTrial"];

// Display names live in code (never in stored state) so renames apply instantly.
export const LABELS: Record<ItemKey, string> = {
  poleCloth: "Pole Cloth",
  gymBag: "Gym Bag",
  hammock: "Hammock Trial",
  hoopTrial: "Hoop Trial",
  poleTrial: "Pole Trial",
  keychain: "Keychain",
  sticker: "Sticker",
  wildcard: "?",
};

// Extra info shown in the winner modal for the trial prizes.
export const PRIZE_DETAILS: Partial<Record<ItemKey, { when: string; offer: string }>> = {
  poleTrial: {
    when: "Tentatively Sat 22 / Sun 23 Aug",
    offer: "You go free — bring a friend for just $10 more (U.P. $15)",
  },
  hammock: {
    when: "Sat 29 Aug, 9:00 AM",
    offer: "You go free — bring a friend for just $10 more (U.P. $15)",
  },
  hoopTrial: {
    when: "Lyra · Sun 30 Aug, 3:30 PM",
    offer: "You go free — bring a friend for just $10 more (U.P. $15)",
  },
};

const BLOCK_MS = 30 * 60 * 1000;

export function defaultState(): State {
  const mk = (label: string, qty: number, priority = 1): Item => ({
    label,
    qty,
    priority,
    boostPct: 0,
  });
  return {
    items: {
      poleCloth: mk(LABELS.poleCloth, 2),
      gymBag: mk(LABELS.gymBag, 3),
      hammock: mk(LABELS.hammock, 10, 2),
      hoopTrial: mk(LABELS.hoopTrial, 10, 2),
      poleTrial: mk(LABELS.poleTrial, 8, 2),
      keychain: mk(LABELS.keychain, 45),
      sticker: mk(LABELS.sticker, 50),
      wildcard: mk(LABELS.wildcard, Infinity),
    },
    spinsPerBlock: 8, // seed: ~256 spins across the event (tune to real footfall)
    autoRate: true,
    spinLog: [],
    wildcardGiven: 0,
    eventDays: ["2026-08-12", "2026-08-13"],
    startHour: 10,
    endHour: 18,
  };
}

const MIN_ROLLING_SAMPLE = 5; // need at least this many spins before trusting live rate

// Whether `now` falls inside the event's open hours.
export function inEvent(state: State, nowMs: number): boolean {
  const d = new Date(nowMs);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
  const h = d.getHours();
  return (
    state.eventDays.includes(key) && h >= state.startHour && h < state.endHour
  );
}

// Spins recorded in the rolling 30-min window ending at `now`.
export function rollingSpins(state: State, nowMs: number): number {
  return state.spinLog.filter((t) => t > nowMs - BLOCK_MS && t <= nowMs).length;
}

// The spins-per-block figure pacing actually uses. In auto mode this is the live
// rolling 30-min spin count; it falls back to the manual seed until enough spins
// have been observed, or whenever auto is off / we're outside event hours.
export function effectiveSpinsPerBlock(state: State, nowMs: number): number {
  if (!state.autoRate) return state.spinsPerBlock;
  const rolling = rollingSpins(state, nowMs);
  if (inEvent(state, nowMs) && rolling >= MIN_ROLLING_SAMPLE)
    return Math.max(1, rolling);
  return state.spinsPerBlock;
}

// Expected spins still to come from `nowMs` to the end of the event.
// The current block is prorated by the fraction of it remaining.
export function remainingSpins(state: State, nowMs: number): number {
  const peak = effectiveSpinsPerBlock(state, nowMs);
  let total = 0;
  for (const day of state.eventDays) {
    const [y, m, d] = day.split("-").map(Number);
    for (let h = state.startHour; h < state.endHour; h++) {
      for (const min of [0, 30]) {
        const start = new Date(y, m - 1, d, h, min).getTime();
        const end = start + BLOCK_MS;
        if (end <= nowMs) continue; // block fully in the past
        if (start >= nowMs) {
          total += peak; // fully in the future
        } else {
          total += peak * ((end - nowMs) / BLOCK_MS); // straddles now
        }
      }
    }
  }
  return total;
}

// Number of 30-min blocks across the whole event (32 for two 10-6 days).
// Multiply by spinsPerBlock to get expected total spins.
export function eventPeakBlocks(state: State): number {
  return state.eventDays.length * (state.endHour - state.startHour) * 2;
}

// The intuitive knob: total spins expected over the event (footfall).
export function expectedTotalSpins(state: State): number {
  return Math.round(eventPeakBlocks(state) * state.spinsPerBlock);
}

// Inverse: given a target total footfall, the seed spins-per-block it implies.
export function spinsPerBlockForTotal(state: State, total: number): number {
  return Math.max(1, total / eventPeakBlocks(state));
}

export interface Odds {
  probs: Record<ItemKey, number>;
  remaining: number; // expected spins left
  sumPace: number; // required real-prize rate per spin
  behind: boolean; // sumPace >= 1: cannot afford any "?"
}

// The draw distribution for the next spin.
export function computeOdds(state: State, nowMs: number): Odds {
  const reals = ITEM_ORDER.filter((k) => k !== "wildcard");
  const remaining = remainingSpins(state, nowMs);
  const probs = Object.fromEntries(
    ITEM_ORDER.map((k) => [k, 0]),
  ) as Record<ItemKey, number>;

  const inStock = reals.filter((k) => state.items[k].qty > 0);
  if (inStock.length === 0) {
    probs.wildcard = 1;
    return { probs, remaining, sumPace: 0, behind: false };
  }

  // Past the event end (or no demand left): dump all remaining real stock now.
  if (remaining <= 0) {
    const w = weights(state, inStock);
    const sum = w.reduce((a, b) => a + b, 0);
    inStock.forEach((k, i) => (probs[k] = w[i] / sum));
    return { probs, remaining, sumPace: Infinity, behind: true };
  }

  const pace = inStock.map((k) => state.items[k].qty / remaining);
  const sumPace = pace.reduce((a, b) => a + b, 0);
  const wild = Math.max(0, Math.min(1, 1 - sumPace));
  const realBudget = 1 - wild;

  const w = weights(state, inStock);
  const sumW = w.reduce((a, b) => a + b, 0);
  inStock.forEach((k, i) => (probs[k] = realBudget * (w[i] / sumW)));
  probs.wildcard = wild;

  return { probs, remaining, sumPace, behind: sumPace >= 1 };
}

// Effective real-item weight: pace-independent shaping (priority x manual boost)
// multiplied by pace so a behind-schedule item naturally rises.
function weights(state: State, keys: ItemKey[]): number[] {
  return keys.map((k) => {
    const it = state.items[k];
    return it.qty * it.priority * (1 + it.boostPct / 100);
  });
}

export function pickWinner(
  odds: Odds,
  rng: () => number = Math.random,
): ItemKey {
  let r = rng();
  for (const k of ITEM_ORDER) {
    r -= odds.probs[k];
    if (r <= 0) return k;
  }
  return "wildcard"; // rounding fallback
}

// Apply a draw immutably: decrement the winner (or bump the "?" counter),
// and log the spin timestamp.
export function applyDraw(state: State, winner: ItemKey, nowMs: number): State {
  const items = { ...state.items };
  if (winner === "wildcard") {
    return {
      ...state,
      items,
      wildcardGiven: state.wildcardGiven + 1,
      spinLog: [...state.spinLog, nowMs],
    };
  }
  items[winner] = { ...items[winner], qty: Math.max(0, items[winner].qty - 1) };
  return { ...state, items, spinLog: [...state.spinLog, nowMs] };
}

// Spins recorded in the 30-min block containing nowMs (for the live tracker).
export function spinsThisBlock(state: State, nowMs: number): number {
  const blockStart = Math.floor(nowMs / BLOCK_MS) * BLOCK_MS;
  return state.spinLog.filter((t) => t >= blockStart && t < blockStart + BLOCK_MS)
    .length;
}
