package expo.modules.gtrackalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fired by each alarm: schedules the next tick, then runs the JS tick task. */
class TickReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    // Schedule first, so a failed tick can never break the chain.
    AlarmScheduler.scheduleNext(context)
    TickService.start(context)
  }
}
