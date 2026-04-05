import { Router } from "express";
import { db, customersTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/customers", requireAuth, async (req, res): Promise<void> => {
  const { search } = req.query;
  let customers;
  if (search && typeof search === "string") {
    customers = await db.select().from(customersTable)
      .where(like(customersTable.name, `%${search}%`))
      .orderBy(customersTable.name);
  } else {
    customers = await db.select().from(customersTable).orderBy(customersTable.name);
  }
  res.json(customers);
});

router.post("/customers", requireAuth, async (req, res): Promise<void> => {
  const { name, phone, notes } = req.body;
  if (!name) { res.status(400).json({ error: "اسم العميل مطلوب" }); return; }
  const [customer] = await db.insert(customersTable).values({
    name,
    phone: phone || null,
    notes: notes || null,
  }).returning();
  res.status(201).json(customer);
});

router.put("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { name, phone, notes } = req.body;
  if (!name) { res.status(400).json({ error: "اسم العميل مطلوب" }); return; }
  const [customer] = await db.update(customersTable)
    .set({ name, phone: phone || null, notes: notes || null })
    .where(eq(customersTable.id, id))
    .returning();
  if (!customer) { res.status(404).json({ error: "العميل غير موجود" }); return; }
  res.json(customer);
});

router.delete("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.json({ success: true });
});

export default router;
