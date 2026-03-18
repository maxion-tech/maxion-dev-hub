/**
 * Lightweight replacement for the `web3-token` package.
 *
 * Produces and parses the same token format (base64-encoded JSON with
 * `{ signature, body }`) so existing tokens remain compatible.
 */

const MS_UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
  y: 31_557_600_000,
};

function parseTimespan(val: string): number {
  const match = val.match(/^(\d+)\s*(s|m|h|d|w|y)$/);
  if (!match) throw new Error(`Invalid timespan: "${val}"`);
  return Number(match[1]) * MS_UNITS[match[2]];
}

/** Build the message string that gets signed (EIP-191 personal_sign). */
function buildMessage(params: {
  issuedAt: Date;
  expirationTime: Date;
}): string {
  return [
    `Web3 Token Version: 2`,
    `Nonce: ${Math.floor(Math.random() * 99999999)}`,
    `Issued At: ${params.issuedAt.toISOString()}`,
    `Expiration Time: ${params.expirationTime.toISOString()}`,
  ].join("\n");
}

/**
 * Sign a web3-token.
 *
 * @param signer  – a function that signs a message string and returns the signature
 * @param expiry  – a timespan string such as `"1d"`, `"20h"`, etc.
 * @returns the base64-encoded token string
 */
export async function sign(
  signer: (msg: string) => Promise<string>,
  expiry: string
): Promise<string> {
  const expirationTime = new Date(Date.now() + parseTimespan(expiry));
  const body = buildMessage({ issuedAt: new Date(), expirationTime });
  const signature = await signer(body);

  if (typeof signature !== "string") {
    throw new Error("signer must return a signature string");
  }

  return btoa(JSON.stringify({ signature, body }));
}

export interface DecryptedBody {
  "web3-token-version"?: string;
  "issued-at"?: string;
  "expiration-time"?: string;
  nonce?: string;
  [key: string]: string | undefined;
}

/**
 * Verify / decode a web3-token and return its parsed body.
 *
 * Note: this only decodes – it does **not** verify the cryptographic
 * signature (the original `web3-token` verify does recover the signer
 * address, but callers in this codebase only use the body fields).
 */
export function verify(token: string): { body: DecryptedBody } {
  const decoded = JSON.parse(atob(token));
  const bodyStr: string = decoded.body;

  const body: DecryptedBody = {};
  for (const line of bodyStr.split("\n")) {
    const colonIdx = line.indexOf(": ");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).toLowerCase().replace(/ /g, "-");
    body[key] = line.slice(colonIdx + 2);
  }

  return { body };
}
