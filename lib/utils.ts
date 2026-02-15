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
    title: "FriendPlace",
    text: `Join my FriendPlace game!\n${url}`,
  };
}

/**
 * True when the device is likely a phone (or small tablet) so we can use the native share sheet.
 * Desktop browsers (including Chromium) skip the share API and use copy instead.
 */
function isMobileSharePreferred(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * On phone OSes: use the native Web Share API when available (text only to avoid duplicate link).
 * On desktop (including Chromium): copy the invite message + link to clipboard (link appears once).
 * Returns "shared" | "copied" | "failed".
 */
export async function shareOrCopy(url: string): Promise<"shared" | "copied" | "failed"> {
  const { title, text } = buildShareText(url);

  // Only use Web Share API on mobile; desktop/Chromium should just copy
  if (
    typeof navigator !== "undefined" &&
    navigator.share &&
    isMobileSharePreferred()
  ) {
    try {
      // Pass only title and text so the link appears once (text already contains the url)
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "failed";
      }
      // Fall through to clipboard
    }
  }

  // Desktop or fallback: copy only the URL so it can be pasted directly in a browser
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
