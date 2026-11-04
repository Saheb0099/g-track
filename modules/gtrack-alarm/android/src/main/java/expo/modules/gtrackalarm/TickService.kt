package expo.modules.gtrackalarm

import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Runs the JS task registered with AppRegistry.registerHeadlessTask("GTrackTick").
 * Starts the JS runtime if the app process was killed.
 */
class TickService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig =
    HeadlessJsTaskConfig(TASK_KEY, Arguments.createMap(), TIMEOUT_MS, true)

  companion object {
    const val TASK_KEY = "GTrackTick"
    private const val TIMEOUT_MS = 60_000L
    private const val TAG = "GtrackTick"

    fun start(context: Context) {
      try {
        // Keeps the CPU awake until the task finishes; the service releases it.
        acquireWakeLockNow(context)
        context.startService(Intent(context, TickService::class.java))
      } catch (e: IllegalStateException) {
        // Background start refused; the next alarm tries again.
        Log.w(TAG, "Could not start tick service", e)
      }
    }
  }
}
