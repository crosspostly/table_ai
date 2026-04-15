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

  console.log(`[auth/vk/login] DEBUG: Generated redirect_uri: ${redirectUri}`);
  console.log('[auth/vk/login] Redirecting to VK...');
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

app.post('/api/content/import', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { source, url, count } = await c.req.json()
  console.log(`[/content/import] Importing ${count} posts from ${source}: ${url} for user: ${userId}`)

  try {
    const importId = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO imports (id, user_id, source_url, source_type, post_count, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(importId, userId, url, source, count, 'completed').run()

    // Имитируем парсинг (в реальности здесь вызов VK/TG парсера)
    for (let i = 1; i <= count; i++) {
      const postId = crypto.randomUUID()
      await c.env.DB.prepare(
        'INSERT INTO content (id, user_id, import_id, source_type, raw_text) VALUES (?, ?, ?, ?, ?)'
      ).bind(postId, userId, importId, source, `Пост #${i} из ${source}: Содержание тестового поста #${i} для пакетного анализа.`).run()
    }

    return c.json({ success: true, importId, count })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/content/manual-import', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { text, sourceType } = await c.req.json()

  try {
    const importId = crypto.randomUUID()
    const postId = crypto.randomUUID()

    await c.env.DB.prepare(
      'INSERT INTO imports (id, user_id, source_url, source_type, post_count, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(importId, userId, 'manual-input', sourceType, 1, 'completed').run()

    await c.env.DB.prepare(
      'INSERT INTO content (id, user_id, import_id, source_type, raw_text) VALUES (?, ?, ?, ?, ?)'
    ).bind(postId, userId, importId, sourceType, text).run()

    return c.json({ success: true, id: postId })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/content/ocr-import', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { imageBase64, mimeType } = await c.req.json()
  const apiKey = c.env.GEMINI_API_KEY

  try {
    console.log(`[/content/ocr-import] Processing image for user: ${userId}`);
    const prompt = "Извлеки весь текст из этого скриншота отзыва. Верни ТОЛЬКО чистый текст отзыва без комментариев.";

    // Передаем картинку в Gemini для извлечения текста
    const extractedText = await analyzeContent(apiKey, prompt, 1000, 0.1, { data: imageBase64, mimeType });

    const importId = crypto.randomUUID()
    const postId = crypto.randomUUID()

    await c.env.DB.prepare(
      'INSERT INTO imports (id, user_id, source_url, source_type, post_count, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(importId, userId, 'ocr-vision', 'reviews', 1, 'completed').run()

    await c.env.DB.prepare(
      'INSERT INTO content (id, user_id, import_id, source_type, raw_text) VALUES (?, ?, ?, ?, ?)'
    ).bind(postId, userId, importId, 'reviews', extractedText).run()

    return c.json({ success: true, text: extractedText, id: postId })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// === CRUD для Промптов ===

app.post('/api/prompts', authMiddleware, async (c) => {
  const { name, content, description } = await c.req.json()
  const id = crypto.randomUUID()
  try {
    await c.env.DB.prepare(
      'INSERT INTO prompts (id, name, content, description) VALUES (?, ?, ?, ?)'
    ).bind(id, name, content, description).run()
    return c.json({ success: true, id })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.put('/api/prompts/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { name, content, description, is_active } = await c.req.json()
  try {
    await c.env.DB.prepare(
      'UPDATE prompts SET name = ?, content = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name, content, description, is_active ? 1 : 0, id).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.delete('/api/prompts/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  try {
    await c.env.DB.prepare('DELETE FROM prompts WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/ai/analyze-batch', authMiddleware, async (c) => {

  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { promptId, contentIds } = await c.req.json()
  const apiKey = c.env.GEMINI_API_KEY

  try {
    // 1. Получаем текст всех выбранных постов
    const idList = contentIds.map((_: any) => '?').join(',')
    const { results: posts } = await c.env.DB.prepare(
      `SELECT raw_text FROM content WHERE id IN (${idList}) AND user_id = ?`
    ).bind(...contentIds, userId).all()

    const fullText = posts.map((p: any) => p.raw_text).join("\n\n---\n\n")

    // 2. Получаем промпт
    const promptData: any = await c.env.DB.prepare('SELECT content FROM prompts WHERE id = ?').bind(promptId).first()
    const prompt = promptData?.content || "Проанализируй эти посты:"

    // 3. Вызываем Gemini
    const result = await analyzeContent(apiKey, prompt + "\n\nДАННЫЕ:\n" + fullText)

    // 4. Сохраняем общий результат
    const resultId = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO results (id, user_id, prompt_id, input_content_ids, ai_response) VALUES (?, ?, ?, ?, ?)'
    ).bind(resultId, userId, promptId, JSON.stringify(contentIds), result).run()

    return c.json({ success: true, result, id: resultId })
  } catch (e: any) {
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

import { analyzeContent } from './ai'

// ... (after authMiddleware)

// === Эндпоинты для AI и Распаковки ===
app.post('/api/ai/analyze', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { prompt, text, maxTokens, temperature, contentId, promptId } = await c.req.json()
  const apiKey = c.env.GEMINI_API_KEY

  console.log(`[/ai/analyze] AI Analysis requested by user: ${userId} for content: ${contentId}`)

  try {
    const result = await analyzeContent(apiKey, prompt + "\n\n" + text, maxTokens, temperature)
    
    // Сохраняем результат в D1
    const resultId = crypto.randomUUID()
    const contentIdsJson = JSON.stringify(contentId ? [contentId] : [])
    
    await c.env.DB.prepare(
      'INSERT INTO results (id, user_id, prompt_id, input_content_ids, ai_response) VALUES (?, ?, ?, ?, ?)'
    ).bind(resultId, userId, promptId || 'manual', contentIdsJson, result).run()

    return c.json({ success: true, result, id: resultId })
  } catch (e: any) {
    console.error('[/ai/analyze] Error:', e.message)
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/prompts', authMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM prompts ORDER BY name ASC').all()
    return c.json(results)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default app

