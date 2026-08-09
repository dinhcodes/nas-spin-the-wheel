'use client'

import { useEffect, useRef } from 'react'

// Lava-lamp: soft glowing brand-purple blobs on a dark base, blurred together
// and screen-blended so they merge; they drift forever and flee the cursor.
// ponytail: full-screen blur is GPU-ish but fine for ~6 blobs; drop the count
// or the blur radius if it ever chugs on weak hardware.
const BLOBS = [
  { color: '#a187a1', size: 540, x: 15, y: 20 }, // venus       (x/y in vw/vh)
  { color: '#b99bb8', size: 470, x: 82, y: 24 }, // venus-light
  { color: '#c9a2cf', size: 520, x: 28, y: 72 }, // lavender
  { color: '#6f5a90', size: 600, x: 68, y: 62 }, // deep purple
  { color: '#8a6f9e', size: 440, x: 50, y: 12 }, // muted violet
  { color: '#7d6bd6', size: 400, x: 88, y: 82 }, // periwinkle
]

const REPEL_RADIUS = 280

interface Blob {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
}

export function BlobBackground() {
  const els = useRef<(HTMLDivElement | null)[]>([])
  const blobs = useRef<Blob[]>([])
  const mouse = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const W = () => window.innerWidth
    const H = () => window.innerHeight

    blobs.current = BLOBS.map((b, i) => ({
      x: (b.x / 100) * W(),
      y: (b.y / 100) * H(),
      vx: (i % 2 ? 1 : -1) * (0.3 + 0.12 * i),
      vy: (i % 3 ? -1 : 1) * (0.3 + 0.09 * i),
      phase: i * 1.7,
    }))

    const draw = () => {
      els.current.forEach((el, i) => {
        const b = blobs.current[i]
        if (el && b)
          el.style.transform = `translate3d(${b.x - BLOBS[i].size / 2}px, ${
            b.y - BLOBS[i].size / 2
          }px, 0)`
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

        // flee the cursor
        const dx = b.x - mx
        const dy = b.y - my
        const d2 = dx * dx + dy * dy
        if (d2 < REPEL_RADIUS * REPEL_RADIUS) {
          const d = Math.sqrt(d2) || 1
          const f = 1 - d / REPEL_RADIUS
          b.vx += (dx / d) * f * 0.9
          b.vy += (dy / d) * f * 0.9
        }

        b.vx *= 0.96
        b.vy *= 0.96
        // gentle wander so they never settle
        b.vx += Math.cos(b.phase) * 0.03
        b.vy += Math.sin(b.phase) * 0.03
        b.phase += 0.01

        const sp = Math.hypot(b.vx, b.vy)
        if (sp > 1.8) {
          b.vx *= 1.8 / sp
          b.vy *= 1.8 / sp
        }
        // soft-bounce back if it drifts past the edges
        if (b.x < -120) b.vx += 0.3
        if (b.x > w + 120) b.vx -= 0.3
        if (b.y < -120) b.vy += 0.3
        if (b.y > h + 120) b.vy -= 0.3
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
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{
        pointerEvents: 'none',
        background:
          'radial-gradient(circle at 50% 25%, #241a2e 0%, #150d1c 55%, #0c0711 100%)',
      }}
    >
      <div className="absolute inset-0" style={{ filter: 'blur(60px)' }}>
        {BLOBS.map((b, i) => (
          <div
            key={i}
            ref={(el) => {
              els.current[i] = el
            }}
            className="absolute top-0 left-0 rounded-full"
            style={{
              width: b.size,
              height: b.size,
              // initial spread before JS takes over (vw/vh so no corner-clump)
              transform: `translate(calc(${b.x}vw - ${b.size / 2}px), calc(${b.y}vh - ${b.size / 2}px))`,
              background: `radial-gradient(circle at 50% 50%, ${b.color} 0%, transparent 68%)`,
              mixBlendMode: 'screen',
              opacity: 0.8,
              willChange: 'transform',
            }}
          />
        ))}
      </div>
    </div>
  )
}
