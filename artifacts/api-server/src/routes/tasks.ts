import { Router } from "express";
import { db, cleaningTasksTable, taskCompletionsTable, membersTable } from "@workspace/db";
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

function computeNextDueAt(frequency: string, customIntervalDays: number | null | undefined, fromDate: Date = new Date()): Date | null {
  const next = new Date(fromDate);
  if (frequency === "once") {
    return null;
  } else if (frequency === "daily") {
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

type TaskRow = typeof cleaningTasksTable.$inferSelect;

function toApiTask(task: TaskRow, memberName?: string | null) {
  const now = new Date();
  const isOverdue = task.nextDueAt != null && task.nextDueAt < now;
  return {
    id: task.id,
    name: task.name,
    room: task.room,
    frequency: task.frequency,
    customIntervalDays: task.customIntervalDays ?? null,
    notes: task.notes ?? null,
    assignedMemberId: task.assignedMemberId ?? null,
    assignedMemberName: memberName ?? null,
    lastCompletedAt: task.lastCompletedAt?.toISOString() ?? null,
    nextDueAt: task.nextDueAt?.toISOString() ?? null,
    isOverdue,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function selectTasksWithMembers(where?: Parameters<typeof db.select>[0]) {
  return db
    .select({
      task: cleaningTasksTable,
      memberName: membersTable.name,
    })
    .from(cleaningTasksTable)
    .leftJoin(membersTable, eq(cleaningTasksTable.assignedMemberId, membersTable.id));
}

// GET /tasks
router.get("/tasks", async (_req, res) => {
  const rows = await db
    .select({ task: cleaningTasksTable, memberName: membersTable.name })
    .from(cleaningTasksTable)
    .leftJoin(membersTable, eq(cleaningTasksTable.assignedMemberId, membersTable.id))
    .orderBy(cleaningTasksTable.room, cleaningTasksTable.name);
  res.json(rows.map(r => toApiTask(r.task, r.memberName)));
});

// POST /tasks
router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error });
  }

  const { frequency, customIntervalDays, notes, assignedMemberId, nextDueAt: requestedNextDueAt } = parsed.data as typeof parsed.data & { assignedMemberId?: number | null; nextDueAt?: Date | null };
  const name = parsed.data.name.trim();
  const room = parsed.data.room.trim();

  if (!name) {
    return res.status(400).json({ error: "Task name is required." });
  }

  if (!room) {
    return res.status(400).json({ error: "Room is required." });
  }

  if (frequency === "custom" && !customIntervalDays) {
    return res.status(400).json({ error: "Custom frequency requires days between tasks." });
  }

  try {
    const now = new Date();
    const nextDueAt = requestedNextDueAt ?? computeNextDueAt(frequency, customIntervalDays, now);
    const [task] = await db.insert(cleaningTasksTable).values({
      name,
      room,
      frequency,
      customIntervalDays: customIntervalDays ?? null,
      notes: notes?.trim() ? notes.trim() : null,
      assignedMemberId: assignedMemberId ?? null,
      nextDueAt,
      createdAt: now,
      updatedAt: now,
    }).returning();

    if (!task) {
      return res.status(500).json({ error: "Task was not created." });
    }

    let memberName: string | null = null;
    if (task.assignedMemberId) {
      const [m] = await db.select().from(membersTable).where(eq(membersTable.id, task.assignedMemberId));
      memberName = m?.name ?? null;
    }
    return res.status(201).json(toApiTask(task, memberName));
  } catch (err) {
    req.log?.error({ err }, "Failed to create task");
    return res.status(500).json({ error: "Failed to create task." });
  }
});

// GET /tasks/due-today
router.get("/tasks/due-today", async (_req, res) => {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const rows = await db
    .select({ task: cleaningTasksTable, memberName: membersTable.name })
    .from(cleaningTasksTable)
    .leftJoin(membersTable, eq(cleaningTasksTable.assignedMemberId, membersTable.id))
    .where(lte(cleaningTasksTable.nextDueAt, endOfDay))
    .orderBy(cleaningTasksTable.nextDueAt);
  res.json(rows.map(r => toApiTask(r.task, r.memberName)));
});

// GET /tasks/upcoming
router.get("/tasks/upcoming", async (_req, res) => {
  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const rows = await db
    .select({ task: cleaningTasksTable, memberName: membersTable.name })
    .from(cleaningTasksTable)
    .leftJoin(membersTable, eq(cleaningTasksTable.assignedMemberId, membersTable.id))
    .where(and(gte(cleaningTasksTable.nextDueAt, now), lte(cleaningTasksTable.nextDueAt, in7Days)))
    .orderBy(cleaningTasksTable.nextDueAt);
  res.json(rows.map(r => toApiTask(r.task, r.memberName)));
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
  const rows = await db
    .select({ task: cleaningTasksTable, memberName: membersTable.name })
    .from(cleaningTasksTable)
    .leftJoin(membersTable, eq(cleaningTasksTable.assignedMemberId, membersTable.id))
    .where(eq(cleaningTasksTable.id, parsed.data.id));
  if (!rows[0]) return res.status(404).json({ error: "Task not found" });
  return res.json(toApiTask(rows[0].task, rows[0].memberName));
});

// PUT /tasks/:id
router.put("/tasks/:id", async (req, res) => {
  const paramsParsed = UpdateTaskParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });
  const bodyParsed = UpdateTaskBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid input" });

  const existing = await db.select().from(cleaningTasksTable).where(eq(cleaningTasksTable.id, paramsParsed.data.id));
  if (!existing[0]) return res.status(404).json({ error: "Task not found" });

  const body = bodyParsed.data as typeof bodyParsed.data & { assignedMemberId?: number | null; nextDueAt?: Date | null };

  const updates: Partial<typeof cleaningTasksTable.$inferInsert> = {
    ...body,
    updatedAt: new Date(),
  };
  if ("nextDueAt" in body) {
    updates.nextDueAt = body.nextDueAt ?? null;
  } else if (body.frequency) {
    const freq = body.frequency;
    const interval = body.customIntervalDays ?? existing[0].customIntervalDays;
    const base = existing[0].lastCompletedAt ?? new Date();
    updates.nextDueAt = computeNextDueAt(freq, interval, base);
  }
  if ("assignedMemberId" in body) {
    updates.assignedMemberId = body.assignedMemberId ?? null;
  }

  const [task] = await db.update(cleaningTasksTable)
    .set(updates)
    .where(eq(cleaningTasksTable.id, paramsParsed.data.id))
    .returning();

  let memberName: string | null = null;
  if (task.assignedMemberId) {
    const [m] = await db.select().from(membersTable).where(eq(membersTable.id, task.assignedMemberId));
    memberName = m?.name ?? null;
  }
  return res.json(toApiTask(task, memberName));
});

// DELETE /tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  const parsed = DeleteTaskParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const existing = await db.select({ id: cleaningTasksTable.id }).from(cleaningTasksTable).where(eq(cleaningTasksTable.id, parsed.data.id));
  if (!existing[0]) return res.status(404).json({ error: "Task not found" });
  await db.delete(cleaningTasksTable).where(eq(cleaningTasksTable.id, parsed.data.id));
  return res.status(204).end();
});

// POST /tasks/:id/complete
router.post("/tasks/:id/complete", async (req, res) => {
  try {
    const paramsParsed = CompleteTaskParams.safeParse({ id: Number(req.params.id) });
    if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });

    const bodyParsed = CompleteTaskBody.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      return res.status(400).json({ error: "Invalid input", details: bodyParsed.error });
    }
    const notes = bodyParsed.data.notes ?? null;

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

    return res.status(201).json({
      id: completion.id,
      taskId: task.id,
      taskName: task.name,
      room: task.room,
      completedAt: completion.completedAt.toISOString(),
      notes: completion.notes ?? null,
    });
  } catch (err) {
    req.log?.error({ err, taskId: req.params.id }, "Failed to complete task");
    return res.status(500).json({ error: "Failed to complete task." });
  }
});

// DELETE /tasks/:id/complete
router.delete("/tasks/:id/complete", async (req, res) => {
  try {
    const paramsParsed = CompleteTaskParams.safeParse({ id: Number(req.params.id) });
    if (!paramsParsed.success) return res.status(400).json({ error: "Invalid id" });

    const [task] = await db.select().from(cleaningTasksTable).where(eq(cleaningTasksTable.id, paramsParsed.data.id));
    if (!task) return res.status(404).json({ error: "Task not found" });

    const [latestCompletion] = await db
      .select()
      .from(taskCompletionsTable)
      .where(eq(taskCompletionsTable.taskId, task.id))
      .orderBy(desc(taskCompletionsTable.completedAt))
      .limit(1);

    if (!latestCompletion) {
      return res.status(400).json({ error: "Task is not completed." });
    }

    await db.delete(taskCompletionsTable).where(eq(taskCompletionsTable.id, latestCompletion.id));

    const [previousCompletion] = await db
      .select()
      .from(taskCompletionsTable)
      .where(eq(taskCompletionsTable.taskId, task.id))
      .orderBy(desc(taskCompletionsTable.completedAt))
      .limit(1);

    const [updatedTask] = await db
      .update(cleaningTasksTable)
      .set({
        lastCompletedAt: previousCompletion?.completedAt ?? null,
        nextDueAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(cleaningTasksTable.id, task.id))
      .returning();

    let memberName: string | null = null;
    if (updatedTask.assignedMemberId) {
      const [m] = await db.select().from(membersTable).where(eq(membersTable.id, updatedTask.assignedMemberId));
      memberName = m?.name ?? null;
    }

    return res.json(toApiTask(updatedTask, memberName));
  } catch (err) {
    req.log?.error({ err, taskId: req.params.id }, "Failed to uncomplete task");
    return res.status(500).json({ error: "Failed to uncomplete task." });
  }
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
