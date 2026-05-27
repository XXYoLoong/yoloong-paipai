export const AUTH_COOKIE_NAME = "youlong_session";

const HASH_PREFIX = "sha256:";
const HASH_PATTERN = /^[a-f0-9]{64}$/i;

export function normalizePasswordHash(value?: string | null) {
  const raw = value?.trim();
  if (!raw) {
    return "";
  }

  const withoutPrefix = raw.toLowerCase().startsWith(HASH_PREFIX)
    ? raw.slice(HASH_PREFIX.length)
    : raw;

  return HASH_PATTERN.test(withoutPrefix) ? withoutPrefix.toLowerCase() : "";
}

export function isAuthEnabledFromHash(value?: string | null) {
  return Boolean(normalizePasswordHash(value));
}

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(rawHash?: string | null) {
  const hash = normalizePasswordHash(rawHash);
  if (!hash) {
    return "";
  }

  return sha256Hex(`youlong-session:${hash}`);
}

export async function verifyPasswordAgainstHash(password: string, rawHash?: string | null) {
  const hash = normalizePasswordHash(rawHash);
  if (!hash) {
    return true;
  }

  const candidate = await sha256Hex(password);
  return constantTimeEqual(candidate, hash);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}
