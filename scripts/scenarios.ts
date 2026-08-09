// Stress-test the pacing engine across turnout scenarios. Run: node scripts/scenarios.ts
import assert from 'node:assert'
import {
  defaultState,
  computeOdds,
  pickWinner,
  applyDraw,
  ITEM_ORDER,
  type ItemKey,
} from '../lib/lucky-draw.ts'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const at = (day: string, h: number, min = 0) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, h, min).getTime()
}
const PRIO: ItemKey[] = ['hammock', 'hoopTrial', 'poleTrial']

// spinsForHour(dayIndex, hour, rng) -> integer number of spins that hour
function runScenario(
  name: string,
  spinsForHour: (di: number, h: number, rng: () => number) => number,
  seed: number,
  autoRate = true,
) {
  let s = defaultState()
  s.autoRate = autoRate
  const rng = mulberry32(seed)
  const start: Record<string, number> = {}
  for (const k of ITEM_ORDER) start[k] = s.items[k].qty

  let negatives = 0
  let total = 0
  for (let di = 0; di < s.eventDays.length; di++) {
    const day = s.eventDays[di]
    for (let h = s.startHour; h < s.endHour; h++) {
      const n = spinsForHour(di, h, rng)
      total += n
      for (let i = 0; i < n; i++) {
        const now = at(day, h) + Math.floor((i / Math.max(1, n)) * 3600 * 1000)
        const o = computeOdds(s, now)
        // odds are a valid distribution
        const sum = ITEM_ORDER.reduce((a, k) => a + o.probs[k], 0)
        assert(Math.abs(sum - 1) < 1e-6, `${name}: odds sum ${sum}`)
        const w = pickWinner(o, rng) as ItemKey
        s = applyDraw(s, w, now)
        for (const k of ITEM_ORDER)
          if (k !== 'wildcard' && s.items[k].qty < 0) negatives++
      }
    }
  }

  const realKeys = ITEM_ORDER.filter((k) => k !== 'wildcard')
  const totalStart = realKeys.reduce((a, k) => a + start[k], 0)
  const left = realKeys.reduce((a, k) => a + s.items[k].qty, 0)
  const cleared = totalStart - left
  const prioLeft = PRIO.reduce((a, k) => a + s.items[k].qty, 0)

  // HARD invariants that must hold in every scenario:
  assert(negatives === 0, `${name}: stock went negative`)
  for (const k of realKeys)
    assert(
      s.items[k].qty >= 0 && start[k] - s.items[k].qty <= start[k],
      `${name}: over-distributed ${k}`,
    )

  return {
    name,
    total,
    cleared,
    totalStart,
    left,
    prioLeft,
    wild: s.wildcardGiven,
  }
}

const uni = (min: number, max: number) => (rng: () => number) =>
  min + Math.floor(rng() * (max - min + 1))

const scenarios: Array<[string, (di: number, h: number, rng: () => number) => number, number]> = [
  ['very low   5-15/hr', (_d, _h, r) => uni(5, 15)(r), 11],
  ['low       20-40/hr', (_d, _h, r) => uni(20, 40)(r), 22],
  ['medium   40-100/hr', (_d, _h, r) => uni(40, 100)(r), 33],
  ['high    100-180/hr', (_d, _h, r) => uni(100, 180)(r), 44],
  ['veryhigh 200-320/hr', (_d, _h, r) => uni(200, 320)(r), 55],
  ['extreme 350-500/hr', (_d, _h, r) => uni(350, 500)(r), 66],
  ['busy->quiet', (di, _h, r) => (di === 0 ? uni(150, 220)(r) : uni(8, 25)(r)), 77],
  ['quiet->busy', (di, _h, r) => (di === 0 ? uni(8, 25)(r) : uni(150, 220)(r)), 88],
  ['ramp up (per hr)', (_di, h, r) => uni(10, 30)(r) + (h - 10) * 12, 99],
]

console.log('scenario           spins  cleared/total  prioLeft  ? given')
const rows = scenarios.map(([name, fn, seed]) => runScenario(name, fn, seed))
for (const r of rows) {
  console.log(
    `${r.name.padEnd(18)} ${String(r.total).padStart(5)}  ` +
      `${String(r.cleared + '/' + r.totalStart).padStart(12)}  ` +
      `${String(r.prioLeft).padStart(7)}  ${String(r.wild).padStart(6)}`,
  )
}

// Priorities must clear given a comfortable turnout (>= 2x the prize count).
// At near-minimal turnout the gentler 1.4 front-load may leave a unit or two;
// that's a turnout limit, not a bug.
for (const r of rows) {
  if (r.total >= 2 * r.totalStart)
    assert(r.prioLeft === 0, `${r.name}: priorities left ${r.prioLeft} at ${r.total} spins`)
}
const marginal = rows.filter((r) => r.total < 2 * r.totalStart && r.prioLeft > 0)
if (marginal.length)
  console.log(
    '\nnote (near-minimal turnout, priority 1.4): ' +
      marginal.map((r) => `${r.name.trim()} left ${r.prioLeft} priority`).join(', '),
  )
console.log('all invariants held (no negatives, no over-distribution, priorities clear at >=2x turnout)')
