'use client'

import { useEffect, useState } from 'react'
import {
  computeOdds,
  remainingSpins,
  spinsThisBlock,
  defaultState,
  ITEM_ORDER,
  type ItemKey,
  type State,
} from '@/lib/lucky-draw'
import { cn } from '@/lib/utils'

// Target spins for the 30-min block containing `now`, per the demand model.
function targetThisBlock(state: State, now: number) {
  const d = new Date(now)
  const h = d.getHours()
  const inEvent =
    state.eventDays.includes(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`,
    ) && h >= state.startHour && h < state.endHour
  if (!inEvent) return 0
  const half =
    state.halfDemandFirstLastHour &&
    (h < state.startHour + 1 || h >= state.endHour - 1)
  return Math.round(state.spinsPerBlock * (half ? 0.5 : 1))
}

export function Control({
  state,
  setState,
  getNow,
}: {
  state: State
  setState: (fn: (s: State) => State) => void
  getNow: () => number
}) {
  // Re-render every 3s so live odds/tracker follow the clock.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000)
    return () => clearInterval(id)
  }, [])

  const now = getNow()
  const odds = computeOdds(state, now)
  const remaining = remainingSpins(state, now)
  const realLeft = ITEM_ORDER.filter((k) => k !== 'wildcard').reduce(
    (a, k) => a + state.items[k].qty,
    0,
  )
  const wildcardsNeeded = Math.max(0, Math.round(remaining - realLeft))
  const thisBlock = spinsThisBlock(state, now)
  const target = targetThisBlock(state, now)
  const anyBoost = ITEM_ORDER.some((k) => state.items[k].boostPct !== 0)

  const setItem = (key: ItemKey, patch: Partial<State['items'][ItemKey]>) =>
    setState((s) => ({
      ...s,
      items: { ...s.items, [key]: { ...s.items[key], ...patch } },
    }))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* live stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Spins this block" value={`${thisBlock} / ${target || '—'}`} />
        <Stat label="Spins left (est.)" value={Math.round(remaining).toString()} />
        <Stat label="Real prizes left" value={realLeft.toString()} />
        <Stat label="? given / needed" value={`${state.wildcardGiven} / ~${wildcardsNeeded}`} />
      </div>

      {/* spins per block */}
      <label className="bg-card flex items-center justify-between gap-4 rounded-2xl border p-4">
        <div>
          <p className="font-medium">Spins per 30-min block (peak)</p>
          <p className="text-muted-foreground text-sm">
            First & last hour each day count as half. Drives the whole pace.
          </p>
        </div>
        <input
          type="number"
          min={1}
          value={state.spinsPerBlock}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              spinsPerBlock: Math.max(1, Number(e.target.value) || 1),
            }))
          }
          className="bg-background w-24 rounded-lg border px-3 py-2 text-right text-lg font-semibold"
        />
      </label>

      {anyBoost && (
        <div className="border-boost bg-boost/10 text-boost flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium">
          ⚠ Rigging active — boosted items are green, everything else (amber) has
          reduced odds.
        </div>
      )}

      {/* items */}
      <div className="bg-card overflow-hidden rounded-2xl border">
        <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b px-4 py-2 text-xs font-semibold tracking-wide uppercase">
          <span>Prize</span>
          <span className="text-center">Stock</span>
          <span className="text-center">Boost %</span>
          <span className="text-right">Odds</span>
        </div>
        {ITEM_ORDER.map((key) => {
          const it = state.items[key]
          const boosted = it.boostPct > 0
          const reduced = anyBoost && it.boostPct <= 0
          const pct = (odds.probs[key] * 100).toFixed(1)
          const isWild = key === 'wildcard'
          return (
            <div
              key={key}
              className={cn(
                'grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0',
                boosted && 'bg-boost/10',
                reduced && 'bg-reduced/10',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{it.label}</span>
                {!isWild && (
                  <button
                    onClick={() =>
                      setItem(key, { priority: it.priority > 1 ? 1 : 2 })
                    }
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs',
                      it.priority > 1
                        ? 'border-primary text-primary font-semibold'
                        : 'text-muted-foreground',
                    )}
                    title="Toggle higher priority (cleared faster)"
                  >
                    {it.priority > 1 ? '★ priority' : 'normal'}
                  </button>
                )}
              </div>

              {/* stock +/- */}
              <div className="flex items-center gap-1">
                {isWild ? (
                  <span className="text-muted-foreground w-24 text-center text-sm">
                    ∞
                  </span>
                ) : (
                  <>
                    <StepBtn
                      onClick={() =>
                        setItem(key, { qty: Math.max(0, it.qty - 1) })
                      }
                    >
                      −
                    </StepBtn>
                    <input
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) =>
                        setItem(key, { qty: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="bg-background w-14 rounded-lg border px-2 py-1 text-center"
                    />
                    <StepBtn onClick={() => setItem(key, { qty: it.qty + 1 })}>
                      +
                    </StepBtn>
                  </>
                )}
              </div>

              {/* boost */}
              <div className="flex justify-center">
                {isWild ? (
                  <span className="text-muted-foreground text-sm">auto</span>
                ) : (
                  <input
                    type="number"
                    value={it.boostPct}
                    onChange={(e) =>
                      setItem(key, { boostPct: Number(e.target.value) || 0 })
                    }
                    className={cn(
                      'bg-background w-16 rounded-lg border px-2 py-1 text-center',
                      boosted && 'border-boost text-boost font-semibold',
                    )}
                  />
                )}
              </div>

              {/* odds */}
              <span
                className={cn(
                  'text-right font-semibold tabular-nums',
                  boosted && 'text-boost',
                  reduced && 'text-reduced',
                )}
              >
                {pct}%
              </span>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => {
          if (confirm('Reset all stock, boosts and spin history to defaults?'))
            setState(() => defaultState())
        }}
        className="text-muted-foreground hover:text-destructive self-start text-sm underline"
      >
        Reset everything
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl border p-3 text-center">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}

function StepBtn({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="bg-muted hover:bg-accent flex size-8 items-center justify-center rounded-lg text-lg font-bold"
    >
      {children}
    </button>
  )
}
