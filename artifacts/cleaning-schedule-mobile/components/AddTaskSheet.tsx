import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  CleaningTask,
  useCreateTask,
  useUpdateTask,
  useListTasks,
  useListMembers,
  getListTasksQueryKey,
  getListTasksDueTodayQueryKey,
  getListUpcomingTasksQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FREQUENCIES = ["daily", "weekly", "monthly", "custom"] as const;
type Frequency = (typeof FREQUENCIES)[number];

interface Props {
  visible: boolean;
  onClose: () => void;
  task?: CleaningTask;
}

export function AddTaskSheet({ visible, onClose, task }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { data: allTasks } = useListTasks();
  const { data: members } = useListMembers();

  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [customDays, setCustomDays] = useState("7");
  const [notes, setNotes] = useState("");
  const [assignedMemberId, setAssignedMemberId] = useState<number | null>(null);
  const [showRoomSuggestions, setShowRoomSuggestions] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const existingRooms = Array.from(
    new Set((allTasks ?? []).map((t) => t.room).filter(Boolean))
  );

  const filteredRooms = existingRooms.filter(
    (r) => r.toLowerCase().includes(room.toLowerCase()) && r !== room
  );

  useEffect(() => {
    if (visible) {
      if (task) {
        setName(task.name);
        setRoom(task.room);
        setFrequency(task.frequency as Frequency);
        setCustomDays(task.customIntervalDays?.toString() ?? "7");
        setNotes(task.notes ?? "");
        setAssignedMemberId(task.assignedMemberId ?? null);
      } else {
        setName("");
        setRoom("");
        setFrequency("weekly");
        setCustomDays("7");
        setNotes("");
        setAssignedMemberId(null);
      }
      setErrors({});
      setShowRoomSuggestions(false);
    }
  }, [visible, task]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!room.trim()) e.room = "Room is required";
    if (frequency === "custom" && (!customDays || isNaN(Number(customDays)) || Number(customDays) < 1)) {
      e.customDays = "Enter a valid number of days";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTasksDueTodayQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUpcomingTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const data = {
      name: name.trim(),
      room: room.trim(),
      frequency,
      customIntervalDays: frequency === "custom" ? Number(customDays) : null,
      notes: notes.trim() || null,
      assignedMemberId,
    };

    if (task) {
      updateTask.mutate(
        { id: task.id, data },
        { onSuccess: () => { invalidate(); onClose(); } }
      );
    } else {
      createTask.mutate(
        { data },
        { onSuccess: () => { invalidate(); onClose(); } }
      );
    }
  };

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {task ? "Edit Task" : "New Task"}
          </Text>
          <Pressable onPress={handleSubmit} disabled={isPending} hitSlop={8}>
            {isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="check" size={22} color={colors.primary} />
            )}
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>TASK NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: errors.name ? colors.destructive : colors.border, color: colors.foreground, borderRadius: colors.radius }]}
              placeholder="e.g. Vacuum living room"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: "" })); }}
              autoFocus={!task}
            />
            {errors.name ? <Text style={[styles.error, { color: colors.destructive }]}>{errors.name}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>ROOM</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: errors.room ? colors.destructive : colors.border, color: colors.foreground, borderRadius: colors.radius }]}
              placeholder="e.g. Kitchen"
              placeholderTextColor={colors.mutedForeground}
              value={room}
              onChangeText={(v) => { setRoom(v); setErrors((e) => ({ ...e, room: "" })); setShowRoomSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowRoomSuggestions(false), 150)}
            />
            {errors.room ? <Text style={[styles.error, { color: colors.destructive }]}>{errors.room}</Text> : null}
            {showRoomSuggestions && filteredRooms.length > 0 && (
              <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                {filteredRooms.map((r) => (
                  <Pressable key={r} onPress={() => { setRoom(r); setShowRoomSuggestions(false); }} style={[styles.suggestion, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.suggestionText, { color: colors.foreground }]}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>FREQUENCY</Text>
            <View style={styles.chips}>
              {FREQUENCIES.map((f) => (
                <Pressable key={f} onPress={() => setFrequency(f)} style={[styles.chip, { backgroundColor: frequency === f ? colors.primary : colors.muted, borderRadius: colors.radius - 4 }]}>
                  <Text style={[styles.chipText, { color: frequency === f ? colors.primaryForeground : colors.mutedForeground }]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {frequency === "custom" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>EVERY N DAYS</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: errors.customDays ? colors.destructive : colors.border, color: colors.foreground, borderRadius: colors.radius, width: 100 }]}
                keyboardType="number-pad"
                value={customDays}
                onChangeText={(v) => { setCustomDays(v); setErrors((e) => ({ ...e, customDays: "" })); }}
                placeholder="7"
                placeholderTextColor={colors.mutedForeground}
              />
              {errors.customDays ? <Text style={[styles.error, { color: colors.destructive }]}>{errors.customDays}</Text> : null}
            </View>
          )}

          {/* Assignee picker */}
          {members && members.length > 0 && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>ASSIGN TO (OPTIONAL)</Text>
              <View style={styles.chips}>
                <Pressable
                  onPress={() => setAssignedMemberId(null)}
                  style={[styles.chip, { backgroundColor: assignedMemberId === null ? colors.primary : colors.muted, borderRadius: colors.radius - 4 }]}
                >
                  <Text style={[styles.chipText, { color: assignedMemberId === null ? colors.primaryForeground : colors.mutedForeground }]}>
                    Anyone
                  </Text>
                </Pressable>
                {members.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setAssignedMemberId(m.id)}
                    style={[styles.chip, { backgroundColor: assignedMemberId === m.id ? colors.primary : colors.muted, borderRadius: colors.radius - 4 }]}
                  >
                    <Text style={[styles.chipText, { color: assignedMemberId === m.id ? colors.primaryForeground : colors.mutedForeground }]}>
                      {m.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
              placeholder="Any extra details…"
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
  form: {
    padding: 20,
    gap: 24,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  textarea: {
    minHeight: 80,
    paddingTop: 12,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Outfit_500Medium",
  },
  suggestions: {
    borderWidth: 1,
    overflow: "hidden",
    marginTop: -4,
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  error: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
  },
});
