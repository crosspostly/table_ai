import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock better-sqlite3 before importing app
vi.mock('better-sqlite3', () => {
  return {
    default: function() {
      return {
        prepare: vi.fn().mockImplementation(() => ({
          get: vi.fn().mockReturnValue({ id: 'mock-uuid', role: 'admin' }),
          run: vi.fn(),
          all: vi.fn().mockReturnValue([])
        }))
      };
    }
  };
});

import app from './server-node.ts';

// Mock DB because tests run on a real file if not careful.
// In a real environment, you'd use a separate test DB.
// For now, we're testing the Hono routes and logic.

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
    // Hono redirect is 302
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('oauth.vk.com/authorize');
    expect(res.headers.get('Location')).toContain('client_id=52344009');
    
    // Check logs
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[auth/vk/login] Initiating VK login redirect'));
  });

  it('GET /api/auth/mock/login should redirect to auth success', async () => {
    const res = await app.request('/api/auth/mock/login');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/auth/success?token=');
    
    // Check logs
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[auth/mock] Login requested'));
  });

  it('GET /api/user/me without token should return 401', async () => {
    const res = await app.request('/api/user/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/vk/callback should exchange code and create user', async () => {
    // Mock global fetch for VK API
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('access_token')) {
        return Promise.resolve({
          json: () => Promise.resolve({ access_token: 'fake_token', user_id: 12345, email: 'test@vk.com' })
        });
      }
      if (url.includes('users.get')) {
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
    expect(res.headers.get('Location')).toContain('/auth/success?token=');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[auth/vk/callback] Received callback from VK'));
    
    global.fetch = originalFetch;
  });
});
