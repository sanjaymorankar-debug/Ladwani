import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, otp } = await req.json();
    if (!userId || !otp) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const crypto = await import("crypto");
    const otpHash = crypto.createHash("sha256").update(otp.toString()).digest("hex");
    const token = await prisma.verificationToken.findFirst({
      where: { userId, type: "EMAIL_VERIFY", tokenHash: otpHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!token) return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    await prisma.$transaction([
      prisma.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: userId }, data: { emailVerified: true, status: "ACTIVE" } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
