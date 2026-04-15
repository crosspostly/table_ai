import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign } from 'hono/jwt'
import crypto from 'crypto'
import sqlite from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// Инициализация локальной БД (ленивая)
let _db: any = null;
function getDb() {
  if (_db) return _db;
  
  if (process.env.NODE_ENV === 'test') {
    // В режиме тестов возвращаем мок, если он не был установлен извне
    return {
      prepare: () => ({
        get: () => ({ id: 'mock-id', role: 'admin' }),
        run: () => ({}),
        all: () => []
      })
    };
  }

  const dbPath = path.join(projectRoot, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject')
  if (!fs.existsSync(dbPath)) {
    console.error('Database path not found:', dbPath);
    process.exit(1);
  }
  
  const dbFiles = fs.readdirSync(dbPath).filter(f => f.endsWith('.sqlite'))
  if (dbFiles.length === 0) {
    console.error('No SQLite database found. Run: npm run db:init')
    process.exit(1)
  }
  _db = new sqlite(path.join(dbPath, dbFiles[0]))
  return _db;
}

const db = {
  prepare: (sql: string) => getDb().prepare(sql)
};

type Bindings = {
  VK_CLIENT_ID: string
  VK_SECURE_KEY: string
  JWT_SECRET: string
  FRONTEND_URL: string
}

const env: Bindings = {
  VK_CLIENT_ID: "52344009",
  VK_SECURE_KEY: "fHKmdpHNo9GbSXMHAhdq",
  JWT_SECRET: "ImA6Fin7LovlVTqJcOK98ILTjGPLAxqdiTU+GWKL+xE=",
  FRONTEND_URL: "https://klublocal.ddns.net"
}

const app = new Hono()
app.use('/*', cors())

// Global request logger
app.use('*', async (c, next) => {
  const start = Date.now();
  const { method, url } = c.req;
  console.log(`[req] ${new Date().toISOString()} | ${method} ${url} | Starting...`);
  await next();
  const ms = Date.now() - start;
  console.log(`[res] ${new Date().toISOString()} | ${method} ${url} | Completed in ${ms}ms | Status: ${c.res.status}`);
})

const authMiddleware = (c: any, next: any) => {
  return jwt({ secret: env.JWT_SECRET, alg: 'HS256' })(c, next)
}

app.get('/', (c) => c.json({ status: 'ok', adapter: 'node-server' }))

app.get('/api/auth/mock/login', async (c) => {
  console.log('[auth/mock] Login requested');
  const mockVkId = '123456789'
  const mockEmail = 'mockuser@example.com'
  const mockName = 'Тестовый Пользователь'
  const mockAvatar = 'https://ui-avatars.com/api/?name=Test+User&background=random'

  try {
    let userRecord: any = db.prepare('SELECT * FROM users WHERE vk_id = ?').get(mockVkId)

    if (!userRecord) {
      console.log('[auth/mock] User not found, creating new user');
      const newUserId = crypto.randomUUID()
      db.prepare(
        'INSERT INTO users (id, vk_id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(newUserId, mockVkId, mockEmail, mockName, mockAvatar, 'admin')

      userRecord = { id: newUserId, vk_id: mockVkId, email: mockEmail, name: mockName, avatar_url: mockAvatar, role: 'admin' }
    } else {
      console.log('[auth/mock] Existing user found:', userRecord.id);
    }

    const payload = {
      sub: userRecord.id,
      role: userRecord.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    }
    const token = await sign(payload, env.JWT_SECRET, 'HS256')
    console.log('[auth/mock] Token issued, redirecting');

    return c.redirect(`${env.FRONTEND_URL}/?token=${token}`)
  } catch (e: any) {
    console.error('[auth/mock] Error:', e.message);
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/auth/vk/login', (c) => {
  console.log('[auth/vk/login] Initiating VK login redirect');
  let origin = '';
  try {
    const urlObj = new URL(c.req.url);
    origin = urlObj.origin;
  } catch(e) {
    origin = env.FRONTEND_URL; // fallback
  }
  const redirectUri = `${origin}/api/auth/vk/callback`
  // Прямой редирект вместо возврата JSON.
  const url = `https://oauth.vk.com/authorize?client_id=${env.VK_CLIENT_ID}&display=page&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email&response_type=code`
  return c.redirect(url)
})

app.get('/api/auth/vk/callback', async (c) => {
  console.log('[auth/vk/callback] Received callback from VK');
  const code = c.req.query('code')
  let origin = '';
  try {
    const urlObj = new URL(c.req.url);
    origin = urlObj.origin;
  } catch(e) {
    origin = env.FRONTEND_URL;
  }
  const redirectUri = `${origin}/api/auth/vk/callback`
  
  try {
    console.log('[auth/vk/callback] Exchanging code for access token');
    const tokenRes = await fetch(`https://oauth.vk.com/access_token?client_id=${env.VK_CLIENT_ID}&client_secret=${env.VK_SECURE_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`)
    const tokenData: any = await tokenRes.json()
    
    if (tokenData.error) {
      console.error('[auth/vk/callback] Error from VK access_token:', tokenData.error);
      return c.json(tokenData, 400)
    }

    console.log('[auth/vk/callback] Fetching VK profile for user_id:', tokenData.user_id);
    const userRes = await fetch(`https://api.vk.com/method/users.get?user_ids=${tokenData.user_id}&fields=photo_200&access_token=${tokenData.access_token}&v=5.131`)
    const userData: any = await userRes.json()
    const vkUser = userData.response[0]
    const fullName = `${vkUser.first_name} ${vkUser.last_name}`

    let user = db.prepare('SELECT * FROM users WHERE vk_id = ?').get(tokenData.user_id.toString()) as any
    if (!user) {
      console.log('[auth/vk/callback] New VK user, creating profile in DB');
      const id = crypto.randomUUID()
      db.prepare('INSERT INTO users (id, vk_id, name, avatar_url, role) VALUES (?, ?, ?, ?, ?)')
        .run(id, tokenData.user_id.toString(), fullName, vkUser.photo_200, 'user')
      user = { id, role: 'user' }
    } else {
      console.log('[auth/vk/callback] Existing VK user found:', user.id);
    }

    const token = await sign({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 60*60*24*7 }, env.JWT_SECRET, 'HS256')
    console.log('[auth/vk/callback] Token issued, redirecting to frontend');
    return c.redirect(`${env.FRONTEND_URL}/?token=${token}`)
  } catch (err: any) {
    console.error('[auth/vk/callback] Catch error:', err.message);
    return c.json({ error: err.message }, 500)
  }
})

app.get('/api/user/me', authMiddleware, (c: any) => {
  try {
    const payload = c.get('jwtPayload')
    console.log('[/me] Request from user ID:', payload.sub)
    const userId = payload.sub
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!user) {
      console.log('[/me] User not found in DB for ID:', userId)
      return c.json({ error: 'User not found' }, 404)
    }
    console.log('[/me] User found:', { id: user.id, role: user.role })
    return c.json(user)
  } catch (e: any) {
    console.error('[/me] Error:', e.message)
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/content', authMiddleware, (c: any) => {
  try {
    const userId = c.get('jwtPayload').sub
    console.log('[/content] Fetching content for user ID:', userId)
    const rows = db.prepare('SELECT * FROM content WHERE user_id = ? LIMIT 10').all(userId)
    console.log(`[/content] Found ${rows.length} rows for user:`, userId)
    return c.json(rows)
  } catch (e: any) {
    console.error('[/content] Error:', e.message)
    return c.json({ error: e.message }, 500)
  }
})

import { analyzeContent } from './ai.js'

// ... (existing imports)

app.post('/api/ai/analyze', authMiddleware, async (c: any) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { prompt, text, maxTokens, temperature } = await c.req.json()

  console.log(`[/ai/analyze] Analysis request for user: ${userId}`);

  try {
    // В реальном приложении мы бы брали ключ из БД или env
    const apiKey = process.env.GEMINI_API_KEY || 'REPLACE_WITH_REAL_KEY'
    const result = await analyzeContent(apiKey, prompt + "\n\n" + text, maxTokens, temperature)
    
    // Сохраняем результат в БД
    const resultId = crypto.randomUUID()
    db.prepare('INSERT INTO results (id, user_id, prompt_id, input_content_ids, ai_response) VALUES (?, ?, ?, ?, ?)')
      .run(resultId, userId, 'manual', '[]', result)

    return c.json({ success: true, result, id: resultId })
  } catch (e: any) {
    console.error('[/ai/analyze] Error:', e.message)
    return c.json({ error: e.message }, 500)
  }
})

const port = 8787
if (process.env.NODE_ENV !== 'test') {
  console.log(`Server is running on http://0.0.0.0:${port}`)
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
}

export default app
