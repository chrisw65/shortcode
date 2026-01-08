import fs from 'fs/promises';
import maxmind from 'maxmind';

type GeoResult = {
  country_code?: string | null;
  country_name?: string | null;
  region?: string | null;
  city?: string | null;
};

let readerPromise: Promise<any> | null = null;

function isPrivateIp(ip: string): boolean {
  return (
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    /^127\./.test(ip) ||
    ip === '::1'
  );
}

async function getReader() {
  if (readerPromise) return readerPromise;
  const dbPath = process.env.GEOIP_DB_PATH || '/etc/shortlink/geoip/DBIP-City.mmdb';
  try {
    await fs.access(dbPath);
  } catch {
    return null;
  }
  readerPromise = maxmind.open(dbPath);
  return readerPromise;
}

export async function lookupGeo(ip: string | null): Promise<GeoResult | null> {
  if (!ip || isPrivateIp(ip)) return null;
  const reader = await getReader();
  if (!reader) return null;
  try {
    const data = reader.get(ip);
    if (!data) return null;
    const country = data.country?.names?.en ?? null;
    const code = data.country?.iso_code ?? null;
    const city = data.city?.names?.en ?? null;
    const region = data.subdivisions?.[0]?.names?.en ?? null;
    return {
      country_code: code,
      country_name: country,
      region,
      city,
    };
  } catch {
    return null;
  }
}
