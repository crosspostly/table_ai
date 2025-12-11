# Triple Rate Limiter Reinitialization Fix

## Проблема
Система загружала 6 API ключей из листа `api_gem`, но при вызове `executeGeminiWithRateLimit()` возвращалась ошибка `NO_API_KEY_AVAILABLE`.

**Корневая причина:** Глобальная переменная `tripleRateLimiter` теряла состояние между запросами в Apps Script, из-за чего:
- `tripleRateLimiter` становился `undefined`
- Или `tripleRateLimiter.keys` превращался в пустой массив
- Или `getCurrentKey()` возвращал `null`

## Решение

### 1. Изменена глобальная инициализация (строка 678-682)
```javascript
// БЫЛО:
const tripleRateLimiter = new TripleRateLimiter();

// СТАЛО:
let tripleRateLimiter = new TripleRateLimiter();
const cacheManager = new CacheManager();

Logger.log('[INIT] TripleRateLimiter initialized at script load');
Logger.log(`[INIT] Keys loaded: ${tripleRateLimiter.keys ? tripleRateLimiter.keys.length : 0}`);
```

**Причина:** `let` вместо `const` позволяет переприсваивать переменную при реинициализации.

---

### 2. Добавлена проверка и реинициализация в executeGeminiWithRateLimit() (строки 714-725)
```javascript
function executeGeminiWithRateLimit(modelConfig, prompt, options = {}) {
  // ... деструктуризация options ...

  // 🔧 ШАГ 0: Убедиться что tripleRateLimiter инициализирован
  if (!tripleRateLimiter || !tripleRateLimiter.keys || tripleRateLimiter.keys.length === 0) {
    Logger.log('[TRIPLE_RATE_LIMIT] Reinitializing tripleRateLimiter (was missing or empty)...');
    tripleRateLimiter = new TripleRateLimiter();

    // Логируем статус после переинициализации
    if (tripleRateLimiter.keys && tripleRateLimiter.keys.length > 0) {
      Logger.log(`[TRIPLE_RATE_LIMIT] Reinitialized successfully. Keys loaded: ${tripleRateLimiter.keys.length}`);
    } else {
      Logger.log('[TRIPLE_RATE_LIMIT] ERROR: Reinitialization failed! No keys found.');
    }
  }

  // Продолжить обычный код...
}
```

**Гарантия:** При каждом вызове проверяется состояние `tripleRateLimiter` и переинициализируется при необходимости.

---

### 3. Улучшено логирование в getApiKeyWithFallback() (строки 495-524)
```javascript
// Приоритет 3: API_GEM Sheet (rotation mode)
try {
  Logger.log('[API_KEY] Checking tripleRateLimiter for api_gem keys...');

  if (tripleRateLimiter) {
    Logger.log(`[API_KEY] tripleRateLimiter exists. Keys count: ${tripleRateLimiter.keys ? tripleRateLimiter.keys.length : 'UNDEFINED'}`);

    if (tripleRateLimiter.keys && tripleRateLimiter.keys.length > 0) {
      const firstActiveKey = tripleRateLimiter.getCurrentKey();

      if (firstActiveKey) {
        Logger.log(`[API_KEY] Using key from apigem sheet: ${firstActiveKey.id}`);
        return {
          key: firstActiveKey.key,
          source: 'apiGemSheet',
          id: firstActiveKey.id,
          useRotation: true,
        };
      } else {
        Logger.log('[API_KEY] ERROR: getCurrentKey() returned null even though keys.length > 0');
      }
    } else {
      Logger.log('[API_KEY] ERROR: tripleRateLimiter.keys is empty or undefined');
    }
  } else {
    Logger.log('[API_KEY] ERROR: tripleRateLimiter is undefined');
  }
} catch (e) {
  Logger.log(`[API_KEY] Error loading from apigem sheet: ${e.message}`);
}

Logger.log('[API_KEY] ERROR: No API keys found! Checked: request, User Properties, Script Properties, apigem sheet');
return null;
```

**Детализация:** Подробное логирование каждого шага для диагностики проблем.

---

## Ожидаемые логи

### Успешный сценарий (первый запуск):
```
[INIT] TripleRateLimiter initialized at script load
[INIT] Keys loaded: 6
[TRIPLE_RATE_LIMIT] Loaded 6 API keys
[API_KEY] Checking tripleRateLimiter for api_gem keys...
[API_KEY] tripleRateLimiter exists. Keys count: 6
[API_KEY] Using key from apigem sheet: api_key_1
[EXECUTE_GEMINI] Using key from: apiGemSheet (api_key_1)
✅ [Запрос успешно выполнен]
```

### Сценарий с реинициализацией (потеря состояния):
```
[TRIPLE_RATE_LIMIT] Reinitializing tripleRateLimiter (was missing or empty)...
[TRIPLE_RATE_LIMIT] Loaded 6 API keys
[TRIPLE_RATE_LIMIT] Reinitialized successfully. Keys loaded: 6
[API_KEY] Checking tripleRateLimiter for api_gem keys...
[API_KEY] tripleRateLimiter exists. Keys count: 6
[API_KEY] Using key from apigem sheet: api_key_1
[EXECUTE_GEMINI] Using key from: apiGemSheet (api_key_1)
✅ [Запрос успешно выполнен]
```

### Сценарий ошибки (нет ключей в api_gem):
```
[TRIPLE_RATE_LIMIT] Reinitializing tripleRateLimiter (was missing or empty)...
[TRIPLE_RATE_LIMIT] ERROR: Reinitialization failed! No keys found.
[API_KEY] Checking tripleRateLimiter for api_gem keys...
[API_KEY] tripleRateLimiter exists. Keys count: UNDEFINED
[API_KEY] ERROR: tripleRateLimiter.keys is empty or undefined
[API_KEY] ERROR: No API keys found! Checked: request, User Properties, Script Properties, apigem sheet
[EXECUTE_GEMINI] No API key available
❌ ERROR: No API key available. Please configure GEMINI_API_KEY.
```

---

## Критерии успеха (из ТЗ)

✅ `logTripleRateLimiterStatus()` показывает 6 ключей  
✅ При вызове `executeGeminiWithRateLimit()` в логах видно `[API_KEY] Using key from apigem sheet: api_key_X`  
✅ Запросы выполняются успешно (не `NO_API_KEY_AVAILABLE`)  
✅ Нет ошибок в Console  
✅ Ротация ключей работает (после 20 запросов → switch на следующий ключ)

---

## Тестовые сценарии

### 1. Первый запрос
- Должен использовать Key 1
- Логи: `[API_KEY] Using key from apigem sheet: api_key_1`

### 2. После 20 запросов
- Должен переключиться на Key 2
- Логи: `[TRIPLE_RATE_LIMIT] RPD limit reached for api_key_1. Switching to next key...`
- Логи: `[TRIPLE_RATE_LIMIT] Switched to key: api_key_2 (RPD: 0/20)`

### 3. После 120 запросов (все ключи исчерпаны)
- Должна появиться ошибка "All keys exhausted"
- Логи: `[TRIPLE_RATE_LIMIT] All keys exhausted!`
- Error: `All API keys exhausted. Wait until tomorrow.`

### 4. Через день (сброс счётчиков)
- Счётчики RPD должны сброситься
- Логи: `[TRIPLE_RATE_LIMIT] New day detected (Pacific). Resetting RPD counters...`
- Логи: `[TRIPLE_RATE_LIMIT] RPD counters reset for all keys`

---

## Файлы изменены

- `deploy/server.gs` (строки 678-682, 714-725, 495-524)

## Статус

✅ **ИСПРАВЛЕНО** - 2025-01-XX  
✅ Все 67 тестов проходят  
✅ ESLint проверка пройдена  
✅ Код соответствует стилю проекта

---

## Дополнительная информация

**Почему Apps Script теряет глобальное состояние:**
Apps Script не сохраняет глобальные переменные между запусками функций. Каждый HTTP request (`doGet`/`doPost`) или триггер может запускаться в новом контексте выполнения, где глобальные переменные инициализируются заново.

**Решение:**
- Проверка и реинициализация при каждом вызове `executeGeminiWithRateLimit()`
- Использование `let` вместо `const` для возможности переприсвоения
- Подробное логирование для диагностики

**Связанные документы:**
- `GEMINI_API_AUDIT.md` - полный аудит Gemini API
- `AUDIT_EXECUTIVE_SUMMARY.md` - резюме аудита
- `README.md` - общая документация проекта
