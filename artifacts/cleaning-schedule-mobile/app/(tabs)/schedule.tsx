import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useListTasks, CleaningTask } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { TaskCard } from "@/components/TaskCard";
import { AddTaskSheet } from "@/components/AddTaskSheet";

type Row =
  | { type: "header" }
  | { type: "section"; room: string; count: number }
  | { type: "task"; task: CleaningTask }
  | { type: "empty" }
  | { type: "loading" };

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: tasks, isLoading, refetch } = useListTasks();
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const grouped = useMemo(() => {
    if (!tasks) return {} as Record<string, CleaningTask[]>;
    return tasks.reduce<Record<string, CleaningTask[]>>((acc, t) => {
      if (!acc[t.room]) acc[t.room] = [];
      acc[t.room].push(t);
      return acc;
    }, {});
  }, [tasks]);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [{ type: "header" }];
    if (isLoading) {
      list.push({ type: "loading" });
    } else if (!tasks || tasks.length === 0) {
      list.push({ type: "empty" });
    } else {
      for (const [room, roomTasks] of Object.entries(grouped)) {
        list.push({ type: "section", room, count: roomTasks.length });
        for (const task of roomTasks) {
          list.push({ type: "task", task });
        }
      }
    }
    return list;
  }, [tasks, grouped, isLoading]);

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 + 80 : insets.bottom + 80;

  const renderItem = ({ item }: { item: Row }) => {
    switch (item.type) {
      case "header":
        return (
          <View style={[styles.headerRow, { paddingTop: topPad }]}>
            <Text style={[styles.heading, { color: colors.foreground }]}>Schedule</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {tasks?.length ?? 0} tasks
            </Text>
          </View>
        );
      case "loading":
        return (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        );
      case "empty":
        return (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="clipboard" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No tasks yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Tap the + button to add your first cleaning task
            </Text>
          </View>
        );
      case "section":
        return (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{item.room}</Text>
            <View style={[styles.badge, { backgroundColor: `${colors.primary}18` }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {item.count} {item.count === 1 ? "task" : "tasks"}
              </Text>
            </View>
          </View>
        );
      case "task":
        return <TaskCard task={item.task} showComplete={false} />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(item, i) => `${item.type}-${i}`}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        scrollEnabled={rows.length > 1}
      />

      <Pressable
        onPress={() => setAddOpen(true)}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            borderRadius: colors.radius + 8,
            bottom: Platform.OS === "web" ? 34 + 16 : insets.bottom + 16,
          },
        ]}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </Pressable>

      <AddTaskSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  headerRow: {
    paddingBottom: 20,
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
  centerBox: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyBox: {
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
    maxWidth: 240,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Outfit_500Medium",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
});
