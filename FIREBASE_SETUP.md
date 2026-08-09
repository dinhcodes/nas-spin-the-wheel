# Cloud sync setup (Firebase Realtime Database)

This makes one shared live state across every device — hand the booth to another
laptop mid-event and stock/spins stay in sync. It's free (Firebase Spark plan)
and the site stays a static site; the browsers talk to Firebase directly, no
server to run.

Until you finish this, the app just runs in **localStorage-only** mode (per
device) — nothing breaks.

## One-time setup (~10 min, needs your Google login)

1. Go to <https://console.firebase.google.com> → **Add project** (name it e.g.
   `nas-wheel`). Skip Google Analytics. Create.
2. Left sidebar → **Build → Realtime Database** → **Create Database**.
   - Pick a location (e.g. Singapore `asia-southeast1`).
   - Start in **Test mode** (open read/write). Fine for the event — see
     "Locking it down" below.
3. Add a web app: **Project settings** (gear, top-left) → **General** → scroll to
   **Your apps** → click the **`</>`** (web) icon → register (any nickname).
   You'll see a `firebaseConfig = { ... }` block.
4. Copy those values into **`lib/firebase-config.ts`** — especially
   `databaseURL` (the one ending in `.firebasedatabase.app`). That URL is what
   turns sync on.
5. Rebuild + redeploy (see below). Done — open the site on two devices and watch
   a stock change on one appear on the other.

## Redeploy after adding the config

```powershell
$env:BASE_PATH='/nas-spin-the-wheel'; npm run build; Remove-Item Env:\BASE_PATH
cd out; git add -A; git commit -m "deploy"; git push -f <repo-url> gh-pages; cd ..
```

(Or just ask me and I'll run it.)

## How it behaves

- The shared state lives at `draw/state` in the database.
- Every device subscribes; any change (spin/redeem, stock edit, boost) writes the
  whole state and all devices update within a second.
- Last write wins. With one active operator (even across a handover) that's
  exactly right. If two people edit *simultaneously*, the later save wins — avoid
  editing stock on two devices at the same instant.
- Offline? It keeps working from the localStorage cache and re-syncs when back
  online.

## Locking it down (optional, after the event or for safety)

Test mode leaves the DB open to anyone with the URL. For an internal booth on an
obscure URL that's usually fine for the two days. To restrict, set Realtime
Database **Rules** to require a shared check, e.g. only allow your data shape, or
add Firebase Anonymous Auth and gate on `auth != null`. Ask me and I'll wire it.
