import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable, permissionsSchema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET || "al-yaseen-secret-2024";

const DEFAULT_ADMIN_PERMISSIONS = {
  canViewDashboard: true,
  canManageProducts: true,
  canManageSuppliers: true,
  canMakeSales: true,
  canViewReports: true,
  canManageUsers: true,
  canManageDebts: true,
  canViewPurchases: true,
  canCreatePurchases: true,
};

const DEFAULT_CASHIER_PERMISSIONS = {
  canViewDashboard: true,
  canManageProducts: false,
  canManageSuppliers: false,
  canMakeSales: true,
  canViewReports: false,
  canManageUsers: false,
  canManageDebts: false,
  canViewPurchases: false,
  canCreatePurchases: false,
};

async function ensureAdminExists() {
  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).limit(1);
  if (admins.length === 0) {
    const hash = await bcrypt.hash("admin123", 10);
    await db.insert(usersTable).values({
      username: "admin",
      passwordHash: hash,
      name: "المدير",
      role: "admin",
      permissions: DEFAULT_ADMIN_PERMISSIONS,
    });
  }
}

ensureAdminExists().catch(() => {});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  const { username, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });

  const permissions = permissionsSchema.parse(user.permissions);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }

  const token = authHeader.slice(7);
  let payload: { userId: number };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    res.status(401).json({ error: "رمز غير صالح" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) {
    res.status(401).json({ error: "المستخدم غير موجود" });
    return;
  }

  const permissions = permissionsSchema.parse(user.permissions);

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions,
    createdAt: user.createdAt.toISOString(),
  });
});

export { JWT_SECRET, DEFAULT_ADMIN_PERMISSIONS, DEFAULT_CASHIER_PERMISSIONS };
export default router;
