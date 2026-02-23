/**
 * Have I Been Pwned — k-Anonymity Password Check
 *
 * Checks whether a password has appeared in known data breaches WITHOUT
 * ever sending the full password (or even its full hash) to the HIBP API.
 *
 * How it works:
 *  1. SHA-1 hash the password
 *  2. Send only the first 5 hex characters to the API
 *  3. API returns all hashes starting with those 5 chars (~500 results)
 *  4. Check locally if the remaining 35 chars match — no server ever
 *     learns which specific password was checked
 */

const HIBP_API = "https://api.pwnedpasswords.com/range/";

export interface BreachResult {
  breached: boolean;
  /** Number of times this password has appeared in known breaches */
  count: number;
}

/**
 * Checks a password against the HIBP database using k-anonymity.
 * Safe to call from the client — no password data is ever exposed.
 */
export async function checkPasswordBreach(password: string): Promise<BreachResult> {
  const hash = await sha1(password);
  const prefix = hash.slice(0, 5).toUpperCase();
  const suffix = hash.slice(5).toUpperCase();

  const response = await fetch(`${HIBP_API}${prefix}`, {
    headers: { "Add-Padding": "true" }, // Prevents traffic analysis
  });

  if (!response.ok) {
    throw new Error(`HIBP API error: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split("\r\n");

  for (const line of lines) {
    const [hashSuffix, countStr] = line.split(":");
    if (hashSuffix === suffix) {
      const count = parseInt(countStr ?? "0", 10);
      return { breached: count > 0, count };
    }
  }

  return { breached: false, count: 0 };
}

async function sha1(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
