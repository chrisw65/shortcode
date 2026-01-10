import { URLSearchParams } from 'url';

type DnsAutomationResult = {
  provider: string;
  status: 'skipped' | 'created' | 'error';
  details: string[];
};

type DnsRecordInput = {
  type: 'TXT' | 'CNAME';
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
};

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

function enabledProvider(): string | null {
  const provider = String(process.env.DNS_AUTOMATION_PROVIDER || '').trim().toLowerCase();
  return provider || null;
}

function cloudflareToken(): string | null {
  return process.env.CLOUDFLARE_API_TOKEN || null;
}

async function cfRequest(path: string, init: RequestInit = {}) {
  const token = cloudflareToken();
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN not set');
  const res = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const json = await res.json();
  if (!json?.success) {
    const message = json?.errors?.map((e: any) => e.message).join('; ') || res.statusText;
    throw new Error(message || 'Cloudflare API error');
  }
  return json;
}

function zoneCandidates(domain: string): string[] {
  const parts = domain.split('.').filter(Boolean);
  const candidates: string[] = [];
  for (let i = 0; i < parts.length - 1; i += 1) {
    const candidate = parts.slice(i).join('.');
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }
  return candidates;
}

async function findZoneId(domain: string): Promise<string | null> {
  for (const candidate of zoneCandidates(domain)) {
    const params = new URLSearchParams({ name: candidate, status: 'active', per_page: '1' });
    const data = await cfRequest(`/zones?${params.toString()}`);
    const zone = data?.result?.[0];
    if (zone?.id) return zone.id as string;
  }
  return null;
}

async function upsertRecord(zoneId: string, record: DnsRecordInput) {
  const params = new URLSearchParams({ type: record.type, name: record.name, per_page: '1' });
  const existing = await cfRequest(`/zones/${zoneId}/dns_records?${params.toString()}`);
  const existingRecord = existing?.result?.[0];
  const payload = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl ?? 120,
    proxied: record.proxied ?? false,
  };
  if (existingRecord?.id) {
    await cfRequest(`/zones/${zoneId}/dns_records/${existingRecord.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return 'updated';
  }
  await cfRequest(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return 'created';
}

export async function autoProvisionDns(domain: string, verificationToken: string): Promise<DnsAutomationResult | null> {
  const provider = enabledProvider();
  if (!provider) return null;
  if (provider !== 'cloudflare') {
    return {
      provider,
      status: 'skipped',
      details: ['unsupported provider'],
    };
  }

  const token = cloudflareToken();
  if (!token) {
    return { provider, status: 'skipped', details: ['CLOUDFLARE_API_TOKEN not set'] };
  }

  const details: string[] = [];
  try {
    const zoneId = await findZoneId(domain);
    if (!zoneId) {
      return { provider, status: 'error', details: ['zone not found for domain'] };
    }

    const txtRecords: DnsRecordInput[] = [
      { type: 'TXT', name: `_shortlink.${domain}`, content: verificationToken, ttl: 120 },
      { type: 'TXT', name: domain, content: `shortlink-verify=${verificationToken}`, ttl: 120 },
    ];
    for (const record of txtRecords) {
      const outcome = await upsertRecord(zoneId, record);
      details.push(`TXT ${record.name} ${outcome}`);
    }

    const cnameTarget = String(process.env.DNS_CNAME_TARGET || '').trim();
    if (cnameTarget) {
      const proxied = String(process.env.DNS_CNAME_PROXIED || 'true').toLowerCase() === 'true';
      const outcome = await upsertRecord(zoneId, {
        type: 'CNAME',
        name: domain,
        content: cnameTarget,
        ttl: 120,
        proxied,
      });
      details.push(`CNAME ${domain} -> ${cnameTarget} ${outcome}`);
    }

    return { provider, status: 'created', details };
  } catch (err: any) {
    details.push(err?.message || 'unknown error');
    return { provider, status: 'error', details };
  }
}
