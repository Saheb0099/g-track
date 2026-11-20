# Lessons: ideas that went wrong

Things we tried that broke because the logic was wrong, so they aren't tried again. Read this
before changing how locations are judged or saved (`src/features/location/rules.ts`,
`tracking.ts`). Each entry: what we did, what went wrong, the rule to keep.

## 1. Holding on to the last GPS spot indoors (removed, Nov 2026)

**Idea:** after a precise GPS fix, move later rough readings (mobile towers, ±200 m) onto that
GPS spot while they roughly fit, for up to 6 hours. The pin would stay put indoors instead of
drifting with the towers.

**What went wrong:** indoors, GPS sometimes reports a confident reading (±6 m) that is hundreds of
metres off. The rule took that glitch as the GPS spot, and every honest reading after it was moved
onto it. The pin sat in the wrong place for over 15 minutes, showing "±6 m", and would have stayed
for hours. Before the rule, the next reading would have corrected it within a minute.

**Rules to keep:**

- Never let one reading override many later ones. A single fix, however precise it claims to be,
  can be a glitch; indoors the "precise" ones are the most suspicious.
- Don't replace a measured position with a remembered one. Showing what was actually measured,
  with its honest accuracy, is better than a confident guess.
- Anything that keeps an old position must give up quickly when newer readings disagree, not after
  hours.

There's a test for exactly this: "A confident GPS glitch indoors does not stick".

## 2. Replacing the waiting reading with every new one (fixed, Nov 2026)

**Bug:** a reading that needs confirming waits until a second reading at least 2 minutes later
agrees. But each new unconfirmed reading replaced the waiting one, and readings come every minute,
so the gap never reached 2 minutes. Indoors after a pause, nothing was saved at all ("Last seen 9
days ago").

**Rule to keep:** when a check needs time between two readings, keep the first one while later
ones agree (`nextHeld`). Check the timing against how often readings really arrive.

## 3. Trusting only precise first readings (fixed, Nov 2026)

**Bug:** after a gap, a first reading had to be ±50 m, or be confirmed by one of ±100 m. Indoors
with Wi-Fi off a phone may only ever get ±200 m, so it never qualified.

**Rule to keep:** test every rule with the worst phone conditions too: indoors, Wi-Fi off, no
GPS, readings that are all ±200 m. Two rough readings on the same spot minutes apart are good
enough to start from.

## 4. Readings in pairs counted as agreement (fixed, Nov 2026)

**Bug:** a rough jump counts as a move only once a second reading agrees. Phones often send
readings in pairs seconds apart, so every jump "agreed" with itself.

**Rule to keep:** "a second reading agrees" must mean a reading from a different moment (45 s or
more apart), not a near-copy.

## 5. Guessing the cause from how often points were saved (Nov 2026)

**Mistake:** points were being saved every minute, and we concluded the position was hopping
between towers. It wasn't: the group's admin had set "save every 1 minute", and every point was
0 m from the last. A fix was built for the wrong cause.

**Rules to keep:**

- Look at the evidence before concluding: the phone's log (distances between saved points, the
  reasons logged) and the timing the phone follows (`schedule` in the tracker state).
- Read it with `adb exec-out run-as com.sahebbeshra.gtrack cat files/SQLite/tracker.db` (copy the
  `-wal` file too, or recent changes are missing).
- Check the screen with screenshots, not `uiautomator dump`: on a screen that changes every second
  (a countdown) the dump quietly fails and the old file is read again. That once made a working
  countdown look broken.

## 6. Fixed timers that assumed readings every minute (fixed, Nov 2026)

**Bug:** trust windows were fixed lengths (a trip trusted for 10 minutes, a good reading for 30)
chosen when readings came every minute. A group admin can set checks every 1 to 30 minutes; at 30,
readings arrive just over 30 minutes apart, every window had expired by the next reading, and
indoor readings were dropped.

**Rule to keep:** any time limit between readings must be checked against the slowest setting
(30 minutes, plus Android's delays). Scale it with the interval (`trustFor`), and test with
readings every 15 and 30 minutes, not only every minute.

## Before changing location rules

1. Add a test to `scripts/test-rules.mjs` that fails on the current code for the problem you're
   fixing, and check it really fails.
2. Make sure the old tests still pass: trains and buses with rough readings, glitches, clock
   changes, indoors with only ±200 m readings, and readings every 15 and 30 minutes.
3. Try it on a phone and read its log before calling it done.
