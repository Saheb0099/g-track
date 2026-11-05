package expo.modules.gtrackalarm

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GtrackAlarmModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }.applicationContext

  override fun definition() = ModuleDefinition {
    Name("GtrackAlarm")

    Function("start") { intervalMs: Double -> AlarmScheduler.start(context, intervalMs.toLong()) }

    Function("stop") { AlarmScheduler.stop(context) }

    Function("isRunning") { AlarmScheduler.isRunning(context) }

    Function("ensure") { AlarmScheduler.ensure(context) }

    Function("canScheduleExact") { AlarmScheduler.canScheduleExact(context) }

    // Android's own "Restricted" battery setting for the app (Android 9+): it stops background work.
    Function("isBackgroundRestricted") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
        (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).isBackgroundRestricted
    }

    // Reads a phone setting, such as a maker's own battery switch (Vivo's "power_sleep_mode_enabled").
    // Null when it doesn't exist on this phone or Android won't let apps read it.
    Function("readSystemSetting") { name: String ->
      try {
        Settings.System.getString(context.contentResolver, name)
      } catch (e: SecurityException) {
        null
      }
    }
  }
}
