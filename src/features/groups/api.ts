import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type DeviceStatus = Database['public']['Enums']['device_status'];

export type GroupSummary = {
  id: string;
  name: string;
  adminId: string;
  memberCount: number;
  /** The admin's timing for members' phones, in minutes. */
  checkEveryMin: number;
  saveEveryMin: number;
  /** Set while the group waits out the 7 days before it's removed (see deletionDate). */
  deletedAt: string | null;
};

export type Member = {
  userId: string;
  joinedAt: string;
  displayName: string;
  avatarUrl: string | null;
  status: DeviceStatus;
  sharingEnabled: boolean;
  lastSeenAt: string | null;
  /** Set while their account waits out the 7 days before it's removed. */
  deletedAt: string | null;
  /** Set while they've stopped sharing with this group (sharingEnabled is then false too). */
  hiddenAt: string | null;
};

export type GroupPreview = {
  groupId: string;
  name: string;
  memberCount: number;
  isMember: boolean;
  /** Being deleted: it takes no new members. */
  isClosing: boolean;
};

export const MAX_MEMBERS = 10;

const keys = {
  groups: ['groups'] as const,
  group: (id: string) => ['group', id] as const,
  members: (id: string) => ['group', id, 'members'] as const,
  invite: (id: string) => ['group', id, 'invite'] as const,
  preview: (code: string) => ['preview', code] as const,
};

// Join codes: 6 characters, no look-alikes (matches the database check).
const CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;
const LOOK_ALIKES = /[01ILO]/;

/**
 * Turns whatever was typed or pasted into a code: "5fk-yzx" → "5FKYZX". A pasted invite message
 * or link ("…enter this code: 5FKYZX…", "gtrack://join/5FKYZX") yields the code it contains.
 */
export function normalizeCode(input: string) {
  const upper = input.toUpperCase();
  const words = upper.split(/[^A-Z0-9]+/).filter(Boolean);
  if (words.length > 1) {
    const code = words.findLast((word) => CODE_PATTERN.test(word));
    if (code) return code;
  }
  return upper.replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** True when the input contains characters join codes never use (0, O, 1, I, L). */
export function hasLookAlikes(code: string) {
  return LOOK_ALIKES.test(code);
}

export function isValidCode(code: string) {
  return CODE_PATTERN.test(code);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useMyGroups() {
  return useQuery({
    queryKey: keys.groups,
    queryFn: async (): Promise<GroupSummary[]> => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, admin_id, check_every_min, save_every_min, deleted_at, group_members(count)')
        .order('created_at');
      if (error) throw error;
      return data.map((g) => ({
        id: g.id,
        name: g.name,
        adminId: g.admin_id,
        memberCount: g.group_members[0]?.count ?? 0,
        checkEveryMin: g.check_every_min,
        saveEveryMin: g.save_every_min,
        deletedAt: g.deleted_at,
      }));
    },
  });
}

/** Resolves to null when the group doesn't exist or you're no longer in it. */
export function useGroup(id: string) {
  return useQuery({
    queryKey: keys.group(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, admin_id, check_every_min, save_every_min, deleted_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (
        data && {
          id: data.id,
          name: data.name,
          adminId: data.admin_id,
          checkEveryMin: data.check_every_min,
          saveEveryMin: data.save_every_min,
          deletedAt: data.deleted_at,
        }
      );
    },
  });
}

export function useMembers(groupId: string) {
  return useQuery({
    queryKey: keys.members(groupId),
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select(
          'user_id, joined_at, hidden_at, profiles(display_name, avatar_url, status, sharing_enabled, last_seen_at, deleted_at)',
        )
        .eq('group_id', groupId)
        .order('joined_at');
      if (error) throw error;
      return data.flatMap((m) =>
        m.profiles
          ? [
              {
                userId: m.user_id,
                joinedAt: m.joined_at,
                displayName: m.profiles.display_name,
                avatarUrl: m.profiles.avatar_url,
                status: m.profiles.status,
                // Not sharing with this group looks the same as paused, here.
                sharingEnabled: m.profiles.sharing_enabled && !m.hidden_at,
                lastSeenAt: m.profiles.last_seen_at,
                deletedAt: m.profiles.deleted_at,
                hiddenAt: m.hidden_at,
              },
            ]
          : [],
      );
    },
  });
}

/** Only the admin can read the code; everyone else gets null. */
export function useInviteCode(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.invite(groupId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('group_invites').select('code').eq('group_id', groupId).maybeSingle();
      if (error) throw error;
      return data?.code ?? null;
    },
  });
}

export function usePreviewGroup(code: string) {
  return useQuery({
    queryKey: keys.preview(code),
    enabled: isValidCode(code),
    queryFn: async (): Promise<GroupPreview | null> => {
      const { data, error } = await supabase.rpc('preview_group', { p_code: code });
      if (error) throw error;
      const row = data[0];
      return row
        ? {
            groupId: row.group_id,
            name: row.name,
            memberCount: row.member_count,
            isMember: row.is_member,
            isClosing: row.is_closing,
          }
        : null;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('create_group', { p_name: name });
      if (error) throw error;
      return { groupId: data[0].group_id, code: data[0].invite_code };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.groups }),
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_group', { p_code: code });
      if (error) throw error;
      // A wrong code comes back empty (the database counts it towards the hourly limit).
      if (!data) throw new Error('invalid_code');
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.groups }),
  });
}

export function useRegenerateCode(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regenerate_invite_code', { p_group_id: groupId });
      if (error) throw error;
      return data;
    },
    onSuccess: (code) => queryClient.setQueryData(keys.invite(groupId), code),
  });
}

export function useRenameGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.rpc('rename_group', { p_group_id: groupId, p_name: name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

/** When a group marked for deletion is removed for good: 7 days after the admin deleted it. */
export function deletionDate(deletedAt: string) {
  return new Date(Date.parse(deletedAt) + 7 * 24 * 60 * 60_000);
}

/** "12 Nov", for "will be deleted on …". */
export function formatDeletionDate(deletedAt: string) {
  return deletionDate(deletedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Admin only. Schedules the group's deletion in 7 days; useRestoreGroup cancels it. */
export function useDeleteGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_group', { p_group_id: groupId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

export function useRestoreGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('restore_group', { p_group_id: groupId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

/** Admin only. Members' phones switch to it at their next 5-minute check-in. */
export function useSetGroupTiming(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ checkEveryMin, saveEveryMin }: { checkEveryMin: number; saveEveryMin: number }) => {
      const { error } = await supabase.rpc('set_group_timing', {
        p_group_id: groupId,
        p_check_every_min: checkEveryMin,
        p_save_every_min: saveEveryMin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: keys.groups });
      // This phone follows its groups' timing too, so re-sync tracking now.
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
    },
  });
}

export function useKickMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('kick_member', { p_group_id: groupId, p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.members(groupId) });
      queryClient.invalidateQueries({ queryKey: keys.groups });
    },
  });
}

export function useTransferAdmin(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('transfer_admin', { p_group_id: groupId, p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: keys.groups });
      queryClient.removeQueries({ queryKey: keys.invite(groupId) });
    },
  });
}

/**
 * Stops (or restarts) sharing your location with this one group. While stopped, the group sees
 * neither where you are nor where you went, even after you share again.
 */
export function useSetHiddenFromGroup(groupId: string, me: string | undefined) {
  const queryClient = useQueryClient();
  const key = keys.members(groupId);
  return useMutation({
    mutationFn: async (hidden: boolean) => {
      const { error } = await supabase.rpc('set_hidden_from_group', { p_group_id: groupId, p_hidden: hidden });
      if (error) throw error;
    },
    // Flip the switch at once; a failure puts it back.
    onMutate: (hidden) => {
      const before = queryClient.getQueryData<Member[]>(key);
      queryClient.setQueryData<Member[]>(key, (list) =>
        list?.map((m) => (m.userId === me ? { ...m, hiddenAt: hidden ? new Date().toISOString() : null } : m)),
      );
      return { before };
    },
    onError: (_error, _hidden, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['group', groupId] }),
  });
}

export function useLeaveGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('leave_group', { p_group_id: groupId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: keys.groups });
    },
  });
}
