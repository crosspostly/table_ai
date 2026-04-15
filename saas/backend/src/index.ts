import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign } from 'hono/jwt'
import { analyzeContent, executeChain, AnalysisOptions } from './ai'
import { fetchSocialPosts } from './social'

type Bindings = {
  DB: D1Database
  GEMINI_API_KEY: string
  VK_CLIENT_ID: string
  VK_SECURE_KEY: string
  JWT_SECRET: string
  FRONTEND_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

// Middleware для защиты роутов
const authMiddleware = (c: any, next: any) => {
  const jwtSecret = c.env.JWT_SECRET || 'fallback-secret-for-dev'
  return jwt({ secret: jwtSecret, alg: 'HS256' })(c, next)
}

// Помощник для проверки лимитов
async function checkQuota(db: D1Database, userId: string, cost: number = 1): Promise<boolean> {
  const user: any = await db.prepare('SELECT balance, role FROM users WHERE id = ?').bind(userId).first();
  if (!user) return false;
  if (user.role === 'admin') return true; // Админам безлимит
  if (user.balance < cost) return false;
  
  await db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').bind(cost, userId).run();
  return true;
}

app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'Table AI SaaS API is running' })
})

// === Авторизация (упрощенно для примера) ===
app.get('/api/auth/mock/login', async (c) => {
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173'
  const mockVkId = '12345'
  
  try {
    let user: any = await c.env.DB.prepare('SELECT * FROM users WHERE vk_id = ?').bind(mockVkId).first()
    if (!user) {
      const id = crypto.randomUUID()
      await c.env.DB.prepare('INSERT INTO users (id, vk_id, name, balance, role) VALUES (?, ?, ?, ?, ?)')
        .bind(id, mockVkId, 'Test User', 100, 'user').run()
      user = { id, role: 'user' }
    }

    const token = await sign({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 86400 }, c.env.JWT_SECRET || 'secret')
    return c.redirect(`${frontendUrl}/?token=${token}`)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// === ИМПОРТ (Реальный) ===
app.post('/api/content/import', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { source, url, count } = await c.req.json()

  try {
    // 1. Получаем реальные данные
    const posts = await fetchSocialPosts(source, url, count);
    
    if (posts.length === 0) {
        return c.json({ success: false, error: 'No posts found' }, 404);
    }

    // 2. Сохраняем в БД
    const importId = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO imports (id, user_id, source_url, source_type, post_count, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(importId, userId, url, source, posts.length, 'completed').run()

    for (const post of posts) {
      const postId = crypto.randomUUID()
      await c.env.DB.prepare(
        'INSERT INTO content (id, user_id, import_id, source_type, raw_text, metadata) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(postId, userId, importId, source, post.text, JSON.stringify({ date: post.date, link: post.link })).run()
    }

    return c.json({ success: true, importId, count: posts.length })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// === AI И ЦЕПОЧКИ ===
app.post('/api/ai/analyze', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { prompt, text, options, contentId } = await c.req.json()

  if (!await checkQuota(c.env.DB, userId)) {
    return c.json({ error: 'Quota exceeded' }, 403)
  }

  try {
    const result = await analyzeContent(c.env.GEMINI_API_KEY, prompt + "\n\n" + text, options)
    
    const resultId = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO results (id, user_id, prompt_id, input_content_ids, ai_response) VALUES (?, ?, ?, ?, ?)'
    ).bind(resultId, userId, 'manual', JSON.stringify([contentId]), result).run()

    return c.json({ success: true, result, id: resultId })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/ai/chain', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { chain, initialText, contentId } = await c.req.json() // chain: [{promptId, options}]

  if (!await checkQuota(c.env.DB, userId, chain.length)) {
    return c.json({ error: 'Quota exceeded' }, 403)
  }

  try {
    // 1. Собираем тексты промптов из БД
    const fullChain = [];
    for (const step of chain) {
        const p: any = await c.env.DB.prepare('SELECT content FROM prompts WHERE id = ?').bind(step.promptId).first();
        fullChain.push({ prompt: p.content, options: step.options });
    }

    // 2. Выполняем цепочку
    const results = await executeChain(c.env.GEMINI_API_KEY, fullChain, initialText);
    const finalResult = results[results.length - 1];

    // 3. Сохраняем финальный результат
    const resultId = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO results (id, user_id, prompt_id, input_content_ids, ai_response) VALUES (?, ?, ?, ?, ?)'
    ).bind(resultId, userId, 'chain', JSON.stringify([contentId]), finalResult).run()

    return c.json({ success: true, results, finalResult, id: resultId })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// === ПОЛУЧЕНИЕ ДАННЫХ ===
app.get('/api/content', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { results } = await c.env.DB.prepare('SELECT * FROM content WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(userId).all()
  return c.json(results)
})

app.get('/api/results', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload')
  const userId = payload.sub
  const { results } = await c.env.DB.prepare('SELECT * FROM results WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all()
  return c.json(results)
})

export default app
