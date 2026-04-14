import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign } from 'hono/jwt'
import crypto from 'crypto'
import fs from 'fs'

const DB_FILE = './db-mock.json'
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], content: [] }))

const getDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
const saveDb = (db: any) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))

const env = {
  VK_CLIENT_ID: "52344009",
  VK_SECURE_KEY: "fHKmdpHNo9GbSXMHAhdq",
  JWT_SECRET: "ImA6Fin7LovlVTqJcOK98ILTjGPLAxqdiTU+GWKL+xE=",
  FRONTEND_URL: "https://klublocal.ddns.net"
}

const app = new Hono()
app.use('/*', cors())

// Глобальный логгер запросов (по образцу klm)
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

app.get('/', (c) => c.json({ status: 'ok', storage: 'json-file' }))

// --- Mock Auth ---
app.get('/api/auth/mock/login', (c) => {
  console.log('[auth/mock] Login requested');
  // В server-json у нас упрощенная схема: редирект сразу на callback
  const redirectUri = env.FRONTEND_URL + '/api/auth/mock/callback'
  return c.redirect(redirectUri)
})

app.get('/api/auth/mock/callback', async (c) => {
  console.log('[auth/mock/callback] Mock callback processing');
  const db = getDb()
  const mockVkId = '123456789'
  let user = db.users.find((u: any) => u.vk_id === mockVkId)
  
  if (!user) {
    console.log('[auth/mock/callback] New mock user, adding to JSON DB');
    user = { id: crypto.randomUUID(), vk_id: mockVkId, name: 'Тестовый Пользователь', avatar_url: 'https://ui-avatars.com/api/?name=Test', role: 'admin' }
    db.users.push(user)
    saveDb(db)
  } else {
    console.log('[auth/mock/callback] Existing mock user found:', user.id);
  }

  const token = await sign({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 60*60*24*7 }, env.JWT_SECRET)
  console.log('[auth/mock/callback] Token issued, redirecting to frontend');
  return c.redirect(`${env.FRONTEND_URL}/auth/success?token=${token}`)
})

// --- VK Auth ---
app.get('/api/auth/vk/login', (c) => {
  console.log('[auth/vk/login] Initiating VK login redirect');
  const redirectUri = `${env.FRONTEND_URL}/api/auth/vk/callback`
  const url = `https://oauth.vk.com/authorize?client_id=${env.VK_CLIENT_ID}&display=page&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email&response_type=code`
  return c.redirect(url)
})

app.get('/api/auth/vk/callback', async (c) => {
  console.log('[auth/vk/callback] Received callback from VK');
  const code = c.req.query('code')
  const redirectUri = `${env.FRONTEND_URL}/api/auth/vk/callback`
  
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
    
    if (!userData.response || userData.response.length === 0) {
      console.error('[auth/vk/callback] Failed to get user data from VK');
      return c.json({ error: 'Failed to get user data' }, 400)
    }

    const vkUser = userData.response[0]
    const fullName = `${vkUser.first_name} ${vkUser.last_name}`

    const db = getDb()
    let user = db.users.find((u: any) => u.vk_id === tokenData.user_id.toString())
    
    if (!user) {
      console.log('[auth/vk/callback] New VK user, creating entry in JSON DB');
      user = { id: crypto.randomUUID(), vk_id: tokenData.user_id.toString(), name: fullName, avatar_url: vkUser.photo_200, role: 'user' }
      db.users.push(user)
      saveDb(db)
    } else {
      console.log('[auth/vk/callback] Existing VK user found:', user.id);
    }
    
    const token = await sign({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 60*60*24*7 }, env.JWT_SECRET)
    console.log('[auth/vk/callback] Token issued, redirecting to frontend');
    return c.redirect(`${env.FRONTEND_URL}/auth/success?token=${token}`)
  } catch (err: any) {
    console.error('[auth/vk/callback] Catch error:', err.message);
    return c.json({ error: err.message }, 500)
  }
})

// --- API Endpoints ---
app.get('/api/user/me', authMiddleware, (c: any) => {
  const payload = c.get('jwtPayload');
  console.log('[/me] Request from user ID:', payload.sub)
  const userId = payload.sub
  const user = getDb().users.find((u: any) => u.id === userId)
  if (!user) {
    console.log('[/me] User not found in JSON DB for ID:', userId)
    return c.json({ error: 'User not found' }, 404)
  }
  console.log('[/me] User found:', { id: user.id, role: user.role })
  return c.json(user)
})

app.get('/api/content', authMiddleware, (c: any) => {
  const userId = c.get('jwtPayload').sub
  console.log('[/content] Fetching content for user ID:', userId)
  const rows = getDb().content.filter((i: any) => i.user_id === userId)
  console.log(`[/content] Found ${rows.length} rows for user:`, userId)
  return c.json(rows)
})

app.post('/api/content/mock-import', authMiddleware, (c: any) => {
  const userId = c.get('jwtPayload').sub
  console.log('[/content/mock-import] Importing mock content for user ID:', userId)
  const db = getDb()
  db.content.push({ id: crypto.randomUUID(), user_id: userId, source_type: 'vk_post', raw_text: 'Пост 1: Gemini — мощь!', created_at: new Date().toISOString() })
  saveDb(db)
  console.log('[/content/mock-import] Import successful')
  return c.json({ success: true })
})

const port = 8787
console.log(`JSON Server is running on http://127.0.0.1:${port}`)
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' })
