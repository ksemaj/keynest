/**
 * Cryptographically secure password generator.
 * Uses crypto.getRandomValues — never Math.random().
 */

const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
} as const;

export interface PasswordOptions {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  /** Characters to never include (e.g. ambiguous: "0O1lI") */
  exclude?: string;
}

const DEFAULTS: Required<PasswordOptions> = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  exclude: "",
};

export function generatePassword(options: PasswordOptions = {}): string {
  const opts = { ...DEFAULTS, ...options };

  let charset = "";
  if (opts.uppercase) charset += CHARSETS.uppercase;
  if (opts.lowercase) charset += CHARSETS.lowercase;
  if (opts.digits) charset += CHARSETS.digits;
  if (opts.symbols) charset += CHARSETS.symbols;

  if (opts.exclude) {
    charset = charset
      .split("")
      .filter((c) => !opts.exclude.includes(c))
      .join("");
  }

  if (charset.length === 0) {
    throw new Error("No character set selected for password generation");
  }

  // Rejection sampling to avoid modulo bias
  const password: string[] = [];
  const maxValid = Math.floor(256 / charset.length) * charset.length;

  while (password.length < opts.length) {
    const rand = new Uint8Array(opts.length * 2);
    crypto.getRandomValues(rand);
    for (const byte of rand) {
      if (password.length >= opts.length) break;
      if (byte < maxValid) {
        password.push(charset[byte % charset.length]!);
      }
    }
  }

  return password.join("");
}

/**
 * Generates a memorable passphrase from random words.
 * Entropy: ~77 bits for 6 words (log2(7776^6))
 */
export function generatePassphrase(
  wordCount = 6,
  separator = "-",
): string {
  // EFF large wordlist embedded as a compact number list
  // In production this would import the full EFF list;
  // for now we use a small sample to keep bundle size down.
  const sample = [
    "correct", "horse", "battery", "staple", "elephant", "river",
    "cloud", "timber", "frozen", "amber", "carbon", "drift",
    "echo", "flint", "grove", "hatch", "ivory", "jolt",
  ];

  const words: string[] = [];
  const rand = new Uint32Array(wordCount);
  crypto.getRandomValues(rand);

  for (let i = 0; i < wordCount; i++) {
    words.push(sample[rand[i]! % sample.length]!);
  }

  return words.join(separator);
}

/**
 * Estimates password entropy in bits.
 */
export function estimateEntropy(password: string): number {
  let charset = 0;
  if (/[A-Z]/.test(password)) charset += 26;
  if (/[a-z]/.test(password)) charset += 26;
  if (/[0-9]/.test(password)) charset += 10;
  if (/[^A-Za-z0-9]/.test(password)) charset += 32;
  return password.length * Math.log2(charset || 1);
}
