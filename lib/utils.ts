import { customAlphabet } from "nanoid";

const alphanumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoid6 = customAlphabet(alphanumeric, 6);

/**
 * Generate a short, URL-safe invite code for game links.
 */
export function generateInviteCode(): string {
  return nanoid6();
}
