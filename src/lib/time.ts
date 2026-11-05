/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** Compact form for tight spaces: "now", "5 min", "3 h", "2 d". */
export function timeAgoShort(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}

/** When a pause ends: "6:30 PM", or "tomorrow 2:30 AM" when that's not today. */
export function untilText(iso: string, now = new Date()): string {
  const end = new Date(iso);
  const clock = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (end.toDateString() === now.toDateString()) return clock;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (end.toDateString() === tomorrow.toDateString()) return `tomorrow ${clock}`;
  return `${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${clock}`;
}
