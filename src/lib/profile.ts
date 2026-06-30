import type { Difficulty } from "./types";

// GoTrue rejects reserved TLDs like `.local` ("Email address ... is invalid"),
// so synthetic password-auth emails must use a real, valid TLD.
export const PASSWORD_AUTH_EMAIL_DOMAIN = "users.leetproof.app";

// Domains previously used for synthetic emails. Kept so existing accounts are
// still recognized as password-auth (not shown as a real public email).
const LEGACY_PASSWORD_AUTH_EMAIL_DOMAINS = ["users.leetproof.local"];

export interface ProfileLike {
  id?: string | null;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  auth_email?: string | null;
  avatar_url?: string | null;
}

export interface DifficultyStat {
  difficulty: Difficulty;
  total_count: number;
  solved_count: number;
}

const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

export function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function usernameFromEmail(email: string | null | undefined) {
  const localPart = email?.split("@")[0]?.trim();
  return localPart ? normalizeUsername(localPart.replace(/[^a-z0-9._-]/gi, "_")) : "";
}

export function getSyntheticAuthEmail(username: string) {
  return `${normalizeUsername(username)}@${PASSWORD_AUTH_EMAIL_DOMAIN}`;
}

export function isSyntheticAuthEmail(email: string | null | undefined) {
  const normalized = email?.toLowerCase();
  if (!normalized) return false;
  return [PASSWORD_AUTH_EMAIL_DOMAIN, ...LEGACY_PASSWORD_AUTH_EMAIL_DOMAINS].some((domain) =>
    normalized.endsWith(`@${domain}`)
  );
}

export function getPublicEmail(email: string | null | undefined) {
  return isSyntheticAuthEmail(email) ? null : email ?? null;
}

export function getProfileDisplayName(profile: ProfileLike | null | undefined) {
  if (!profile) return "anonymous";
  return (
    profile.username?.trim() ||
    profile.full_name?.trim() ||
    usernameFromEmail(getPublicEmail(profile.email)) ||
    usernameFromEmail(profile.auth_email) ||
    "anonymous"
  );
}

export function getProfileInitials(profile: ProfileLike | string | null | undefined) {
  const displayName = typeof profile === "string" ? profile : getProfileDisplayName(profile);
  const parts = displayName
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getGeneratedAvatarBackground(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  const primaryHue = Math.abs(hash) % 360;
  const secondaryHue = (primaryHue + 42) % 360;
  return `linear-gradient(135deg, hsl(${primaryHue} 68% 42%), hsl(${secondaryHue} 62% 32%))`;
}

export function emptyDifficultyStats(): DifficultyStat[] {
  return [
    { difficulty: "easy", total_count: 0, solved_count: 0 },
    { difficulty: "medium", total_count: 0, solved_count: 0 },
    { difficulty: "hard", total_count: 0, solved_count: 0 },
  ];
}