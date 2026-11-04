import { NativeModule, requireNativeModule } from 'expo';

declare class GtrackAlarmModule extends NativeModule<{}> {
  /**
   * Wakes the app every `intervalMs`, exactly and even in Doze, running the "GTrackTick"
   * headless task. Survives reboots and app updates until `stop()`.
   */
  start(intervalMs: number): void;
  stop(): void;
  isRunning(): boolean;
  /** False if Android withheld exact-alarm access; ticks then come, but may be late. */
  canScheduleExact(): boolean;
}

export default requireNativeModule<GtrackAlarmModule>('GtrackAlarm');
