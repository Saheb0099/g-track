import { Share } from 'react-native';

// Matches `scheme` in app.json; Expo Router opens gtrack://join/CODE on the join screen.
const SCHEME = 'gtrack';

export function inviteLink(code: string) {
  return `${SCHEME}://join/${code}`;
}

export function shareInvite(groupName: string, code: string) {
  return Share.share({
    message:
      `Join my group "${groupName}" on G Track!\n\n` +
      // Keep in step with the home screen's button label.
      `Open G Track, tap "Join with a code" and enter: ${code}\n\n` +
      `Or open this link on your phone: ${inviteLink(code)}`,
  });
}
