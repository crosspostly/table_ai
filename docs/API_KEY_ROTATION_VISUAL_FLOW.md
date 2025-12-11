# API Key Rotation - Visual Flow (v3.5.3)

## Before vs After

### BEFORE (v3.5.2) - No Rotation ❌

```
┌─────────────────────────────────────────────────┐
│  CLIENT REQUEST (без пользовательского ключа)   │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ resolveApiKey(null)    │
        │ Returns: first key     │
        │ from api_gem sheet     │
        └────────┬───────────────┘
                 │
                 ▼ finalApiKey = "AIzaSy..." (key_1)
        ┌────────────────────────┐
        │ serverGM_(            │
        │   prompt,             │
        │   maxTokens,          │
        │   temperature,        │
        │   "AIzaSy..."         │  ← Explicit key!
        │ )                     │
        └────────┬───────────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │ modelConfig = {                │
        │   apiKey: "AIzaSy..." (key_1) │  ← Key in config!
        │ }                              │
        └────────┬───────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │ getApiKeyWithFallback()        │
        │                                │
        │ if (modelConfig.apiKey) {      │
        │   return {                     │
        │     key: "AIzaSy...",          │
        │     useRotation: false  ❌     │
        │   }                            │
        │ }                              │
        └────────┬───────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │ executeGeminiWithRateLimit()   │
        │                                │
        │ if (useRotation === false) {   │
        │   // NO ROTATION! ❌           │
        │   limiter = null               │
        │ }                              │
        └────────┬───────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │ callGeminiApi(key_1)           │
        │                                │
        │ ❌ Error: Model overloaded     │
        │                                │
        │ → FAIL IMMEDIATELY ❌          │
        │ → NO RETRY WITH OTHER KEYS     │
        └────────────────────────────────┘
```

### AFTER (v3.5.3) - With Rotation ✅

```
┌─────────────────────────────────────────────────┐
│  CLIENT REQUEST (без пользовательского ключа)   │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │ userApiKey = null                  │
        │                                    │
        │ finalApiKey = userApiKey ?         │
        │   userApiKey : null                │
        │                                    │
        │ Result: finalApiKey = null  ✅     │
        └────────┬───────────────────────────┘
                 │
                 ▼ finalApiKey = null
        ┌────────────────────────┐
        │ serverGM_(            │
        │   prompt,             │
        │   maxTokens,          │
        │   temperature,        │
        │   null                │  ← No key!
        │ )                     │
        └────────┬───────────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │ modelConfig = {                │
        │   apiKey: null || undefined    │  ← undefined!
        │ }                              │
        │                                │
        │ Result: apiKey = undefined ✅  │
        └────────┬───────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────────────┐
        │ getApiKeyWithFallback()                │
        │                                        │
        │ if (modelConfig.apiKey) {  ← FALSE!    │
        │   // skip...                           │
        │ }                                      │
        │                                        │
        │ // Priority 3: API_GEM Sheet           │
        │ if (tripleRateLimiter.keys) {          │
        │   return {                             │
        │     key: currentKey.key,               │
        │     useRotation: true  ✅              │
        │   }                                    │
        │ }                                      │
        └────────┬───────────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────────────────┐
        │ executeGeminiWithRateLimit()            │
        │                                         │
        │ if (useRotation === true) {  ✅         │
        │   limiter = tripleRateLimiter           │
        │   maxRetries = activeKeys.length (6)    │
        │ }                                       │
        └────────┬────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────────────────────────┐
        │  ROTATION LOOP (maxRetries = 6)                 │
        │                                                 │
        │  ┌──────────────────────────────────────┐       │
        │  │ Attempt 1/6: key_1                   │       │
        │  │ callGeminiApi(key_1)                 │       │
        │  │                                      │       │
        │  │ ❌ Error: Model overloaded           │       │
        │  │                                      │       │
        │  │ if (isQuotaError) {                  │       │
        │  │   limiter.switchToNextKey()          │       │
        │  │   → key_2 ✅                         │       │
        │  │   continue;  // Try again!           │       │
        │  │ }                                    │       │
        │  └──────────────────────────────────────┘       │
        │                   │                             │
        │                   ▼                             │
        │  ┌──────────────────────────────────────┐       │
        │  │ Attempt 2/6: key_2                   │       │
        │  │ callGeminiApi(key_2)                 │       │
        │  │                                      │       │
        │  │ ✅ SUCCESS!                          │       │
        │  │                                      │       │
        │  │ return {                             │       │
        │  │   success: true,                     │       │
        │  │   data: response,                    │       │
        │  │   keyId: "api_key_2",                │       │
        │  │   attempt: 2                         │       │
        │  │ }                                    │       │
        │  └──────────────────────────────────────┘       │
        │                                                 │
        └─────────────────────────────────────────────────┘
```

## Key Changes

### 1. doPost 'gm' action

```javascript
// BEFORE ❌
const finalApiKey = resolveApiKey(userApiKey);  // Returns first key from sheet

// AFTER ✅
const finalApiKey = userApiKey && userApiKey.trim() ? userApiKey : null;
//                  └─────────────────────────┘   └──────────────────┘
//                  User provided key?            No → null (rotation!)
```

### 2. serverGM_()

```javascript
// BEFORE ❌
const modelConfig = {
  apiKey: apiKey  // "AIzaSy..." → rotation OFF
};

// AFTER ✅
const modelConfig = {
  apiKey: apiKey || undefined  // null → undefined → rotation ON
};
```

### 3. getApiKeyWithFallback()

```javascript
// BEFORE ❌
if (modelConfig && modelConfig.apiKey) {  // TRUE if apiKey = "AIzaSy..."
  return { key: modelConfig.apiKey, useRotation: false };
}

// AFTER ✅
if (modelConfig && modelConfig.apiKey) {  // FALSE if apiKey = undefined
  // skip...
}
// Falls through to Priority 3: API_GEM Sheet
return { key: currentKey.key, useRotation: true };  // ✅ Rotation enabled!
```

## Execution Flow Comparison

### Scenario: One key is overloaded

| Step | BEFORE (v3.5.2) | AFTER (v3.5.3) |
|------|-----------------|----------------|
| 1 | resolveApiKey() → key_1 | finalApiKey = null |
| 2 | serverGM_(key_1) | serverGM_(null) |
| 3 | modelConfig.apiKey = key_1 | modelConfig.apiKey = undefined |
| 4 | getApiKeyWithFallback() → useRotation: false | getApiKeyWithFallback() → useRotation: true |
| 5 | Try key_1 → overloaded ❌ | Try key_1 → overloaded |
| 6 | **FAIL** (no retry) | switchToNextKey() → key_2 |
| 7 | Return error to client | Try key_2 → **SUCCESS** ✅ |
| 8 | Cell NOT updated ❌ | Cell updated with key_2 result ✅ |

## Logging Comparison

### BEFORE (v3.5.2)

```
[API_KEY] Using key from api_gem: api_key_1
=== serverGM_ START (Wrapped) ===
[GEMINI] skipCache: false
[EXECUTE_GEMINI] Using key from: modelConfig (USER_PROVIDED)
[EXECUTE_GEMINI] Rate limiting disabled (rotation off or single key)
[GEMINI] Attempt 1/3 using key: USER_PROVIDED
❌ Error: The model is overloaded. Please try again later.
serverGM_ failed: Error: The model is overloaded
```

### AFTER (v3.5.3)

```
Using SHEET_ROTATION mode with 6 keys available
Calling serverGM_ with SHEET_ROTATION mode
=== serverGM_ START (Wrapped) ===
[GEMINI] skipCache: false
[GEMINI] apiKey provided: NO (will use rotation)
[API_KEY] Using key from api_gem sheet (api_key_1)
[EXECUTE_GEMINI] Using key from: apiGemSheet (api_key_1)
[EXECUTE_GEMINI] Auto maxRetries: 6 (based on 6 active keys)
[GEMINI] Attempt 1/6 using key: api_key_1
[GEMINI] ❌ Attempt 1 failed with key api_key_1: The model is overloaded
[GEMINI] Quota/overload error - trying next key...
[TRIPLE_RATE_LIMIT] Switched to key: api_key_2 (RPD: 5/20)
[GEMINI] Attempt 2/6 using key: api_key_2
[GEMINI] ✅ Success with key: api_key_2
[serverGM_] Used key: api_key_2, attempt: 2
serverGM_ completed successfully, response length: 342
```

## Error Detection

### Errors that trigger rotation:

```javascript
const isQuotaError = errorMsg.includes('429') ||
                     errorMsg.includes('quota') ||
                     errorMsg.includes('Quota') ||
                     errorMsg.includes('overloaded') ||
                     errorMsg.includes('RESOURCE_EXHAUSTED');
```

### Examples:

| Error Message | Triggers Rotation? |
|---------------|-------------------|
| "The model is overloaded. Please try again later." | ✅ YES |
| "Error 429: Too Many Requests" | ✅ YES |
| "Quota exceeded for aiplatform.googleapis.com" | ✅ YES |
| "RESOURCE_EXHAUSTED: Quota exceeded" | ✅ YES |
| "Invalid API key" | ❌ NO (immediate fail) |
| "Model not found" | ❌ NO (immediate fail) |

## Benefits

1. ✅ **No more immediate failures** on overload
2. ✅ **Automatic failover** to available keys
3. ✅ **Maximum utilization** of all 6 keys
4. ✅ **Transparent to users** - just works!
5. ✅ **Backward compatible** - user keys still work without rotation
6. ✅ **Detailed logging** - easy to debug
7. ✅ **Production ready** - all 67 tests pass

## Configuration

No configuration needed! Just ensure your `api_gem` sheet has active keys:

```
| Name      | API Key          | Status  |
|-----------|------------------|---------|
| api_key_1 | AIzaSy...        | ACTIVE  |
| api_key_2 | AIzaSy...        | ACTIVE  |
| api_key_3 | AIzaSy...        | ACTIVE  |
| ...       | ...              | ...     |
```

The system will automatically:
- Use all ACTIVE keys
- Skip DISABLED keys
- Try each key in order
- Switch on overload errors
- Log detailed metrics

## Version

**v3.5.3** - API Key Rotation on Overload Errors (2025-01-15)
