// The Firebase web app's settings for online play. Paste them from the Firebase console:
// Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config.
// See docs/firebase-setup.md. These values are meant to be public (they name the project, they
// don't grant access); the database's security rules (database.rules.json) protect the data.
// While this is null, the Play online page says online play isn't set up yet.
export const FIREBASE_CONFIG = null;

// App Check: proves requests come from the real Bible Trivia app, not a script that copied the
// settings above. Paste the reCAPTCHA site key here (docs/firebase-setup.md, "App Check").
// It's public too. While this is null, App Check is off.
export const APP_CHECK_SITE_KEY = null;
// "enterprise" for a reCAPTCHA Enterprise key, or "v3" for a classic reCAPTCHA v3 key.
export const APP_CHECK_PROVIDER = "enterprise";
