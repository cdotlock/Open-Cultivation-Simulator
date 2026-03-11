import { atom } from "recoil";
import { CharacterState, GamePushResponse, ShareState } from "@/interfaces";

export const pages = ["home", "loading", "create", "char", "story"] as const
// export { pages };
export type PageType = typeof pages[number]

export const pageState = atom<PageType>({
  key: "pageState",
  default: "home"
});

export const loadingState = atom<[boolean, PageType]>({
  key: "loadingState",
  default: [false, "home"]
});

export const toastState = atom<string>({
  key: "toastState",
  default: ""
});

export const characterState = atom<CharacterState>({
  key: "characterState",
  default: void 0
});

export const gamePushState = atom<GamePushResponse>({
  key: "gamePushState",
  default: void 0
});

export const shareCharacterState = atom<ShareState>({
  key: "shareCharacterState",
  default: {
    id: 0
  }
});

// 用户登录状态，包含完整的用户信息
export const userState = atom<{
  id: number;
  phone: string;
  uuid: string;
  isLoggedIn: boolean;
  freeReviveUsed: boolean;
  paidReviveCount: number;
} | null>({
  key: "userState",
  default: null,
});

