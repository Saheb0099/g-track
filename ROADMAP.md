# G Track roadmap

A free location-sharing app for a circle of friends. Android first.

`[x]` done · `[ ]` to do

## Done

### Phases 1–8: the core app

- [X] **Phase 1:** database, access rules and tests
- [X] **Phase 2:** Google sign-in
- [X] **Phase 3:** groups of up to 10, invite links and codes, admin-only invite, remove and delete
- [X] **Phase 4:** background location every 5 minutes, even after a restart
- [X] **Phase 5:** live map with friends' positions
- [X] **Phase 6:** 7-day history with places, trips and distance
- [X] **Phase 7:** pause switch, account deletion after a 7-day wait (signing in again cancels it)
- [X] **Phase 8:** signed APK, install guide and privacy page on the website

### Features added since

- [X] Light, dark and automatic theme; map styles
- [X] Admin sets how often location is checked and saved (1–30 min)
- [X] Plain sharing notification, can be hidden in Settings
- [X] Train and bus trips kept even when fixes are rough
- [X] Admin can delete a group after a 7-day wait (and cancel it)
- [X] Update notice, directions, "N km away", name editing, offline notice
- [X] Phone-maker battery steps (Vivo, Xiaomi, Oppo, Samsung, Huawei) with direct buttons
- [X] Shared pins when friends are at the same spot
- [X] Navigation bar buttons follow dark mode
- [X] Pause for 1 hour, 8 hours or until turned back on
- [X] Stop sharing with one group only
- [X] Today's distance on each person's card

### Security

- [X] Wrong join codes limited to 10 an hour per account
- [X] Android backup turned off, so the sign-in isn't copied to Google backups

### Releases

- [X] 1.0.0
- [X] 1.0.1
- [X] 1.0.2

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
