export function anonymizeIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
    return ip;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    if (!parts.length) return ip;
    const prefix = parts.slice(0, 3).join(':');
    return `${prefix}::`;
  }
  return ip;
}
