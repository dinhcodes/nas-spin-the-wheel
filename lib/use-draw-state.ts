'use client'

import { useEffect, useRef, useState } from 'react'
import { defaultState, type State } from './lucky-draw'
import { SYNC_ENABLED, subscribeState, pushState } from './firebase'

const KEY = 'nas-spin-the-wheel'

// Merge a stored/remote snapshot onto fresh defaults: restore the wildcard's
// Infinity sentinel and always take the code-owned event schedule + labels.
function normalize(parsed: Partial<State>): State {
  const base = defaultState()
  const next: State = {
    ...base,
    ...parsed,
    items: { ...base.items, ...(parsed.items ?? {}) },
  }
  next.items.wildcard.qty = Infinity
  next.eventDays = base.eventDays
  next.startHour = base.startHour
  next.endHour = base.endHour
  return next
}

// Single source of truth: when Firebase is configured, the shared `draw/state`
// node syncs across every device in real time, with localStorage as an offline
// cache. Without config, it falls back to localStorage-only.
export function useDrawState() {
  const [state, setState] = useState<State>(defaultState)
  const [loaded, setLoaded] = useState(false)
  // The exact object last applied FROM remote. We only push when `state` is a
  // different object than this — identity comparison is race-proof (unlike a
  // timing flag) even when a remote echo and a local edit batch together.
  const remoteObj = useRef<State | null>(null)
  // Don't push until the first remote snapshot arrives (avoids clobbering the
  // shared state with a stale local cache on startup).
  const ready = useRef(!SYNC_ENABLED)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setState(normalize(JSON.parse(raw)))
    } catch {
      // corrupt storage -> defaults
    }
    setLoaded(true)

    if (!SYNC_ENABLED) return
    const unsub = subscribeState((remote) => {
      ready.current = true
      if (remote) {
        const next = normalize(remote)
        remoteObj.current = next
        setState(next)
      } else {
        pushState(stateRef.current) // empty DB -> seed it
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(KEY, JSON.stringify(state))
    // Push only genuine local edits (state is a new object, not the remote one).
    if (SYNC_ENABLED && ready.current && state !== remoteObj.current) {
      pushState(state)
    }
  }, [state, loaded])

  return { state, setState, loaded }
}
