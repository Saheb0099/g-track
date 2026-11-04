package expo.modules.gtrackalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock

/**
 * Keeps a chain of exact alarms going: each tick schedules the next one. Exact
 * "allow while idle" alarms fire even in Doze, unlike WorkManager jobs or Google's
 * location updates, which can pause for a long time while the phone lies still.
 *
 * The interval is stored so the chain can be resumed after a reboot or an app update.
 */
internal object AlarmScheduler {
  private const val PREFS = "gtrack_alarm"
  private const val KEY_INTERVAL = "interval_ms"
  private const val REQUEST_CODE = 4102

  fun start(context: Context, intervalMs: Long) {
    prefs(context).edit().putLong(KEY_INTERVAL, intervalMs).apply()
    scheduleIn(context, intervalMs)
  }

  fun stop(context: Context) {
    prefs(context).edit().remove(KEY_INTERVAL).apply()
    alarmManager(context).cancel(pendingIntent(context))
  }

  fun isRunning(context: Context): Boolean = interval(context) > 0

  /** Schedules the next tick, if ticking is on. */
  fun scheduleNext(context: Context) {
    val interval = interval(context)
    if (interval > 0) scheduleIn(context, interval)
  }

  /** Schedules a tick after [delayMs] (replacing any pending one), if ticking is on. */
  fun scheduleIn(context: Context, delayMs: Long) {
    if (!isRunning(context)) return
    val alarms = alarmManager(context)
    val at = SystemClock.elapsedRealtime() + delayMs
    if (canScheduleExact(context)) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pendingIntent(context))
    } else {
      // Without exact-alarm access the system may delay ticks, but they still come.
      alarms.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pendingIntent(context))
    }
  }

  fun canScheduleExact(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(context).canScheduleExactAlarms()

  private fun interval(context: Context): Long = prefs(context).getLong(KEY_INTERVAL, 0L)

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun pendingIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      Intent(context, TickReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}
