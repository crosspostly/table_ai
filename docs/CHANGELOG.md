# CHANGELOG - Table AI

## v3.5.2 (2025-01-XX) - CRITICAL: RETRY LOGIC & RATE LIMIT FIX

### 🚨 Critical Bug Fixes

#### 1. Gemini API Retry Logic: Quota Exhaustion Storm
**Проблема:**
- Пользователь запускал CollectConfig → упирался в quota
- Система делала retry каждые **1s → 2s → 4s** (слишком быстро!)
- Результат: **20+ retry за несколько минут** → блокировка пользователя на 15+ минут
- Пример: одна попытка в 18:39:05 привела к 20+ ошибкам до 18:54:19

**Решение:**
- ⭐ **Exponential backoff увеличен:** 30s → 60s → 120s (вместо 1s → 2s → 4s)
- ⭐ **Максимум 3 попытки** (жёстко), затем понятная ошибка пользователю
- ⭐ **Парсинг Retry-After** из ответа Google API (если есть)
- ⭐ **Детальное логирование** каждой попытки с таймстампами
- ⭐ **User-friendly ошибка:** "⏸️ Квота Gemini API исчерпана. Подождите 120 секунд"

**Код:**
```javascript
// server.gs: executeGeminiWithRateLimit()
const backoffDelay = Math.pow(2, attempt) * MIN_RETRY_DELAY_MS; // 30s, 60s, 120s
```

**Логи:**
```
[RATE_LIMIT_429] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[RATE_LIMIT_429] 🚫 QUOTA EXCEEDED или RATE LIMIT
[RATE_LIMIT_429] Попытка: 1/3
[RATE_LIMIT_429] Ожидание: 30 секунд
[RATE_LIMIT_429] Retry-After из API: не указан
[RATE_LIMIT_429] Backoff delay: 30s
[RATE_LIMIT_429] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 2. Rate Limiter: Слишком агрессивный лимит
**Проблема:**
- `MAX_REQUESTS_PER_MINUTE = 10` (слишком много!)
- При batch-операциях (reniewcell.gs) быстро исчерпывалась квота
- Нет предупреждения пользователю до превышения

**Решение:**
- ⭐ **Снижен лимит:** `MAX_REQUESTS_PER_MINUTE = 2` (вместо 10)
- ⭐ **Детальное логирование:** каждое ожидание rate limit
- ⭐ **User-friendly сообщение:** "⏸️ Превышен лимит запросов (2 запросов/минуту)"

**Код:**
```javascript
// server.gs
const MAX_REQUESTS_PER_MINUTE = 2; // ⭐ Снижено с 10
const MIN_RETRY_DELAY_MS = 30000; // ⭐ Минимум 30 секунд
```

#### 3. Улучшенное логирование
**Добавлено:**
- ⭐ Timestamp для каждого вызова Gemini API
- ⭐ Функция-источник вызова
- ⭐ Размер входных данных (prompt size)
- ⭐ Retry count
- ⭐ Полный текст ошибки
- ⭐ Retry-After значение (если есть)
- ⭐ Логирование в лист `API_METRICS` (LICENSE_SHEET_ID)

**Пример логов:**
```
[GEMINI_CALL] Попытка 1/3 в 2025-01-15T18:39:05Z
[GEMINI_CALL] Модель: gemini-2.5-flash-lite, Prompt size: 1234
[GEMINI_ERROR] Попытка 1/3 НЕУДАЧНА в 2025-01-15T18:39:06Z
[GEMINI_ERROR] Ошибка: Resource exhausted (retry after 30s)
```

**Файлы:**
- `deploy/server.gs`: Полностью переработана функция `executeGeminiWithRateLimit()`
- `deploy/server.gs`: Улучшена функция `callGeminiApi()` для парсинга retryDelay
- `deploy/server.gs`: Добавлен метод `RateLimitManager.getRateLimitErrorMessage()`
- `docs/GEMINI_API_CALLS.md`: **Новый документ** с картой всех вызовов API
- `README.md`: Добавлена секция "⚡ Retry-логика и Rate Limiting"

**Обратная совместимость:**
- ✅ Все существующие вызовы продолжают работать
- ✅ Новая логика применяется автоматически
- ✅ Нет breaking changes

### 📊 Acceptance Criteria

- [x] Все функции, вызывающие Gemini, найдены и задокументированы (docs/GEMINI_API_CALLS.md)
- [x] Retry-логика использует exponential backoff ≥30s между попытками
- [x] Rate-limiter предотвращает избыточные запросы (макс 2/минуту)
- [x] Добавлено детальное логирование с таймстампами
- [x] Пользователь получает понятную ошибку при исчерпании квоты
- [x] Документирован весь поток вызовов API

### 🔧 Bug Fixes

#### OTA System: Backward Compatibility
**Проблема:**
- Старые клиенты (v3.4.x и ниже) имели функцию `checkForUpdates_()` без суффикса `Background_`
- Триггеры создавались с именем `checkForUpdates_`
- При попытке обновления возникала ошибка: `checkForUpdates_ is not defined`

**Решение:**
- Добавлен **алиас-функция** `checkForUpdates_()` в `Main.gs` (строка 2034)
- Функция автоматически перенаправляет вызовы на `checkForUpdatesBackground_()`
- Старые клиенты теперь могут успешно обновиться
- Добавлено логирование для отслеживания использования deprecated функции

**Файлы:**
- `deploy/Main.gs`: Добавлена функция `checkForUpdates_()` как алиас

**Обратная совместимость:**
- ✅ Старые триггеры с именем `checkForUpdates_` будут работать
- ✅ Старые вызовы `checkForUpdates_()` будут перенаправлены
- ✅ После обновления клиенты автоматически получат новые триггеры с правильным именем

**TODO для будущих версий:**
- После обновления всех клиентов до v3.5.2+ можно удалить алиас-функцию
- Рекомендуемый срок: через 3-6 месяцев после релиза v3.5.2

---

## v3.5.1 (2025-01-XX) - DEV TOOLS EXTRACTION

### ⚙️ Development Tools

#### Extracted DEV Code
**Изменения:**
- Все DEV функции вынесены в отдельный файл `DevTools.gs`
- `Main.gs` очищен от DEV констант и функций
- Добавлена graceful fallback для отсутствующих DEV функций
- Создан `PRODUCTION_DEPLOY.md` с инструкциями по развертыванию

**Файлы:**
- `deploy/DevTools.gs`: Новый файл с DEV инструментами
- `deploy/Main.gs`: Очищен от DEV кода
- `.claspignore`: Добавлено исключение `DevTools.gs`
- `docs/PRODUCTION_DEPLOY.md`: Новый документ

---

## v3.5.0 (2025-01-XX) - PRIVATE GITHUB OTA

### 🚀 Major Features

#### Private GitHub Repository Support
**Описание:**
- Поддержка приватных GitHub репозиториев для OTA обновлений
- Четкое разделение CLIENT/SERVER ответственности
- Модульная архитектура OTA системы

**Ключевые изменения:**

**CLIENT (Main.gs):**
- ✅ `checkForUpdatesBackground_()` - фоновая проверка версии
- ✅ `checkForUpdatesManual_()` - ручная проверка из меню
- ❌ НЕ скачивает файлы
- ❌ НЕ знает про GitHub
- ❌ НЕ знает про PAT (Private Access Token)

**SERVER (server.gs + ota_updates.gs):**
- ✅ `checkForUpdates_()` - сравнение версий
- ✅ `applyUpdatesToClient_()` - полное обновление клиента
- ✅ `downloadFileFromGithub_()` - скачивание с GitHub
- ✅ `setGithubPAT_()` / `getGithubPAT_()` - управление токеном

**Новый файл:** `deploy/ota_updates.gs`
- Модульный файл с логикой OTA (375 строк)
- Поддержка публичных и приватных репозиториев
- Централизованное управление GitHub доступом

**Конфигурация:**
```javascript
// server.gs
const REPO_IS_PUBLIC = true;  // true = публичный, false = приватный

// Для приватного репозитория (один раз):
setGithubPAT_('ghp_YOUR_TOKEN_HERE')
```

**Файлы:**
- `deploy/ota_updates.gs`: Новый модуль с OTA логикой
- `deploy/server.gs`: Упрощен, делегирует OTA в отдельный модуль
- `deploy/Main.gs`: Упрощен, только проверка и запрос обновления
- `docs/GITHUB_PRIVATE_REPO.md`: Новый документ
- `docs/OTA_UPDATES.md`: Обновлен для v3.5

---

## v3.4.5 и ниже

См. историю в Git commits

---

## Migration Guide

### Переход на v3.5.2 (из v3.4.x или ниже)

**Автоматическое обновление:**
1. Пользователь нажимает "🔄 Автообновление"
2. Старая функция `checkForUpdates_()` перенаправит на новую
3. Обновление применится автоматически
4. Email уведомление об успехе

**Ручное обновление (если автоматическое не работает):**
1. Extensions → Apps Script
2. Скопировать все файлы из GitHub `/deploy/` папки
3. Сохранить и перезагрузить таблицу

### Переход на v3.5.0 (приватный репозиторий)

**Для администраторов:**
1. Создать приватный GitHub репозиторий
2. Сгенерировать Personal Access Token (PAT)
3. Выполнить в server.gs консоли:
   ```javascript
   setGithubPAT_('ghp_YOUR_TOKEN_HERE')
   ```
4. Изменить в `server.gs`:
   ```javascript
   const REPO_IS_PUBLIC = false;
   ```
5. Deploy сервера: `clasp deploy --force`
6. ✅ Все клиенты получат обновления из приватного репо

**Для клиентов:**
- Никаких действий не требуется
- Обновление произойдет автоматически ночью в 3:00
- Или вручную через меню "🔄 Автообновление"

---

**Последнее обновление:** 2025-01-XX
