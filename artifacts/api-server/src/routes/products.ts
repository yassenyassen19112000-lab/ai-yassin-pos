import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, like, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    barcode: p.barcode ?? null,
    category: p.category ?? null,
    costPrice: parseFloat(p.costPrice as string),
    sellingPrice: parseFloat(p.sellingPrice as string),
    quantity: p.quantity,
    minStockLevel: p.minStockLevel,
    unit: p.unit,
    isLowStock: p.quantity <= p.minStockLevel,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const { lowStock, search } = req.query;
  
  let conditions = [];
  if (search && typeof search === "string") {
    conditions.push(like(productsTable.name, `%${search}%`));
  }
  
  let products;
  if (conditions.length > 0) {
    products = await db.select().from(productsTable).where(and(...conditions)).orderBy(productsTable.name);
  } else {
    products = await db.select().from(productsTable).orderBy(productsTable.name);
  }

  let result = products.map(formatProduct);
  if (lowStock === "true") {
    result = result.filter(p => p.isLowStock);
  }

  res.json(result);
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const { name, description, barcode, category, costPrice, sellingPrice, quantity, minStockLevel, unit } = req.body;
  if (!name || costPrice == null || sellingPrice == null || quantity == null || !unit) {
    res.status(400).json({ error: "الحقول المطلوبة: الاسم، سعر التكلفة، سعر البيع، الكمية، الوحدة" });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    name,
    description: description || null,
    barcode: barcode || null,
    category: category || null,
    costPrice: costPrice.toString(),
    sellingPrice: sellingPrice.toString(),
    quantity: parseInt(quantity),
    minStockLevel: parseInt(minStockLevel ?? 5),
    unit: unit || "قطعة",
  }).returning();

  res.status(201).json(formatProduct(product));
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "المنتج غير موجود" }); return; }
  res.json(formatProduct(product));
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, description, barcode, category, costPrice, sellingPrice, quantity, minStockLevel, unit } = req.body;
  
  const updates: Partial<typeof productsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (barcode !== undefined) updates.barcode = barcode;
  if (category !== undefined) updates.category = category;
  if (costPrice !== undefined) updates.costPrice = costPrice.toString();
  if (sellingPrice !== undefined) updates.sellingPrice = sellingPrice.toString();
  if (quantity !== undefined) updates.quantity = parseInt(quantity);
  if (minStockLevel !== undefined) updates.minStockLevel = parseInt(minStockLevel);
  if (unit !== undefined) updates.unit = unit;

  const [product] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "المنتج غير موجود" }); return; }
  res.json(formatProduct(product));
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [product] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "المنتج غير موجود" }); return; }
  res.sendStatus(204);
});

export default router;
