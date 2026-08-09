'use client'

import { useState } from 'react'
import { Settings, X } from 'lucide-react'
import { useDrawState } from '@/lib/use-draw-state'
import { applyDraw, type ItemKey } from '@/lib/lucky-draw'
import { Wheel } from '@/components/wheel'
import { Control } from '@/components/control'
import { BlobBackground } from '@/components/blob-background'

export default function Page() {
  const { state, setState, loaded } = useDrawState()
  const [showControl, setShowControl] = useState(false)

  // Optional rehearsal clock: preview how the pace behaves at a given date/time
  // before the real event. null => use the real clock.
  const [previewNow, setPreviewNow] = useState<number | null>(null)
  const getNow = () => previewNow ?? Date.now()

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#150d1c]">
        <BlobBackground />
        <p className="text-warm-ivory/70">Loading…</p>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen bg-[#150d1c]">
      <BlobBackground />

      {/* hidden control, revealed by the corner gear */}
      <button
        onClick={() => setShowControl(true)}
        aria-label="Open controls"
        className="text-warm-ivory/80 absolute top-4 right-4 z-30 flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur transition-colors hover:bg-white/20"
      >
        <Settings className="size-5" />
      </button>

      <header className="mx-auto flex max-w-5xl flex-col items-center px-4 pt-10 pb-2">
        <h1 className="font-heading text-warm-ivory text-4xl font-bold drop-shadow">
          Spin the Wheel
        </h1>
      </header>

      <section className="mx-auto max-w-5xl px-4 pt-4 pb-16">
        <Wheel
          state={state}
          getNow={getNow}
          onResult={(w: ItemKey) => setState((s) => applyDraw(s, w, getNow()))}
        />
      </section>

      {showControl && (
        <div className="bg-hero fixed inset-0 z-40 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-heading text-primary text-2xl font-bold">
                Controls
              </h2>
              <button
                onClick={() => setShowControl(false)}
                aria-label="Close controls"
                className="text-muted-foreground hover:text-foreground flex size-10 items-center justify-center rounded-full border bg-white/60"
              >
                <X className="size-5" />
              </button>
            </div>
            <PreviewClock value={previewNow} onChange={setPreviewNow} />
            <Control state={state} setState={setState} getNow={getNow} />
          </div>
        </div>
      )}
    </main>
  )
}

function PreviewClock({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  const toInput = (ms: number) => {
    const d = new Date(ms)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
      d.getHours(),
    )}:${p(d.getMinutes())}`
  }
  return (
    <div className="mb-6 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-dashed p-3 text-sm">
      <span className="text-muted-foreground">Rehearsal clock:</span>
      {value === null ? (
        <button
          onClick={() => onChange(new Date(2026, 7, 12, 13, 0).getTime())}
          className="text-primary underline"
        >
          simulate a time
        </button>
      ) : (
        <>
          <input
            type="datetime-local"
            value={toInput(value)}
            onChange={(e) => onChange(new Date(e.target.value).getTime())}
            className="bg-background rounded-lg border px-2 py-1"
          />
          <button
            onClick={() => onChange(null)}
            className="text-muted-foreground underline"
          >
            back to live clock
          </button>
        </>
      )}
    </div>
  )
}
