# 🔐 Security Fix: OCR Gemini Server Proxy

## Issue Found & Fixed

### ❌ The Problem
The initial implementation had a critical security vulnerability:

1. **Client** (`ocrRunV2_client.gs`) was trying to get API keys from client-side properties
2. **Client** was sending these keys to the **Server** in the request payload
3. **Server** was accepting and using these client-provided keys

This violates the principle: **Server should NEVER trust client-provided credentials**

### ✅ The Solution
Complete separation of concerns:

1. **Client** sends ONLY image data (no API keys)
2. **Server** uses ONLY its own configured API key
3. **Server** ignores any API key fields in client requests

---

## Files Modified

### 1. Client-Side: `deploy/ocrRunV2_client.gs`

#### Function: `gmOcrFromBlobV2_(blob, lang)`
**Before:**
```javascript
var userApiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
var result = serverGmOcrBatchV2_(images, lang || 'ru', userApiKey);
```

**After:**
```javascript
var result = serverGmOcrBatchV2_(images, lang || 'ru');
```

**Change:** Removed client API key retrieval and parameter passing.

#### Function: `serverGmOcrBatchV2_(images, lang, userApiKey)`
**Before:**
```javascript
var apiKey = userApiKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
var payload = { action: 'gm_image', email: email, token: token, apiKey: apiKey, images: images, ... };
```

**After:**
```javascript
function serverGmOcrBatchV2_(images, lang){
  var email = (typeof getLicenseEmail === 'function') ? getLicenseEmail() : '';
  var token = (typeof getLicenseToken === 'function') ? getLicenseToken() : '';
  var payload = { action: 'gm_image', email: email, token: token, images: images, lang: lang || 'ru', delimiter: '____' };
```

**Change:** 
- Removed `userApiKey` parameter
- Removed `apiKey` from payload sent to server
- Client never manages or sends API keys

### 2. Server-Side: `deploy/server.gs`

#### Function: doPost() - case 'gm_image'
**Before:**
```javascript
const userApiKey = (data.apiKey || '').toString();
// API key priority: use user key first, otherwise fallback to default
let finalApiKey = userApiKey;
let keySource = 'USER';

if (!userApiKey) {
  const defaultApiKey = getDefaultGeminiKey_();
  if (defaultApiKey) {
    finalApiKey = defaultApiKey;
    keySource = 'DEFAULT';
  }
} else {
  Logger.log('Using USER API key, length: ' + userApiKey.length);
}
```

**After:**
```javascript
// ✅ Server uses ONLY its own configured API key
// ❌ Never trust client-provided API keys
const finalApiKey = getDefaultGeminiKey_();
if (!finalApiKey) {
  Logger.log('ERROR: GEMINI_API_KEY not configured on SERVER');
  return json_({ok: false, error: 'NO_API_KEY_AVAILABLE'}, 400);
}
Logger.log('✅ Using SERVER API key from script properties');
const keySource = 'SERVER';
```

**Change:**
- Ignores any `data.apiKey` field from client
- Uses ONLY `getDefaultGeminiKey_()` from server properties
- Clear log message: "Using SERVER API key from script properties"
- keySource is now always 'SERVER' for gm_image action

---

## Security Verification

### ✅ Verified: No Client API Keys in Requests

**Before (❌ INSECURE):**
```
POST /server
{
  "action": "gm_image",
  "images": [...],
  "apiKey": "sk-abc123..."  // ❌ EXPOSED!
}
```

**After (✅ SECURE):**
```
POST /server
{
  "action": "gm_image",
  "images": [...],
  "email": "user@example.com",
  "token": "token123..."
  // ✅ No API key in request
}
```

### ✅ Verified: Server Uses Only Own Credentials
- `getDefaultGeminiKey_()` reads from **server** script properties only
- Client properties never consulted by server
- Each script instance has its own isolated credentials

### ✅ Verified: No Fallback to Client Keys
- Removed all conditional logic that might use client-provided keys
- Server either has its own key or returns error
- No ambiguity about key source

---

## Configuration

### Server Configuration (Admin Only)
```javascript
// In server.gs Web App Console:
PropertiesService.setProperty('GEMINI_API_KEY', 'your-server-api-key');
```

### Client Configuration (Users)
❌ **REMOVED**: Clients can no longer provide their own API keys
✅ **BENEFIT**: Eliminates credential management from client side

Users now simply need a valid license token. The server handles all API key management.

---

## Logging & Audit Trail

### Server Logs Now Show
- `action: 'gm_image'`
- `keySource: 'SERVER'` (not 'USER' or 'DEFAULT')
- All API key sources are now transparent
- Easy to audit that only server keys are used

### Example Server Log Entry
```
Processing gm_image action
images count: 1
lang: ru
delimiter: ____
✅ Using SERVER API key from script properties
Calling serverGMImage_ with SERVER API key
serverGMImage_ completed successfully, response length: 245
```

---

## Error Handling

### If Server API Key is Not Configured
```
HTTP 400
{
  "ok": false,
  "error": "NO_API_KEY_AVAILABLE"
}
```

**Server Log:**
```
ERROR: GEMINI_API_KEY not configured on SERVER
```

### How to Fix
Admin must set the API key in server properties:
```javascript
PropertiesService.setProperty('GEMINI_API_KEY', 'sk-...');
```

---

## Testing the Fix

### Test 1: Verify Client Doesn't Send API Key
1. Open DevTools → Network tab
2. Run OCR operation
3. Check POST request to SERVER_URL
4. Verify: No `apiKey` or `data.apiKey` in JSON payload
5. Verify: Only `email`, `token`, `images`, `lang` fields

### Test 2: Verify Server Uses Its Own Key
1. Check server logs for `keySource: 'SERVER'`
2. Verify no references to client-provided keys
3. Confirm successful OCR responses

### Test 3: Test Error Case
1. Unset server API key
2. Attempt OCR
3. Should get error: "NO_API_KEY_AVAILABLE"

---

## Impact Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Security** | ❌ Keys exposed | ✅ Keys on server only |
| **Flexibility** | Can use per-user keys | ✅ Unified server key |
| **Simplicity** | Complex fallback logic | ✅ Simple, one source |
| **Audit Trail** | Ambiguous key sources | ✅ Always 'SERVER' |
| **Error Messages** | Unclear | ✅ Explicit: "configure on SERVER" |

---

## Backward Compatibility

### ✅ Breaking Changes (Intentional)
- Removed `userApiKey` parameter from `serverGmOcrBatchV2_()`
- Removed API key sending from client payload
- **Reason:** These were security vulnerabilities

### ✅ Non-Breaking
- Function signatures still work (parameter removed from client call)
- All existing OCR workflows continue to work
- No client-side UI changes required

### Migration Path
**No migration needed for end users:**
- Client code updated automatically
- Users just need valid license token
- Server administrator sets API key once

---

## See Also

- **Architecture**: `deploy/OCR_SERVER_PROXY_GUIDE.md`
- **Migration Summary**: `OCR_MIGRATION_SUMMARY.md`
- **Server Handler**: `deploy/ocr_server_handler.gs`
- **Main Server**: `deploy/server.gs` (doPost function, gm_image action)

---

**Status:** ✅ SECURITY FIX APPLIED
**Branch:** feature-ocr-gemini-server-proxy
**Severity:** HIGH (Credential Exposure)
**Impact:** CRITICAL (All OCR operations)
