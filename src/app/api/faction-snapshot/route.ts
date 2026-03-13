import { NextRequest, NextResponse } from "next/server";
import { getFactionUiData } from "@/app/actions/module/factionSystem";

export async function GET(request: NextRequest) {
  const characterId = Number(request.nextUrl.searchParams.get("characterId") || "");

  if (!Number.isFinite(characterId) || characterId <= 0) {
    return NextResponse.json({ error: "Invalid characterId" }, { status: 400 });
  }

  const payload = await getFactionUiData(characterId);
  return NextResponse.json(payload ?? null);
}
