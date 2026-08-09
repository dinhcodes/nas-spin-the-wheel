'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useDrawState } from '@/lib/use-draw-state'
import { applyDraw, type ItemKey } from '@/lib/lucky-draw'
import { Wheel } from '@/components/wheel'
import { Control } from '@/components/control'
import { cn } from '@/lib/utils'

export default function Page() {
  const { state, setState, loaded } = useDrawState()
  const [tab, setTab] = useState<'draw' | 'control'>('draw')

  // Optional rehearsal clock: preview how the pace behaves at a given date/time
  // before the real event. null => use the real clock.
  const [previewNow, setPreviewNow] = useState<number | null>(null)
  const getNow = () => previewNow ?? Date.now()

  if (!loaded) {
    return (
      <main className="bg-hero flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    )
  }

  return (
    <main className="bg-hero min-h-screen">
      <header className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logo.png"
            alt="NAS"
            width={48}
            height={48}
            className="rounded-full"
          />
          <h1 className="font-heading text-primary text-3xl font-bold">
            Spin the Wheel
          </h1>
        </div>

        <div className="bg-card flex rounded-full border p-1">
          {(['draw', 'control'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-full px-6 py-2 text-sm font-semibold capitalize transition-colors',
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        {tab === 'draw' ? (
          <Wheel
            state={state}
            getNow={getNow}
            onResult={(w: ItemKey) =>
              setState((s) => applyDraw(s, w, getNow()))
            }
          />
        ) : (
          <>
            <PreviewClock value={previewNow} onChange={setPreviewNow} />
            <Control state={state} setState={setState} getNow={getNow} />
          </>
        )}
      </section>
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
    <div className="mx-auto mb-6 flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-dashed p-3 text-sm">
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
