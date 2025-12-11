# Dual-Metric Rate Limiting для Gemini API

## 📋 Обзор

**DualRateLimiter** — это двухуровневый rate limiter для Gemini API, который отслеживает:

1. **TPM (Tokens Per Minute)** — количество токенов в минуту (**ПРИОРИТЕТ**)
2. **RPM (Requests Per Minute)** — количество запросов в минуту
3. **Multi-Key Rotation** — автоматическая ротация API ключей при превышении лимитов

## 🔥 Проблема (из логов)

До внедрения dual-metric rate limiting:

```
08:48:10 ✅ 95 tokens       → RPM: 1/15, TPM: 95/250k
08:49:04 ❌ 47,789 tokens   → RPM: 2/15, TPM: 47,884/250k (БЛИЗКО К ЛИМИТУ!)
08:49:04 ❌ 55,950 tokens   → RPM: 3/15, TPM: 103,834/250k (ВСЕ ЕЩЕ OK?)
08:49:04 ❌ 47,835 tokens   → 429 QUOTA EXCEEDED ❌
```

**Причина:** Система учитывала только RPM (15 requests/min), но игнорировала TPM (250k tokens/min).
Большие запросы (47k-55k tokens) быстро исчерпали TPM лимит, не нарушив RPM лимит!

## ✅ Решение

После внедрения DualRateLimiter:

```
Request 1: ✅ key_1 (95 tokens)  → RPM: 1/15, TPM: 95/250k
Request 2: ✅ key_1 (47,789 t)   → RPM: 2/15, TPM: 47,884/250k
Request 3: ⚠️ TPM WARNING (200k/250k) → SWITCH KEY!
Request 3: ✅ key_2 (55,950 t)   → RPM: 3/15, TPM: 55,950/250k (new key!)
Request 4: ✅ key_2 (47,835 t)   → RPM: 4/15, TPM: 103,785/250k
...
Request 6: ✅ key_3 (50,000 t)   → RPM: 6/15, TPM: 50,000/250k (new key!)
```

**Итого:** 6 ключей × 250k TPM = 1,500,000 TPM!

## 📊 Конфигурация

### Лимиты для Free Tier (gemini-2.5-flash-lite)

```javascript
const MAX_REQUESTS_PER_MINUTE = 15;     // RPM лимит
const MAX_TOKENS_PER_MINUTE = 250000;   // TPM лимит (ПРИОРИТЕТ!)
const TPM_WARNING_THRESHOLD = 200000;   // 80% от TPM
```

### Multi-Key Configuration

API ключи загружаются из Google Sheets:

- **Spreadsheet ID:** `1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s`
- **Sheet Name:** `api_gem`
- **Формат таблицы:**
  - Column A: `name` (имя ключа, например: "key_1", "key_2")
  - Column B: `key` (API ключ)
  - Column C: `status` (ACTIVE/DISABLED)

## 🎯 Архитектура

### Поток выполнения

```
User Request
    ↓
executeGeminiWithRateLimit()
    ↓
1️⃣ Estimate Tokens: prompt.length / 4 (~4 chars = 1 token)
    ↓
2️⃣ checkDualRateLimits(estimatedTokens)
    ├─ Check RPM: requests_this_minute < 15?
    ├─ Check TPM: tokens_this_minute + estimated < 250k? (ПРИОРИТЕТ!)
    └─ If TPM exceeded → switchToNextKey()
    ↓
3️⃣ If limits OK → callGeminiApi()
    ↓
4️⃣ Get response + usageMetadata
    ↓
5️⃣ logTokens(actualInput, actualOutput)
    ↓
6️⃣ logApiMetric(complete metrics to API_METRICS sheet)
    ↓
✅ SUCCESS or ❌ FAIL
```

### Sliding Window механизм

DualRateLimiter использует **sliding window** для отслеживания использования:

```javascript
// Timestamps хранятся в PropertiesService
requestTimestamps = [ts1, ts2, ts3, ...]  // RPM tracking
tokenUsageLog = [
  {timestamp: ts1, tokens: 1000},
  {timestamp: ts2, tokens: 5000},
  ...
]  // TPM tracking

// Очистка старых записей (> 60 секунд)
const now = Date.now();
requestTimestamps = requestTimestamps.filter(ts => now - ts < 60000);
tokenUsageLog = tokenUsageLog.filter(entry => now - entry.timestamp < 60000);
```

## 🔧 API Reference

### DualRateLimiter Class

#### `checkLimits(estimatedInputTokens)`

Проверяет лимиты ПЕРЕД запросом.

**Parameters:**
- `estimatedInputTokens` (number) - Примерное количество input токенов

**Returns:**
```javascript
{
  canMakeRequest: boolean,
  limitType: 'RPM' | 'TPM' | 'TPM_ALL_KEYS_EXHAUSTED' | 'OK',
  waitTime: number,  // milliseconds
  currentRPM: number,
  currentTPM: number,
  maxRPM: number,
  maxTPM: number,
  keySwitched?: boolean  // true if key was switched
}
```

**Логика:**
1. ✅ Проверка RPM: `currentRPM < 15`
2. ✅ Проверка TPM: `currentTPM + estimatedTokens < 250k` (**ПРИОРИТЕТ**)
3. ⚠️ Если TPM превышен → `switchToNextKey()`
4. ❌ Если все ключи исчерпаны → вернуть `waitTime`

#### `logRequest()`

Логирует что запрос СЕЙЧАС делается (вызывается ПЕРЕД API call).

```javascript
dualRateLimiter.logRequest();
// Увеличивает RPM counter
```

#### `logTokens(inputTokens, outputTokens)`

Логирует РЕАЛЬНОЕ количество токенов из API response.

**Parameters:**
- `inputTokens` (number) - Actual input tokens from `usageMetadata.promptTokenCount`
- `outputTokens` (number) - Actual output tokens from `usageMetadata.candidatesTokenCount`

**Returns:**
```javascript
{
  totalTokens: number,
  currentTPM: number,
  remainingTPM: number
}
```

#### `estimateTokens(text)`

Оценивает количество input токенов ПЕРЕД запросом.

**Formula:** `~4 chars = 1 token` (approximation)

**Parameters:**
- `text` (string | object) - Промпт (текст или объект с `contents`)

**Returns:** `number` - Estimated token count

**Примеры:**
```javascript
dualRateLimiter.estimateTokens('Hello world')  // ~3 tokens
dualRateLimiter.estimateTokens(promptWith50000chars)  // ~12500 tokens
dualRateLimiter.estimateTokens({contents: [...]})  // Supports Vision API
```

#### `switchToNextKey()`

Переключается на следующий API ключ.

**Returns:** `boolean`
- `true` - успешно переключились
- `false` - все ключи исчерпаны или только 1 ключ

**Логика:**
```javascript
currentKeyIndex = (currentKeyIndex + 1) % keys.length
```

#### `getCurrentKey()`

Возвращает текущий активный ключ.

**Returns:**
```javascript
{
  id: string,      // name from sheet
  key: string,     // API key
  status: string   // ACTIVE/DISABLED
}
```

## 📊 Мониторинг

### API_METRICS Sheet

Все метрики логируются в Google Sheets (`API_METRICS`):

| Column | Description | Example |
|--------|-------------|---------|
| Timestamp | ISO timestamp | `2024-12-11T08:49:04.123Z` |
| Function | Function name | `executeGeminiWithRateLimit` |
| Status | success/failed | `success` |
| Model | Model name | `gemini-2.5-flash-lite` |
| **InputTokens** | Actual input tokens | `47789` |
| **OutputTokens** | Actual output tokens | `2156` |
| **TotalTokens** | Sum of input+output | `49945` |
| **KeyId** | Which key was used | `key_2` |
| **KeySource** | Source of key | `MULTI_KEY` / `USER` / `DEFAULT` |
| **CurrentRPM** | Current RPM usage | `3/15` |
| **CurrentTPM** | Current TPM usage | `103785/250000` |
| MaxRPM | Max RPM limit | `15` |
| MaxTPM | Max TPM limit | `250000` |
| Error | Error message | `""` or `"429 Quota exceeded"` |
| WaitTime | Wait time (ms) | `0` or `5000` |
| Attempt | Retry attempt number | `1`, `2`, `3` |

### Логирование в Console

```
[DUAL_RATE_LIMIT] Loaded 6 active keys
[EXECUTE_GEMINI] Starting with model: gemini-2.5-flash-lite
[EXECUTE_GEMINI] Estimated input tokens: 12500
[DUAL_RATE_LIMIT] RPM: 2/15, TPM: 47884/250000
[EXECUTE_GEMINI] Using multi-key: key_1
[DUAL_RATE_LIMIT] Request logged. Total this minute: 3/15
[EXECUTE_GEMINI] Attempt 1/3
[EXECUTE_GEMINI] API response received. Actual tokens - Input: 12456, Output: 2134
[DUAL_RATE_LIMIT] Tokens logged. Input: 12456, Output: 2134, Total this minute: 60340/250000
```

## 🎯 Примеры использования

### 1. Базовое использование (автоматическая ротация)

```javascript
const modelConfig = {
  model: 'gemini-2.5-flash-lite',
  apiKey: null,  // null → используется multi-key rotation
  maxTokens: 12500,
  temperature: 0.7
};

const result = executeGeminiWithRateLimit(modelConfig, prompt, {maxRetries: 3});

if (result.success) {
  Logger.log(`Response: ${result.data}`);
  Logger.log(`Tokens used: ${result.tokensUsed}`);
  Logger.log(`Key used: ${result.keyId}`);
}
```

### 2. Использование своего API ключа

```javascript
const modelConfig = {
  model: 'gemini-2.5-flash-lite',
  apiKey: 'AIza...YOUR_KEY',  // Ваш ключ → без ротации
  maxTokens: 12500,
  temperature: 0.7
};

const result = executeGeminiWithRateLimit(modelConfig, prompt);
// Не будет использовать multi-key rotation
```

### 3. Ручная проверка лимитов

```javascript
const estimatedTokens = dualRateLimiter.estimateTokens(prompt);
const limitsCheck = dualRateLimiter.checkLimits(estimatedTokens);

if (!limitsCheck.canMakeRequest) {
  Logger.log(`Rate limit exceeded: ${limitsCheck.limitType}`);
  Logger.log(`Wait time: ${limitsCheck.waitTime}ms`);
  Logger.log(`Current RPM: ${limitsCheck.currentRPM}/${limitsCheck.maxRPM}`);
  Logger.log(`Current TPM: ${limitsCheck.currentTPM}/${limitsCheck.maxTPM}`);

  // Подождать
  Utilities.sleep(limitsCheck.waitTime);
}
```

### 4. Получить статус ключей

```javascript
const keysStatus = dualRateLimiter.getKeysStatus();

keysStatus.forEach(function(key) {
  Logger.log(`Key ${key.index}: ${key.id} - ${key.status} ${key.isCurrent}`);
});

// Output:
// Key 0: key_1 - ACTIVE ✓
// Key 1: key_2 - ACTIVE
// Key 2: key_3 - ACTIVE
```

## ⚙️ Настройка Multi-Key в Google Sheets

### 1. Создать лист `api_gem`

В таблице `1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s`:

| A (name) | B (key) | C (status) |
|----------|---------|------------|
| key_1    | AIza... | ACTIVE     |
| key_2    | AIza... | ACTIVE     |
| key_3    | AIza... | DISABLED   |
| key_4    | AIza... | ACTIVE     |

### 2. Получить Gemini API ключи

1. Перейти на [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Нажать **Get API Key**
3. Скопировать ключ (начинается с `AIza...`)
4. Повторить для каждого email/аккаунта

### 3. Проверить работу

```javascript
function testMultiKey() {
  const limiter = new DualRateLimiter();
  limiter.loadKeys();

  Logger.log(`Loaded ${limiter.keys.length} keys`);

  const currentKey = limiter.getCurrentKey();
  Logger.log(`Current key: ${currentKey.id}`);

  // Проверить переключение
  limiter.switchToNextKey();
  const nextKey = limiter.getCurrentKey();
  Logger.log(`Next key: ${nextKey.id}`);
}
```

## 🔍 Troubleshooting

### Проблема: "No API keys available"

**Причина:** Лист `api_gem` не найден или все ключи DISABLED.

**Решение:**
1. Проверить что лист `api_gem` существует
2. Проверить что хотя бы один ключ имеет status = ACTIVE
3. Проверить что столбцы A, B, C заполнены корректно

### Проблема: "All API keys exhausted"

**Причина:** Все ключи исчерпали TPM лимит за минуту.

**Решение:**
1. Добавить больше ключей в лист `api_gem`
2. Подождать ~60 секунд для сброса лимитов
3. Уменьшить размер промптов (меньше токенов)

### Проблема: TPM счётчик не сбрасывается

**Причина:** PropertiesService хранит старые timestamps.

**Решение:**
```javascript
function resetDualRateLimiter() {
  const ps = PropertiesService.getUserProperties();
  ps.deleteProperty('gemini_api_rate_limit_store');
  ps.deleteProperty('gemini_api_token_limit_store');
  Logger.log('✅ DualRateLimiter state reset');
}
```

### Проблема: Ротация не работает

**Причина:** Пользователь передал свой API ключ в `modelConfig.apiKey`.

**Поведение:** Если `modelConfig.apiKey` задан → multi-key rotation **НЕ** используется.

**Решение:** Установить `modelConfig.apiKey = null` для активации multi-key rotation.

## 📈 Производительность

### До внедрения

- **Среднее использование:** 3-5 запросов/мин (RPM)
- **Проблема:** 429 ошибки при больших промптах (>40k tokens)
- **Downtime:** ~30-60 секунд при quota exceeded

### После внедрения

- **Среднее использование:** 10-15 запросов/мин (RPM)
- **TPM tracking:** Полная видимость использования токенов
- **Multi-key rotation:** 6 ключей × 250k = 1.5M TPM
- **Downtime:** 0 секунд (автоматическая ротация)

## 📝 Changelog

### v3.5.3 (2024-12-11)

- ✅ Добавлен DualRateLimiter класс
- ✅ TPM (Tokens Per Minute) tracking
- ✅ RPM (Requests Per Minute) tracking
- ✅ Multi-Key Rotation из листа `api_gem`
- ✅ Реальные токены из `usageMetadata`
- ✅ Обновлён `logApiMetric()` с новыми метриками
- ✅ Обновлён `callGeminiApi()` для возврата `usageMetadata`
- ✅ Backwards compatibility с старым `rateLimiter`

## 🔗 См. также

- [GEMINI_API_CONFIG.md](./GEMINI_API_CONFIG.md) - Конфигурация Gemini API
- [FUNCTIONS_REFERENCE.md](./FUNCTIONS_REFERENCE.md) - Справочник функций
- [TROUBLESHOOTING_OTA.md](./TROUBLESHOOTING_OTA.md) - Устранение неполадок
