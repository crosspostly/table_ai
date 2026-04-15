import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from './server-node.ts';

describe('Table AI API Tests (server-node)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('GET / should return status ok', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', adapter: 'node-server' });
  });

  it('GET /api/auth/vk/login should redirect to VK', async () => {
    const res = await app.request('/api/auth/vk/login');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('oauth.vk.com/authorize');
  });

  it('GET /api/auth/mock/login should redirect to frontend with token', async () => {
    const res = await app.request('/api/auth/mock/login');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/?token=');
  });

  it('GET /api/user/me without token should return 401', async () => {
    const res = await app.request('/api/user/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/vk/callback should handle code and redirect', async () => {
    // Mock global fetch for VK API
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('oauth.vk.com/access_token')) {
        return Promise.resolve({
          json: () => Promise.resolve({ access_token: 'fake_token', user_id: 12345 })
        });
      }
      if (url.includes('api.vk.com/method/users.get')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            response: [{ first_name: 'Ivan', last_name: 'Ivanov', photo_200: 'http://photo.com' }]
          })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const res = await app.request('/api/auth/vk/callback?code=test_code');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/?token=');
    
    global.fetch = originalFetch;
  });
});
