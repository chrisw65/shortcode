import { normalizeRetentionDays, normalizeUiMode } from '../src/services/platformConfig';

describe('platformConfig', () => {
  it('normalizes retention days correctly', () => {
    expect(normalizeRetentionDays(null)).toBeNull();
    expect(normalizeRetentionDays('')).toBeNull();
    expect(normalizeRetentionDays('30')).toBe(30);
    expect(normalizeRetentionDays(3650)).toBe(3650);
    expect(normalizeRetentionDays(0)).toBeNull();
    expect(normalizeRetentionDays(4000)).toBeNull();
  });

  it('normalizes ui mode values', () => {
    expect(normalizeUiMode('beginner')).toBe('beginner');
    expect(normalizeUiMode('EXPERT')).toBe('expert');
    expect(normalizeUiMode('')).toBeNull();
    expect(normalizeUiMode('invalid')).toBeNull();
  });
});
