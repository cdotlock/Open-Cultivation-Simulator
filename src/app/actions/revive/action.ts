'use server';

import { rebirthCharacter } from '@/app/actions/character/action';
import { ensureLocalUserRecord } from '@/lib/local-user';

export async function performLocalRevive(characterId: number): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
}> {
  await ensureLocalUserRecord();
  const result = await rebirthCharacter(characterId);

  return {
    success: result.success,
    message: result.message,
    error: result.success ? undefined : result.message,
    data: result.newStatus,
  };
}

export async function getLocalReviveStatus(): Promise<{
  success: boolean;
  error?: string;
  data?: {
    freeReviveUsed: boolean;
    paidReviveCount: number;
    canUseFreeRevive: boolean;
  };
}> {
  await ensureLocalUserRecord();

  return {
    success: true,
    data: {
      freeReviveUsed: false,
      paidReviveCount: 0,
      canUseFreeRevive: true,
    },
  };
}
