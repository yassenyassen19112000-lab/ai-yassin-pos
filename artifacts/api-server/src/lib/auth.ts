import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET || "al-yaseen-secret-2024";

export interface AuthenticatedRequest extends Request {
  userId?: number;
  userRole?: string;
  userName?: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }

  const token = authHeader.slice(7);
  let payload: { userId: number; role: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
  } catch {
    res.status(401).json({ error: "رمز غير صالح" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) {
    res.status(401).json({ error: "المستخدم غير موجود" });
    return;
  }

  req.userId = user.id;
  req.userRole = user.role;
  req.userName = user.name;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "غير مسموح" });
    return;
  }
  next();
}
