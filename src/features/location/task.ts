import * as BackgroundTask from 'expo-background-task';
import * as Battery from 'expo-battery';
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppRegistry } from 'react-native';

import { TICK_TASK } from '../../../modules/gtrack-alarm';

import { logEvent } from '@/features/location/queue';
import {
  checkIn,
  HEARTBEAT_TASK,
  LOCATION_TASK,
  markReadingReceived,
  recordReading,
} from '@/features/location/tracking';
import { flushQueue } from '@/features/location/upload';

// All background entry points are registered at module load (imported from index.ts),
// because Android can start the JS runtime just to run one of them, with no screens mounted.

// Every batch of readings from the foreground service, including while the app's screens are closed.
TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  await markReadingReceived();

  const level = await Battery.getBatteryLevelAsync().catch(() => -1);
  const battery = level >= 0 ? Math.round(level * 100) : null;

  const readings = [...data.locations].sort((a, b) => a.timestamp - b.timestamp);
  let saved = 0;
  for (const reading of readings) {
    if (await recordReading(reading, { battery })) saved++;
  }
  await logEvent(`location task: ${readings.length} reading(s), ${saved} saved`);

  // No signal? The points stay queued and go up with a later batch.
  await flushQueue().catch(() => {});
});

// The exact alarm, every 5 minutes, even when readings have stopped.
AppRegistry.registerHeadlessTask(TICK_TASK, () => async () => {
  await checkIn('alarm').catch((e) =>
    logEvent(`alarm failed: ${e instanceof Error ? e.message : String(e)}`).catch(() => {}),
  );
});

// The WorkManager backstop, about every 15 minutes.
TaskManager.defineTask(HEARTBEAT_TASK, async () => {
  try {
    await checkIn('heartbeat');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    await logEvent(`heartbeat failed: ${e instanceof Error ? e.message : String(e)}`).catch(() => {});
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
