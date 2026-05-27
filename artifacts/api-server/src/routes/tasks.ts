import { Router } from "express";
import { db, cleaningTasksTable, taskCompletionsTable } from "@workspace/db";
import { eq, desc, and, lte, gte, sql } from "drizzle-orm";
import {
  CreateTaskBody,
  UpdateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  DeleteTaskParams,
  CompleteTaskParams,
  CompleteTaskBody,
  ListCompletionsQueryParams,
} from "@workspace/api-zod";

const router = Router();

function computeNextDueAt(frequency: string, customIntervalDays: number | null | undefined, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === "custom" && customIntervalDays) {
    next.setDate(next.getDate() + customIntervalDays);
  } else {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

function toApiTask(task: typeof cleaningTasksTable.$inferSelect) {
  const now = new Date();
  const isOverdue = task.nextDueAt != null && task.nextDueAt < now;
  return {
    id: task.id,
    name: task.name,
    room: task.room,
    frequency: task.frequency,
    customIntervalDays: task.customIntervalDays ?? null,
    notes: task.notes ?? null,
    lastCompletedAt: task.lastCompletedAt?.toISOString() ?? null,
    nextDueAt: task.nextDueAt?.toISOString() ?? null,
    isOverdue,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

// GET /tasks
router.get("/tasks", async (_req, res) => {
  const tasks = await db.select().from(cleaningTasksTable).orderBy(cleaningTasksTable.room, cleaningTasksTable.name);
  res.json(tasks.map(toApiTask));
});

// POST /tasks
router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error });
  }
  const { name, room, frequency, customIntervalDays, notes } = parsed.data;
  const nextDueAt = computeNextDueAt(frequency, customIntervalDays);
  const [task] = await db.insert(cleaningTasksTable).values({
    name,
    room,
    frequency,
    customIntervalDays: customIntervalDays ?? null,
    notes: notes ?? null,
    nextDueAt,
  }).returning();
  return res.status(201).json(toApiTask(task));
});

// GET /tasks/due-today
router.get("/tasks/due-today", async (_req, res) => {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const tasks = await db.select().from(cleaningTasksTable).where(
    lte(cleaningTasksTable.nextDueAt, endOfDay)
  ).orderBy(cleaningTasksTable.nextDueAt);
  res.json(tasks.map(toApiTask));
});

// GET /tasks/upcoming
router.get("/tasks/upcoming", async (_req, res) => {
  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const tasks = await db.select().from(cleaningTasksTable).where(
    and(
      gte(cleaningTasksTable.nextDueAt, now),
      lte(cleaningTasksTable.nextDueAt, in7Days)
    )
  ).orderBy(cleaningTasksTable.nextDueAt);
  res.json(tasks.map(toApiTask));
});

// GET /tasks/stats
router.get("/tasks/stats", async (_req, res) => {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const allTasks = await db.select().from(cleaningTasksTable);
  const totalTasks = allTasks.length;
  const dueTodayCount = allTasks.filter(t => t.nextDueAt != null && t.nextDueAt <= endOfToday).length;
  const overdueCount = allTasks.filter(t => t.nextDueAt != null && t.nextDueAt < now).length;

  const weekCompletions = await db.select({ count: sql<number>`count(*)` })
    .from(taskCompletionsTable)
    .where(gte(taskCompletionsTable.completedAt, startOfWeek));
  const monthCompletions = await db.select({ count: sql<number>`count(*)` })
    .from(taskCompletionsTable)
    .where(gte(taskCompletionsTable.completedAt, startOfMonth));

  res.json({
    totalTasks,
    dueTodayCount,
    overdueCount,
    completedThisWeek: Number(weekCompletions[0]?.count ?? 0),
    completedThisMonth: Number(monthCompletions[0]?.count ?? 0),
  });
});

// GET /tasks/:id
router.get("/tasks/:id", async (req, res) => {
  const parsed = GetTaskParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const [task] = await db.select().from(cleaningTasksTable).where(eq(cleaningTasksTable.id, parsed.data.id));
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(toApiTask(task));
});

// PUT /tasks/:id
router.put("/tasks/:id", async (req, res) => {
  const paramsParsed = UpdateTaskParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });
  const bodyParsed = UpdateTaskBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid input" });

  const existing = await db.select().from(cleaningTasksTable).where(eq(cleaningTasksTable.id, paramsParsed.data.id));
  if (!existing[0]) return res.status(404).json({ error: "Task not found" });

  const updates: Partial<typeof cleaningTasksTable.$inferInsert> = {
    ...bodyParsed.data,
    updatedAt: new Date(),
  };
  if (bodyParsed.data.frequency) {
    const freq = bodyParsed.data.frequency;
    const interval = bodyParsed.data.customIntervalDays ?? existing[0].customIntervalDays;
    const base = existing[0].lastCompletedAt ?? new Date();
    updates.nextDueAt = computeNextDueAt(freq, interval, base);
  }

  const [task] = await db.update(cleaningTasksTable)
    .set(updates)
    .where(eq(cleaningTasksTable.id, paramsParsed.data.id))
    .returning();
  res.json(toApiTask(task));
});

// DELETE /tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  const parsed = DeleteTaskParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const existing = await db.select({ id: cleaningTasksTable.id }).from(cleaningTasksTable).where(eq(cleaningTasksTable.id, parsed.data.id));
  if (!existing[0]) return res.status(404).json({ error: "Task not found" });
  await db.delete(cleaningTasksTable).where(eq(cleaningTasksTable.id, parsed.data.id));
  res.status(204).end();
});

// POST /tasks/:id/complete
router.post("/tasks/:id/complete", async (req, res) => {
  const paramsParsed = CompleteTaskParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = CompleteTaskBody.safeParse(req.body ?? {});
  const notes = bodyParsed.success ? (bodyParsed.data.notes ?? null) : null;

  const [task] = await db.select().from(cleaningTasksTable).where(eq(cleaningTasksTable.id, paramsParsed.data.id));
  if (!task) return res.status(404).json({ error: "Task not found" });

  const now = new Date();
  const nextDueAt = computeNextDueAt(task.frequency, task.customIntervalDays, now);

  await db.update(cleaningTasksTable)
    .set({ lastCompletedAt: now, nextDueAt, updatedAt: now })
    .where(eq(cleaningTasksTable.id, task.id));

  const [completion] = await db.insert(taskCompletionsTable).values({
    taskId: task.id,
    notes,
    completedAt: now,
  }).returning();

  res.status(201).json({
    id: completion.id,
    taskId: task.id,
    taskName: task.name,
    room: task.room,
    completedAt: completion.completedAt.toISOString(),
    notes: completion.notes ?? null,
  });
});

// GET /completions
router.get("/completions", async (req, res) => {
  const parsed = ListCompletionsQueryParams.safeParse({
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  const limit = parsed.success && parsed.data.limit ? parsed.data.limit : 20;

  const completions = await db
    .select({
      id: taskCompletionsTable.id,
      taskId: taskCompletionsTable.taskId,
      taskName: cleaningTasksTable.name,
      room: cleaningTasksTable.room,
      completedAt: taskCompletionsTable.completedAt,
      notes: taskCompletionsTable.notes,
    })
    .from(taskCompletionsTable)
    .leftJoin(cleaningTasksTable, eq(taskCompletionsTable.taskId, cleaningTasksTable.id))
    .orderBy(desc(taskCompletionsTable.completedAt))
    .limit(limit);

  res.json(completions.map(c => ({
    id: c.id,
    taskId: c.taskId,
    taskName: c.taskName ?? "Unknown Task",
    room: c.room ?? "Unknown Room",
    completedAt: c.completedAt.toISOString(),
    notes: c.notes ?? null,
  })));
});

export default router;
