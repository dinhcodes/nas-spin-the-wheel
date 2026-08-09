// Thin wrapper over Firebase Realtime Database: one shared `draw/state` node is
// the single source of truth. No-ops cleanly when sync isn't configured.
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, type DatabaseReference } from 'firebase/database'
import { firebaseConfig, SYNC_ENABLED } from './firebase-config'
import type { State } from './lucky-draw'

let stateRef: DatabaseReference | null = null
if (SYNC_ENABLED) {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  stateRef = ref(getDatabase(app), 'draw/state')
}

export { SYNC_ENABLED }

// Subscribe to remote changes. Returns an unsubscribe fn.
export function subscribeState(cb: (s: State | null) => void): () => void {
  if (!stateRef) return () => {}
  return onValue(stateRef, (snap) => cb(snap.val() as State | null))
}

// Write the shared state. Realtime DB rejects Infinity, so the wildcard's
// sentinel qty is stripped to 0 (it's never read for the wildcard anyway).
export function pushState(s: State): void {
  if (!stateRef) return
  const safe: State = {
    ...s,
    items: {
      ...s.items,
      wildcard: { ...s.items.wildcard, qty: 0 },
    },
  }
  void set(stateRef, safe)
}
