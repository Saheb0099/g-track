// Re-export the native module. On web, it will be resolved to GtrackAlarmModule.web.ts
// and on native platforms to GtrackAlarmModule.ts
export { default } from './src/GtrackAlarmModule';
export * from './src/GtrackAlarm.types';
