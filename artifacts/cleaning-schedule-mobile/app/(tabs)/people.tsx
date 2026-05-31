import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMembers,
  useCreateMember,
  useDeleteMember,
  useListTasks,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type Row =
  | { type: "header" }
  | { type: "add-form" }
  | { type: "section-label" }
  | { type: "member"; id: number; name: string; taskCount: number }
  | { type: "empty" };

export default function PeopleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: members, isLoading } = useListMembers();
  const { data: tasks } = useListTasks();
  const createMember = useCreateMember();
  const deleteMember = useDeleteMember();
  const [name, setName] = useState("");

  const taskCountByMember = React.useMemo(() => {
    const counts: Record<number, number> = {};
    (tasks ?? []).forEach((t) => {
      if (t.assignedMemberId != null) {
        counts[t.assignedMemberId] = (counts[t.assignedMemberId] ?? 0) + 1;
      }
    });
    return counts;
  }, [tasks]);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMember.mutate(
      { data: { name: trimmed } },
      {
        onSuccess: () => {
          setName("");
          queryClient.invalidateQueries({ queryKey: ["members"] });
        },
      }
    );
  };

  const handleDelete = (id: number, memberName: string) => {
    Alert.alert(
      `Remove ${memberName}?`,
      "Their tasks will become unassigned.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            deleteMember.mutate(
              { id },
              {
                onSuccess: () =>
                  queryClient.invalidateQueries({ queryKey: ["members"] }),
              }
            ),
        },
      ]
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 + 50 : insets.bottom + 50;

  const rows = React.useMemo<Row[]>(() => {
    const list: Row[] = [{ type: "header" }, { type: "add-form" }];
    if (isLoading) return list;
    if (!members || members.length === 0) {
      list.push({ type: "empty" });
    } else {
      list.push({ type: "section-label" });
      for (const m of members) {
        list.push({ type: "member", id: m.id, name: m.name, taskCount: taskCountByMember[m.id] ?? 0 });
      }
    }
    return list;
  }, [members, isLoading, taskCountByMember]);

  const renderItem = ({ item }: { item: Row }) => {
    switch (item.type) {
      case "header":
        return (
          <View style={[styles.headerRow, { paddingTop: topPad }]}>
            <Text style={[styles.heading, { color: colors.foreground }]}>People</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Manage your household members
            </Text>
          </View>
        );

      case "add-form":
        return (
          <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.addLabel, { color: colors.mutedForeground }]}>ADD A MEMBER</Text>
            <View style={styles.addRow}>
              <TextInput
                style={[styles.addInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius - 4, flex: 1 }]}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                onSubmitEditing={handleAdd}
                returnKeyType="done"
                autoCapitalize="words"
              />
              <Pressable
                onPress={handleAdd}
                disabled={!name.trim() || createMember.isPending}
                style={[styles.addBtn, { backgroundColor: name.trim() ? colors.primary : colors.muted, borderRadius: colors.radius - 4 }]}
              >
                {createMember.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="plus" size={20} color={name.trim() ? colors.primaryForeground : colors.mutedForeground} />
                )}
              </Pressable>
            </View>
          </View>
        );

      case "section-label":
        return (
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MEMBERS</Text>
        );

      case "empty":
        return (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="users" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No members yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add household members above, then assign tasks to them.
            </Text>
          </View>
        );

      case "member":
        return (
          <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}>
              <Feather name="user" size={18} color={colors.primary} />
            </View>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.memberMeta, { color: colors.mutedForeground }]}>
                {item.taskCount === 0
                  ? "No tasks assigned"
                  : `${item.taskCount} task${item.taskCount === 1 ? "" : "s"} assigned`}
              </Text>
            </View>
            <Pressable
              onPress={() => handleDelete(item.id, item.name)}
              hitSlop={8}
              style={styles.deleteBtn}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </Pressable>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <FlatList
        data={rows}
        keyExtractor={(item, i) => `${item.type}-${i}`}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  headerRow: {
    paddingBottom: 8,
    gap: 4,
  },
  heading: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "Outfit_700Bold",
  },
  sub: {
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  addCard: {
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  addLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
    letterSpacing: 0.8,
  },
  addRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  addInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  addBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: -4,
  },
  emptyBox: {
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
    maxWidth: 240,
  },
  memberCard: {
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
  memberMeta: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
  },
  deleteBtn: {
    padding: 6,
    flexShrink: 0,
  },
});
