# 🤖 AGENT_READ_FIRST.md - Инструкция для ИИ-агентов

**Версия:** 4.0.0 (SaaS Migration Edition)
**Дата:** 14 апреля 2026
**Статус:** Активная фаза миграции на Cloudflare

---

## 🎯 СРОЧНО К ПРОЧТЕНИЮ (Хендовер контекста)

Мы находимся в процессе миграции с Google Apps Script на SaaS архитектуру. 
**НЕ ПЫТАЙТЕСЬ** чинить старый бэкенд в `deploy/`, если задача касается веб-интерфейса.

### ТЕКУЩЕЕ СОСТОЯНИЕ (на 14.04.2026):
1.  **Архитектура "Shell + Brain":**
    *   **Оболочка (Shell):** Сервер `klublocal.ddns.net` (Nginx + Static React).
    *   **Мозг (Brain):** Cloudflare Worker `table-ai-backend.sheepoff.workers.dev`.
    *   **Nginx:** Проксирует `/api/*` в Cloudflare. Настроено подмену Host и SSL SNI.
2.  **Авторизация VK:**
    *   Работает через Cloudflare, но использует `redirect_uri=https://klublocal.ddns.net/api/auth/vk/callback`.
    *   Это сделано для прохождения проверок безопасности VK (Security Error исправлена).
3.  **Интеллект (AI):**
    *   Интегрирован Gemini 1.5 Flash через `@google/generative-ai`.
    *   Модуль: `saas/backend/src/ai.ts`.
    *   Эндпоинт: `/api/ai/analyze` (принимает prompt и text).
4.  **База Данных:**
    *   Cloudflare D1. ID: `117d51a6-630c-4d67-8a0d-1d2016b48d8a`.
    *   Таблицы `users`, `content`, `results` инициализированы.
5.  **Критический фикс JWT:**
    *   Всегда используйте `{ secret: key, alg: 'HS256' }` в Hono JWT. Без `alg` проверка токена падает.

---

## 📁 Структура проекта

### SaaS Часть (Новая)
- `saas/backend/src/index.ts` — Точка входа Cloudflare Worker.
- `saas/backend/src/server-node.ts` — Локальная копия для PM2/Node.js.
- `saas/backend/src/ai.ts` — Логика работы с Gemini.
- `web/App.tsx` — Фронтенд (React 19).
- `web/services/apiService.ts` — Связь с бэкендом (использует относительные пути).

### Legacy Часть (Google Sheets)
- `deploy/` — Скрипты Apps Script. Работают автономно в таблицах.

---

## 🚀 Как продолжать разработку

1.  **Тестирование:** Используйте `cd saas/backend && npm test`. Тесты на Vitest.
2.  **Деплой:** При изменениях в бэкенде: `cd saas/backend && wrangler deploy`.
3.  **Логи:** Для отладки в реальном времени: `wrangler tail`. Все логи имеют префиксы `[auth]`, `[ai]`, `[req]`.

### Ближайшие задачи (по TODO.md):
- Реализовать импорт стены VK (`/api/content/import`).
- Создать UI для отображения результатов AI анализа из таблицы `results`.
- Написать E2E тесты для сценария "Вход -> Анализ -> Просмотр".

---
*Если вы видите это сообщение, значит система Shell + Brain настроена и работает. Не меняйте redirect_uri без согласования с настройками VK приложения.*
