import * as BackgroundTask from 'expo-background-task';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import GtrackAlarm from '../../../modules/gtrack-alarm';

import { clearAll, enqueue, getState, logEvent, setState, type PendingPoint } from '@/features/location/queue';
import {
  DEFAULT_SCHEDULE,
  judgeFix,
  saveDueMs,
  scheduleFor,
  shouldSave,
  type Fix,
  type Schedule,
  type Verdict,
} from '@/features/location/rules';
import { reportStatus, type DeviceStatus } from '@/features/location/status';
import { flushQueue } from '@/features/location/upload';
import { supabase } from '@/lib/supabase';

export const LOCATION_TASK = 'gtrack-location';

// Saving on time must not depend on the location service alone: Google's fused provider
// stops producing fixes while the phone lies still, and phone makers sometimes kill the
// service. Two independent wake-ups therefore "check in" (see checkIn):
//  - an exact alarm every 5 minutes (native module modules/gtrack-alarm), which also resumes
//    after a reboot or app update, whatever timing the groups chose;
//  - a WorkManager job about every 15 minutes, as a backstop if alarms are ever withheld.
export const HEARTBEAT_TASK = 'gtrack-heartbeat';
const HEARTBEAT_MINUTES = 15;
const ALARM_EVERY_MS = 5 * 60_000;

// A reading every "check" interval at high accuracy: Android's fused provider uses GPS when it
// has a signal and falls back to Wi-Fi and cell towers when not (indoors). Accuracy over
// battery, as the user chose. The save rule then thins the readings out.
const UPDATE_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: DEFAULT_SCHEDULE.checkEveryMs,
  distanceInterval: 0,
  // Never wait on a "turn on location" dialog: there may be no screen to show it on.
  mayShowUserSettingsDialog: false,
  foregroundService: {
    notificationTitle: 'G Track is sharing your location',
    notificationBody: 'Friends in your groups can see where you are. You can pause in Settings.',
    notificationColor: '#1F6FEB',
    // Keep tracking when the app's screen is closed; only the system or a pause stops it.
    killServiceOnDestroy: false,
  },
};

/** A cached fix is used when a fresh one fails, if it's at most this old. */
const LAST_KNOWN_MAX_AGE_MS = 15 * 60_000;
/**
 * A fresh fix is tried best source first: GPS-quality, then Wi-Fi/cell. Each gets this long;
 * a GPS fix can take a while to arrive, a network fix is quick.
 */
const FRESH_FIX_ATTEMPTS: { accuracy: Location.Accuracy; timeoutMs: number; label: string }[] = [
  { accuracy: Location.Accuracy.High, timeoutMs: 18_000, label: 'gps' },
  { accuracy: Location.Accuracy.Balanced, timeoutMs: 8_000, label: 'network' },
];
/** A "current" fix older than this was really a cached one. */
const STALE_FIX_MS = 60_000;
/**
 * Readings normally arrive once per check. Silence this much longer means the service was
 * stopped (Android or the phone maker) or the provider paused, and the next check-in restarts it.
 */
const SERVICE_SILENT_GRACE_MS = 2 * 60_000;
// Time limits for each check-in step; together they stay under the 60 s the alarm's
// background task is allowed. Saving a point needs the most: both fresh-fix attempts (26 s)
// plus the cached fallback.
const POINT_STEP_MS = 32_000;
const START_STEP_MS = 10_000;
const UPLOAD_STEP_MS = 12_000;

export type Readiness = {
  foreground: boolean;
  background: boolean;
  servicesOn: boolean;
  tracking: boolean;
};

export async function getReadiness(): Promise<Readiness> {
  const [fg, bg, servicesOn, tracking] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
    Location.hasStartedLocationUpdatesAsync(LOCATION_TASK),
  ]);
  return { foreground: fg.granted, background: bg.granted, servicesOn, tracking };
}

function statusFor(readiness: Readiness): DeviceStatus {
  if (!readiness.foreground || !readiness.background) return 'permission_missing';
  if (!readiness.servicesOn) return 'location_off';
  return 'ok';
}

function updateOptions(schedule: Schedule): Location.LocationTaskOptions {
  return { ...UPDATE_OPTIONS, timeInterval: schedule.checkEveryMs };
}

/** The timing this phone follows, as last fetched from its groups. */
async function getSchedule(): Promise<Schedule> {
  return (await getState<Schedule>('schedule')) ?? DEFAULT_SCHEDULE;
}

/** Fetches your groups' timing and remembers it. Returns whether it changed; offline it throws. */
async function refreshSchedule(): Promise<boolean> {
  const { data, error } = await supabase.from('groups').select('check_every_min, save_every_min');
  if (error) throw error;
  const next = scheduleFor(data);
  const current = await getSchedule();
  if (next.checkEveryMs === current.checkEveryMs && next.saveEveryMs === current.saveEveryMs) return false;
  await setState('schedule', next);
  await logEvent(`timing: check every ${next.checkEveryMs / 60_000} min, save every ${next.saveEveryMs / 60_000} min`);
  return true;
}

async function batteryPercent(): Promise<number | null> {
  const level = await Battery.getBatteryLevelAsync().catch(() => -1);
  return level >= 0 ? Math.round(level * 100) : null;
}

function toPoint(
  location: Location.LocationObject,
  source: PendingPoint['source'],
  battery: number | null,
): PendingPoint {
  const { latitude, longitude, accuracy, speed, heading } = location.coords;
  return {
    recorded_at: new Date(location.timestamp).toISOString(),
    lat: latitude,
    lng: longitude,
    accuracy_m: accuracy ?? null,
    // Android reports -1 or null when speed/heading are unknown.
    speed: speed != null && speed >= 0 ? speed : null,
    heading: heading != null && heading >= 0 ? heading : null,
    source,
    battery_pct: battery,
  };
}

/**
 * Checks a reading is believable, applies the save rule, and queues it if it should be kept.
 * `verdict` says whether the reading was believed at all (see judgeFix).
 */
export async function recordReading(
  location: Location.LocationObject,
  options: { source?: PendingPoint['source']; force?: boolean; battery?: number | null } = {},
): Promise<{ saved: boolean; verdict: Verdict }> {
  const fix: Fix = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    time: location.timestamp,
    accuracy: location.coords.accuracy,
  };

  const [lastGood, held] = await Promise.all([getState<Fix>('last_good'), getState<Fix>('held_jump')]);
  const { verdict, reason } = judgeFix(lastGood, held, fix);
  if (verdict !== 'accept') {
    if (verdict === 'hold') await setState('held_jump', fix);
    await logEvent(`${verdict} fix: ${reason}`);
    return { saved: false, verdict };
  }
  await setState('last_good', fix);
  if (held) await setState('held_jump', null);

  const last = await getState<Fix>('last_saved');
  // A forced save (the app was just opened) still skips a reading within a minute of the last one.
  const keep = options.force ? !last || fix.time - last.time >= 60_000 : shouldSave(last, fix, await getSchedule());
  if (!keep) return { saved: false, verdict };

  const battery = options.battery !== undefined ? options.battery : await batteryPercent();
  await enqueue(toPoint(location, options.source ?? 'fused', battery));
  await setState('last_saved', fix);
  return { saved: true, verdict };
}

/** Re-sends the last believable position with the current time ("still here"). */
async function recordLastGood(): Promise<boolean> {
  const good = await getState<Fix>('last_good');
  if (!good) return false;
  const reading: Location.LocationObject = {
    timestamp: Date.now(),
    coords: {
      latitude: good.lat,
      longitude: good.lng,
      accuracy: good.accuracy ?? null,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
  };
  const { saved } = await recordReading(reading, { force: true, source: 'last_known' });
  await logEvent(`re-sent last good position saved=${saved}`);
  return saved;
}

/** One fresh-fix attempt; null if it fails or runs out of time. */
async function freshFix(accuracy: Location.Accuracy, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy, mayShowUserSettingsDialog: false }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (!fix) await logEvent(`${label} fix timed out`);
    return fix;
  } catch (e) {
    await logEvent(`${label} fix failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Saves a point right now, from the best source that answers: a GPS-quality fix, then a
 * Wi-Fi/cell fix, then the phone's last known fix.
 * With `stillHere`, a cached fix of any age is re-sent with the current time: Google's provider
 * stops producing fixes while the phone lies still, so the last fix is where the phone still is.
 */
export async function recordCurrentPosition(options: { stillHere?: boolean } = {}) {
  for (const attempt of FRESH_FIX_ATTEMPTS) {
    const fresh = await freshFix(attempt.accuracy, attempt.timeoutMs, attempt.label);
    if (!fresh) continue;
    // While the phone is still, Android can answer with its previous fix. When a point is due,
    // that's still where the phone is, so it's saved as of now rather than skipped as a repeat.
    const stale = Date.now() - fresh.timestamp > STALE_FIX_MS;
    const reading = options.stillHere && stale ? { ...fresh, timestamp: Date.now() } : fresh;
    const { saved, verdict } = await recordReading(reading, { force: true, source: stale ? 'last_known' : 'fused' });
    await logEvent(
      `${attempt.label} fix ±${Math.round(fresh.coords.accuracy ?? 0)}m stale=${stale} ${verdict} saved=${saved}`,
    );
    // An unbelievable fix (e.g. an indoor GPS glitch): try the next source instead.
    if (verdict === 'accept') return;
  }

  const cached = await Location.getLastKnownPositionAsync(options.stillHere ? {} : { maxAge: LAST_KNOWN_MAX_AGE_MS });
  if (cached) {
    const reading = options.stillHere ? { ...cached, timestamp: Date.now() } : cached;
    const { saved, verdict } = await recordReading(reading, { source: 'last_known', force: true });
    await logEvent(`cached fix from ${new Date(cached.timestamp).toISOString()} ${verdict} saved=${saved}`);
    if (verdict === 'accept') return;
  } else {
    await logEvent('no cached fix');
  }

  // Nothing believable from the phone: the 5-minute point repeats the last good position.
  if (options.stillHere) await recordLastGood();
}

/** Called with the app on screen. */
export async function startTracking() {
  // Wake-ups first: scheduling them always works, while starting the location service can be
  // refused (Android blocks starting it while the app isn't on screen).
  if (!GtrackAlarm.isRunning()) GtrackAlarm.start(ALARM_EVERY_MS);
  else GtrackAlarm.ensure();
  if (!(await TaskManager.isTaskRegisteredAsync(HEARTBEAT_TASK))) {
    await BackgroundTask.registerTaskAsync(HEARTBEAT_TASK, { minimumInterval: HEARTBEAT_MINUTES });
  }
  // Always (re)start: "registered" stays true after the system stops the service (e.g. an app
  // update or the phone maker's battery saver), and starting a running service is harmless.
  await Location.startLocationUpdatesAsync(LOCATION_TASK, updateOptions(await getSchedule()));
}

export async function stopTracking() {
  GtrackAlarm.stop();
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  if (await TaskManager.isTaskRegisteredAsync(HEARTBEAT_TASK)) {
    await BackgroundTask.unregisterTaskAsync(HEARTBEAT_TASK);
  }
}

/**
 * A wake-up while sharing is on (alarm tick or heartbeat job): restart the location service
 * if the system stopped it, save a point if one is due, then upload.
 */
export async function checkIn(reason: 'alarm' | 'heartbeat') {
  const schedule = await getSchedule();
  const last = await getState<Fix>('last_saved');
  const due = !last || Date.now() - last.time >= saveDueMs(schedule);
  // "Registered" survives the service being stopped by the system, so also judge by whether
  // readings are actually arriving.
  const registered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  const lastReadingAt = (await getState<number>('last_reading_at')) ?? 0;
  const silent = Date.now() - lastReadingAt > schedule.checkEveryMs + SERVICE_SILENT_GRACE_MS;
  // The heartbeat job may be the only thing still running if the alarm chain was wiped.
  const rearmed = GtrackAlarm.ensure();
  await logEvent(
    `${reason}: registered=${registered}, readings silent=${silent}, point due=${due}, alarm re-armed=${rearmed}`,
  );

  // The point comes first, so nothing below can stand in the way of it.
  if (due) {
    await withTimeout(recordCurrentPosition({ stillHere: true }), POINT_STEP_MS, `${reason}: saving point`);
  }

  if (!registered || silent) {
    // Starting is safe when the service is already running (Expo also restarts it by itself when
    // a killed app is woken). Exact alarms and the battery-optimization exemption are among the
    // few things that let Android start a location service from the background; if refused,
    // the next wake-up or opening the app tries again.
    await withTimeout(
      Location.startLocationUpdatesAsync(LOCATION_TASK, updateOptions(schedule)).then(() =>
        logEvent(`${reason}: (re)started location service`),
      ),
      START_STEP_MS,
      `${reason}: starting location service`,
    );
  }

  // An admin's new timing reaches every phone here, within 5 minutes.
  await withTimeout(Promise.all([flushQueue(), applyNewSchedule()]), UPLOAD_STEP_MS, `${reason}: upload`);
}

/** Picks up a changed group timing and restarts location checks at the new pace. */
async function applyNewSchedule() {
  if (await refreshSchedule()) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, updateOptions(await getSchedule()));
  }
}

/** Runs one check-in step, logging (not throwing) if it fails or takes too long. */
async function withTimeout(step: Promise<unknown>, ms: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms);
  });
  try {
    if ((await Promise.race([step, timeout])) === 'timeout') await logEvent(`${label} timed out`);
  } catch (e) {
    await logEvent(`${label} failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Called by the location task for every batch, so check-ins can tell the service is alive. */
export async function markReadingReceived() {
  await setState('last_reading_at', Date.now());
}

/**
 * Brings tracking in line with the user's choice and the phone's permissions, reports the
 * status to friends, and sends a fresh point. Called when the app opens or comes to the front.
 */
export async function syncTracking(sharingEnabled: boolean): Promise<Readiness> {
  const readiness = await getReadiness();
  await reportStatus(statusFor(readiness)).catch(() => {});

  const canTrack = sharingEnabled && readiness.foreground && readiness.background;
  if (canTrack) {
    // Fetched first so the service starts at the groups' pace; offline, the remembered one is used.
    await refreshSchedule().catch(() => {});
    // If Android refuses to start the service right now, the next sync or heartbeat retries.
    await startTracking().catch(() => {});
    if (readiness.servicesOn) await recordCurrentPosition().catch(() => {});
  } else {
    await stopTracking();
  }

  await flushQueue().catch(() => {});
  return { ...readiness, tracking: canTrack && (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) };
}

/** Sign-out: stop sharing and forget this account's unsent points and tracker state. */
export async function resetTracking() {
  await stopTracking().catch(() => {});
  await clearAll();
}
