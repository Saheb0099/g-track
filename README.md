# G Track

A free location-sharing app for a circle of friends. Android first.

- Live map of everyone in your group, plus a 7-day history of places and trips
- Location every few minutes, even with the app closed or after a restart
- Groups of up to 10; only the admin invites, removes and deletes
- Pause for a set time, or stop sharing with one group only
- Google sign-in, OpenStreetMap maps, no ads

See [ROADMAP.md](ROADMAP.md) for what's done and what's next.

## Tech stack

- Expo (React Native) with Expo Router, TypeScript and TanStack Query
- Supabase: Postgres with row-level security, Realtime, scheduled jobs
- Google sign-in
- MapLibre with OpenFreeMap tiles
- A small native Android module (`modules/gtrack-alarm`) for exact 5-minute wake-ups

## Run it

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase and Google values.
3. Link your Supabase project and apply the database (migrations are in `supabase/migrations`):
   `npx supabase link`, then `npx supabase db push --remote`
4. Build the dev app on a connected Android phone: `npx expo run:android`
5. After that, `npx expo start --dev-client` reloads code changes live.

## Checks

```bash
npm run typecheck
npm run lint
npm run test:rules   # location rules (trips, glitches, clock changes)
npm run test:db      # database access rules, run against the linked project and rolled back
```

## Release builds

Release APKs are signed with a key kept outside the project. Its path and passwords go in
`~/.gradle/gradle.properties` as `GTRACK_UPLOAD_STORE_FILE`, `GTRACK_UPLOAD_KEY_ALIAS`,
`GTRACK_UPLOAD_STORE_PASSWORD` and `GTRACK_UPLOAD_KEY_PASSWORD` (see `plugins/with-release-signing.js`).

## License

All rights reserved. The code is public to read, not to copy or reuse.
