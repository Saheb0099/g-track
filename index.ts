// Background tasks must be defined before anything else: Android may start the app
// only to run the location task, without opening any screen.
import './src/features/location/task';
import 'expo-router/entry';
