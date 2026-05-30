import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import {
  CleaningTask,
  useCompleteTask,
  useDeleteTask,
  getListTasksDueTodayQueryKey,
  getListTasksQueryKey,
  getGetStatsQueryKey,
  getListUpcomingTasksQueryKey,
  getListCompletionsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AddTaskSheet } from "@/components/AddTaskSheet";
import { format, parseISO } from "date-fns";

function frequencyLabel(task: CleaningTask): string {
  if (task.frequency === "custom" && task.customIntervalDays) {
    return `Every ${task.customIntervalDays}d`;
  }
  return task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1);
}

function dueDateLabel(task: CleaningTask): string | null {
  if (!task.nextDueAt) return null;
  return format(parseISO(task.nextDueAt), "MMM d");
}

interface TaskCardProps {
  task: CleaningTask;
  showComplete?: boolean;
}

export function TaskCard({ task, showComplete = true }: TaskCardProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const [editOpen, setEditOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksDueTodayQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUpcomingTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCompletionsQueryKey() });
  };

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeTask.mutate({ id: task.id }, { onSuccess: invalidate });
  };

  const handleMenu = () => {
    Alert.alert(task.name, undefined, [
      { text: "Edit", onPress: () => setEditOpen(true) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert("Delete task?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => {
                deleteTask.mutate({ id: task.id }, { onSuccess: invalidate });
              },
            },
          ]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const dueLabel = dueDateLabel(task);

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        {showComplete && (
          <Pressable
            onPress={handleComplete}
            disabled={completeTask.isPending}
            style={[
              styles.completeBtn,
              {
                borderColor: task.isOverdue ? colors.destructive : colors.primary,
                backgroundColor: "transparent",
              },
            ]}
            hitSlop={8}
          >
            {completeTask.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="check" size={16} color={task.isOverdue ? colors.destructive : colors.primary} />
            )}
          </Pressable>
        )}

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {task.name}
          </Text>
          <View style={styles.meta}>
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                {task.room}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                {frequencyLabel(task)}
              </Text>
            </View>
            {dueLabel && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: task.isOverdue
                      ? `${colors.destructive}18`
                      : colors.muted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: task.isOverdue ? colors.destructive : colors.mutedForeground },
                  ]}
                >
                  {task.isOverdue ? "Overdue" : dueLabel}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Pressable onPress={handleMenu} hitSlop={8} style={styles.menuBtn}>
          <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <AddTaskSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        task={task}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  completeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 5,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Outfit_500Medium",
  },
  menuBtn: {
    padding: 4,
    flexShrink: 0,
  },
});
