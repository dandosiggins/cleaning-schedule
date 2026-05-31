import { Router } from "express";
import { db, mealPlansTable, shoppingItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /meals?weekStart=2026-05-25
router.get("/meals", async (req, res) => {
  const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : null;
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return res.status(400).json({ error: "weekStart (YYYY-MM-DD) is required" });
  }
  const meals = await db.select().from(mealPlansTable).where(eq(mealPlansTable.weekStart, weekStart));
  return res.json(meals.map(m => ({
    id: m.id,
    weekStart: m.weekStart,
    dayOfWeek: m.dayOfWeek,
    mealType: m.mealType,
    title: m.title,
    notes: m.notes ?? null,
    createdAt: m.createdAt.toISOString(),
  })));
});

// POST /meals
router.post("/meals", async (req, res) => {
  const { weekStart, dayOfWeek, mealType, title, notes } = req.body ?? {};
  if (!weekStart || typeof dayOfWeek !== "number" || !mealType || !title?.trim()) {
    return res.status(400).json({ error: "weekStart, dayOfWeek, mealType, title are required" });
  }
  if (!["breakfast", "lunch", "dinner"].includes(mealType)) {
    return res.status(400).json({ error: "mealType must be breakfast, lunch, or dinner" });
  }
  const [meal] = await db.insert(mealPlansTable).values({
    weekStart,
    dayOfWeek,
    mealType,
    title: title.trim(),
    notes: notes?.trim() || null,
  }).returning();
  return res.status(201).json({
    id: meal.id,
    weekStart: meal.weekStart,
    dayOfWeek: meal.dayOfWeek,
    mealType: meal.mealType,
    title: meal.title,
    notes: meal.notes ?? null,
    createdAt: meal.createdAt.toISOString(),
  });
});

// DELETE /meals/:id
router.delete("/meals/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const existing = await db.select({ id: mealPlansTable.id }).from(mealPlansTable).where(eq(mealPlansTable.id, id));
  if (!existing[0]) return res.status(404).json({ error: "Meal not found" });
  await db.delete(mealPlansTable).where(eq(mealPlansTable.id, id));
  return res.status(204).end();
});

// GET /shopping?weekStart=2026-05-25
router.get("/shopping", async (req, res) => {
  const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : null;
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return res.status(400).json({ error: "weekStart (YYYY-MM-DD) is required" });
  }
  const items = await db.select().from(shoppingItemsTable).where(eq(shoppingItemsTable.weekStart, weekStart));
  return res.json(items.map(i => ({
    id: i.id,
    weekStart: i.weekStart,
    name: i.name,
    checked: i.checked,
    createdAt: i.createdAt.toISOString(),
  })));
});

// POST /shopping
router.post("/shopping", async (req, res) => {
  const { weekStart, name } = req.body ?? {};
  if (!weekStart || !name?.trim()) {
    return res.status(400).json({ error: "weekStart and name are required" });
  }
  const [item] = await db.insert(shoppingItemsTable).values({
    weekStart,
    name: name.trim(),
    checked: false,
  }).returning();
  return res.status(201).json({
    id: item.id,
    weekStart: item.weekStart,
    name: item.name,
    checked: item.checked,
    createdAt: item.createdAt.toISOString(),
  });
});

// PATCH /shopping/:id
router.patch("/shopping/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const checked = req.body?.checked;
  if (typeof checked !== "boolean") return res.status(400).json({ error: "checked (boolean) is required" });
  const existing = await db.select().from(shoppingItemsTable).where(eq(shoppingItemsTable.id, id));
  if (!existing[0]) return res.status(404).json({ error: "Item not found" });
  const [item] = await db.update(shoppingItemsTable).set({ checked }).where(eq(shoppingItemsTable.id, id)).returning();
  return res.json({ id: item.id, weekStart: item.weekStart, name: item.name, checked: item.checked, createdAt: item.createdAt.toISOString() });
});

// DELETE /shopping/:id
router.delete("/shopping/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const existing = await db.select({ id: shoppingItemsTable.id }).from(shoppingItemsTable).where(eq(shoppingItemsTable.id, id));
  if (!existing[0]) return res.status(404).json({ error: "Item not found" });
  await db.delete(shoppingItemsTable).where(eq(shoppingItemsTable.id, id));
  return res.status(204).end();
});

export default router;
