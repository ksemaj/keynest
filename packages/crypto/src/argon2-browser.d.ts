declare module "argon2-browser" {
  export interface Argon2BrowserHashResult {
    hash: Uint8Array;
    hashHex: string;
    encoded: string;
  }

  export interface Argon2BrowserHashParams {
    pass: string;
    salt: Uint8Array | string;
    time?: number;
    mem?: number;
    parallelism?: number;
    hashLen?: number;
    type?: number;
  }

  export function hash(params: Argon2BrowserHashParams): Promise<Argon2BrowserHashResult>;
  export function verify(params: { pass: string; encoded: string; type?: number }): Promise<void>;

  const argon2: {
    hash: typeof hash;
    verify: typeof verify;
  };
  export default argon2;
}

declare module "argon2-browser/dist/argon2.js" {
  export * from "argon2-browser";
  export { default } from "argon2-browser";
}
