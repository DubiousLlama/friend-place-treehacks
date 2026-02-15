import { customAlphabet } from "nanoid";

const alphanumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoid6 = customAlphabet(alphanumeric, 6);
const tokenAlphabet = customAlphabet(alphanumeric + "-_", 32);

/**
 * Generate a short, URL-safe invite code for game links.
 */
export function generateInviteCode(): string {
  return nanoid6();
}

/** URL-safe token for email invite links (join?token=...). */
export function generateInviteToken(): string {
  return tokenAlphabet();
}

/**
 * Mask email for display so raw addresses are not exposed to clients.
 * e.g. "jane@example.com" -> "ja***@example.com"
 */
export function maskEmail(email: string): string {
  const s = email.trim();
  const at = s.indexOf("@");
  if (at <= 0) return "***";
  const local = s.slice(0, at);
  const domain = s.slice(at);
  if (local.length <= 2) return local + "***" + domain;
  return local.slice(0, 2) + "***" + domain;
}

/**
 * Build the share text for a game invite.
 * Kept here so every surface shares the same copy.
 */
export function buildShareText(url: string): { title: string; text: string } {
  return {
    title: "Friend Place",
    text: `Join my Friend Place game!\n${url}`,
  };
}

/**
 * Attempt to use the native Web Share API. Falls back to clipboard copy.
 * Returns "shared" | "copied" | "failed".
 */
export async function shareOrCopy(url: string): Promise<"shared" | "copied" | "failed"> {
  const { title, text } = buildShareText(url);

  // Use Web Share API when available (most mobile browsers + some desktop)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (err) {
      // User cancelled the share sheet — not an error, but nothing happened
      if (err instanceof DOMException && err.name === "AbortError") {
        return "failed";
      }
      // Fall through to clipboard
    }
  }

  // Fallback: copy link to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }

  return "failed";
}
