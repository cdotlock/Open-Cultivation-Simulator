"use server";

import { getFactionUiData } from "../module/factionSystem";

export async function getFactionSnapshot(characterId: number) {
  return getFactionUiData(characterId);
}
