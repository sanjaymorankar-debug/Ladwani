import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, generateAccessToken, generateRefreshToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { emailOrMobile, password } = await req.json();
    if (!emailOrMobile || !password) return NextResponse.json({ error: "Credentials required" }, { status: 400 });

    const isEmail = emailOrMobile.includes("@");
    const user = await prisma.user.findFirst({
      where: isEmail ? { email: emailOrMobile } : { mobile: emailOrMobile },
      include: { userRoles: { include: { role: true } }, member: { select: { id: true, firstName: true, lastName: true, profilePhotoId: true } } },
    });

    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    if (user.status === "SUSPENDED" || user.status === "BLOCKED") return NextResponse.json({ error: "Account suspended. Contact admin." }, { status: 403 });
    if (user.lockedUntil && user.lockedUntil > new Date()) return NextResponse.json({ error: "Account temporarily locked." }, { status: 429 });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedAttempts + 1;
      await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: attempts, ...(attempts >= 5 ? { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) } : {}) } });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });

    const roles = user.userRoles.map((r: any) => r.role.code as string);
    const accessToken = generateAccessToken({ userId: user.id, email: user.email, mobile: user.mobile, roles });
    const refreshToken = generateRefreshToken({ userId: user.id });
    const crypto = await import("crypto");
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });

    return NextResponse.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, mobile: user.mobile, status: user.status, roles, member: user.member } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
