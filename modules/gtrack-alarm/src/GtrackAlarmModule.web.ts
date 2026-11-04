import { registerWebModule, NativeModule } from 'expo';

// GtrackAlarmModule is not available on the web platform.
class GtrackAlarmModule extends NativeModule<{}> {}

export default registerWebModule(GtrackAlarmModule, 'GtrackAlarmModule');
