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
  // Wall-clock time of the next tick, so a missed or wiped alarm can be noticed (survives reboot).
  private const val KEY_NEXT_DUE = "next_due_ms"
  private const val OVERDUE_GRACE_MS = 60_000L
  private const val REQUEST_CODE = 4102

  fun start(context: Context, intervalMs: Long) {
    prefs(context).edit().putLong(KEY_INTERVAL, intervalMs).apply()
    scheduleIn(context, intervalMs)
  }

  fun stop(context: Context) {
    prefs(context).edit().remove(KEY_INTERVAL).apply()
    val pending = pendingIntent(context)
    alarmManager(context).cancel(pending)
    // Cancel the PendingIntent too, so hasPendingAlarm() reports no alarm afterwards.
    pending.cancel()
  }

  fun isRunning(context: Context): Boolean = interval(context) > 0

  /**
   * Re-arms the chain if ticking is on but no alarm is waiting. Android clears an app's alarms
   * on update and reboot, and some phone makers block the broadcasts that would re-arm them.
   * Returns true if it had to schedule one.
   */
  fun ensure(context: Context): Boolean {
    if (!isRunning(context)) return false
    // A PendingIntent can outlive its alarm, so an overdue tick also counts as "none waiting".
    val overdue = System.currentTimeMillis() > prefs(context).getLong(KEY_NEXT_DUE, 0L) + OVERDUE_GRACE_MS
    if (hasPendingAlarm(context) && !overdue) return false
    scheduleIn(context, interval(context))
    return true
  }

  private fun hasPendingAlarm(context: Context): Boolean =
    PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      Intent(context, TickReceiver::class.java),
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
    ) != null

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
    prefs(context).edit().putLong(KEY_NEXT_DUE, System.currentTimeMillis() + delayMs).apply()
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
