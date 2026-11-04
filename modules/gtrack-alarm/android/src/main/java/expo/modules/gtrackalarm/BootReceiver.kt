package expo.modules.gtrackalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Alarms are wiped when the phone restarts or the app is updated. If sharing was on,
 * resume the chain shortly after; that first tick also restarts the location service.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> AlarmScheduler.scheduleIn(context, RESUME_DELAY_MS)
    }
  }

  private companion object {
    const val RESUME_DELAY_MS = 30_000L
  }
}
