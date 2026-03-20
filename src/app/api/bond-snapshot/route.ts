import { NextRequest, NextResponse } from "next/server";
import { getBondUiData } from "@/app/actions/module/bondSystem";

export async function GET(request: NextRequest) {
  const characterId = Number(request.nextUrl.searchParams.get("characterId") || "");

  if (!Number.isFinite(characterId) || characterId <= 0) {
    return NextResponse.json({ error: "Invalid characterId" }, { status: 400 });
  }

  const payload = await getBondUiData(characterId);
  return NextResponse.json(payload ?? null);
}
