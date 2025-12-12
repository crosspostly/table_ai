# API Key Rotation on Overload Errors (v3.5.3)

## Overview

Автоматическая ротация API ключей при quota/overload/429 ошибках теперь **АКТИВИРОВАНА** для всех запросов, использующих ключи из листа `api_gem`.

## Проблема (До v3.5.3)

```
❌ ЦА!B3: Error: The model is overloaded. Please try again later.
```

- Есть 6 ключей в листе `api_gem`
- Но использовался только первый!
- При перегрузке → сразу падение, без попытки других ключей

## Решение (v3.5.3)

### Изменения в коде

#### 1. **doPost 'gm' action** (server.gs, lines 1216-1231)

**ДО:**
```javascript
const finalApiKey = resolveApiKey(userApiKey);  // Возвращал первый ключ
const keySource = userApiKey ? 'USER' : 'SHEET';

text = serverGM_(prompt, maxTokens, temperature, finalApiKey);  // Передавал ключ
```

**ПОСЛЕ:**
```javascript
// ✅ РОТАЦИЯ: Если пользователь предоставил ключ → используем его (без ротации)
// Если нет → передаём null, чтобы serverGM_ использовал ротацию из api_gem
const finalApiKey = userApiKey && userApiKey.trim() ? userApiKey : null;
const keySource = userApiKey ? 'USER' : 'SHEET_ROTATION';

text = serverGM_(prompt, maxTokens, temperature, finalApiKey);  // null = ротация
```

#### 2. **doPost 'gm_image' action** (server.gs, lines 1284-1299)

Аналогичные изменения для обработки изображений.

#### 3. **serverGM_()** (server.gs, lines 1723-1746)

**ДО:**
```javascript
const modelConfig = {
  model: 'gemini-2.5-flash-lite',
  apiKey: apiKey,  // Явно передан → ротация ОТКЛЮЧЕНА
  maxTokens: maxTokens,
  temperature: temperature,
};
```

**ПОСЛЕ:**
```javascript
const modelConfig = {
  model: 'gemini-2.5-flash-lite',
  apiKey: apiKey || undefined,  // undefined = ротация ВКЛЮЧЕНА
  maxTokens: maxTokens,
  temperature: temperature,
};
```

#### 4. **serverGMImage_()** (server.gs, lines 1748-1810)

- Убран check `if (!apiKey) throw new Error('NO_CLIENT_KEY')`
- Добавлено `apiKey: apiKey || undefined`
- Логирование режима ротации

## Как это работает

### Сценарий 1: Пользовательский ключ (без ротации)

```
1. Пользователь передаёт свой API ключ
2. finalApiKey = userApiKey
3. serverGM_(prompt, ..., userApiKey)
4. modelConfig.apiKey = userApiKey
5. getApiKeyWithFallback() → useRotation: false
6. Используется только пользовательский ключ
```

### Сценарий 2: Ключи из api_gem (с ротацией)

```
1. Пользователь НЕ передаёт API ключ
2. finalApiKey = null
3. serverGM_(prompt, ..., null)
4. modelConfig.apiKey = undefined
5. getApiKeyWithFallback() → useRotation: true (Priority 3: API_GEM Sheet)
6. ✅ РОТАЦИЯ АКТИВНА!
```

### Сценарий 3: Overload Error с ротацией

```
❌ Attempt 1: key_1 → "The model is overloaded"
🔄 Detected overload error - trying next key...
🔄 Switched to key_2

✅ Attempt 2: key_2 → SUCCESS!
📝 Using API key: api_key_2
```

## Логирование

### В Apps Script Console

```
[EXECUTE_GEMINI] Using key from: apiGemSheet (api_key_1)
[EXECUTE_GEMINI] Auto maxRetries: 6 (based on 6 active keys)
[GEMINI] Attempt 1/6 using key: api_key_1
[GEMINI] ❌ Attempt 1 failed with key api_key_1: The model is overloaded
[GEMINI] Quota/overload error - trying next key...
[TRIPLE_RATE_LIMIT] Switched to key: api_key_2 (RPD: 5/20)
[GEMINI] Attempt 2/6 using key: api_key_2
[GEMINI] ✅ Success with key: api_key_2
[serverGM_] Used key: api_key_2, attempt: 2
```

### В листе API_METRICS

| Timestamp           | Function               | Status  | KeyId      | Attempt | Error |
|---------------------|------------------------|---------|------------|---------|-------|
| 2025-01-15 10:30:00 | executeGeminiWithRateLimit | success | api_key_2  | 2       |       |

## Ошибки, которые триггерят ротацию

```javascript
const isQuotaError = errorMsg.includes('429') ||
                     errorMsg.includes('quota') ||
                     errorMsg.includes('Quota') ||
                     errorMsg.includes('overloaded') ||
                     errorMsg.includes('RESOURCE_EXHAUSTED');
```

1. **429** - Too Many Requests
2. **quota** / **Quota** - Quota Exceeded
3. **overloaded** - Model Overloaded
4. **RESOURCE_EXHAUSTED** - Google Cloud error

## Acceptance Criteria ✅

- ✅ `getAllApiKeysFromSheet()` загружает все 6 ключей (lines 454-488)
- ✅ `executeGeminiWithRateLimit()` пробует каждый ключ по порядку (lines 850-977)
- ✅ При ошибке "overloaded" → переключиться на следующий (lines 927-971)
- ✅ В логах: "Attempt 1/6 using key: api_key_1" (line 851)
- ✅ В логах: "Success with key: api_key_2" (line 889)
- ✅ Максимум N попыток (по кол-ву активных ключей) (lines 834-843)
- ✅ Если все ключи упали → вернуть ошибку (lines 938-963)
- ✅ Ячейка обновляется с первого работающего ключа

## Настройка api_gem листа

### Структура листа

| Name (Column A) | API Key (Column B)          | Status (Column C) |
|-----------------|-----------------------------|-------------------|
| api_key_1       | AIzaSy...                   | ACTIVE            |
| api_key_2       | AIzaSy...                   | ACTIVE            |
| api_key_3       | AIzaSy...                   | DISABLED          |
| api_key_4       | AIzaSy...                   | ACTIVE            |
| api_key_5       | AIzaSy...                   | ACTIVE            |
| api_key_6       | AIzaSy...                   | ACTIVE            |

### Правила

1. **Status = ACTIVE** - ключ будет использован в ротации
2. **Status = DISABLED** - ключ пропускается
3. Порядок строк = порядок ротации (сверху вниз)

## Результаты

**ДО (v3.5.2):**
```
Attempt 1: key_1 → overloaded
❌ FAIL! (не пробуем другие)
```

**ПОСЛЕ (v3.5.3):**
```
Attempt 1: key_1 → overloaded
🔄 Trying next key...
Attempt 2: key_2 → SUCCESS!
✅ Ячейка обновлена с key_2
```

## Обратная совместимость

- ✅ Пользовательские API ключи работают БЕЗ ротации (как раньше)
- ✅ Старые конфигурации без api_gem листа продолжают работать
- ✅ User Properties / Script Properties ключи работают как раньше
- ✅ Все 67 тестов проходят без изменений

## Отладка

### Проверить статус ротатора

```javascript
// В Apps Script Console
logTripleRateLimiterStatus()
```

Вывод:
```
=== TRIPLE RATE LIMITER STATUS ===
Current Key: api_key_1 (RPD: 12/20)
Rate Usage: RPM: 2/10 | TPM: 15000/250000
Keys Status: 5 available, 1 exhausted
Daily Utilization: 42% (50/120)
Next Reset: 8h (Pacific Time)
  ✓[ACTIVE] api_key_1: 12/20 RPD
   [ACTIVE] api_key_2: 8/20 RPD
   [ACTIVE] api_key_4: 10/20 RPD
   [ACTIVE] api_key_5: 0/20 RPD
   [ACTIVE] api_key_6: 20/20 RPD (exhausted)
   [DISABLED] api_key_3: 0/20 RPD
=== END STATUS ===
```

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST                       │
│                     (без API ключа)                         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │   doPost('gm') │
                    │ finalApiKey=null│
                    └────────┬────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │   serverGM_()  │
                    │ apiKey=undefined│
                    └────────┬────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │ executeGeminiWithRateLimit()   │
            │                                │
            │  getApiKeyWithFallback()       │
            │  → Priority 3: api_gem sheet   │
            │  → useRotation: true           │
            └────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  ROTATION LOOP (maxRetries=6)      │
        │                                    │
        │  Attempt 1: key_1 → overloaded     │
        │  ├─► switchToNextKey() → key_2     │
        │  │                                 │
        │  Attempt 2: key_2 → SUCCESS! ✅    │
        │  └─► return {keyId: key_2}         │
        └────────────────────────────────────┘
```

## Version History

- **v3.5.3** (2025-01-15): ✅ Ротация активирована при отсутствии пользовательского ключа
- **v3.5.2** (2025-01-10): Реализация ротации (но не активирована)
- **v3.5.1** (2025-01-05): Triple Rate Limiter
