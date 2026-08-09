'use client'

import { useEffect, useState } from 'react'
import {
  computeOdds,
  rollingSpins,
  effectiveSpinsPerBlock,
  inEvent,
  expectedTotalSpins,
  spinsPerBlockForTotal,
  defaultState,
  ITEM_ORDER,
  LABELS,
  type ItemKey,
  type State,
} from '@/lib/lucky-draw'
import { cn } from '@/lib/utils'

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
  const realLeft = ITEM_ORDER.filter((k) => k !== 'wildcard').reduce(
    (a, k) => a + state.items[k].qty,
    0,
  )
  const rolling = rollingSpins(state, now)
  const effective = Math.round(effectiveSpinsPerBlock(state, now))
  const usingLive = state.autoRate && inEvent(state, now) && rolling >= 5
  const expectedTotal = expectedTotalSpins(state)
  const seedPerBlock = Math.round(state.spinsPerBlock)
  const baselineWild =
    expectedTotal > 0
      ? Math.max(0, Math.round((1 - realLeft / expectedTotal) * 100))
      : 0

  const setItem = (key: ItemKey, patch: Partial<State['items'][ItemKey]>) =>
    setState((s) => ({
      ...s,
      items: { ...s.items, [key]: { ...s.items[key], ...patch } },
    }))

  return (
    <div className="flex w-full flex-col gap-6">
      {/* live stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Spins / 30 min (live)" value={rolling.toString()} />
        <Stat
          label="Pacing at / 30-min block"
          value={effective.toString()}
          hint={usingLive ? 'from live rate' : 'from seed'}
        />
        <Stat label="Real prizes left" value={realLeft.toString()} />
      </div>

      {/* how many spins to expect — the dial that controls the ? rate */}
      <div className="bg-card flex flex-col gap-4 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Expected total spins (both days)</p>
            <p className="text-muted-foreground text-sm">
              This means: {baselineWild}% won't win anything valuable (aka: they get the ? prize)
            </p>
          </div>
          <input
            type="number"
            min={1}
            value={expectedTotal}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                spinsPerBlock: spinsPerBlockForTotal(
                  s,
                  Math.max(1, Number(e.target.value) || 1),
                ),
              }))
            }
            className="bg-background w-28 rounded-lg border px-3 py-2 text-right text-lg font-semibold"
          />
        </div>
        <label className="flex items-center gap-3 border-t pt-3">
          <input
            type="checkbox"
            checked={state.autoRate}
            onChange={(e) =>
              setState((s) => ({ ...s, autoRate: e.target.checked }))
            }
            className="size-4"
          />
          <span className="text-sm">
            Auto-adjust from the live rolling 30-min rate
          </span>
        </label>
      </div>

      {/* items */}
      <div className="bg-card overflow-hidden rounded-2xl border">
        <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto] gap-3 border-b px-4 py-2 text-xs font-semibold tracking-wide uppercase">
          <span>Prize</span>
          <span className="text-center">Stock</span>
          <span className="text-right">Odds</span>
        </div>
        {ITEM_ORDER.map((key) => {
          const it = state.items[key]
          const pct = (odds.probs[key] * 100).toFixed(1)
          const isWild = key === 'wildcard'
          const priority = it.priority > 1
          return (
            <div
              key={key}
              className={cn(
                'grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0',
                priority && 'bg-primary/5',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{LABELS[key]}</span>
                {!isWild && (
                  <button
                    onClick={() =>
                      setItem(key, { priority: priority ? 1 : 2 })
                    }
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs',
                      priority
                        ? 'border-primary text-primary font-semibold'
                        : 'text-muted-foreground',
                    )}
                    title="Toggle higher priority (cleared first)"
                  >
                    {priority ? '★ clear first' : 'normal'}
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
                        setItem(key, {
                          qty: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="bg-background w-14 rounded-lg border px-2 py-1 text-center"
                    />
                    <StepBtn onClick={() => setItem(key, { qty: it.qty + 1 })}>
                      +
                    </StepBtn>
                  </>
                )}
              </div>

              {/* odds */}
              <span className="text-right font-semibold tabular-nums">
                {pct}%
              </span>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => {
          if (confirm('Reset all stock, priorities and spin history to defaults?'))
            setState(() => defaultState())
        }}
        className="text-muted-foreground hover:text-destructive self-start text-sm underline"
      >
        Reset everything
      </button>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="bg-card rounded-2xl border p-3 text-center">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground text-[10px]">{hint}</p>}
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
