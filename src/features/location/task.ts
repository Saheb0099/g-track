import * as BackgroundTask from 'expo-background-task';
import * as Battery from 'expo-battery';
import type { LocationObject } from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { AppRegistry } from 'react-native';

import { TICK_TASK } from '../../../modules/gtrack-alarm';

import { LOCATION_REQUEST_TASK, readLocationRequest } from '@/features/location/push';
import { logEvent } from '@/features/location/queue';
import { errorMessage } from '@/lib/errors';
import {
  answerLocationRequest,
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
    if ((await recordReading(reading, { battery })).saved) saved++;
  }
  await logEvent(`location task: ${readings.length} reading(s), ${saved} saved`);

  // No signal? The points stay queued and go up with a later batch.
  await flushQueue().catch(() => {});
});

// The exact alarm, every 5 minutes, even when readings have stopped.
AppRegistry.registerHeadlessTask(TICK_TASK, () => async () => {
  await checkIn('alarm').catch((e) => logEvent(`alarm failed: ${errorMessage(e)}`).catch(() => {}));
});

// The WorkManager backstop, about every 15 minutes.
TaskManager.defineTask(HEARTBEAT_TASK, async () => {
  try {
    await checkIn('heartbeat');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    await logEvent(`heartbeat failed: ${errorMessage(e)}`).catch(() => {});
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// A friend tapped "Get location now": a Firebase data message, delivered even when the app is
// closed (see the request-location edge function).
TaskManager.defineTask<Notifications.NotificationTaskPayload>(LOCATION_REQUEST_TASK, async ({ data }) => {
  const request = readLocationRequest(data);
  if (!request) {
    await logEvent(`push message that isn't an ask: ${JSON.stringify(data).slice(0, 300)}`).catch(() => {});
    return;
  }
  await answerLocationRequest(request.from).catch((e) => logEvent(`ask failed: ${errorMessage(e)}`).catch(() => {}));
});
Notifications.registerTaskAsync(LOCATION_REQUEST_TASK).catch(() => {});
