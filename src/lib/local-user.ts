import "server-only";

import { prisma } from "@/lib/prisma";
import { getLocalAppConfig, updateLocalAppConfig } from "@/lib/local-config/store";

export interface LocalClientUser {
  id: number;
  phone: string;
  uuid: string;
  isLoggedIn: boolean;
  freeReviveUsed: boolean;
  paidReviveCount: number;
  name?: string;
}

export async function ensureLocalUserRecord(): Promise<LocalClientUser> {
  const appConfig = await getLocalAppConfig();
  const profile = appConfig.localUser;
  let shouldSyncProfile = false;

  let user = await prisma.user.findUnique({
    where: { uuid: profile.uuid },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: { phone: profile.phone },
    });

    if (user) {
      shouldSyncProfile = true;
    }
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        uuid: profile.uuid,
        phone: profile.phone,
        name: profile.name,
      },
    });
  } else if (user.phone !== profile.phone || user.name !== profile.name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: profile.phone,
        name: profile.name,
      },
    });
  }

  if (shouldSyncProfile) {
    await updateLocalAppConfig((config) => ({
      ...config,
      localUser: {
        ...config.localUser,
        uuid: user.uuid || config.localUser.uuid,
        phone: user.phone || config.localUser.phone,
        name: user.name || config.localUser.name,
      },
    }));
  }

  return {
    id: user.id,
    phone: user.phone || profile.phone,
    uuid: user.uuid || profile.uuid,
    name: user.name || profile.name,
    isLoggedIn: true,
    freeReviveUsed: user.freeReviveUsed,
    paidReviveCount: user.paidReviveCount,
  };
}
