import { v4 as uuidv4 } from "uuid";

const DEVICE_ID_KEY = "gt_device_id";
const THEME_KEY = "gt_theme";
const USER_KEY = "gt_user";
const DEV_MODE_KEY = "gt_dev_mode";
const INTRO_SESSION_KEY = "gt_intro_shown";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getTheme(): "dark" | "light" {
  return (localStorage.getItem(THEME_KEY) as "dark" | "light") || "dark";
}

export function setTheme(theme: "dark" | "light") {
  localStorage.setItem(THEME_KEY, theme);
}

export interface StoredUser {
  deviceId: string;
  nickname: string;
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(USER_KEY);
}

export type DevMode = "user" | "admin";

export function getDevMode(): DevMode {
  return (localStorage.getItem(DEV_MODE_KEY) as DevMode) || "user";
}

export function setDevMode(mode: DevMode) {
  localStorage.setItem(DEV_MODE_KEY, mode);
}

export function shouldShowIntro(): boolean {
  return !sessionStorage.getItem(INTRO_SESSION_KEY);
}

export function markIntroShown() {
  sessionStorage.setItem(INTRO_SESSION_KEY, "1");
}
