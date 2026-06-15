// ─────────────────────────────────────────────────────────────────────────────
// Firebase configuration for SuperArc Dex
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO SETUP (one-time, 2 minutes):
//
// 1. Go to https://console.firebase.google.com
// 2. Click "Add Project" → name it "superarc-dex" → Continue (no analytics needed)
// 3. Click "Build" → "Realtime Database" → "Create database"
//    → Start in TEST mode → Choose region → Done
// 4. Click the gear icon (⚙) → "Project Settings" → scroll to "Your apps"
// 5. Click the </> (web) icon → Register app → copy the firebaseConfig object
// 6. Paste the values from YOUR config below, replacing the placeholders
// ─────────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  authDomain:        "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "PASTE_YOUR_DATABASE_URL_HERE",   // e.g. https://superarc-dex-default-rtdb.firebaseio.com
  projectId:        "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket:    "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID_HERE",
  appId:             "PASTE_YOUR_APP_ID_HERE",
};

// Set to true once you have filled in the values above
export const FIREBASE_ENABLED = false;
