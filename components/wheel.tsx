'use client'

import { useRef, useState } from 'react'
import {
  computeOdds,
  pickWinner,
  ITEM_ORDER,
  LABELS,
  type ItemKey,
  type State,
} from '@/lib/lucky-draw'
import { Confetti } from '@/components/confetti'

// Equal-looking slices; the winner is decided by the pacing model, then the
// wheel is animated to land on that slice.
const SEG = 360 / ITEM_ORDER.length
const SPIN_MS = 3500
const TURNS = 5

// Four bright, on-brand pastels in an A-B-C-D-A-B-C-D rotation: violet / peach /
// rose / gold. Even, playful, no two neighbours alike, no heavy dark slice.
const PALETTE = ['#b193bf', '#f4b393', '#e8a9c2', '#f4d29a']
const FILLS = ITEM_ORDER.map((_, i) => PALETTE[i % PALETTE.length])

const R = 96
const C = 100

function pointOnCircle(deg: number, radius = R) {
  const rad = ((deg - 90) * Math.PI) / 180 // deg measured clockwise from top
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)]
}

function segmentPath(i: number) {
  const [x1, y1] = pointOnCircle(i * SEG)
  const [x2, y2] = pointOnCircle((i + 1) * SEG)
  return `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`
}

// Rotation (deg) that brings slice `index` under the top pointer, always
// spinning forward at least TURNS full turns from `current`.
function rotationFor(index: number, current: number) {
  const targetMod = (360 - (index * SEG + SEG / 2)) % 360
  const currentMod = ((current % 360) + 360) % 360
  let delta = targetMod - currentMod
  if (delta < 0) delta += 360
  return current + TURNS * 360 + delta
}

export function Wheel({
  state,
  getNow,
  onResult,
}: {
  state: State
  getNow: () => number
  onResult: (winner: ItemKey) => void
}) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<ItemKey | null>(null)
  const pending = useRef<ItemKey | null>(null)

  function spin() {
    if (spinning) return
    setWinner(null)
    const odds = computeOdds(state, getNow())
    const w = pickWinner(odds)
    pending.current = w
    setRotation((r) => rotationFor(ITEM_ORDER.indexOf(w), r))
    setSpinning(true)
  }

  function onTransitionEnd() {
    if (!spinning) return
    setSpinning(false)
    if (pending.current) setWinner(pending.current) // show modal; stock unchanged until Redeem
  }

  function redeem() {
    if (winner) onResult(winner) // only now does stock change
    setWinner(null)
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative aspect-square w-full max-w-[520px]">
        {/* pointer */}
        <div className="absolute top-[-6px] left-1/2 z-20 -translate-x-1/2">
          <div className="h-0 w-0 border-x-[16px] border-t-[26px] border-x-transparent border-t-matterhorn drop-shadow" />
        </div>

        <svg
          viewBox="0 0 200 200"
          className="h-full w-full drop-shadow-xl"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.9, 0.2, 1)`
              : 'none',
          }}
          onTransitionEnd={onTransitionEnd}
        >
          <circle cx={C} cy={C} r={R + 3} fill="#fffdfb" />
          {ITEM_ORDER.map((key, i) => {
            const [lx, ly] = pointOnCircle(i * SEG + SEG / 2, R * 0.62)
            const words =
              key === 'wildcard' ? ['?'] : LABELS[key].split(' ')
            const wild = key === 'wildcard'
            return (
              <g key={key}>
                <path
                  d={segmentPath(i)}
                  fill={FILLS[i]}
                  stroke="#fffdfb"
                  strokeWidth={2}
                />
                <text
                  x={lx}
                  y={ly}
                  fill="#4b343c"
                  fontSize={wild ? 16 : 7.5}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${i * SEG + SEG / 2} ${lx} ${ly})`}
                >
                  {words.map((w, j) => (
                    <tspan
                      key={j}
                      x={lx}
                      dy={j === 0 ? -((words.length - 1) * 4) : 8}
                    >
                      {w}
                    </tspan>
                  ))}
                </text>
              </g>
            )
          })}
          <circle cx={C} cy={C} r={16} fill="#fffdfb" stroke="#e6d3ca" />
        </svg>
      </div>

      <button
        onClick={spin}
        disabled={spinning}
        className="bg-matterhorn text-warm-ivory hover:bg-matterhorn/90 rounded-full px-14 py-4 text-xl font-bold tracking-widest shadow-lg transition-all active:translate-y-px disabled:opacity-60"
      >
        {spinning ? 'Spinning…' : 'SPIN'}
      </button>

      {winner && (
        <div className="animate-pop-in fixed inset-0 z-40 flex items-center justify-center bg-white/50 p-6 backdrop-blur-sm">
          <Confetti />
          <div className="bg-card w-full max-w-md rounded-3xl p-10 text-center shadow-2xl">
            <p className="text-muted-foreground text-sm tracking-widest uppercase">
              Winner
            </p>
            <p className="font-heading text-primary mt-2 text-5xl font-bold">
              {LABELS[winner]}
            </p>
            <div className="mt-8 flex gap-3">
              <button
                onClick={redeem}
                className="bg-matterhorn text-warm-ivory hover:bg-matterhorn/90 flex-1 rounded-full px-6 py-3 font-bold shadow transition-colors"
              >
                Redeem
              </button>
              <button
                onClick={() => setWinner(null)}
                className="border-border text-muted-foreground hover:bg-muted flex-1 rounded-full border px-6 py-3 font-medium transition-colors"
              >
                Nevermind
              </button>
            </div>
            <p className="text-muted-foreground mt-4 text-xs">
              yipee! congrats.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
