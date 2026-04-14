import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database
  GEMINI_API_KEY: string
  VK_CLIENT_ID: string
  VK_SECURE_KEY: string
  JWT_SECRET: string
  FRONTEND_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Настраиваем CORS для нашего фронтенда
app.use('/*', cors())

// Глобальный логгер запросов
app.use('*', async (c, next) => {
  const start = Date.now();
  const { method, url } = c.req;
  console.log(`[req] ${new Date().toISOString()} | ${method} ${url} | Starting...`);
  await next();
  const ms = Date.now() - start;
  console.log(`[res] ${new Date().toISOString()} | ${method} ${url} | Completed in ${ms}ms | Status: ${c.res.status}`);
})

// Middleware для защиты роутов
const authMiddleware = (c: any, next: any) => {
  const jwtSecret = c.env.JWT_SECRET || 'fallback-secret-for-dev'
  return jwt({ secret: jwtSecret, alg: 'HS256' })(c, next)
}

app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'Table AI API is running on Cloudflare Workers' })
})

// === Эндпоинты для ВКонтакте (Авторизация) ===

// --- Mock Auth (для тестов) ---
// Упрощённый flow: сразу создаём юзера, генерируем JWT и редиректим на фронтенд
app.get('/api/auth/mock/login', async (c) => {
  const frontendUrl = c.env.FRONTEND_URL || 'https://klublocal.ddns.net'
  const mockVkId = '123456789'
  const mockEmail = 'mockuser@example.com'
  const mockName = 'Тестовый Пользователь'
  const mockAvatar = 'https://ui-avatars.com/api/?name=Test+User&background=random'

  try {
    let userRecord: any = await c.env.DB.prepare('SELECT * FROM users WHERE vk_id = ?').bind(mockVkId).first()

    if (!userRecord) {
      const newUserId = crypto.randomUUID()
      await c.env.DB.prepare(
        'INSERT INTO users (id, vk_id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(newUserId, mockVkId, mockEmail, mockName, mockAvatar, 'admin').run()

      userRecord = { id: newUserId, vk_id: mockVkId, email: mockEmail, name: mockName, avatar_url: mockAvatar, role: 'admin' }
    }

    const jwtSecret = c.env.JWT_SECRET || 'fallback-secret-for-dev'
    const payload = {
      sub: userRecord.id,
      role: userRecord.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 1 неделя
    }
    const token = await sign(payload, jwtSecret)
    console.log('[auth/mock] Token issued, redirecting to frontend');

    return c.redirect(`${frontendUrl}/?token=${token}`)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 1. Получить URL для логина через ВК
app.get('/api/auth/vk/login', (c) => {
  const clientId = c.env.VK_CLIENT_ID
  const frontendUrl = c.env.FRONTEND_URL || 'https://klublocal.ddns.net'
  // ВСЕГДА используем основной домен для колбэка VK
  const redirectUri = `${frontendUrl}/api/auth/vk/callback`
  const scope = 'email'

  const vkLoginUrl = `https://oauth.vk.com/authorize?client_id=${clientId}&display=page&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`

  console.log('[auth/vk/login] Redirecting to VK with callback:', redirectUri);
  return c.redirect(vkLoginUrl)
})

// 2. Callback от ВК
app.get('/api/auth/vk/callback', async (c) => {
  console.log('[auth/vk/callback] Received callback from VK');
  const code = c.req.query('code')
  if (!code) {
    console.error('[auth/vk/callback] Code is missing in request');
    return c.json({ error: 'Code is missing' }, 400)
  }

  const clientId = c.env.VK_CLIENT_ID
  const secureKey = c.env.VK_SECURE_KEY
  const frontendUrl = c.env.FRONTEND_URL || 'https://klublocal.ddns.net'
  const redirectUri = `${frontendUrl}/api/auth/vk/callback`

  try {
    // Шаг 1: Обмен code на access_token
    console.log('[auth/vk/callback] Exchanging code for access token');
    const tokenUrl = `https://oauth.vk.com/access_token?client_id=${clientId}&client_secret=${secureKey}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    const tokenRes = await fetch(tokenUrl)
    const tokenData: any = await tokenRes.json()

    if (tokenData.error) {
      console.error('[auth/vk/callback] Error from VK access_token:', tokenData.error_description || tokenData.error);
      return c.json({ error: tokenData.error_description || tokenData.error }, 400)
    }

    const { access_token, user_id, email } = tokenData

    // Шаг 2: Получение инфо о пользователе
    console.log('[auth/vk/callback] Fetching VK profile for user_id:', user_id);
    const userUrl = `https://api.vk.com/method/users.get?user_ids=${user_id}&fields=photo_200&access_token=${access_token}&v=5.131`
    const userRes = await fetch(userUrl)
    const userData: any = await userRes.json()
    
    if (!userData.response || userData.response.length === 0) {
      console.error('[auth/vk/callback] Failed to get user data from VK');
      return c.json({ error: 'Failed to get user data from VK' }, 400)
    }

    const vkUser = userData.response[0]
    const fullName = `${vkUser.first_name} ${vkUser.last_name}`
    const avatarUrl = vkUser.photo_200

    // Шаг 3: Поиск или создание пользователя в D1
    let userRecord: any = await c.env.DB.prepare('SELECT * FROM users WHERE vk_id = ?').bind(user_id.toString()).first()

    if (!userRecord) {
      console.log('[auth/vk/callback] New VK user, creating profile in DB');
      const newUserId = crypto.randomUUID()
      await c.env.DB.prepare(
        'INSERT INTO users (id, vk_id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(newUserId, user_id.toString(), email || null, fullName, avatarUrl, 'user').run()
      
      userRecord = { id: newUserId, vk_id: user_id.toString(), email: email || null, name: fullName, avatar_url: avatarUrl, role: 'user' }
    } else {
      console.log('[auth/vk/callback] Existing VK user found:', userRecord.id);
      // Обновляем инфо (имя, аватар)
      await c.env.DB.prepare(
        'UPDATE users SET name = ?, avatar_url = ? WHERE id = ?'
      ).bind(fullName, avatarUrl, userRecord.id).run()
    }

    // Шаг 4: Генерация JWT
    const jwtSecret = c.env.JWT_SECRET || 'fallback-secret-for-dev'
    const payload = {
      sub: userRecord.id,
      role: userRecord.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 1 неделя
    }
    const token = await sign(payload, jwtSecret)

    console.log('[auth/vk/callback] Token issued, redirecting to frontend');
    // Редирект на корень фронтенда с токеном (фронтенд сам его подхватит)
    return c.redirect(`${frontendUrl}/?token=${token}`)

  } catch (e: any) {
    console.error('[auth/vk/callback] Catch error:', e.message);
    return c.json({ error: e.message }, 500)
  }
})

// === Защищенные эндпоинты ===

app.get('/api/user/me', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  console.log('[/me] Request from user ID:', payload.sub)
  const userId = payload.sub
  
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
  if (!user) {
    console.log('[/me] User not found in DB for ID:', userId)
    return c.json({ error: 'User not found' }, 404)
  }
  
  console.log('[/me] User found:', { id: user.id, role: user.role })
  return c.json(user)
})

// === Эндпоинты для работы с контентом ===

app.post('/api/content/mock-import', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  console.log('[/content/mock-import] Importing mock content for user ID:', userId)
  
  const mockPosts = [
    { id: crypto.randomUUID(), text: 'Пост 1: Обзор новой нейросети Gemini 1.5 Pro. Потрясающие возможности контекста!' },
    { id: crypto.randomUUID(), text: 'Пост 2: Как автоматизировать работу с таблицами с помощью ИИ. Пошаговый гайд.' },
    { id: crypto.randomUUID(), text: 'Пост 3: Отзыв клиента: "Table AI сэкономил нам 20 часов работы в неделю".' }
  ]

  try {
    for (const post of mockPosts) {
      await c.env.DB.prepare(
        'INSERT INTO content (id, user_id, source_type, raw_text) VALUES (?, ?, ?, ?)'
      ).bind(post.id, userId, 'vk_post', post.text).run()
    }
    console.log('[/content/mock-import] Import successful')
    return c.json({ success: true, message: 'Mock content imported' })
  } catch (e: any) {
    console.error('[/content/mock-import] Error:', e.message)
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/content', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  console.log('[/content] Fetching content for user ID:', userId)
  
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM content WHERE user_id = ? LIMIT 10').bind(userId).all()
    console.log(`[/content] Found ${results.length} rows for user:`, userId)
    return c.json(results)
  } catch (e: any) {
    console.error('[/content] Error:', e.message)
    return c.json({ error: e.message }, 500)
  }
})

// === Эндпоинты для AI и Распаковки ===
app.post('/api/ai/analyze', authMiddleware, async (c) => {
  // TODO: Логика получения промпта из таблицы `prompts`
  // И отправка запроса в Gemini API
  return c.json({ message: 'Analysis started' })
})

export default app
