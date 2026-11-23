import assert from "node:assert/strict";
import { test } from "node:test";

// A typo in src/online/config.js (e.g. a missing { or }) breaks the whole app's build, so check it
// here first, where the error message is clear.
test("the online play config is valid: null (not set up) or a complete Firebase config", async () => {
  const { FIREBASE_CONFIG, APP_CHECK_SITE_KEY, APP_CHECK_PROVIDER } = await import("../../src/online/config.js");
  if (FIREBASE_CONFIG !== null) {
    assert.equal(typeof FIREBASE_CONFIG, "object", "FIREBASE_CONFIG must be { … } (with the braces) or null");
    for (const key of ["apiKey", "authDomain", "databaseURL", "projectId", "appId"]) {
      assert.equal(typeof FIREBASE_CONFIG[key], "string", `FIREBASE_CONFIG needs ${key}`);
    }
    assert.match(FIREBASE_CONFIG.databaseURL, /^https:\/\/.+\.(firebaseio\.com|firebasedatabase\.app)\/?$/, "databaseURL should be the Realtime Database's address");
  }
  assert.ok(APP_CHECK_SITE_KEY === null || /^6L[\w-]{20,}$/.test(APP_CHECK_SITE_KEY), "APP_CHECK_SITE_KEY is null or a reCAPTCHA key starting with 6L");
  assert.ok(["enterprise", "v3"].includes(APP_CHECK_PROVIDER));
});
