import React, { useState, useMemo } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, ShoppingCart, Trash2, Plus, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import type { MealPlan, MealType, ShoppingItem } from "@workspace/api-client-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};
const MEAL_COLORS: Record<MealType, string> = {
  breakfast: "bg-amber-50 border-amber-200 text-amber-800",
  lunch: "bg-sky-50 border-sky-200 text-sky-800",
  dinner: "bg-violet-50 border-violet-200 text-violet-800",
};

function getWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function toMealArray(data: unknown): MealPlan[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const value = data as { meals?: unknown; data?: unknown };
    if (Array.isArray(value.meals)) return value.meals as MealPlan[];
    if (Array.isArray(value.data)) return value.data as MealPlan[];
  }
  return [];
}

function toShoppingArray(data: unknown): ShoppingItem[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const value = data as { shopping?: unknown; items?: unknown; data?: unknown };
    if (Array.isArray(value.shopping)) return value.shopping as ShoppingItem[];
    if (Array.isArray(value.items)) return value.items as ShoppingItem[];
    if (Array.isArray(value.data)) return value.data as ShoppingItem[];
  }
  return [];
}

interface AddMealPopoverProps {
  dayOfWeek: number;
  mealType: MealType;
  weekStart: string;
  onClose: () => void;
}

function AddMealPopover({ dayOfWeek, mealType, weekStart, onClose }: AddMealPopoverProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const createMeal = useCreateMeal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMeal.mutate(
      { data: { weekStart, dayOfWeek, mealType, title: title.trim(), notes: notes.trim() || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMealsQueryKey({ weekStart }) });
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-xl p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-foreground mb-4">
          Add {MEAL_LABELS[mealType]} · {DAYS[dayOfWeek]}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            className="border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. Pasta carbonara"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2 justify-end mt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || createMeal.isPending}
              className="px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MealsPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [addCell, setAddCell] = useState<{ dayOfWeek: number; mealType: MealType } | null>(null);
  const [shoppingInput, setShoppingInput] = useState("");

  const baseDate = useMemo(() => {
    const now = new Date();
    const base = startOfWeek(now, { weekStartsOn: 1 });
    return weekOffset >= 0 ? addWeeks(base, weekOffset) : subWeeks(base, -weekOffset);
  }, [weekOffset]);

  const weekStart = getWeekStart(baseDate);
  const queryClient = useQueryClient();

  const { data: mealsData } = useListMeals({ weekStart });
  const { data: shoppingData } = useListShopping({ weekStart });
  const createShoppingItem = useCreateShoppingItem();
  const toggleShoppingItem = useToggleShoppingItem();
  const deleteShoppingItem = useDeleteShoppingItem();
  const deleteMeal = useDeleteMealPlan();
  const meals = useMemo(() => toMealArray(mealsData), [mealsData]);
  const shopping = useMemo(() => toShoppingArray(shoppingData), [shoppingData]);
  const safeMeals = Array.isArray(meals) ? meals : [];
  const safeShopping = Array.isArray(shopping) ? shopping : [];

  const mealGrid = useMemo(() => {
    const grid: Record<string, MealPlan[]> = {};
    for (const m of safeMeals) {
      const key = `${m.dayOfWeek}-${m.mealType}`;
      if (!grid[key]) grid[key] = [];
      grid[key].push(m);
    }
    return grid;
  }, [safeMeals]);

  const invalidateMeals = () => queryClient.invalidateQueries({ queryKey: getListMealsQueryKey({ weekStart }) });
  const invalidateShopping = () => queryClient.invalidateQueries({ queryKey: getListShoppingQueryKey({ weekStart }) });

  const handleAddShopping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shoppingInput.trim()) return;
    createShoppingItem.mutate(
      { data: { weekStart, name: shoppingInput.trim() } },
      { onSuccess: () => { setShoppingInput(""); invalidateShopping(); } }
    );
  };

  const weekLabel = `${format(baseDate, "MMM d")} – ${format(addDays(baseDate, 6), "MMM d, yyyy")}`;
  const checkedCount = safeShopping.filter((i) => i.checked).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Meals</h1>
          <p className="text-muted-foreground mt-1">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 text-sm rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground font-medium"
          >
            This week
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meal Grid */}
      <div className="overflow-x-auto -mx-4 md:mx-0">
        <div className="min-w-[640px] px-4 md:px-0">
          <div className="grid grid-cols-8 gap-2">
            {/* Header row */}
            <div />
            {DAYS.map((day, i) => (
              <div key={day} className="text-center">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{day}</div>
                <div className="text-sm font-medium text-foreground">{format(addDays(baseDate, i), "d")}</div>
              </div>
            ))}

            {/* Meal rows */}
            {MEAL_TYPES.map((mealType) => (
              <React.Fragment key={mealType}>
                <div className="flex items-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {MEAL_LABELS[mealType]}
                  </span>
                </div>
                {DAYS.map((_, dayOfWeek) => {
                  const key = `${dayOfWeek}-${mealType}`;
                  const cellMeals = mealGrid[key] ?? [];
                  return (
                    <div
                      key={`${mealType}-${dayOfWeek}`}
                      className="min-h-[72px] rounded-xl border border-dashed border-border bg-muted/30 p-1.5 flex flex-col gap-1 group"
                    >
                      {cellMeals.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium flex items-start justify-between gap-1 ${MEAL_COLORS[mealType]}`}
                        >
                          <span className="flex-1 leading-snug">{m.title}</span>
                          <button
                            onClick={() => deleteMeal.mutate({ id: m.id }, { onSuccess: invalidateMeals })}
                            className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-current/60 hover:text-current shrink-0 transition-opacity mt-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setAddCell({ dayOfWeek, mealType })}
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-all py-0.5 rounded-lg hover:bg-muted"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Shopping List */}
      <div className="border border-border rounded-2xl bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Shopping List</h2>
          {safeShopping.length > 0 && (
            <span className="ml-auto text-sm text-muted-foreground">
              {checkedCount}/{safeShopping.length} done
            </span>
          )}
        </div>

        <form onSubmit={handleAddShopping} className="flex gap-2 mb-4">
          <input
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Add an item…"
            value={shoppingInput}
            onChange={(e) => setShoppingInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={!shoppingInput.trim()}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {safeShopping.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No items yet — add groceries above.</p>
        ) : (
          <ul className="space-y-1.5">
            {safeShopping.map((item) => (
              <li key={item.id} className="flex items-center gap-3 group py-1">
                <button
                  onClick={() => toggleShoppingItem.mutate({ id: item.id, data: { checked: !item.checked } }, { onSuccess: invalidateShopping })}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    item.checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border hover:border-primary"
                  }`}
                >
                  {item.checked && <Check className="w-3 h-3" />}
                </button>
                <span className={`flex-1 text-sm ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.name}
                </span>
                <button
                  onClick={() => deleteShoppingItem.mutate({ id: item.id }, { onSuccess: invalidateShopping })}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {addCell && (
        <AddMealPopover
          dayOfWeek={addCell.dayOfWeek}
          mealType={addCell.mealType}
          weekStart={weekStart}
          onClose={() => setAddCell(null)}
        />
      )}
    </div>
  );
}
