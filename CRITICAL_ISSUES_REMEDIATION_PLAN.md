# CRITICAL ISSUES REMEDIATION PLAN

**Status:** ⚠️ ACTION REQUIRED BEFORE DEPLOYMENT  
**Issues:** 3 CRITICAL violations found in data flow  
**Severity:** HIGH - Security & Architecture

---

## 🚨 SUMMARY OF CRITICAL ISSUES

### Issue #1: Dual GM() Implementations
- **File:** `deploy/Main.gs`
- **Lines:** 553-580 (OLD), 985-1050 (NEW with fallback)
- **Problem:** Two conflicting implementations create code path ambiguity
- **Risk:** Old code may be executed instead of new version

### Issue #2: Direct Gemini Calls from CLIENT  
- **File:** `deploy/Main.gs`
- **Lines:** 560-572 (old), 1037-1050 (DEV fallback)
- **Problem:** CLIENT can call Gemini directly, bypassing SERVER
- **Risk:** Circumvents SERVER-side validation, logging, and caching

### Issue #3: Gemini API Key Exposed in Transit
- **File:** `deploy/Main.gs`  
- **Line:** 977
- **Problem:** Gemini key sent to SERVER with every request
- **Risk:** Key visible in network traffic, stored on SERVER

---

## 🔧 REMEDIATION STEPS

### STEP 1: Identify Which Code is Actually Running

First, determine if the system is using old Main.gs or Main_v3_REFACTORED.gs:

```bash
# Check which file is deployed
ls -lh deploy/Main.gs
ls -lh deploy/Main_v3_REFACTORED.gs

# Count functions to determine which version
grep -c "^function" deploy/Main.gs       # Should be ~60+
grep -c "^function" deploy/Main_v3_REFACTORED.gs  # Should be ~25
```

**Expected Result:**
- If using **Main.gs** → Has both old AND new implementations (MIXED) ❌
- If using **Main_v3_REFACTORED.gs** → Clean, new version only ✅

---

### STEP 2: Fix Main.gs (If Currently Active)

**Option A: Remove old GM() implementation**

Replace lines 553-580:
```javascript
// ❌ DELETE THIS (old implementation):
function GM(prompt, maxTokens = 25000, temperature = 0.7) {
  addLog('→ GM: prompt=' + (prompt ? prompt.slice(0, 60)+'...' : 'нет') + ' (' + (prompt ? prompt.length : 0) + ')', 'INFO');
  if (!prompt || typeof prompt !== 'string') throw new Error('Промпт должен быть непустой строкой.');
  if (prompt.length > 50000) throw new Error('Промпт слишком длинный, сократите до 50000 символов.');

  const apiKey = getGeminiApiKey();
  const requestBody = {
    contents: [{parts: [{text: prompt}]}],
    generationConfig: {maxOutputTokens: maxTokens, temperature: temperature},
  };
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
    const responseData = JSON.parse(response.getContentText());
    addLog('← GM: HTTP ' + response.getResponseCode(), 'DEBUG');
    if (response.getResponseCode() !== 200) {
      const message = responseData.error && responseData.error.message ? responseData.error.message : 'Unknown error';
      addLog('❌ GM API ошибка: ' + message, 'ERROR');
      return 'Error: ' + message;
    }
    const candidate = responseData.candidates && responseData.candidates[0];
    const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    // ... rest of function
  }
}
```

Replace with:
```javascript
// ✅ KEEP ONLY: New proxy implementation (see STEP 3)
// Old implementation deleted - use SERVER proxy only
```

**Option B: Remove DEV fallback**

In the new GM() function (lines 985-1050), replace this section:
```javascript
// ❌ DELETE THIS FALLBACK (lines ~1037-1050):
if (DEV_MODE) {
  addLog('⚠️ DEV fallback → прямой Gemini. Причина: ' + (serr || 'UNKNOWN'), 'WARN');
  try {
    const apiKey = getGeminiApiKey();
    const body = {contents: [{parts: [{text: prompt}]}], generationConfig: {maxOutputTokens: maxTokens, temperature: temperature}};
    const options = {method: 'POST', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true};
    const resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
    // ...
  }
}
```

Replace with:
```javascript
// ✅ FAIL GRACEFULLY (no direct Gemini):
if (DEV_MODE) {
  addLog('⚠️ SERVER unavailable. Returning error gracefully.', 'WARN');
}
// Don't fallback to direct Gemini - return error instead
```

**Option C: Don't send API key to SERVER**

In serverGM_() function (lines 973-984):

```javascript
// ❌ CURRENT (line 977):
const payload = {
  action: 'gm', 
  email: email, 
  token: token, 
  apiKey: apiKey,      // ❌ REMOVE THIS!
  prompt: prompt, 
  maxTokens: maxTokens, 
  temperature: temperature
};

// ✅ CORRECTED:
const payload = {
  action: 'gm', 
  email: email, 
  token: token, 
  // NO apiKey - CLIENT calls Gemini directly OR SERVER uses pre-configured key
  prompt: prompt, 
  maxTokens: maxTokens, 
  temperature: temperature
};
```

---

### STEP 3: Ensure Server_v3_IMPROVED.gs Handles No API Key

Update Server_v3_IMPROVED.gs to handle missing apiKey:

```javascript
case 'gm': {
  const prompt = (data.prompt || '').toString();
  const maxTokens = data.maxTokens == null ? 12500 : +data.maxTokens;
  const temperature = data.temperature == null ? 0.7 : +data.temperature;
  const apiKey = (data.apiKey || '').toString();
  
  // Option 1: Use SERVER's pre-configured key
  const SERVER_GEMINI_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const keyToUse = apiKey || SERVER_GEMINI_KEY;
  
  if (!keyToUse) return json_({ok: false, error: 'NO_GEMINI_KEY'}, 400);
  
  // Use keyToUse to call Gemini
  const text = serverGM_(prompt, maxTokens, temperature, keyToUse);
  // ...
}
```

---

### STEP 4: Add Input Sanitization

Add validation before sending to SERVER:

```javascript
// In clientGM_() or before serverGM_() call:
function validatePromptForTransmission(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string');
  }
  
  const trimmed = prompt.trim();
  
  // Check length
  if (trimmed.length > 50000) {
    throw new Error('Prompt exceeds 50,000 character limit');
  }
  
  // Check for XSS patterns (basic)
  const xssPatterns = /<script|<iframe|javascript:|onerror=|onload=/i;
  if (xssPatterns.test(trimmed)) {
    throw new Error('Prompt contains invalid patterns');
  }
  
  // Check for SQL injection patterns (basic)
  const sqlPatterns = /union|select|delete|drop|insert|update|alter/i;
  if (sqlPatterns.test(trimmed)) {
    addLog('⚠️ Potential SQL pattern in prompt (logged for review)', 'WARN');
    // Don't block, just log - could be legitimate
  }
  
  return trimmed;
}

// Use before sending:
try {
  const cleanPrompt = validatePromptForTransmission(prompt);
  const r = serverGM_(cleanPrompt, maxTokens, temperature);
} catch (e) {
  addLog('❌ Prompt validation failed: ' + e.message, 'ERROR');
  return 'Error: Invalid prompt - ' + e.message;
}
```

---

### STEP 5: Response Size Limits

Add limit to prevent DoS:

```javascript
// In processGeminiResponse():
function processGeminiResponse(response, maxSize = 100000) {
  if (!response || typeof response !== 'string') return response;
  
  // Check size
  if (response.length > maxSize) {
    addLog('⚠️ Response truncated (size=' + response.length + ', limit=' + maxSize + ')', 'WARN');
    response = response.substring(0, maxSize) + '\n... (truncated)';
  }
  
  return convertMarkdownToReadableText(response);
}
```

---

### STEP 6: Implement Either:

**Option A: CLIENT calls Gemini directly (current risk accepted)**

Keep current design but remove SERVER processing:
- ✅ CLIENT stores key
- ✅ CLIENT calls Gemini directly
- ✅ SERVER does validation/logging only (optional)
- ⚠️ Risk: Client-side bypass possible

**Option B: SERVER uses pre-configured key (recommended)**

New design with better security:
```javascript
// On SERVER setup:
PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', 'sk-...');

// In SERVER handler:
case 'gm': {
  const serverKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!serverKey) return json_({ok: false, error: 'SERVER_NOT_CONFIGURED'}, 500);
  
  // Use serverKey instead of clientKey
  const text = serverGM_(prompt, maxTokens, temperature, serverKey);
  // ...
}

// CLIENT no longer sends apiKey:
const payload = {
  action: 'gm',
  email: email,
  token: token,
  prompt: prompt,
  maxTokens: maxTokens,
  temperature: temperature
  // NO apiKey!
};
```

**Option C: API signature validation (most secure)**

Clients sign requests:
```javascript
// CLIENT:
const timestamp = Date.now();
const message = `${email}|${token}|${timestamp}`;
const signature = CryptoJS.HmacSHA256(message, SECRET_KEY).toString();

const payload = {
  action: 'gm',
  email: email,
  token: token,
  timestamp: timestamp,
  signature: signature,
  prompt: prompt,
  maxTokens: maxTokens,
  temperature: temperature
};

// SERVER:
function verifySignature(email, token, timestamp, signature) {
  const message = `${email}|${token}|${timestamp}`;
  const expectedSig = CryptoJS.HmacSHA256(message, SECRET_KEY).toString();
  return signature === expectedSig;
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Analysis
- [ ] Identify which version is currently deployed (Main.gs vs Main_v3_REFACTORED.gs)
- [ ] Determine if old GM() is being called
- [ ] Verify DEV fallback exists and is active
- [ ] Check if API keys are exposed in logs

### Phase 2: Fix Code
- [ ] Remove old GM() implementation (lines 553-580)
- [ ] Remove DEV fallback (lines 1037-1050)
- [ ] Remove apiKey from serverGM_() payload
- [ ] Add prompt validation function
- [ ] Add response size limits
- [ ] Choose and implement one option (A, B, or C)

### Phase 3: Test
- [ ] Test normal flow (SERVER → Gemini)
- [ ] Test SERVER failure handling (graceful error)
- [ ] Test prompt validation (XSS, SQL injection)
- [ ] Test response size limiting
- [ ] Verify no direct Gemini calls

### Phase 4: Deploy
- [ ] Create feature branch: `fix/critical-data-flow-security`
- [ ] Implement all fixes
- [ ] Run full test suite
- [ ] Create PR with detailed explanation
- [ ] Get security review
- [ ] Deploy to production

### Phase 5: Verify
- [ ] Monitor SERVER logs for any direct Gemini calls
- [ ] Check for API key exposure in logs
- [ ] Verify caching working correctly
- [ ] Monitor error rates

---

## 🎯 RECOMMENDED APPROACH

### SHORT TERM (Quick Fix):
1. Use **Option B** (SERVER pre-configured key)
2. Implement all security checks in Steps 2-5
3. Deploy within 24 hours

### MEDIUM TERM (Hardening):
1. Implement **Option C** (signature validation)
2. Add request logging with trace IDs
3. Add rate limiting per user
4. Monitor for suspicious patterns

### LONG TERM (Architecture):
1. Consider OAuth2 for authentication
2. Implement JWT tokens instead of simple tokens
3. Add request/response encryption
4. Separate CLIENT and SERVER deployment

---

## 📝 ESTIMATED EFFORT

| Task | Effort | Risk |
|------|--------|------|
| Remove old GM() | 15 min | LOW |
| Remove DEV fallback | 15 min | LOW |
| Add input validation | 30 min | LOW |
| Add response limits | 15 min | LOW |
| Implement Option B | 45 min | MEDIUM |
| Testing | 2 hours | HIGH |
| Deployment | 30 min | MEDIUM |

**Total:** ~4 hours | **Risk Level:** MEDIUM

---

## ⚠️ BEFORE YOU PROCEED

### Questions to Answer:

1. **Which version is deployed?**
   - Main.gs (has mixed code) ❌
   - Main_v3_REFACTORED.gs (clean new version) ✅

2. **Should CLIENT call Gemini directly or through SERVER?**
   - Direct (Option A): Faster, but less control
   - SERVER proxy (Option B): Recommended
   - Signed requests (Option C): Most secure

3. **Do you want to store Gemini key on SERVER?**
   - Yes (Option B): Recommended
   - No (Option A): Keep on CLIENT only

4. **Should we implement request signing?**
   - Yes (Option C): Best practice
   - No (Option B): Simpler, acceptable

---

## 📞 NEXT STEPS

1. **Assess current state** - Which code version is running?
2. **Choose security model** - Option A, B, or C?
3. **Implement fixes** - Follow remediation steps
4. **Test thoroughly** - Run all data flow scenarios
5. **Deploy safely** - Use feature branch + PR

---

**Status:** READY FOR IMPLEMENTATION  
**Blocker:** Need decision on security model  
**Timeline:** 4 hours implementation + testing
