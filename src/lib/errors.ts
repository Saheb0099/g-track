// Error keys raised by the database functions (see the init_schema migration), in plain words.
const MESSAGES: Record<string, string> = {
  group_full: 'This group already has 10 members.',
  invalid_code: "That code doesn't match any group. Check it and try again.",
  not_admin: 'Only the group admin can do that.',
  not_member: "That person isn't in this group any more.",
  cannot_kick_self: "You can't remove yourself. Use Leave group instead.",
  not_authenticated: 'Please sign in again.',
  groups_name_check: 'Group names need 1 to 40 characters.',
};

// How a dropped or missing connection shows up: from fetch, Android's networking and Supabase.
const OFFLINE =
  /network request failed|failed to fetch|fetch failed|unable to resolve host|unknownhost|network is unreachable|timed? ?out|connection (refused|reset)/i;

/** The raw text of any error: an Error, a Supabase error object, or anything else. */
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error);
}

export function friendlyError(error: unknown): string {
  const message = errorMessage(error);

  for (const [key, text] of Object.entries(MESSAGES)) {
    if (message.includes(key)) return text;
  }
  if (OFFLINE.test(message)) {
    return 'No internet connection. Try again when you are online.';
  }
  return message;
}
