import { Share } from 'react-native';

// Chat apps only make https:// links tappable, so invites point at the join page on the
// G Track site, whose button opens the app at gtrack://join/CODE (`scheme` in app.json).
const JOIN_PAGE = 'https://saheb0099.github.io/g-track-site/join/';

export function inviteLink(code: string) {
  return `${JOIN_PAGE}?code=${code}`;
}

export function shareInvite(groupName: string, code: string) {
  return Share.share({
    message:
      `Join my group "${groupName}" on G Track!\n\n` +
      `Tap to join: ${inviteLink(code)}\n\n` +
      // Keep in step with the home screen's button label.
      `Or open G Track, tap "Join with a code" and enter: ${code}`,
  });
}
