import { pgTable, serial, text, integer, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cleaningTasksTable = pgTable("cleaning_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  room: text("room").notNull(),
  frequency: text("frequency").notNull(), // daily | weekly | monthly | custom
  customIntervalDays: integer("custom_interval_days"),
  notes: text("notes"),
  assignedMemberId: integer("assigned_member_id").references(() => membersTable.id, { onDelete: "set null" }),
  lastCompletedAt: timestamp("last_completed_at"),
  nextDueAt: timestamp("next_due_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taskCompletionsTable = pgTable("task_completions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => cleaningTasksTable.id, { onDelete: "cascade" }),
  notes: text("notes"),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;

export const insertCleaningTaskSchema = createInsertSchema(cleaningTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCleaningTask = z.infer<typeof insertCleaningTaskSchema>;
export type CleaningTask = typeof cleaningTasksTable.$inferSelect;

export const insertTaskCompletionSchema = createInsertSchema(taskCompletionsTable).omit({ id: true, completedAt: true });
export type InsertTaskCompletion = z.infer<typeof insertTaskCompletionSchema>;
export type TaskCompletion = typeof taskCompletionsTable.$inferSelect;

export const mealPlansTable = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull(), // ISO date string of Monday
  dayOfWeek: integer("day_of_week").notNull(), // 0=Mon … 6=Sun
  mealType: text("meal_type").notNull(), // breakfast | lunch | dinner
  title: text("title").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shoppingItemsTable = pgTable("shopping_items", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull(),
  name: text("name").notNull(),
  checked: boolean("checked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MealPlan = typeof mealPlansTable.$inferSelect;
export type InsertMealPlan = typeof mealPlansTable.$inferInsert;
export type ShoppingItem = typeof shoppingItemsTable.$inferSelect;
export type InsertShoppingItem = typeof shoppingItemsTable.$inferInsert;
