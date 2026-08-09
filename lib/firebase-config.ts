// Firebase web-app config (client-side, safe to commit — security is via the
// Realtime Database rules, not by hiding these). See FIREBASE_SETUP.md.
//
// NOTE: `databaseURL` is still blank. It only exists once you create the
// Realtime Database (Build → Realtime Database → Create). Grab the URL shown at
// the top of that page (ends in .firebasedatabase.app or .firebaseio.com) and
// paste it below — that's what turns cloud sync on.
export const firebaseConfig = {
  apiKey: 'AIzaSyAIv0Lh3jE7gOxRQu5zMt-eYkmhtvXs5xw',
  authDomain: 'nas-wheel.firebaseapp.com',
  databaseURL: 'https://nas-wheel-default-rtdb.asia-southeast1.firebasedatabase.app/',
  projectId: 'nas-wheel',
  storageBucket: 'nas-wheel.firebasestorage.app',
  messagingSenderId: '53339411018',
  appId: '1:53339411018:web:db2ae050d23bc551e1ccb3',
}

export const SYNC_ENABLED = firebaseConfig.databaseURL.trim().length > 0
