# 🏗️ Архитектура Table AI SaaS (Shell + Brain)

Система построена на принципе разделения статической оболочки и облачного интеллекта.

## 1. Компоненты системы

### 🐚 Оболочка (Shell) — `klublocal.ddns.net`
- **Frontend:** React 19 + Vite. Собран в `web/dist`.
- **Web Server:** Nginx 1.24.
- **Роль:** Отдача статики пользователю и безопасное проксирование API-запросов.
- **Nginx Config:** Настроен на `proxy_pass` для пути `/api` в сторону Cloudflare.

### 🧠 Мозг (Brain) — Cloudflare Workers
- **Worker:** `table-ai-backend`.
- **Database:** Cloudflare D1 (SQLite-compatible).
- **Роль:** Вся бизнес-логика, авторизация, обработка AI-запросов и хранение данных.
- **Преимущество:** Бесконечная масштабируемость и высокая доступность.

## 2. Поток авторизации (VK OAuth)

1. Пользователь нажимает «Войти ВК» на `klublocal.ddns.net`.
2. Запрос уходит на `klublocal.ddns.net/api/auth/vk/login`.
3. Nginx прозрачно проксирует это в Cloudflare.
4. Worker генерирует URL авторизации с `redirect_uri=https://klublocal.ddns.net/api/auth/vk/callback`.
5. ВК возвращает пользователя на ваш домен.
6. Nginx снова проксирует ответ в Worker.
7. Worker выдает JWT и редиректит на `klublocal.ddns.net/?token=...`.
8. Frontend подхватывает токен и авторизует пользователя.

## 3. Логирование и отладка

- **Логи сервера (Nginx):** `/var/log/nginx/access.log` (видим входящие запросы).
- **Логи приложения (Worker):** Доступны через `wrangler tail` или в консоли Cloudflare. Все логи имеют префиксы типа `[auth/vk/callback]` для удобства.
- **Локальный бэкенд:** Запущен через PM2 (`table-ai-backend`), но сейчас используется Nginx-прокси напрямую в облако для стабильности.
