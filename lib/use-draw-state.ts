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
  // true while applying a remote snapshot, so we don't echo it back to the DB.
  const applyingRemote = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    // instant paint from the local cache
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setState(normalize(JSON.parse(raw)))
    } catch {
      // corrupt storage -> defaults
    }
    setLoaded(true)

    if (!SYNC_ENABLED) return
    const unsub = subscribeState((remote) => {
      if (remote) {
        applyingRemote.current = true
        setState(normalize(remote))
      } else {
        // empty DB -> seed it with what this device currently has
        pushState(stateRef.current)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(KEY, JSON.stringify(state))
    if (SYNC_ENABLED) {
      if (applyingRemote.current) applyingRemote.current = false
      else pushState(state) // local edit -> broadcast
    }
  }, [state, loaded])

  return { state, setState, loaded }
}
