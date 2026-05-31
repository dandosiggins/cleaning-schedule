import { Router } from "express";
import { db, membersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /members
router.get("/members", async (_req, res) => {
  const members = await db.select().from(membersTable).orderBy(membersTable.name);
  res.json(members.map(m => ({ id: m.id, name: m.name, createdAt: m.createdAt.toISOString() })));
});

// POST /members
router.post("/members", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "Name is required" });
  const [member] = await db.insert(membersTable).values({ name }).returning();
  return res.status(201).json({ id: member.id, name: member.name, createdAt: member.createdAt.toISOString() });
});

// DELETE /members/:id
router.delete("/members/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const existing = await db.select({ id: membersTable.id }).from(membersTable).where(eq(membersTable.id, id));
  if (!existing[0]) return res.status(404).json({ error: "Member not found" });
  await db.delete(membersTable).where(eq(membersTable.id, id));
  return res.status(204).end();
});

export default router;
