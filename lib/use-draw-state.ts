'use client'

import { useEffect, useState } from 'react'
import { defaultState, type State } from './lucky-draw'

const KEY = 'nas-spin-the-wheel'

// State lives in localStorage on the operator's device. Single-kiosk by design;
// swap this for a backend if two devices ever need to share live state.
export function useDrawState() {
  const [state, setState] = useState<State>(defaultState)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>
        const base = defaultState()
        const next: State = {
          ...base,
          ...parsed,
          items: { ...base.items, ...(parsed.items ?? {}) },
        }
        next.items.wildcard.qty = Infinity // never persisted correctly (JSON drops it)
        setState(next)
      }
    } catch {
      // corrupt storage -> fall back to defaults
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(state))
  }, [state, loaded])

  return { state, setState, loaded }
}
