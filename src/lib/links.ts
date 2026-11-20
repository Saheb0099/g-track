import { Alert, Linking } from 'react-native';

/** Pages the app links to. */
export const PRIVACY_URL = 'https://saheb0099.github.io/g-track-site/privacy.html';
export const SOURCE_URL = 'https://github.com/Saheb0099/g-track';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/** Opens a web page in the browser, saying so if the phone can't (no browser, or one blocked). */
export function openLink(url: string) {
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open the link", 'No app on this phone can open web pages.'));
}
