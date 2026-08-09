'use client'

import { useEffect, useRef } from 'react'

// Real lava-lamp: irregular, slowly-rotating blobs that MERGE via an SVG "goo"
// metaball filter (blur + alpha threshold => organic necks where they touch).
// They drift/bob like a lamp and flee the cursor.
// ponytail: the goo filter re-rasterizes each frame; ~7 blobs is the sweet spot,
// drop the count or stdDeviation if a weak machine chugs.
// Deep, muted violets — dim on purpose; a dark screen over them mutes further.
const COLORS = [
  '#5b4788',
  '#4a3a72',
  '#6a5296',
  '#3f3266',
  '#574386',
  '#6d5a9e',
  '#453770',
  '#2f2650',
]
const RADII = [
  '42% 58% 63% 37% / 41% 44% 56% 59%',
  '67% 33% 47% 53% / 37% 62% 38% 63%',
  '38% 62% 55% 45% / 53% 38% 62% 47%',
  '58% 42% 33% 67% / 63% 51% 49% 37%',
  '49% 51% 62% 38% / 44% 61% 39% 56%',
]

// Deterministic pseudo-random in [0,1) so SSR and client agree (no Math.random).
const frac = (n: number) => {
  const x = Math.sin(n) * 43758.5453
  return x - Math.floor(x)
}

// A crowded field of blobs, spread across the viewport.
const BLOBS = Array.from({ length: 24 }, (_, i) => ({
  color: COLORS[i % COLORS.length],
  size: 140 + Math.round(frac(i * 1.7) * 200), // 140–340
  x: 4 + frac(i * 2.3 + 1) * 92, // vw
  y: 4 + frac(i * 3.1 + 2) * 92, // vh
  radius: RADII[i % RADII.length],
}))

const REPEL_RADIUS = 260

interface B {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  phase: number
}

export function BlobBackground() {
  const els = useRef<(HTMLDivElement | null)[]>([])
  const blobs = useRef<B[]>([])
  const mouse = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const W = () => window.innerWidth
    const H = () => window.innerHeight

    blobs.current = BLOBS.map((b, i) => ({
      x: (b.x / 100) * W(),
      y: (b.y / 100) * H(),
      vx: (i % 2 ? 1 : -1) * (0.25 + 0.06 * i),
      vy: (i % 3 ? -1 : 1) * (0.22 + 0.05 * i),
      rot: i * 40,
      spin: (i % 2 ? 1 : -1) * (0.06 + 0.02 * i),
      phase: i * 1.3,
    }))

    const draw = () => {
      els.current.forEach((el, i) => {
        const b = blobs.current[i]
        if (el && b)
          el.style.transform = `translate3d(${b.x - BLOBS[i].size / 2}px, ${
            b.y - BLOBS[i].size / 2
          }px, 0) rotate(${b.rot}deg)`
      })
    }
    draw()

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    let raf = 0
    const tick = () => {
      const w = W()
      const h = H()
      const { x: mx, y: my } = mouse.current
      for (let i = 0; i < blobs.current.length; i++) {
        const b = blobs.current[i]
        b.x += b.vx
        b.y += b.vy
        b.rot += b.spin

        // flee the cursor
        const dx = b.x - mx
        const dy = b.y - my
        const d2 = dx * dx + dy * dy
        if (d2 < REPEL_RADIUS * REPEL_RADIUS) {
          const d = Math.sqrt(d2) || 1
          const f = 1 - d / REPEL_RADIUS
          b.vx += (dx / d) * f * 0.7
          b.vy += (dy / d) * f * 0.7
        }

        b.vx *= 0.985
        b.vy *= 0.985
        // slow wander / buoyancy so they rise, fall and cross (=> merge)
        b.vx += Math.cos(b.phase) * 0.02
        b.vy += Math.sin(b.phase * 0.8) * 0.025
        b.phase += 0.006

        const sp = Math.hypot(b.vx, b.vy)
        if (sp > 1.1) {
          b.vx *= 1.1 / sp
          b.vy *= 1.1 / sp
        }
        // keep them roaming the screen (bounce a bit inside the edges)
        const m = BLOBS[i].size * 0.25
        if (b.x < m) b.vx += 0.25
        if (b.x > w - m) b.vx -= 0.25
        if (b.y < m) b.vy += 0.25
        if (b.y > h - m) b.vy -= 0.25
      }
      draw()
      raf = requestAnimationFrame(tick)
    }

    const onMove = (e: PointerEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    const onLeave = () => {
      mouse.current = { x: -9999, y: -9999 }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 overflow-hidden"
      style={{
        pointerEvents: 'none',
        background:
          'radial-gradient(130% 100% at 50% 40%, #100a1e 0%, #060410 55%, #010006 100%)',
      }}
    >
      {/* goo filter def */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div
        className="absolute inset-0"
        style={{ filter: 'url(#goo) blur(3px)', opacity: 0.95 }}
      >
        {BLOBS.map((b, i) => (
          <div
            key={i}
            ref={(el) => {
              els.current[i] = el
            }}
            // the browser normalizes the vw/vh calc() differently than React's
            // string; rAF overwrites transform on mount, so this is cosmetic.
            suppressHydrationWarning
            className="absolute top-0 left-0"
            style={{
              width: b.size,
              height: b.size,
              borderRadius: b.radius,
              transform: `translate(calc(${b.x}vw - ${b.size / 2}px), calc(${b.y}vh - ${b.size / 2}px))`,
              background: `radial-gradient(circle at 38% 32%, ${b.color}, ${b.color}cc 55%, ${b.color}88 100%)`,
              willChange: 'transform',
            }}
          />
        ))}
      </div>

      {/* semi-opaque dark screen: mutes the blobs into subtle ambiance */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(6,3,14,0.55)' }}
      />
    </div>
  )
}
