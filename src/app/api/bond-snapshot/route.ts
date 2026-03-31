import { NextRequest, NextResponse } from "next/server";
import { getBondUiData } from "@/app/actions/module/bondSystem";

export async function GET(request: NextRequest) {
  const characterId = Number(request.nextUrl.searchParams.get("characterId") || "");
  const bondId = Number(request.nextUrl.searchParams.get("bondId") || "0");

  if (!Number.isFinite(characterId) || characterId <= 0) {
    return NextResponse.json({ error: "Invalid characterId" }, { status: 400 });
  }

  const payload = await getBondUiData(characterId);

  // 如果指定了 bondId 但在 activeDaoLyu/activeDisciples 中找不到，
  // 重新拉取一次（触发状态同步后再查）
  if (bondId > 0 && payload) {
    const found =
      payload.activeDaoLyu?.id === bondId ||
      payload.activeDisciples.some((d) => d.id === bondId);
    if (!found) {
      const retryPayload = await getBondUiData(characterId);
      return NextResponse.json(retryPayload ?? null);
    }
  }

  return NextResponse.json(payload ?? null);
}
