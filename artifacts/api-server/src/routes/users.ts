import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, permissionsSchema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../lib/auth";
import { DEFAULT_ADMIN_PERMISSIONS, DEFAULT_CASHIER_PERMISSIONS } from "./auth";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: permissionsSchema.parse(user.permissions),
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(formatUser));
});

router.post("/users", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name || !role) {
    res.status(400).json({ error: "جميع الحقول مطلوبة" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing.length > 0) {
    res.status(400).json({ error: "اسم المستخدم موجود بالفعل" });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const defaultPermissions = role === "admin" ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_CASHIER_PERMISSIONS;

  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash: hash,
    name,
    role,
    permissions: defaultPermissions,
  }).returning();

  res.status(201).json(formatUser(user));
});

router.get("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { username, password, name, role, permissions } = req.body;
  
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (username) updates.username = username;
  if (name) updates.name = name;
  if (role) updates.role = role;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);
  if (permissions) {
    const parsed = permissionsSchema.safeParse(permissions);
    if (parsed.success) updates.permissions = parsed.data;
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  res.json(formatUser(user));
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (id === req.userId) {
    res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
    return;
  }
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  res.sendStatus(204);
});

router.patch("/users/:id/permissions", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { permissions } = req.body;
  if (!permissions) { res.status(400).json({ error: "الصلاحيات مطلوبة" }); return; }

  const parsed = permissionsSchema.safeParse(permissions);
  if (!parsed.success) { res.status(400).json({ error: "صلاحيات غير صحيحة" }); return; }

  const [user] = await db.update(usersTable).set({ permissions: parsed.data }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  res.json(formatUser(user));
});

export default router;
