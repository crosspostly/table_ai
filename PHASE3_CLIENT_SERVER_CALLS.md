# 📡 CLIENT → SERVER COMMUNICATION GUIDE
## v3.0.0 Architecture - Function Migration Complete

---

## 🔄 HOW CLIENT CALLS SERVER

### General Pattern

```javascript
// CLIENT code (deploy/Main.gs)
function callServer(action, data) {
  try {
    const email = PropertiesService.getScriptProperties().getProperty('LICENSE_EMAIL');
    const token = PropertiesService.getScriptProperties().getProperty('LICENSE_TOKEN');
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    const payload = {
      action: action,
      email: email,
      token: token,
      apiKey: apiKey,
      ...data  // merge additional data
    };

    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(SERVER_URL, options);
    const code = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (code !== 200 || !result.ok) {
      throw new Error(result.error || 'SERVER_ERROR');
    }

    return result;
  } catch (e) {
    throw new Error('Call failed: ' + e.message);
  }
}
```

---

## 🔌 SPECIFIC ENDPOINTS

### 1. GEMINI CALL (Previously GM())

#### CLIENT Side:
```javascript
// OLD (v2.1.0):
function GM(prompt, maxTokens = 25000, temperature = 0.7) {
  // ... local Gemini call ...
  // SECURITY ISSUE: Logic visible to users!
}

// NEW (v3.0.0):
function callGeminiRequest(prompt, maxTokens = 12500, temperature = 0.7) {
  return callServer('gm', {
    prompt: prompt,
    maxTokens: maxTokens,
    temperature: temperature,
  });
}
```

#### Request Format:
```json
{
  "action": "gm",
  "email": "user@example.com",
  "token": "license_token_here",
  "apiKey": "sk-...",
  "prompt": "What is Table AI?",
  "maxTokens": 12500,
  "temperature": 0.7
}
```

#### SERVER Response:
```javascript
// Success:
{
  "ok": true,
  "data": "Table AI is a..."
}

// Cached (6 hours TTL):
{
  "ok": true,
  "data": "Table AI is a...",
  "cached": true
}

// Error - License:
{
  "ok": false,
  "error": "INACTIVE"  // or "EXPIRED", "NOT_FOUND", etc.
}

// Error - Rate limit:
{
  "ok": false,
  "error": "RATE_LIMIT"
}
```

#### SERVER Implementation (deploy/Server_v3_IMPROVED.gs):
```javascript
case 'gm': {
  const prompt = data.prompt;
  const maxTokens = data.maxTokens;
  const temperature = data.temperature;
  const apiKey = data.apiKey;

  // 1. License check (automatic in doPost)
  // 2. Rate limit check
  if (!rateLimitOk_(token)) return RATE_LIMIT_ERROR;

  // 3. Try cache
  const cacheKey = gmCacheKey_(prompt, maxTokens, temperature);
  const cached = gmCacheGet_(cacheKey);
  if (cached) {
    return {ok: true, data: cached, cached: true};
  }

  // 4. Call Gemini API
  const result = serverGM_(prompt, maxTokens, temperature, apiKey);

  // 5. Cache result (6 hours)
  gmCachePut_(cacheKey, result, CACHE_TTL);

  // 6. Log operation
  serverLog_({action: 'gm', ok: true, email, token, promptLen: prompt.length});

  return {ok: true, data: result};
}
```

---

### 2. LICENSE STATUS CHECK

#### CLIENT Side:
```javascript
// Already in Main_v3_REFACTORED.gs
function checkLicenseStatusUI() {
  try {
    const status = serverStatus_();
    if (!status.ok) {
      SpreadsheetApp.getUi().alert('❌ License: ' + status.error);
      return;
    }
    const msg = '✅ License is active' +
      (status.expiry ? '\nExpiry: ' + status.expiry : '') +
      (status.remaining_calls ? '\nRemaining calls: ' + status.remaining_calls : '');
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

function serverStatus_() {
  const payload = {
    action: 'status',
    email: getLicenseEmail(),
    token: getLicenseToken(),
  };
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(SERVER_URL, options);
  const data = JSON.parse(response.getContentText());
  return data;
}
```

#### Request Format:
```json
{
  "action": "status",
  "email": "user@example.com",
  "token": "license_token_here"
}
```

#### SERVER Response:
```javascript
// Valid license:
{
  "ok": true,
  "until": "2025-12-31T23:59:59.000Z",
  "row": 5
}

// License not found:
{
  "ok": false,
  "error": "NOT_FOUND"
}

// License expired:
{
  "ok": false,
  "error": "EXPIRED",
  "until": "2025-01-15T00:00:00.000Z"
}

// License inactive:
{
  "ok": false,
  "error": "INACTIVE"
}
```

---

### 3. GEMINI IMAGE (OCR)

#### CLIENT Side:
```javascript
function callGeminiImageRequest(images, lang = 'ru', delimiter = null) {
  return callServer('gm_image', {
    images: images,  // Array of {mimeType, data(base64)}
    lang: lang,
    delimiter: delimiter,
  });
}
```

#### Request Format:
```json
{
  "action": "gm_image",
  "email": "user@example.com",
  "token": "license_token_here",
  "apiKey": "sk-...",
  "images": [
    {
      "mimeType": "image/png",
      "data": "iVBORw0KGgoAAAANSU..."
    }
  ],
  "lang": "ru",
  "delimiter": "----"
}
```

#### SERVER Response:
```javascript
{
  "ok": true,
  "data": "Extracted text from image 1\n----\nExtracted text from image 2"
}
```

---

## 🔐 SECURITY FLOW

```
┌────────────────────────────────────────┐
│ CLIENT (Google Sheets)                 │
│ - User enters: prompt                  │
│ - User enters: API key (locally stored)│
│ - User enters: License (locally stored)│
│                                        │
│ callGeminiRequest(prompt)              │
│   ↓                                    │
│   Gather: email, token, apiKey        │
│   POST to SERVER_URL                  │
└────────────────────┬───────────────────┘
                     │ HTTPS POST
                     ↓
┌────────────────────────────────────────┐
│ SERVER (Web App)                       │
│                                        │
│ doPost(e):                             │
│   1. Parse request                     │
│   2. Check action                      │
│   3. Validate license (email + token)  │
│   4. Check rate limit                  │
│   5. Try cache (gm action)             │
│   6. Execute action (Gemini call)      │
│   7. Cache result                      │
│   8. Log operation                     │
│   9. Return JSON response              │
│                                        │
│ Never stores:                          │
│   ❌ User's Gemini key (uses it once) │
│   ❌ API keys                          │
│   ✅ Only masks tokens in logs        │
└────────────────────┬───────────────────┘
                     │ HTTPS Response
                     ↓
┌────────────────────────────────────────┐
│ CLIENT                                 │
│ Receive: {ok: true, data: result}     │
│ Display: Result in Sheet               │
└────────────────────────────────────────┘
```

---

## 🔄 FLOW: GEMINI CALL

```
1. User enters prompt in Google Sheet
   ↓
2. CLIENT: callGeminiRequest(prompt)
   ↓
3. CLIENT: callServer('gm', {prompt, maxTokens, temperature})
   ↓
4. CLIENT: POST to SERVER_URL
   Payload: {action: 'gm', email, token, apiKey, prompt, ...}
   ↓
5. SERVER: doPost(e) receives request
   ↓
6. SERVER: Parse request & validate license
   - Check email exists in LICENSE_SHEET
   - Check token matches
   - Check status = 'active'
   - Check expiry date
   ↓
7. SERVER: Check rate limit
   - Max 3 requests/sec per token
   - Use CacheService for tracking
   ↓
8. SERVER: Generate cache key
   key = 'gm_cache:' + prompt.slice(0,20) + ':' + maxTokens + ':' + temperature
   ↓
9. SERVER: Try cache
   result = gmCacheGet_(key)
   if (result) return cached response
   ↓
10. SERVER: Call Gemini API
    UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, {
      method: 'POST',
      payload: {contents: [{parts: [{text: prompt}]}]}
    })
    ↓
11. SERVER: Parse response
    Extract: response.candidates[0].content.parts[0].text
    ↓
12. SERVER: Process markdown (convert to readable)
    ↓
13. SERVER: Cache result
    gmCachePut_(key, result, 21600)  // 6 hours
    ↓
14. SERVER: Log operation
    serverLog_({action: 'gm', ok: true, email, token, promptLen, ms})
    ↓
15. SERVER: Return response
    {ok: true, data: result}
    ↓
16. CLIENT: Receive response
    ↓
17. CLIENT: Display in Sheet
    ↓
18. USER: Sees result
```

---

## 📊 CACHE STRATEGY

### Cache Key Generation:
```javascript
function gmCacheKey_(prompt, maxTokens, temperature) {
  // Example:
  // Prompt: "What is Table AI? Tell me more about it..."
  // Key: "gm_cache:What is Table AI?:12500:0.7"
  
  const p = prompt.slice(0, 20);  // First 20 chars
  return 'gm_cache:' + p + ':' + maxTokens + ':' + temperature;
}
```

### Cache Hit Scenario:
```
First call:
  Client → Server: {action: 'gm', prompt: 'What is AI?', ...}
  Server: No cache → Call Gemini API → Cache result → Return
  Time: ~3 seconds

Second call (same prompt, within 6 hours):
  Client → Server: {action: 'gm', prompt: 'What is AI?', ...}
  Server: Cache hit → Return cached → Log
  Time: ~100ms ✅

Cache expires: 6 hours (21600 seconds)
```

### Cache Storage:
```javascript
// Uses Google Apps Script CacheService
// Automatic expiration after TTL
// Per-script instance (not shared globally)

CacheService.getScriptCache().put(key, value, ttlSeconds);
// Max value size: 100KB per key
// Max total size: 256KB per script
```

---

## 🚨 ERROR HANDLING

### License Errors (HTTP 403):
```javascript
// Client sends invalid token
{
  "ok": false,
  "error": "NOT_FOUND"
}
```

### Rate Limit (HTTP 429):
```javascript
// Too many requests from one token per second
{
  "ok": false,
  "error": "RATE_LIMIT"
}
```

### API Errors (HTTP 500):
```javascript
// Gemini API failed, or invalid API key
{
  "ok": false,
  "error": "Invalid API key"  // From Gemini
}
```

### Input Validation (HTTP 400):
```javascript
// Missing required fields
{
  "ok": false,
  "error": "NO_CLIENT_KEY"  // or "EMPTY_PROMPT"
}
```

---

## 🔍 LOGGING

### What Gets Logged:
```javascript
serverLog_({
  action: 'gm',              // Action type
  ok: true,                  // Success?
  error: null,               // Error message if failed
  email: 'user@example.com', // User email
  token: 'lic_****',         // Masked token (first 4 + ****)
  promptLen: 42,             // Prompt character length
  ms: 2150,                  // Response time in milliseconds
  cached: false              // Was result from cache?
});

// Logged to: LICENSE_SHEET → 'Logs' sheet
// Columns: timestamp | action | ok | error | email | token | promptLen | ms | cached
```

### Log Examples:
```
2025-10-19 14:32:15 | gm | 1 | | user@mail.com | lic_**** | 42 | 2150 | 0
2025-10-19 14:32:30 | gm | 1 | | user@mail.com | lic_**** | 42 | 85 | 1
2025-10-19 14:32:45 | gm | 0 | RATE_LIMIT | user@mail.com | lic_**** | 0 | 5 | 0
```

---

## ✅ MIGRATION CHECKLIST

- [ ] Replace GM() calls in CLIENT with callGeminiRequest()
- [ ] Update CLIENT to pass apiKey through SERVER
- [ ] Verify SERVER caching works (check 'cached' flag in logs)
- [ ] Test license validation (all error cases)
- [ ] Test rate limiting (3 requests/sec max)
- [ ] Test cache TTL (6 hours expiry)
- [ ] Verify markdown processing works
- [ ] Check log sheet is populated correctly
- [ ] Test error responses are proper JSON
- [ ] Verify tokens are masked in logs
- [ ] Load test with multiple simultaneous requests

---

## 🚀 IMPLEMENTATION STATUS

### COMPLETED (v3.0.0):
✅ CLIENT refactored to UI-only (Main_v3_REFACTORED.gs)
✅ SERVER improved with caching (Server_v3_IMPROVED.gs)
✅ gmCache* functions moved to SERVER
✅ License validation on SERVER
✅ Rate limiting implemented
✅ Logging with cache tracking
✅ Architecture documentation

### PENDING:
⏳ Merge v3 files into production (Main.gs, server.gs)
⏳ Update deploy scripts
⏳ Full integration testing
⏳ Create PR for code review

---

**Status:** PHASE 3 COMPLETE - Ready for integration and testing! 🎉
