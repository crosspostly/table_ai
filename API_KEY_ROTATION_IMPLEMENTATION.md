# API Key Rotation on Quota/Overload Errors - Implementation

## Overview

Система автоматической ротации API ключей при ошибках quota/overload/429 от Google Gemini API.

## Problem Solved

**БЫЛО:**
- Использовался только ПЕРВЫЙ ключ из листа `api_gem`
- При ошибке "The model is overloaded" → сразу падали
- НЕ пробовали другие ключи
- В логах НЕ было видно какой ключ использовался

**СТАЛО:**
- Автоматически загружаются ВСЕ активные ключи из листа `api_gem`
- При ошибке quota/overload/429 → автоматическое переключение на следующий ключ
- Логируется ID использованного ключа и номер попытки
- Максимум попыток = количество доступных ключей (до 6)

## Implementation Details

### 1. New Function: `getAllApiKeysFromSheet()`

Загружает все активные ключи из листа `api_gem`:

```javascript
function getAllApiKeysFromSheet() {
  // Загружает из листа api_gem все ключи со статусом ACTIVE
  // Возвращает: [{id, key, status}, ...]
}
```

### 2. Enhanced: `executeGeminiWithRateLimit()`

**Изменения:**

1. **Dynamic maxRetries** (строки 790-800):
   - `maxRetries: null` → автоматически использует количество активных ключей
   - Пробует ВСЕ доступные ключи (не ограничено 3 попытками)

2. **Improved Error Detection** (строки 881-885):
   - Добавлена проверка на "overloaded"
   - Добавлена проверка на "RESOURCE_EXHAUSTED"
   - Сохранены проверки на "429", "quota", "Quota"

3. **Enhanced Logging** (строки 808, 846, 891-892, 896):
   ```
   [GEMINI] Attempt 1/6 using key: api_key_1
   [GEMINI] ❌ Attempt 1 failed with key api_key_1: Error: The model is overloaded
   [GEMINI] Quota/overload error - trying next key...
   [GEMINI] Attempt 2/6 using key: api_key_2
   [GEMINI] ✅ Success with key: api_key_2
   ```

4. **Key Rotation Logic** (строки 887-928):
   - На quota/overload ошибку → `limiter.switchToNextKey()`
   - Если все ключи исчерпаны → сообщение `All 6 keys failed!`
   - Продолжает попытки с новым ключом

### 3. Updated: `serverGM_()` and `serverGMImage_()`

**Изменения:**

- Убран hardcoded `maxRetries: 3`
- Теперь: `maxRetries: null` (автоматическое определение)
- Добавлено логирование использованного ключа

```javascript
// serverGM_
const result = executeGeminiWithRateLimit(modelConfig, prompt, {maxRetries: null});
Logger.log(`[serverGM_] Used key: ${result.keyId}, attempt: ${result.attempt}`);

// serverGMImage_
const result = executeGeminiWithRateLimit(modelConfig, promptObj, {maxRetries: null});
Logger.log(`[serverGMImage_] Used key: ${result.keyId}, attempt: ${result.attempt}`);
```

### 4. API Metrics Logging

Логирование в лист `API_METRICS` уже поддерживало:
- `keyId` - ID использованного ключа
- `attempt` - номер попытки
- `AllKeysStatus` - JSON со статусом всех ключей

## Error Types Handled

Система автоматически переключается на другой ключ при следующих ошибках:

1. `429` - HTTP 429 Too Many Requests
2. `quota` / `Quota` - Quota exceeded
3. `overloaded` - The model is overloaded
4. `RESOURCE_EXHAUSTED` - Google API resource exhausted error

## Expected Behavior

### Success Case (ключ работает):
```
[GEMINI] Attempt 1/6 using key: api_key_1
[GEMINI] ✅ Success with key: api_key_1
[serverGM_] Used key: api_key_1, attempt: 1
```

### Rotation Case (первый ключ выдал ошибку):
```
[GEMINI] Attempt 1/6 using key: api_key_1
[GEMINI] ❌ Attempt 1 failed with key api_key_1: Error: The model is overloaded
[GEMINI] Quota/overload error - trying next key...
[GEMINI] Attempt 2/6 using key: api_key_2
[GEMINI] ✅ Success with key: api_key_2
[serverGM_] Used key: api_key_2, attempt: 2
```

### All Keys Exhausted:
```
[GEMINI] Attempt 1/6 using key: api_key_1
[GEMINI] ❌ Attempt 1 failed with key api_key_1: Error: The model is overloaded
[GEMINI] Quota/overload error - trying next key...
[GEMINI] Attempt 2/6 using key: api_key_2
[GEMINI] ❌ Attempt 2 failed with key api_key_2: Error: The model is overloaded
...
[GEMINI] All 6 keys failed!
Error: All API keys exhausted. Wait until tomorrow.
```

## Configuration

### api_gem Sheet Structure

| Name (A)    | API Key (B)          | Status (C) |
|-------------|----------------------|------------|
| api_key_1   | AIzaSy...            | ACTIVE     |
| api_key_2   | AIzaSy...            | ACTIVE     |
| api_key_3   | AIzaSy...            | DISABLED   |
| ...         | ...                  | ...        |

- **Name (A)**: ID ключа (для логирования)
- **API Key (B)**: Сам ключ
- **Status (C)**: ACTIVE / DISABLED

Система загружает только ключи со статусом `ACTIVE`.

## Acceptance Criteria

- ✅ `getAllApiKeysFromSheet()` загружает ВСЕ активные ключи
- ✅ `executeGeminiWithRateLimit()` пробует ключи по порядку
- ✅ При ошибке "overloaded"/"quota"/"429" → переключается на следующий ключ
- ✅ Максимум попыток = количество активных ключей (не hardcoded)
- ✅ В логах видно: "Attempt 1/6 using key: api_key_1"
- ✅ Логируется успешный ключ: "Success with key: api_key_2"
- ✅ В таблице API_METRICS есть колонка keyId (какой ключ использовался)
- ✅ Если все ключи выбили ошибку → вернуть ошибку пользователю
- ✅ Клиент видит результат (OK или ошибку)
- ✅ Нет бесконечных retry, максимум попыток = количеству ключей

## Testing

Для тестирования:

1. Создайте лист `api_gem` с несколькими ключами
2. Установите статус ACTIVE для всех ключей
3. Вызовите `serverGM_()` или любую функцию с Gemini
4. Проверьте логи - должны видеть:
   - Attempt X/Y using key: ...
   - Success with key: ... или переключение на другой ключ

## Backward Compatibility

✅ **100% обратная совместимость:**

- Если `maxRetries` явно указан → используется указанное значение
- Если `maxRetries: null` → автоматически использует количество ключей
- Старые вызовы `executeGeminiWithRateLimit(config, prompt, {maxRetries: 3})` работают как прежде
- Новые вызовы `executeGeminiWithRateLimit(config, prompt, {maxRetries: null})` используют автоматическую ротацию

## Files Modified

- `/deploy/server.gs`:
  - Добавлена функция `getAllApiKeysFromSheet()` (строки 454-488)
  - Изменена `executeGeminiWithRateLimit()` (строки 690-965)
  - Изменена `serverGM_()` (строки 1665-1684)
  - Изменена `serverGMImage_()` (строки 1686-1749)

## Version

Реализовано в версии: **3.5.3** (после 3.5.2)
