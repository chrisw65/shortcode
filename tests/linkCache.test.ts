import redisClient from '../src/config/redis';
import { getCachedLink, setCachedLink, invalidateCachedLinks } from '../src/services/linkCache';

jest.mock('../src/config/redis', () => ({
  __esModule: true,
  default: {
    isReady: true,
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

describe('linkCache', () => {
  beforeEach(() => {
    (redisClient.get as jest.Mock).mockReset();
    (redisClient.set as jest.Mock).mockReset();
    (redisClient.del as jest.Mock).mockReset();
    redisClient.isReady = true;
  });

  it('returns null when redis is not ready', async () => {
    redisClient.isReady = false;
    const result = await getCachedLink('abc');
    expect(result).toBeNull();
  });

  it('sets and gets cached links', async () => {
    const payload = { id: '1', original_url: 'https://example.com', active: true };
    await setCachedLink('abc', payload);
    (redisClient.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(payload));
    const result = await getCachedLink('abc');
    expect(redisClient.set as jest.Mock).toHaveBeenCalled();
    expect(result).toEqual(payload);
  });

  it('invalidates cached links', async () => {
    await invalidateCachedLinks(['a', 'b']);
    expect(redisClient.del as jest.Mock).toHaveBeenCalledWith(['shortlink:link:a', 'shortlink:link:b']);
  });
});
