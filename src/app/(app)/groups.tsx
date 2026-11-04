import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Fragment } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { Card, RowDivider, SectionLabel } from "@/components/card";
import { MAX_MEMBERS, useMyGroups } from "@/features/groups/api";
import {
  setCurrentGroup,
  useCurrentGroup,
} from "@/features/groups/current-group";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { type as typeStyles, useColors } from "@/lib/theme";

/** Pick which group the map shows, or start a new one. */
export default function Groups() {
  // Edge-to-edge: keep the last item clear of Android's navigation bar.
  const safe = useSafeAreaInsets();
  const colors = useColors();
  const { session } = useAuth();
  const groups = useMyGroups();
  const current = useCurrentGroup(groups.data);

  function open(id: string) {
    setCurrentGroup(id);
    router.back();
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingBottom: safe.bottom + 32 },
      ]}
    >
      {groups.isPending ? (
        <ActivityIndicator />
      ) : groups.isError ? (
        <Text style={[typeStyles.body, { color: colors.danger }]}>
          {friendlyError(groups.error)}
        </Text>
      ) : groups.data.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel>Groups</SectionLabel>
          <Card>
            {groups.data.map((g, i) => {
              const active = g.id === current?.id;
              return (
                <Fragment key={g.id}>
                  {i > 0 && <RowDivider inset={64} />}
                  <Pressable
                    onPress={() => open(g.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.row,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: active ? colors.accent : colors.fill,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typeStyles.bodyStrong,
                          {
                            color: active ? colors.onAccent : colors.text,
                            fontSize: 15,
                          },
                        ]}
                      >
                        {g.name[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text
                        style={[typeStyles.bodyStrong, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {g.name}
                      </Text>
                      <Text
                        style={[typeStyles.caption, { color: colors.muted }]}
                      >
                        {g.memberCount} of {MAX_MEMBERS} members
                        {g.adminId === session?.user.id
                          ? " · You are admin"
                          : ""}
                      </Text>
                    </View>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={colors.accent}
                      />
                    )}
                  </Pressable>
                </Fragment>
              );
            })}
          </Card>
        </View>
      ) : (
        <Text style={[typeStyles.body, { color: colors.muted }]}>
          You aren&apos;t in any groups yet.
        </Text>
      )}

      <View style={styles.actions}>
        <Button
          title="Create a group"
          onPress={() => router.push("/create-group")}
          icon={<Ionicons name="add" size={20} color={colors.onAccent} />}
        />
        <Button
          title="Join with a code"
          variant="secondary"
          onPress={() => router.push("/join")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24, paddingBottom: 48 },
  section: { gap: 8 },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1, gap: 2 },
  actions: { gap: 10 },
});
