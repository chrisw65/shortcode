// src/services/domainVerification.ts
import { resolveTxt } from 'dns/promises';

export type VerificationResult = {
  ok: boolean;
  checkedHostnames: string[];
  matchedAt?: string;  // hostname that matched
  reason?: string;
};

/**
 * We ask the customer to publish a TXT record with a token at:
 *   _shortlink-verify.<domain>
 * Value: shortlink-verify=<token>
 *
 * We also check the root domain as a fallback (some DNS providers prefer it).
 */
export async function verifyDomainTxt(domain: string, token: string): Promise<VerificationResult> {
  const candidates = [
    `_shortlink-verify.${domain}`,
    domain,
  ];

  const expectedExact = `shortlink-verify=${token}`;

  for (const host of candidates) {
    try {
      const txt = await resolveTxt(host);
      // txt is string[][]
      const flat = txt.map(parts => parts.join('')).map(s => s.trim());
      if (flat.includes(expectedExact)) {
        return { ok: true, matchedAt: host, checkedHostnames: candidates };
      }
    } catch (e: any) {
      // ignore NXDOMAIN/ENODATA; continue to next candidate
    }
  }

  return {
    ok: false,
    checkedHostnames: candidates,
    reason: `TXT not found. Expect a TXT record with value "${expectedExact}" on one of: ${candidates.join(', ')}.`,
  };
}

