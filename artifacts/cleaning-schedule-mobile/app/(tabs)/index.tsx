import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, parseISO } from "date-fns";
import {
  useListTasksDueToday,
  useGetStats,
  useListUpcomingTasks,
  CleaningTask,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { TaskCard } from "@/components/TaskCard";

type Section =
  | { type: "header" }
  | { type: "stat-row" }
  | { type: "section-title"; title: string; count: number }
  | { type: "task"; task: CleaningTask }
  | { type: "upcoming-header" }
  | { type: "upcoming-task"; task: CleaningTask }
  | { type: "empty" }
  | { type: "all-done" };

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: tasks, isLoading: loadingTasks, refetch: refetchToday } = useListTasksDueToday();
  const { data: stats, refetch: refetchStats } = useGetStats();
  const { data: upcoming, refetch: refetchUpcoming } = useListUpcomingTasks();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchToday(), refetchStats(), refetchUpcoming()]);
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

  const sections = useMemo<Section[]>(() => {
    const rows: Section[] = [{ type: "header" }, { type: "stat-row" }];
    if (loadingTasks) {
      rows.push({ type: "empty" });
    } else if (!tasks || tasks.length === 0) {
      rows.push({ type: "all-done" });
    } else {
      for (const [room, roomTasks] of Object.entries(grouped)) {
        rows.push({ type: "section-title", title: room, count: roomTasks.length });
        for (const task of roomTasks) {
          rows.push({ type: "task", task });
        }
      }
    }
    if (upcoming && upcoming.length > 0) {
      rows.push({ type: "upcoming-header" });
      for (const task of upcoming) {
        rows.push({ type: "upcoming-task", task });
      }
    }
    return rows;
  }, [tasks, grouped, loadingTasks, upcoming]);

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 + 50 : insets.bottom + 50;

  const renderItem = ({ item }: { item: Section }) => {
    switch (item.type) {
      case "header":
        return (
          <View style={[styles.headerRow, { paddingTop: topPad }]}>
            <Text style={[styles.heading, { color: colors.foreground }]}>Today</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {format(new Date(), "EEEE, MMMM d")}
            </Text>
          </View>
        );

      case "stat-row":
        return (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{stats?.dueTodayCount ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Due</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.statNum, { color: colors.destructive }]}>{stats?.overdueCount ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Overdue</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{stats?.completedThisWeek ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Done this week</Text>
            </View>
          </View>
        );

      case "empty":
        return (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        );

      case "all-done":
        return (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All caught up!</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tasks due today.</Text>
          </View>
        );

      case "section-title":
        return (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{item.title}</Text>
            <View style={[styles.countBadge, { backgroundColor: `${colors.primary}18` }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>{item.count}</Text>
            </View>
          </View>
        );

      case "task":
        return <TaskCard task={item.task} />;

      case "upcoming-header":
        return (
          <View style={[styles.upcomingHeader, { borderTopColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Coming Up</Text>
            <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.countText, { color: colors.mutedForeground }]}>next 7 days</Text>
            </View>
          </View>
        );

      case "upcoming-task":
        return (
          <View style={[styles.upcomingCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.upcomingInfo}>
              <Text style={[styles.upcomingName, { color: colors.foreground }]} numberOfLines={1}>
                {item.task.name}
              </Text>
              <Text style={[styles.upcomingMeta, { color: colors.mutedForeground }]}>
                {item.task.room} · {item.task.frequency}
              </Text>
            </View>
            {item.task.nextDueAt && (
              <Text style={[styles.upcomingDate, { color: colors.mutedForeground }]}>
                {format(parseISO(item.task.nextDueAt), "EEE, MMM d")}
              </Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <FlatList
      data={sections}
      keyExtractor={(item, i) => `${item.type}-${i}`}
      renderItem={renderItem}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      scrollEnabled={sections.length > 0}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 0,
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
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    padding: 12,
    gap: 2,
    alignItems: "center",
  },
  statNum: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Outfit_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyBox: {
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 6,
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
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Outfit_500Medium",
  },
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 10,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  upcomingCard: {
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  upcomingInfo: {
    flex: 1,
    gap: 2,
  },
  upcomingName: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
  upcomingMeta: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
  },
  upcomingDate: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Outfit_500Medium",
  },
});
