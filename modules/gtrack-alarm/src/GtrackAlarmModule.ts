import { NativeModule, requireNativeModule } from 'expo';

declare class GtrackAlarmModule extends NativeModule<{}> {
  /**
   * Wakes the app every `intervalMs`, exactly and even in Doze, running the "GTrackTick"
   * headless task. Survives reboots and app updates until `stop()`.
   */
  start(intervalMs: number): void;
  stop(): void;
  /** Whether ticking is switched on (a saved setting; an alarm may still need re-arming). */
  isRunning(): boolean;
  /** Re-arms the alarm if ticking is on but none is waiting (after an update or reboot). Returns true if it did. */
  ensure(): boolean;
  /** False if Android withheld exact-alarm access; ticks then come, but may be late. */
  canScheduleExact(): boolean;
}

export default requireNativeModule<GtrackAlarmModule>('GtrackAlarm');
