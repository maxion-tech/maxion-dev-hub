import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { bytes } = await req.json();
  if (!Number.isInteger(bytes) || bytes < 8 || bytes > 128) {
    return NextResponse.json({ error: "Invalid bytes" }, { status: 400 });
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const random = Array.from(crypto.randomBytes(bytes))
    .map((b) => chars[b % chars.length])
    .join("");
  return NextResponse.json({ hex: random });
}
