import { v4 as uuidv4 } from "uuid";

const DEVICE_ID_KEY = "gt_device_id";
const THEME_KEY = "gt_theme";
const USER_KEY = "gt_user";
const DEV_MODE_KEY = "gt_dev_mode";
const INTRO_SESSION_KEY = "gt_intro_shown";

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage can be unavailable in restricted mobile browser contexts.
  }
}

function safeRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage can be unavailable in restricted mobile browser contexts.
  }
}

export function getDeviceId(): string {
  let id = safeGet(localStorage, DEVICE_ID_KEY);
  if (!id) {
    id = uuidv4();
    safeSet(localStorage, DEVICE_ID_KEY, id);
  }
  return id;
}

export function getTheme(): "dark" | "light" {
  return (safeGet(localStorage, THEME_KEY) as "dark" | "light") || "dark";
}

export function setTheme(theme: "dark" | "light") {
  safeSet(localStorage, THEME_KEY, theme);
}

export interface StoredUser {
  deviceId: string;
  nickname: string;
}

export function getStoredUser(): StoredUser | null {
  const raw = safeGet(localStorage, USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser) {
  safeSet(localStorage, USER_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  safeRemove(localStorage, USER_KEY);
}

export type DevMode = "user" | "admin";

export function getDevMode(): DevMode {
  return (safeGet(localStorage, DEV_MODE_KEY) as DevMode) || "user";
}

export function setDevMode(mode: DevMode) {
  safeSet(localStorage, DEV_MODE_KEY, mode);
}

export function shouldShowIntro(): boolean {
  return !safeGet(sessionStorage, INTRO_SESSION_KEY);
}

export function markIntroShown() {
  safeSet(sessionStorage, INTRO_SESSION_KEY, "1");
}
