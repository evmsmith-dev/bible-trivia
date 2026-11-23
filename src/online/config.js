// The Firebase web app's settings for online play. Paste them from the Firebase console:
// Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config.
// See docs/firebase-setup.md. These values are meant to be public (they name the project, they
// don't grant access); the database's security rules (database.rules.json) protect the data.
// While this is null, the Play online page says online play isn't set up yet.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB_SeFJrwGAJVNuuLxwNTZ9FgYzwKIiOzU",
  authDomain: "bible-trivia-192dc.firebaseapp.com",
  databaseURL: "https://bible-trivia-192dc-default-rtdb.firebaseio.com",
  projectId: "bible-trivia-192dc",
  storageBucket: "bible-trivia-192dc.firebasestorage.app",
  messagingSenderId: "505790291792",
  appId: "1:505790291792:web:83ea5443e3e77a83bb9655",
  measurementId: "G-N80JKBCYSN",
};

// App Check: proves requests come from the real Bible Trivia app, not a script that copied the
// settings above. Paste the reCAPTCHA site key here (docs/firebase-setup.md, "App Check").
// It's public too. While this is null, App Check is off.
export const APP_CHECK_SITE_KEY = "6Ldn3C0uAAAAAIYXLMrI_5bvv5lGfVnG82tTqZy_";
// "enterprise" for a reCAPTCHA Enterprise key, or "v3" for a classic reCAPTCHA v3 key.
export const APP_CHECK_PROVIDER = "enterprise";
