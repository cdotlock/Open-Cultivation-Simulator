"use server";

import { getBondUiData, submitDaoLyuWish, acceptDiscipleCandidate, dismissDiscipleCandidate, sendBondChatMessage, renameBondActorByBondId } from "../module/bondSystem";

export async function getBondSnapshot(characterId: number) {
  return getBondUiData(characterId);
}

export async function makeDaoLyuWish(characterId: number, rawWish: string) {
  return submitDaoLyuWish(characterId, rawWish);
}

export async function recruitDisciple(characterId: number, bondId: number) {
  return acceptDiscipleCandidate(characterId, bondId);
}

export async function rejectDisciple(characterId: number, bondId: number) {
  return dismissDiscipleCandidate(characterId, bondId);
}

export async function sendBondChat(characterId: number, bondId: number, message: string) {
  return sendBondChatMessage(characterId, bondId, message);
}

export async function renameBond(characterId: number, bondId: number, newName: string) {
  return renameBondActorByBondId(characterId, bondId, newName);
}
