import { Router } from "express";
import { db, suppliersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

function formatSupplier(s: typeof suppliersTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone ?? null,
    address: s.address ?? null,
    notes: s.notes ?? null,
    totalDebt: parseFloat(s.totalDebt as string),
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/suppliers", requireAuth, async (_req, res): Promise<void> => {
  const suppliers = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  res.json(suppliers.map(formatSupplier));
});

router.post("/suppliers", requireAuth, async (req, res): Promise<void> => {
  const { name, phone, address, notes } = req.body;
  if (!name) { res.status(400).json({ error: "اسم المورد مطلوب" }); return; }

  const [supplier] = await db.insert(suppliersTable).values({
    name,
    phone: phone || null,
    address: address || null,
    notes: notes || null,
    totalDebt: "0",
  }).returning();

  res.status(201).json(formatSupplier(supplier));
});

router.get("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) { res.status(404).json({ error: "المورد غير موجود" }); return; }
  res.json(formatSupplier(supplier));
});

router.patch("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, phone, address, notes } = req.body;
  
  const updates: Partial<typeof suppliersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (notes !== undefined) updates.notes = notes;

  const [supplier] = await db.update(suppliersTable).set(updates).where(eq(suppliersTable.id, id)).returning();
  if (!supplier) { res.status(404).json({ error: "المورد غير موجود" }); return; }
  res.json(formatSupplier(supplier));
});

router.delete("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [supplier] = await db.delete(suppliersTable).where(eq(suppliersTable.id, id)).returning();
  if (!supplier) { res.status(404).json({ error: "المورد غير موجود" }); return; }
  res.sendStatus(204);
});

export default router;
