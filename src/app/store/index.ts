import { atom, AtomEffect } from "recoil";
import { CharacterState, GamePushResponse, ShareState } from "@/interfaces";

export const pages = ["home", "loading", "create", "char", "story"] as const
// export { pages };
export type PageType = typeof pages[number]

function sessionStorageEffect<T>(key: string): AtomEffect<T> {
  return ({ setSelf, onSet }) => {
    if (typeof window === "undefined") {
      return;
    }

    const storedValue = window.sessionStorage.getItem(key);
    if (storedValue !== null) {
      try {
        setSelf(JSON.parse(storedValue) as T);
      } catch {
        window.sessionStorage.removeItem(key);
      }
    }

    onSet((newValue, _, isReset) => {
      if (typeof window === "undefined") {
        return;
      }

      if (isReset || newValue === undefined) {
        window.sessionStorage.removeItem(key);
        return;
      }

      window.sessionStorage.setItem(key, JSON.stringify(newValue));
    });
  };
}

export const pageState = atom<PageType>({
  key: "pageState",
  default: "home",
  effects: [sessionStorageEffect<PageType>("mobai.pageState")],
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
  default: void 0,
  effects: [sessionStorageEffect<CharacterState>("mobai.characterState")],
});

export const gamePushState = atom<GamePushResponse>({
  key: "gamePushState",
  default: void 0,
  effects: [sessionStorageEffect<GamePushResponse>("mobai.gamePushState")],
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
