# 🔴 CRITICAL SECURITY FIX APPLIED

## Issue: Client API Keys Being Sent to Server

### The Bug
The initial PR had a critical vulnerability where:
1. Client attempted to get API keys from client-side properties
2. Client sent these keys to the server in request payload
3. Server accepted and potentially used client-provided keys

**This violates fundamental security principle:** Server should NEVER trust client-provided credentials.

### The Fix
**Complete separation of concerns:**

#### Client Side (`deploy/ocrRunV2_client.gs`)
- ❌ REMOVED: `userApiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY')`
- ❌ REMOVED: Passing `userApiKey` as 3rd parameter to `serverGmOcrBatchV2_()`
- ❌ REMOVED: `apiKey: apiKey` from payload sent to server

**Before:**
```javascript
var userApiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
var result = serverGmOcrBatchV2_(images, lang || 'ru', userApiKey);

var payload = { action: 'gm_image', email: email, token: token, apiKey: apiKey, images: images, ... };
```

**After:**
```javascript
var result = serverGmOcrBatchV2_(images, lang || 'ru');

var payload = { action: 'gm_image', email: email, token: token, images: images, lang: lang || 'ru', delimiter: '____' };
```

#### Server Side (`deploy/server.gs`)
- ❌ REMOVED: `const userApiKey = (data.apiKey || '').toString();`
- ❌ REMOVED: Conditional logic that might use client key as priority
- ✅ ENFORCED: Server ALWAYS uses `getDefaultGeminiKey_()` from server properties only
- ✅ ADDED: Clear error if server API key not configured
- ✅ CHANGED: `keySource` is now always 'SERVER' for gm_image action

**Before:**
```javascript
const userApiKey = (data.apiKey || '').toString();
let finalApiKey = userApiKey;
let keySource = 'USER';

if (!userApiKey) {
  const defaultApiKey = getDefaultGeminiKey_();
  if (defaultApiKey) {
    finalApiKey = defaultApiKey;
    keySource = 'DEFAULT';
  }
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

### Results
✅ No API keys ever sent by client
✅ No API keys ever accepted from client
✅ Server uses only its own configured credentials
✅ Clear audit trail (keySource = 'SERVER')
✅ Simple, transparent error handling

### Security Verification
**Network request from client now contains:**
```json
{
  "action": "gm_image",
  "email": "user@example.com",
  "token": "token123...",
  "images": [{...}],
  "lang": "ru",
  "delimiter": "____"
}
```

**No API key exposed! ✅**

### Files Modified
1. `deploy/ocrRunV2_client.gs` - Removed API key handling from client
2. `deploy/server.gs` - Fixed gm_image handler to use only server key

### Documentation
- `SECURITY_FIX_OCR_PROXY.md` - Detailed security fix documentation
- `SECURITY_HOTFIX_SUMMARY.md` - This file

### Status
🔴 **CRITICAL** security vulnerability found and fixed
✅ Ready for re-review and merge
