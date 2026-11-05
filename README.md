# G Track

A free location-sharing app for a circle of friends. Android first.

- Live map of everyone in your group, plus a 7-day history of places and trips
- Location every few minutes, even with the app closed or after a restart
- Groups of up to 10; only the admin invites, removes and deletes
- Pause for a set time, or stop sharing with one group only
- Google sign-in, OpenStreetMap maps, no ads

There's no ready-made app to download: you set up your own copy with the guide below. Everything
it uses has a free plan. See [ROADMAP.md](ROADMAP.md) for what's done and what's next.

## Tech stack

- Expo (React Native) with Expo Router, TypeScript and TanStack Query
- Supabase: Postgres with row-level security, Realtime, scheduled jobs (pg_cron)
- Google sign-in
- MapLibre with OpenFreeMap and OpenStreetMap tiles
- A small native Android module (`modules/gtrack-alarm`) for exact 5-minute wake-ups

---

## Setup guide

About an hour the first time. You'll make three free accounts (Supabase, Google Cloud, and
GitHub if you don't have it), build the app on your computer and install it on your phone by
cable.

### 1. What you need

- A computer (macOS, Windows or Linux)
- An Android phone, Android 7 or newer, and a USB cable
- **Node.js 20 or newer:** <https://nodejs.org>
- **Android Studio:** <https://developer.android.com/studio>. Open it once and let it install
  the Android SDK. It also brings the Java version the build needs.
- Tell your terminal where the SDK is (add to `~/.zshrc` or `~/.bashrc`, then open a new
  terminal). On macOS:

  ```bash
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_HOME/platform-tools:$PATH"
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  export PATH="$JAVA_HOME/bin:$PATH"
  ```

  On Windows the SDK is usually in `%LOCALAPPDATA%\Android\Sdk`; on Linux, `~/Android/Sdk`.

### 2. Get the code

```bash
git clone https://github.com/<you>/g-track.git
cd g-track
npm install
```

`npm install` also applies a small fix to `expo-location` (in `patches/`).

**Give the app your own ID.** In `app.json`, change `"package": "com.sahebbeshra.gtrack"` to
something unique to you, like `com.yourname.gtrack`. Google ties sign-in to this ID, and two
people can't register the same one.

### 3. Supabase (database and sign-in)

1. Make a free account at <https://supabase.com> and create a **new project**. Pick any name
   and a strong database password (save it in a password manager).
2. When it's ready, click **Connect** at the top of the project (or open **Project Settings →
   API Keys**) and note:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **publishable key** (starts with `sb_publishable_`). Never use the secret key in the app.
3. In your terminal, from the `g-track` folder, connect the project and create the database:

   ```bash
   npx supabase login
   npx supabase link
   npx supabase db push --remote
   ```

   `link` asks you to pick the project and for the database password. `db push` creates the
   tables, access rules, functions and hourly cleanup jobs from `supabase/migrations`.

### 4. Google sign-in

All of this is in the Google Cloud console: <https://console.cloud.google.com>.

**a. Project and consent screen**

1. Click the project picker at the top, then **New Project**. Name it `G Track`, create it,
   and make sure it's selected.
2. Search for **Google Auth Platform** in the top bar and click **Get started**.
3. App name `G Track`, your email as support and contact email, audience **External**. Agree
   and create.
4. Who can sign in:
   - **Easiest:** stay in _Testing_ and add each friend's Gmail under **Audience → Test users**
     (up to 100 people).
   - **Anyone:** on **Branding**, add a home page and a privacy policy link (a free GitHub
     Pages site works), then **Audience → Publish app**. The app only asks for name, email and
     photo, so Google doesn't review it.

**b. Find your app's SHA-1 fingerprint**

Google checks that sign-ins come from your build. Debug builds are signed with a debug key
that Expo puts in the generated `android` folder. Create that folder, then print the key's
fingerprint:

```bash
npx expo prebuild --platform android
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android | grep SHA1
```

**c. Android client**

1. Go to **Clients → Create client**, type **Android**.
2. Name `G Track Android (debug)`, package name = the one you set in `app.json`, SHA-1 = the
   fingerprint from step b. Create. Nothing to copy from it.

**d. Web client**

1. **Create client** again, type **Web application**, name `G Track Web (Supabase)`. Leave the
   URIs empty and create.
2. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) and the **Client secret**.

**e. Turn on Google in Supabase**

In Supabase: **Authentication → Sign In / Providers → Google**.

- Turn it on.
- **Client IDs:** paste the Web client ID.
- **Client Secret:** paste the secret.
- Leave **Skip nonce check** off and save.

### 5. Settings file

Copy the example and fill in the three values from steps 3 and 4d:

```bash
cp .env.example .env.local
```

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
```

`.env.local` is ignored by git. These values end up inside the app anyway (they're meant to
be public); the database's access rules are what keep data private.

### 6. Build and install on your phone

1. On the phone, turn on **Developer options** (Settings → About phone → tap _Build number_
   7 times), then turn on **USB debugging**.
2. Connect the cable and accept the prompt on the phone. Check it shows up:

   ```bash
   adb devices
   ```

3. Build and install (the first build takes several minutes):

   ```bash
   npx expo run:android
   ```

4. Sign in with Google, then open **Set up location sharing** and allow everything it asks,
   including location **Allow all the time**. Keep scrolling: it lists your phone maker's
   battery settings with buttons to open each one. Do them all, or the phone may stop G Track
   at night.

**Day to day:** after the first build, start the dev server with `npx expo start --dev-client`
and code changes reload on the phone by themselves. Only changes to native code or `app.json`
need `npx expo run:android` again.

> The dev build loads its code from your computer, so it stops sharing when the phone is away
> from it or after a restart. For everyday use, install a release build (next step).

### 7. A release build for everyday use (and for friends)

A release build carries its own code, works anywhere, and survives restarts.

1. Make your own signing key, once, and keep it somewhere safe **outside** the project. Back
   it up: an update can only be installed over a copy signed with the same key.

   ```bash
   mkdir -p ~/.gtrack
   keytool -genkeypair -v -keystore ~/.gtrack/gtrack-release.jks -alias gtrack -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Tell Gradle where it is, in `~/.gradle/gradle.properties` (not in the project):

   ```properties
   GTRACK_UPLOAD_STORE_FILE=/Users/you/.gtrack/gtrack-release.jks
   GTRACK_UPLOAD_KEY_ALIAS=gtrack
   GTRACK_UPLOAD_STORE_PASSWORD=your-store-password
   GTRACK_UPLOAD_KEY_PASSWORD=your-key-password
   ```

3. This key has its own fingerprint. Print it and add a **second Android client** in Google
   Cloud with it (same package name), or Google sign-in will fail on the release build:

   ```bash
   keytool -list -v -keystore ~/.gtrack/gtrack-release.jks -alias gtrack | grep SHA1
   ```

   Once the key is set up, dev builds are signed with it too, so the two can be installed
   over each other.

4. Build:

   ```bash
   npx expo prebuild --platform android
   cd android && ./gradlew assembleRelease
   ```

   The app is at `android/app/build/outputs/apk/release/app-release.apk`. Install it with
   `adb install -r` or send the file to friends (they'll need to allow installing from that
   source). Friends sign in with Google, so add them as test users if you stayed in Testing.

**Shipping an update:** raise `expo.version` and `expo.android.versionCode` in `app.json`,
build again, and add a migration that sets the new number, so older copies show an
"update available" notice:

```sql
update public.app_config set latest_version_code = 4, latest_version_name = '1.0.3', updated_at = now();
```

Then `npx supabase db push --remote`.

### 8. Good to know

- **Free Supabase projects pause after about a week with no activity.** Phones sharing
  location keep it awake; if it does pause, restore it from the Supabase dashboard.
- **History is kept for 7 days**, then deleted automatically. Deleting an account or a group
  waits 7 days too, and can be cancelled until then.
- **Map tiles** come from free public servers (OpenFreeMap, OpenStreetMap). Fine for a group
  of friends; don't build something large on them.

## Checks

```bash
npm run typecheck
npm run lint
npm run test:rules   # location rules: trips, glitches, clock changes
npm run test:db      # database access rules, run on the linked project and rolled back
```

After changing the database, refresh the TypeScript types with `npm run gen:types`.

## Troubleshooting

- **"Google rejected this app build":** the package name or SHA-1 in your Android client
  doesn't match the build. Debug and release builds need one client each.
- **Sign-in works for you but not a friend:** the consent screen is in Testing and their
  Gmail isn't a test user.
- **`adb: command not found` or no device:** check `ANDROID_HOME` and `PATH` (step 1), the
  cable, and that you accepted the USB debugging prompt.
- **Gaps in the history overnight:** a phone-maker battery setting is still on. Open
  **Settings → Permissions and battery** in the app and finish every step.

## License

MIT. See [LICENSE](LICENSE).
