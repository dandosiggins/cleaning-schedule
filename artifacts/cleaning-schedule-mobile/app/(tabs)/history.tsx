import React, { useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import { useListCompletions, TaskCompletion } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type Row =
  | { type: "header" }
  | { type: "loading" }
  | { type: "empty" }
  | { type: "day"; date: string; items: TaskCompletion[] };

function groupByDay(completions: TaskCompletion[]): Row[] {
  const map: Record<string, TaskCompletion[]> = {};
  for (const c of completions) {
    const day = format(parseISO(c.completedAt), "yyyy-MM-dd");
    if (!map[day]) map[day] = [];
    map[day].push(c);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ type: "day" as const, date, items }));
}

function dayLabel(dateStr: string): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return format(parseISO(dateStr), "EEEE, MMM d");
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: completions, isLoading, refetch } = useListCompletions({ limit: 100 });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 + 50 : insets.bottom + 50;

  const rows: Row[] = [
    { type: "header" },
    ...(isLoading
      ? [{ type: "loading" as const }]
      : !completions || completions.length === 0
      ? [{ type: "empty" as const }]
      : groupByDay(completions)),
  ];

  const renderItem = ({ item }: { item: Row }) => {
    switch (item.type) {
      case "header":
        return (
          <View style={[styles.headerRow, { paddingTop: topPad }]}>
            <Text style={[styles.heading, { color: colors.foreground }]}>History</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {completions?.length ?? 0} completions
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
            <Feather name="clock" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No history yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Completed tasks will appear here
            </Text>
          </View>
        );

      case "day":
        return (
          <View style={styles.dayGroup}>
            <Text style={[styles.dayLabel, { color: colors.mutedForeground }]}>
              {dayLabel(item.date)}
            </Text>
            {item.items.map((c) => (
              <View
                key={c.id}
                style={[styles.completionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
              >
                <View style={[styles.checkCircle, { backgroundColor: `${colors.primary}18` }]}>
                  <Feather name="check" size={14} color={colors.primary} />
                </View>
                <View style={styles.completionInfo}>
                  <Text style={[styles.completionName, { color: colors.foreground }]} numberOfLines={1}>
                    {c.taskName}
                  </Text>
                  <Text style={[styles.completionMeta, { color: colors.mutedForeground }]}>
                    {c.room} · {format(parseISO(c.completedAt), "h:mm a")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, i) => `${item.type}-${i}`}
      renderItem={renderItem}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
      scrollEnabled={rows.length > 1}
    />
  );
}

const styles = StyleSheet.create({
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
  },
  dayGroup: {
    marginBottom: 16,
    gap: 6,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 8,
  },
  completionCard: {
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  completionInfo: {
    flex: 1,
    gap: 2,
  },
  completionName: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
  completionMeta: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
  },
});
