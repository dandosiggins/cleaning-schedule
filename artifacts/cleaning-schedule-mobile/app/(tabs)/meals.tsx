import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import {
  useListMeals,
  useCreateMeal,
  useDeleteMealPlan,
  useListShopping,
  useCreateShoppingItem,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  getListMealsQueryKey,
  getListShoppingQueryKey,
} from "@workspace/api-client-react";
import type { MealType, MealPlan } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABELS: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

function getWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

interface AddMealModalProps {
  visible: boolean;
  dayOfWeek: number;
  mealType: MealType;
  weekStart: string;
  onClose: () => void;
}

function AddMealModal({ visible, dayOfWeek, mealType, weekStart, onClose }: AddMealModalProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const createMeal = useCreateMeal();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    createMeal.mutate(
      { weekStart, dayOfWeek, mealType, title: title.trim(), notes: notes.trim() || null },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMealsQueryKey({ weekStart }) });
          setTitle("");
          setNotes("");
          onClose();
        },
      }
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {MEAL_LABELS[mealType]} · {DAYS[dayOfWeek]}
            </Text>
            <TextInput
              autoFocus
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius - 4 }]}
              placeholder="e.g. Pasta carbonara"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius - 4 }]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
            />
            <View style={styles.modalBtns}>
              <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}>
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={!title.trim() || createMeal.isPending}
                style={[styles.modalBtn, { backgroundColor: title.trim() ? colors.primary : colors.muted, borderRadius: colors.radius - 4 }]}
              >
                {createMeal.isPending
                  ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                  : <Text style={[styles.modalBtnText, { color: title.trim() ? colors.primaryForeground : colors.mutedForeground }]}>Add</Text>}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

export default function MealsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [weekOffset, setWeekOffset] = useState(0);
  const [addCell, setAddCell] = useState<{ dayOfWeek: number; mealType: MealType } | null>(null);
  const [activeTab, setActiveTab] = useState<"planner" | "shopping">("planner");
  const [shoppingInput, setShoppingInput] = useState("");

  const baseDate = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return weekOffset >= 0 ? addWeeks(base, weekOffset) : subWeeks(base, -weekOffset);
  }, [weekOffset]);

  const weekStart = getWeekStart(baseDate);
  const weekLabel = `${format(baseDate, "MMM d")} – ${format(addDays(baseDate, 6), "MMM d")}`;

  const { data: meals = [] } = useListMeals({ weekStart });
  const { data: shopping = [] } = useListShopping({ weekStart });
  const deleteMeal = useDeleteMealPlan();
  const createShoppingItem = useCreateShoppingItem();
  const toggleShopping = useToggleShoppingItem();
  const deleteShopping = useDeleteShoppingItem();

  const mealGrid = useMemo(() => {
    const grid: Record<string, MealPlan[]> = {};
    for (const m of meals) {
      const key = `${m.dayOfWeek}-${m.mealType}`;
      if (!grid[key]) grid[key] = [];
      grid[key].push(m);
    }
    return grid;
  }, [meals]);

  const invalidateMeals = () => queryClient.invalidateQueries({ queryKey: getListMealsQueryKey({ weekStart }) });
  const invalidateShopping = () => queryClient.invalidateQueries({ queryKey: getListShoppingQueryKey({ weekStart }) });

  const handleAddShopping = () => {
    if (!shoppingInput.trim()) return;
    createShoppingItem.mutate(
      { weekStart, name: shoppingInput.trim() },
      { onSuccess: () => { setShoppingInput(""); invalidateShopping(); } }
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 84 + 16 : insets.bottom + 16;

  const checkedCount = shopping.filter((i) => i.checked).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.heading, { color: colors.foreground }]}>Meals</Text>
            <Text style={[styles.weekLabel, { color: colors.mutedForeground }]}>{weekLabel}</Text>
          </View>
          <View style={styles.weekNav}>
            <Pressable
              onPress={() => setWeekOffset((w) => w - 1)}
              style={[styles.navBtn, { borderColor: colors.border, borderRadius: colors.radius - 4 }]}
            >
              <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={() => setWeekOffset(0)}
              style={[styles.thisWeekBtn, { borderColor: colors.border, borderRadius: colors.radius - 4 }]}
            >
              <Text style={[styles.thisWeekText, { color: colors.mutedForeground }]}>Now</Text>
            </Pressable>
            <Pressable
              onPress={() => setWeekOffset((w) => w + 1)}
              style={[styles.navBtn, { borderColor: colors.border, borderRadius: colors.radius - 4 }]}
            >
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.muted, borderRadius: colors.radius - 2 }]}>
          {(["planner", "shopping"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                { borderRadius: colors.radius - 4 },
                activeTab === tab && { backgroundColor: colors.card },
              ]}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? colors.foreground : colors.mutedForeground }]}>
                {tab === "planner" ? "Planner" : `Shopping${shopping.length > 0 ? ` (${shopping.length})` : ""}`}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "planner" ? (
          /* Meal Planner */
          <View style={styles.plannerGrid}>
            {DAYS.map((day, dayOfWeek) => (
              <View key={day} style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayName, { color: colors.foreground }]}>{day}</Text>
                  <Text style={[styles.dayDate, { color: colors.mutedForeground }]}>
                    {format(addDays(baseDate, dayOfWeek), "d")}
                  </Text>
                </View>
                {MEAL_TYPES.map((mealType) => {
                  const cellMeals = mealGrid[`${dayOfWeek}-${mealType}`] ?? [];
                  return (
                    <View key={mealType} style={styles.mealRow}>
                      <Text style={[styles.mealTypeLabel, { color: colors.mutedForeground }]}>
                        {MEAL_LABELS[mealType].slice(0, 5)}
                      </Text>
                      <View style={styles.mealItems}>
                        {cellMeals.map((m) => (
                          <Pressable
                            key={m.id}
                            onLongPress={() =>
                              Alert.alert(m.title, m.notes ?? undefined, [
                                { text: "Delete", style: "destructive", onPress: () => deleteMeal.mutate({ id: m.id }, { onSuccess: invalidateMeals }) },
                                { text: "Cancel", style: "cancel" },
                              ])
                            }
                            style={[styles.mealChip, { backgroundColor: `${colors.primary}15`, borderRadius: colors.radius - 6 }]}
                          >
                            <Text style={[styles.mealChipText, { color: colors.primary }]} numberOfLines={2}>{m.title}</Text>
                          </Pressable>
                        ))}
                        <Pressable
                          onPress={() => setAddCell({ dayOfWeek, mealType })}
                          style={[styles.addMealBtn, { borderColor: colors.border, borderRadius: colors.radius - 6 }]}
                        >
                          <Feather name="plus" size={12} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          /* Shopping List */
          <View style={styles.shoppingSection}>
            <View style={styles.shoppingInputRow}>
              <TextInput
                style={[styles.shoppingInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius - 4, flex: 1 }]}
                placeholder="Add an item…"
                placeholderTextColor={colors.mutedForeground}
                value={shoppingInput}
                onChangeText={setShoppingInput}
                onSubmitEditing={handleAddShopping}
                returnKeyType="done"
              />
              <Pressable
                onPress={handleAddShopping}
                disabled={!shoppingInput.trim()}
                style={[styles.shoppingAddBtn, { backgroundColor: shoppingInput.trim() ? colors.primary : colors.muted, borderRadius: colors.radius - 4 }]}
              >
                <Feather name="plus" size={20} color={shoppingInput.trim() ? colors.primaryForeground : colors.mutedForeground} />
              </Pressable>
            </View>

            {shopping.length > 0 && (
              <Text style={[styles.shoppingMeta, { color: colors.mutedForeground }]}>
                {checkedCount}/{shopping.length} done
              </Text>
            )}

            {shopping.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Feather name="shopping-cart" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No items yet</Text>
              </View>
            ) : (
              <View style={[styles.shoppingList, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                {shopping.map((item, idx) => (
                  <View
                    key={item.id}
                    style={[
                      styles.shoppingItem,
                      idx < shopping.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    ]}
                  >
                    <Pressable
                      onPress={() => toggleShopping.mutate({ id: item.id, checked: !item.checked }, { onSuccess: invalidateShopping })}
                      style={[
                        styles.checkbox,
                        {
                          borderColor: item.checked ? colors.primary : colors.border,
                          backgroundColor: item.checked ? colors.primary : "transparent",
                          borderRadius: 5,
                        },
                      ]}
                    >
                      {item.checked && <Feather name="check" size={12} color={colors.primaryForeground} />}
                    </Pressable>
                    <Text
                      style={[
                        styles.shoppingItemName,
                        { color: item.checked ? colors.mutedForeground : colors.foreground },
                        item.checked && styles.strikethrough,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Pressable
                      onPress={() => deleteShopping.mutate({ id: item.id }, { onSuccess: invalidateShopping })}
                      hitSlop={8}
                    >
                      <Feather name="x" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {addCell && (
        <AddMealModal
          visible
          dayOfWeek={addCell.dayOfWeek}
          mealType={addCell.mealType}
          weekStart={weekStart}
          onClose={() => setAddCell(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heading: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "Outfit_700Bold",
  },
  weekLabel: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    marginTop: 2,
  },
  weekNav: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  navBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thisWeekBtn: {
    paddingHorizontal: 10,
    height: 34,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thisWeekText: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    fontWeight: "500",
  },
  tabs: {
    flexDirection: "row",
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Outfit_500Medium",
  },
  plannerGrid: {
    gap: 10,
  },
  dayCard: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 2,
  },
  dayName: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Outfit_700Bold",
  },
  dayDate: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  mealTypeLabel: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
    letterSpacing: 0.4,
    width: 36,
    paddingTop: 5,
    textTransform: "uppercase",
  },
  mealItems: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  mealChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 160,
  },
  mealChipText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Outfit_500Medium",
  },
  addMealBtn: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  shoppingSection: {
    gap: 12,
  },
  shoppingInputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  shoppingInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  shoppingAddBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  shoppingMeta: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    textAlign: "right",
    marginTop: -4,
  },
  emptyBox: {
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
  },
  shoppingList: {
    borderWidth: 1,
    overflow: "hidden",
  },
  shoppingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  shoppingItemName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    borderWidth: 1,
    padding: 20,
    gap: 12,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  modalBtns: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  modalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Outfit_600SemiBold",
  },
});
