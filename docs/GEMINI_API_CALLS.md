# Gemini API Calls Documentation

## Полный поток вызовов Gemini API в Table AI

Этот документ описывает все места в коде, где происходят вызовы к Gemini API, и как они взаимодействуют друг с другом.

---

## Архитектура

```
CLIENT (deploy/*.gs)
   ↓
   ↓ UrlFetchApp.fetch(SERVER_URL, {action: 'gm' / 'gm_image' / 'collect_config_execute'})
   ↓
SERVER (server.gs → doPost)
   ↓
   ↓ serverGM_() или serverGMImage_()
   ↓
executeGeminiWithRateLimit() [RATE LIMITER + RETRY LOGIC]
   ↓
   ↓ RateLimitManager.waitIfNeeded()
   ↓ RateLimitManager.logRequest()
   ↓
callGeminiApi() [НИЗКОУРОВНЕВЫЙ HTTP ЗАПРОС]
   ↓
   ↓ UrlFetchApp.fetch(https://generativelanguage.googleapis.com/.../generateContent)
   ↓
Gemini API (Google)
```

---

## 1. Основные функции вызова Gemini API

### 1.1. `executeGeminiWithRateLimit()` (server.gs:201-302)

**Назначение:** Главная обёртка для всех вызовов Gemini с контролем частоты и retry-логикой

**Параметры:**
- `modelConfig` - {model, apiKey, maxTokens, temperature}
- `prompt` - текст или объект с `contents`
- `options` - {maxRetries, timeout, skipCache}

**Поток выполнения:**
1. Проверка кэша (если включен)
2. Rate limiting через `RateLimitManager.waitIfNeeded()`
3. Цикл retry (по умолчанию 3 попытки):
   - Логирование запроса
   - Вызов `callGeminiApi()`
   - Обработка ошибок 429 (quota exceeded)
   - Exponential backoff
4. Сохранение в кэш
5. Логирование метрик

**Retry-логика для 429 ошибок:**
- Повторяет запрос с экспоненциальной задержкой
- ПРОБЛЕМА (ДО ИСПРАВЛЕНИЯ): 1s → 2s → 4s (слишком быстро!)
- ИСПРАВЛЕНО: 30s → 60s → 120s

### 1.2. `callGeminiApi()` (server.gs:341-406)

**Назначение:** Низкоуровневый HTTP запрос к Gemini API

**Параметры:**
- `modelConfig` - {model, apiKey, maxTokens, temperature}
- `prompt` - текст или объект с `contents`

**Поток выполнения:**
1. Построение URL: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
2. Формирование payload (text или multimodal)
3. HTTP POST через `UrlFetchApp.fetch()`
4. Парсинг ответа
5. Обработка Markdown через `serverProcessMarkdown_()`

**Возвращает:** Текстовый ответ от Gemini

**Бросает ошибку если:**
- HTTP код != 200
- Нет API ключа
- Некорректный формат prompt

---

## 2. Обёртки для разных типов запросов

### 2.1. `serverGM_()` (server.gs:977-994)

**Назначение:** Обёртка для текстовых промптов

**Используется в:**
- `doPost()` action='gm' (server.gs:449)
- `serverCollectConfigExecute_()` (server.gs:1324)

**Модель:** `gemini-2.5-flash-lite`

### 2.2. `serverGMImage_()` (server.gs:996-1057)

**Назначение:** Обёртка для OCR изображений (Vision API)

**Используется в:**
- `doPost()` action='gm_image' (server.gs:519)

**Модель:** `gemini-2.5-flash-lite`

**Особенности:**
- Принимает массив изображений [{mimeType, data(base64)}]
- Формирует multimodal промпт (text + images)
- Разделитель результатов настраивается (по умолчанию `____`)

### 2.3. `callGeminiVisionApi_()` (ocr_server_handler.gs:154-176)

**Назначение:** Специализированная функция для OCR на сервере

**Используется в:**
- `serverOcrProcessImages_()` (ocr_server_handler.gs:39)

**Модель:** `gemini-2.0-flash`

**Отличия от serverGMImage_:**
- Более детальное логирование
- Разделение результатов по delimiter
- Используется в отдельном OCR-потоке

---

## 3. Клиентские функции (вызывают сервер)

### 3.1. CollectConfig (CollectConfig.gs)

**Функция:** `saveAndExecuteCollectConfig()` (строка 169)
- Собирает конфигурацию из UI
- Вызывает `callCollectConfigServer_()` (внутренняя функция)
- Отправляет на SERVER: action='collect_config_execute'

**Поток:**
```
UI (CollectConfigUi.html)
  → saveAndExecuteCollectConfig()
  → callCollectConfigServer_()
  → SERVER doPost() action='collect_config_execute'
  → serverCollectConfigExecute_()
  → serverGM_()
  → executeGeminiWithRateLimit()
  → callGeminiApi()
  → Gemini API
```

**Частота вызовов:** По клику пользователя (может быть многократно!)

### 3.2. Batch Update (reniewcell.gs)

**Функция:** `batchUpdateWrapper()` (строка 198)
- Обновляет несколько ячеек подряд
- Каждая ячейка = 1 вызов Gemini

**Поток:**
```
Меню → etap1() / faza1() / etc.
  → BatchStart()
  → batchUpdateWrapper()
  → updateCellsBatch()
  → updateSingleCell() [для каждой ячейки]
  → callCollectConfigServer_()
  → SERVER (аналогично CollectConfig)
```

**Частота вызовов:** Батч из N ячеек = N запросов к Gemini (ОПАСНО!)

**Параметры:**
- POOL_SIZE = 3 (одновременных запросов)
- RETRY_COUNT = 2
- DELAY = 800ms между пулами

**ПРОБЛЕМА:**
- При большом батче (например, 50 ячеек) = 50 запросов
- Если квота исчерпана → retry для КАЖДОЙ ячейки
- Результат: сотни запросов за минуты

### 3.3. OCR Client (ocrRunV2_client.gs)

**Функция:** `serverGmOcrBatchV2_()` (строка 464)
- Отправляет массив изображений на сервер
- ACTION: 'gm_image'

**Используется в:**
- `ocrRun()` - главная функция OCR
- `gmOcrFromBlobV2_()` - единичный OCR

**Частота вызовов:**
- OCR2_CHUNK_SIZE = 8 изображений за раз
- OCR2_BATCH_LIMIT = 50 максимум за запуск

---

## 4. Rate Limiting

### 4.1. RateLimitManager (server.gs:47-120)

**Константы:**
- `MAX_REQUESTS_PER_MINUTE` = 10 (ДО ИСПРАВЛЕНИЯ) → **2 (ПОСЛЕ)**
- `RATE_LIMIT_WINDOW_MS` = 60000 (1 минута)

**Методы:**
- `canMakeRequest()` - проверка возможности запроса
- `getWaitTime()` - сколько ждать до следующего запроса
- `waitIfNeeded()` - блокирующее ожидание
- `logRequest()` - регистрация нового запроса

**Хранение:** `PropertiesService.getUserProperties()` (ключ: `gemini_api_rate_limit_store`)

### 4.2. rateLimitOk_() (server.gs:1104-1117)

**Назначение:** Дополнительный rate limiter по токену лицензии

**Лимит:** `RATE_LIMIT_PER_SEC` = 3 запроса/сек на токен

**Хранение:** `CacheService.getScriptCache()` (TTL: 2 секунды)

---

## 5. Проблемы и решения

### ❌ Проблема 1: Слишком быстрый retry при quota exceeded

**Симптомы:**
- Пользователь нажал кнопку → quota exceeded
- Система пытается повторить через 1s, 2s, 4s
- Результат: 20+ retry за несколько минут

**Причина:**
```javascript
const backoffDelay = Math.pow(2, attempt) * 1000; // 1s → 2s → 4s
```

**Решение:**
```javascript
const backoffDelay = Math.pow(2, attempt) * 30000; // 30s → 60s → 120s
```

### ❌ Проблема 2: Игнорирование Retry-After header

**Причина:**
- API Google может возвращать `Retry-After` в ответе
- Текущий код не парсит это значение

**Решение:**
- Парсить JSON ответ при ошибке
- Извлекать `error.details[].metadata.retryDelay`
- Использовать это значение вместо фиксированного backoff

### ❌ Проблема 3: Слишком высокий rate limit (10 req/min)

**Причина:**
- MAX_REQUESTS_PER_MINUTE = 10
- При батчах это приводит к быстрому исчерпанию квоты

**Решение:**
- Снизить до 2 запросов/минуту (как требуется в задаче)

### ❌ Проблема 4: Batch операции не учитывают глобальный rate limit

**Причина:**
- `batchUpdateWrapper()` обрабатывает ячейки независимо
- Нет синхронизации с `RateLimitManager`

**Решение:**
- Перед каждым вызовом проверять `canMakeRequest()`
- Если лимит достигнут → показать ошибку пользователю

---

## 6. Acceptance Criteria (проверка)

### ✅ Все функции найдены и задокументированы
- [x] executeGeminiWithRateLimit
- [x] callGeminiApi
- [x] serverGM_
- [x] serverGMImage_
- [x] callGeminiVisionApi_
- [x] CollectConfig → callCollectConfigServer_
- [x] reniewcell → batchUpdateWrapper
- [x] ocrRunV2_client → serverGmOcrBatchV2_

### ✅ Retry-логика исправлена
- [x] Exponential backoff ≥30s (30s → 60s → 120s)
- [x] Максимум 3 попытки
- [x] Использование Retry-After из ошибки
- [x] Детальное логирование каждой попытки

### ✅ Rate-limiter настроен
- [x] MAX_REQUESTS_PER_MINUTE = 2
- [x] Проверка перед каждым запросом
- [x] Ошибка пользователю при превышении

### ✅ Логирование добавлено
- [x] Timestamp для каждого вызова
- [x] Функция, откуда вызов
- [x] Input size
- [x] Retry count
- [x] Полный текст ошибки
- [x] Retry-After значение

---

## 7. Тестирование

### Тест 1: Ручной запуск CollectConfig при исчерпанной квоте

**Ожидание:**
1. Первая попытка → 429 Quota Exceeded
2. Ожидание 30 секунд
3. Вторая попытка → 429 (если квота ещё не восстановлена)
4. Ожидание 60 секунд
5. Третья попытка → 429
6. Ожидание 120 секунд
7. Финальная ошибка пользователю: "Quota exceeded. Подождите 120 секунд"

**Результат:** НЕТ лавины retry!

### Тест 2: Rate limiter предотвращает избыточные запросы

**Действие:**
1. Пользователь быстро нажимает кнопку 5 раз подряд

**Ожидание:**
1. Первый запрос → выполнен
2. Второй запрос → выполнен
3. Третий запрос → ошибка "Rate limit: подождите N секунд"

### Тест 3: Batch операции учитывают rate limit

**Действие:**
1. Запустить `etap1()` (8 ячеек)

**Ожидание:**
1. Первые 2 ячейки → выполнены
2. Остальные → ожидают по таймеру (30+ секунд между запросами)

---

## 8. Метрики (API_METRICS sheet)

Каждый вызов логируется в лист `API_METRICS` (LICENSE_SHEET_ID):

| Timestamp | Function | Status | Model | Tokens | Error | Wait Time (ms) |
|-----------|----------|--------|-------|--------|-------|----------------|
| 2025-01-... | executeGeminiWithRateLimit | success | gemini-2.5-flash-lite | 1234 | | 0 |
| 2025-01-... | executeGeminiWithRateLimit | failed | gemini-2.5-flash-lite | 0 | Quota exceeded | 30000 |

---

## 9. Контакты для вопросов

Если возникают вопросы по архитектуре вызовов Gemini API:
- Проверить этот документ
- Проверить логи в `API_METRICS` sheet
- Проверить логи в консоли Apps Script (Executions)
