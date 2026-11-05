# G Track roadmap

A free location-sharing app for a circle of friends. Android first.

`[x]` done · `[ ]` to do

## Done

### Phases 1–8: the core app

- [x] **Phase 1:** database, access rules and tests
- [x] **Phase 2:** Google sign-in
- [x] **Phase 3:** groups of up to 10, invite links and codes, admin-only invite, remove and delete
- [x] **Phase 4:** background location every 5 minutes, even after a restart
- [x] **Phase 5:** live map with friends' positions
- [x] **Phase 6:** 7-day history with places, trips and distance
- [x] **Phase 7:** pause switch, account deletion after a 7-day wait (signing in again cancels it)
- [x] **Phase 8:** signed APK, install guide and privacy page on the website

### Features added since

- [x] Light, dark and automatic theme; map styles
- [x] Admin sets how often location is checked and saved (1–30 min)
- [x] Plain sharing notification, can be hidden in Settings
- [x] Train and bus trips kept even when fixes are rough
- [x] Admin can delete a group after a 7-day wait (and cancel it)
- [x] Update notice, directions, "N km away", name editing, offline notice
- [x] Phone-maker battery steps (Vivo, Xiaomi, Oppo, Samsung, Huawei) with direct buttons
- [x] Shared pins when friends are at the same spot
- [x] Navigation bar buttons follow dark mode
- [x] Pause for 1 hour, 8 hours or until turned back on
- [x] Stop sharing with one group only
- [x] Today's distance on each person's card

### Security

- [x] Wrong join codes limited to 10 an hour per account
- [x] Android backup turned off, so the sign-in isn't copied to Google backups

### Releases

- [x] 1.0.0
- [x] 1.0.1
- [x] 1.0.2

## Next

- [ ] **Release 1.0.3:** dark-mode buttons, new pause options, group switch, today's distance, backup fix
- [ ] Real-world tests:
  - [ ] a train or bus ride
  - [ ] a full day's battery use
  - [ ] a full night recorded on the Vivo, with every setting fixed
  - [ ] a friend's phone of another brand
- [ ] Back up the signing key (`~/.gtrack/gtrack-release.jks`) somewhere safe

## Upcoming features

These need the server to send alerts to phones (Google's free notification service).

- [ ] **Arrival alerts:** save places like Home or College and get "your friend reached Home"
- [ ] **SOS button:** one tap sends your location and an alert to the whole group
- [ ] **Ask for a fresh location:** get a friend's position right now, not up to 5 minutes old

## Later

- [ ] App icon
- [ ] iPhone version
