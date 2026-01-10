type OidcDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
};

const discoveryCache = new Map<string, { value: OidcDiscovery; expiresAt: number }>();
const TTL_MS = 60 * 60 * 1000;

export async function discoverIssuer(issuerUrl: string): Promise<OidcDiscovery> {
  const cached = discoveryCache.get(issuerUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = issuerUrl.replace(/\/+$/, '') + '/.well-known/openid-configuration';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed (${res.status})`);
  }
  const data = (await res.json()) as OidcDiscovery;
  if (!data?.authorization_endpoint || !data?.token_endpoint || !data?.jwks_uri) {
    throw new Error('OIDC discovery missing required endpoints');
  }
  discoveryCache.set(issuerUrl, { value: data, expiresAt: Date.now() + TTL_MS });
  return data;
}

export function normalizeIssuer(issuerUrl: string): string {
  return issuerUrl.trim().replace(/\/+$/, '');
}

export function defaultScopes(scopes: string[] | null | undefined): string[] {
  if (scopes && scopes.length) return scopes;
  return ['openid', 'profile', 'email'];
}
