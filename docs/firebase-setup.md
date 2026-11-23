# Setting up Firebase for online play

Play online needs its own free Firebase project, separate from Chess Quest's. Setup takes about
15 minutes and needs no payment card. The free **Spark** plan allows 100 connections at once,
which is about 12 full games of 8 players.

Until it's done, the app works as before, and **👥 Online** says online play isn't set up yet.

## 1. Create the project

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project** (or **Add project**). Name it `bible-trivia`. Firebase adds a
   few letters to make the ID unique, for example `bible-trivia-4f2a1`.
3. When it asks about **Google Analytics**, turn it **off**. The app doesn't use analytics, and
   leaving it off keeps children's data out of tracking.
4. Click **Create project**, then **Continue**.

Firebase moves its menus around from time to time. If you can't find something below, type its
name in the search box at the top of the console, or open **All products** at the bottom of the
left menu. On a phone, the menu is behind the ☰ button.

## 2. Turn on anonymous sign-in

1. In the left menu: **Security → Authentication → Get started**.
2. On the **Sign-in method** tab, choose **Anonymous**, switch it on, and click **Save**.

Players never see a sign-in screen. The app gets a random player number in the background, and
the same number comes back on the same device, so a player can rejoin a game.

## 3. Create the database

1. Open **Realtime Database** and click **Create database**. Make sure it's *Realtime
   Database*, not *Firestore*.
2. Pick the location nearest your players (for the US: `us-central1`), then **Next**.
3. Choose **Start in locked mode** and click **Enable**.
4. Open the **Rules** tab and delete everything there. Paste the whole contents of
   [`database.rules.json`](../database.rules.json) from this repo, and click **Publish**.

The rules let players change only their own seat, presence, answers and reactions. Each player
can hold only one seat in a game, and can create at most one new game every 10 seconds. Only the host
can change the settings and move the game on. Answers are accepted once, only while the question
is open, and stamped with the server's clock. Anyone may delete a game once it's more than a day
old. Without these rules, the database refuses everything.

## 4. Register the web app and copy its settings

1. Click the gear ⚙️ next to **Project overview**, then **Project settings**.
2. Under **Your apps**, click the web icon **</>**.
3. Give it a nickname (`Bible Trivia`). Leave **Firebase Hosting** unticked, and click
   **Register app**.
4. Firebase shows a `firebaseConfig = { … }` block. It must include a `databaseURL` line. It
   will, if you created the database in step 3 first. Copy the whole block.
5. Put it in [`src/online/config.js`](../src/online/config.js) as
   `export const FIREBASE_CONFIG = { … };` in place of `null`. Or paste it to Claude and ask it
   to do this.

These values are safe to publish: they only name the project. The database rules are what
protect it.

## 5. Allow your site's address

1. Go to **Security → Authentication → Settings → Authorized domains → Add domain**.
2. Add `evmsmith-dev.github.io`.

Push the change from step 4. Once GitHub Pages has deployed it, **👥 Online** works. To try it,
open the game on two devices (or two browser windows), create a game on one, and join with the
code on the other.

## 6. App Check (recommended)

App Check makes Firebase accept requests only from the real Bible Trivia app, not from scripts
that copied the settings above. Players never see it: reCAPTCHA checks quietly in the background
and never shows a puzzle.

**Order matters:** turn on *enforcement* last. If you enforce before the app sends App Check
tokens, online play stops working.

1. **Make a reCAPTCHA key.**
   1. Open <https://console.cloud.google.com/security/recaptcha> and pick the same project at
      the top (`bible-trivia-…`). If asked, enable the reCAPTCHA Enterprise API.
   2. Click **Create key**. Choose type *Website*, name it `Bible Trivia`, and enter the domain
      `evmsmith-dev.github.io`. Leave **Use checkbox challenge** off.
   3. Create it and copy the **key ID**, a long string starting with `6L`.
2. **Register the app with App Check.** In the Firebase console, go to **Security → App Check →
   Apps**. Choose the web app, pick **reCAPTCHA Enterprise**, paste the key ID, and save. Leave
   the threshold at 0.5.
3. **Put the key in the app.** In [`src/online/config.js`](../src/online/config.js), set
   `export const APP_CHECK_SITE_KEY = "6L…";` (or paste it to Claude). Push, and wait for the
   deploy.
4. **Check it's working.** Play an online game. A few hours later, look at **App Check → APIs →
   Realtime Database**. The chart should show almost all requests as **Verified**.
5. **Enforce.** On that same page, click **Enforce** for **Realtime Database**. From then on,
   requests without a valid App Check token are refused.

reCAPTCHA Enterprise has a free monthly allowance that's far more than a trivia game needs. The
Google Cloud console may insist on a billing account before it creates the key. If so, use classic
**reCAPTCHA v3** instead, which never needs one:

- Create a v3 key at <https://www.google.com/recaptcha/admin/create>, with the domain
  `evmsmith-dev.github.io`.
- In step 2, choose **reCAPTCHA** (not Enterprise) and paste the **secret key**.
- In step 3, set `APP_CHECK_SITE_KEY` to the **site key** and `APP_CHECK_PROVIDER = "v3"`.

Players who installed an older version get App Check the next time they tap **Update**. Enforce
only after most of them have done that (give it a few days). Until then, they'll see "Couldn't
connect".

## Optional: clean up old player numbers

Under **Authentication → Sign-in method → Anonymous** you can turn on **automatic clean-up**,
which deletes anonymous player numbers 30 days after they were made. It needs the free upgrade to
*Firebase Authentication with Identity Platform*. Skip it if the console asks for a payment card.

The app handles the clean-up by itself. The 30 days count from when an account was made, so even
active players get a new player number about once a month. When a device's saved account is gone,
the app quietly signs in again. If that happens in the middle of a game, the player takes a new
seat (starting from 0 points that round). Games only last a day, so nothing else is lost.

## Good to know

- **Cost:** the Spark plan never bills. When its 100 connections are all in use, more players see
  "Couldn't connect" until someone leaves.
- **Clean-up:** games are deleted a day after they're created. The app tidies old ones whenever
  someone opens a game.
- **Changing the rules later:** whenever an update says `database.rules.json` changed, paste it
  into the **Rules** tab again. If you've installed the Firebase CLI, `firebase deploy --only
  database` does the same (it reads `firebase.json`).
- **Testing the rules:** `npm run test:rules` checks them in the Firebase emulator (it needs Java).
  GitHub Actions runs it on every push.
- **Trust:** answers are stamped with the server's clock, and every device works out the scores
  from the stored answers, so nobody can fake a time or a score. The questions and answers do
  ship inside the app, though, so a tampered app could always know the right answer. That's fine
  for family and church games, but not for prizes.
- **App versions:** every device must have the same question bank. If someone's app is older or
  newer than the host's, they're asked to update before they can join.
