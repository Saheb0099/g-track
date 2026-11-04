package expo.modules.gtrackalarm

import android.content.Context
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

    Function("canScheduleExact") { AlarmScheduler.canScheduleExact(context) }
  }
}
