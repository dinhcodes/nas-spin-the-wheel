// Paste your Firebase web-app config here (Firebase console →
// Project settings → General → "Your apps" → SDK setup and configuration).
//
// This is a CLIENT config and is meant to be public — security is enforced by
// the Realtime Database rules, not by hiding these values. See FIREBASE_SETUP.md.
//
// Until `databaseURL` is filled in, the app runs in localStorage-only mode
// (no cloud sync), so nothing breaks before you set Firebase up.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  databaseURL: '', // e.g. https://nas-wheel-default-rtdb.asia-southeast1.firebasedatabase.app
  projectId: '',
  appId: '',
}

export const SYNC_ENABLED = firebaseConfig.databaseURL.trim().length > 0
