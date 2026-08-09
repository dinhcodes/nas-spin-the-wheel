'use client'

import { useMemo } from 'react'

const COLORS = ['#A187A1', '#ECC4AC', '#C4ACA4', '#B99BB8', '#4B343C']

/**
 * A lightweight, self-contained confetti burst.
 * Render it conditionally — it animates once and fades out.
 */
export function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.4,
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        rounded: Math.random() > 0.5,
      })),
    [count],
  )

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.rounded ? '9999px' : '2px',
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  )
}
