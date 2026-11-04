import * as BackgroundTask from 'expo-background-task';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import GtrackAlarm from '../../../modules/gtrack-alarm';

import { clearAll, enqueue, getState, logEvent, setState, type PendingPoint } from '@/features/location/queue';
import { SAVE_DUE_MS, SAVE_EVERY_MS, shouldSave, type Fix } from '@/features/location/rules';
import { reportStatus, type DeviceStatus } from '@/features/location/status';
import { flushQueue } from '@/features/location/upload';

export const LOCATION_TASK = 'gtrack-location';

// A point every 5 minutes must not depend on the location service alone: Google's fused
// provider stops producing fixes while the phone lies still, and phone makers sometimes kill
// the service. Two independent wake-ups therefore "check in" (see checkIn):
//  - an exact alarm every 5 minutes (native module modules/gtrack-alarm), which also resumes
//    after a reboot or app update;
//  - a WorkManager job about every 15 minutes, as a backstop if alarms are ever withheld.
export const HEARTBEAT_TASK = 'gtrack-heartbeat';
const HEARTBEAT_MINUTES = 15;

// Readings about once a minute at high accuracy: Android's fused provider uses GPS when it has
// a signal and falls back to Wi-Fi and cell towers when not (indoors). Accuracy over battery,
// as the user chose. The save rule then thins the readings out.
const UPDATE_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 60_000,
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
 * Readings normally arrive every minute. Silence this long means the service was stopped
 * (Android or the phone maker) or the provider paused, and the next check-in restarts it.
 */
const SERVICE_SILENT_MS = 3 * 60_000;
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

async function batteryPercent(): Promise<number | null> {
  const level = await Battery.getBatteryLevelAsync().catch(() => -1);
  return level >= 0 ? Math.round(level * 100) : null;
}

function toPoint(location: Location.LocationObject, source: PendingPoint['source'], battery: number | null): PendingPoint {
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

/** Applies the save rule to one reading and queues it if it should be kept. Returns whether it was saved. */
export async function recordReading(
  location: Location.LocationObject,
  options: { source?: PendingPoint['source']; force?: boolean; battery?: number | null } = {},
): Promise<boolean> {
  const fix: Fix = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    time: location.timestamp,
    accuracy: location.coords.accuracy,
  };
  const last = await getState<Fix>('last_saved');
  // A forced save (the app was just opened) still skips a reading within a minute of the last one.
  const keep = options.force ? !last || fix.time - last.time >= 60_000 : shouldSave(last, fix);
  if (!keep) return false;

  const battery = options.battery !== undefined ? options.battery : await batteryPercent();
  await enqueue(toPoint(location, options.source ?? 'fused', battery));
  await setState('last_saved', fix);
  return true;
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
    const saved = await recordReading(reading, { force: true, source: stale ? 'last_known' : 'fused' });
    await logEvent(
      `${attempt.label} fix ±${Math.round(fresh.coords.accuracy ?? 0)}m stale=${stale} saved=${saved}`,
    );
    return;
  }

  const cached = await Location.getLastKnownPositionAsync(options.stillHere ? {} : { maxAge: LAST_KNOWN_MAX_AGE_MS });
  if (!cached) {
    await logEvent('no cached fix');
    return;
  }
  const reading = options.stillHere ? { ...cached, timestamp: Date.now() } : cached;
  const saved = await recordReading(reading, { source: 'last_known', force: true });
  await logEvent(`cached fix from ${new Date(cached.timestamp).toISOString()} saved=${saved}`);
}

/** Called with the app on screen. */
export async function startTracking() {
  // Wake-ups first: scheduling them always works, while starting the location service can be
  // refused (Android blocks starting it while the app isn't on screen).
  if (!GtrackAlarm.isRunning()) GtrackAlarm.start(SAVE_EVERY_MS);
  else GtrackAlarm.ensure();
  if (!(await TaskManager.isTaskRegisteredAsync(HEARTBEAT_TASK))) {
    await BackgroundTask.registerTaskAsync(HEARTBEAT_TASK, { minimumInterval: HEARTBEAT_MINUTES });
  }
  // Always (re)start: "registered" stays true after the system stops the service (e.g. an app
  // update or the phone maker's battery saver), and starting a running service is harmless.
  await Location.startLocationUpdatesAsync(LOCATION_TASK, UPDATE_OPTIONS);
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
  const last = await getState<Fix>('last_saved');
  const due = !last || Date.now() - last.time >= SAVE_DUE_MS;
  // "Registered" survives the service being stopped by the system, so also judge by whether
  // readings are actually arriving.
  const registered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  const lastReadingAt = (await getState<number>('last_reading_at')) ?? 0;
  const silent = Date.now() - lastReadingAt > SERVICE_SILENT_MS;
  // The heartbeat job may be the only thing still running if the alarm chain was wiped.
  const rearmed = GtrackAlarm.ensure();
  await logEvent(
    `${reason}: registered=${registered}, readings silent=${silent}, point due=${due}, alarm re-armed=${rearmed}`,
  );

  // The point comes first, so nothing below can stand in the way of the 5-minute record.
  if (due) {
    await withTimeout(recordCurrentPosition({ stillHere: true }), POINT_STEP_MS, `${reason}: saving point`);
  }

  if (!registered || silent) {
    // Starting is safe when the service is already running (Expo also restarts it by itself when
    // a killed app is woken). Exact alarms and the battery-optimization exemption are among the
    // few things that let Android start a location service from the background; if refused,
    // the next wake-up or opening the app tries again.
    await withTimeout(
      Location.startLocationUpdatesAsync(LOCATION_TASK, UPDATE_OPTIONS).then(() =>
        logEvent(`${reason}: (re)started location service`),
      ),
      START_STEP_MS,
      `${reason}: starting location service`,
    );
  }

  await withTimeout(flushQueue(), UPLOAD_STEP_MS, `${reason}: upload`);
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
