import { customAlphabet } from "nanoid";

const alphanumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoid6 = customAlphabet(alphanumeric, 6);

/**
 * Generate a short, URL-safe invite code for game links.
 */
export function generateInviteCode(): string {
  return nanoid6();
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

  // Desktop or fallback: copy full invite message (one link) to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }

  return "failed";
}
