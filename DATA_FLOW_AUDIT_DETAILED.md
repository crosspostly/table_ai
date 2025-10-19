# DATA FLOW AUDIT: DETAILED ANALYSIS

**Date:** 2025-10-19  
**Purpose:** Verify complete data flow between CLIENT, SERVER, and external APIs  
**Status:** ⚠️ CRITICAL ISSUES FOUND

---

## 🚨 CRITICAL FINDINGS

### Issue #1: DUAL GM() IMPLEMENTATIONS - ARCHITECTURE VIOLATION!

**Location:** `deploy/Main.gs`

**Problem:** Two conflicting implementations of `GM()` function:

```javascript
// VERSION 1 (Lines 553-580): ❌ DIRECT GEMINI CALL
function GM(prompt, maxTokens = 25000, temperature = 0.7) {
  const apiKey = getGeminiApiKey();
  const response = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
  // CLIENT calls Gemini DIRECTLY - VIOLATION!
}

// VERSION 2 (Lines 985-1050): ✅ SERVER PROXY
function GM(prompt, maxTokens, temperature) {
  // Uses serverGM_() which goes through SERVER
  const r = serverGM_(prompt, maxTokens, temperature);
  if (r && r.ok) { ... }
  else if (DEV_MODE) {
    // DEV FALLBACK: ❌ DIRECT GEMINI CALL!
    const response = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
  }
}
```

**Impact:** 
- ❌ CLIENT **CAN** call Gemini directly (violates separation)
- ❌ DEV mode allows direct Gemini bypass
- ❌ Inconsistent code paths

---

## 📊 COMPLETE DATA FLOW ANALYSIS

### Data Type 1: PROMPTS

```
USER INPUT
  ↓
CLIENT (Main.gs)
  ↓
Two possible paths:
  
PATH 1 (SHOULD BE): ✅ CORRECT
  Prompt → serverGM_() → SERVER → Gemini API → Response → CLIENT → Sheet
  
PATH 2 (CURRENT): ❌ WRONG
  Prompt → GM() → Gemini API (DIRECT) → Response → CLIENT → Sheet
  
PATH 3 (DEV FALLBACK): ❌ WRONG
  Prompt → serverGM_() → SERVER (fails) → GM() (fallback) → Gemini API (DIRECT)
```

**Where prompts enter CLIENT:**
- Line 243: `GM_IF(condition, prompt, ...)` - Gets prompt from Prompt_box sheet
- Line 553: `GM(prompt, ...)` - Main function
- Line 985: Proxy `GM(prompt, ...)` - Should use SERVER

**Validation on CLIENT:**
- Line 555: Length check (50000 chars) ✅
- Line 1007: Length check (50000 chars) ✅
- Line 1008: Type check (string) ✅
- NO input sanitization before sending! ⚠️

**Where prompts go:**
- Line 560: Direct to Gemini API ❌
- Line 977: To SERVER (correct) ✅
- Line 1019: To SERVER or fallback to Direct ⚠️

---

### Data Type 2: IMAGES

**Current Implementation:**
```javascript
// No explicit image handling found in Main.gs
// But Server_v3_IMPROVED.gs has 'gm_image' action:
case 'gm_image': {
  const images = data.images || [];
  const lang = (data.lang || 'ru').toString();
  const apiKey2 = (data.apiKey || '').toString();
  // ✅ Images go through SERVER
}
```

**Issue:** CLIENT doesn't send images to SERVER!
- ❌ No image upload mechanism in CLIENT
- ❌ `gm_image` endpoint on SERVER but not used from CLIENT

---

### Data Type 3: TOKENS & CREDENTIALS

**CLIENT stores locally:**
- Line 143: `getGeminiApiKey()` → PropertiesService ✅
- Line 152: `getLicenseEmail()` → PropertiesService ✅
- Line 161: `getLicenseToken()` → PropertiesService ✅

**CLIENT sends to SERVER:**
```javascript
const payload = {
  action: 'gm',
  email: email,        // ✅ Sent
  token: token,        // ✅ Sent
  apiKey: apiKey,      // ✅ Sent (Gemini key)
  prompt: prompt,      // ✅ Sent
  maxTokens: ...,      // ✅ Sent
  temperature: ...     // ✅ Sent
};
```

**Issues:**
- ⚠️ Gemini API key sent to SERVER (could be stolen!)
- ✅ License token sent to SERVER (needed for validation)
- ✅ Email sent to SERVER (needed for validation)

**Better approach:**
- CLIENT should NOT send Gemini key to SERVER
- SERVER should call Gemini with CLIENT key OR use pre-authorized key

---

### Data Type 4: RESPONSES

**From Gemini API:**
```javascript
// Line 572: Parse response
const candidate = responseData.candidates && responseData.candidates[0];
const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
const text = (content && content.text) || '';

// Line 579: Process markdown
const processed = processGeminiResponse(text);

// Return to sheet
return processed;
```

**Issues:**
- ✅ Response processed locally
- ✅ Markdown converted
- ❌ No response size limits
- ❌ No response sanitization

---

### Data Type 5: LOGGING DATA

**What gets logged:**

```javascript
// Client logs (Line 554):
addLog('→ GM: prompt=' + (prompt ? prompt.slice(0, 60)+'...' : 'нет'), 'INFO');

// Potential issue: Prompt content in logs!
// Line 1006: Logs first 60 chars of prompt
```

**Issues:**
- ⚠️ Prompts logged on CLIENT (cache storage)
- ⚠️ May contain sensitive data
- ✅ SERVER logs masked (with trace ID)
- ❌ Token logged in some cases

---

## 🔐 SECURITY ISSUES IN DATA FLOW

### Issue 1: Client-Side Gemini Calls
```
❌ VIOLATION: CLIENT can call Gemini directly
✅ SHOULD: All Gemini calls through SERVER only
```

**Root cause:** Two conflicting GM() implementations

### Issue 2: Gemini API Key Transmission
```
CLIENT stores Gemini key locally ✅
CLIENT sends key to SERVER with each request ⚠️
  ↓
KEY EXPOSURE RISK: Key visible in network traffic
KEY EXPOSURE RISK: Key stored on SERVER (not needed)
KEY EXPOSURE RISK: Key in SERVER logs
```

**Better design:**
- CLIENT stores key locally
- CLIENT calls SERVER with just (email, token, prompt)
- SERVER either:
  - Uses pre-configured Gemini key on SERVER
  - OR CLIENT calls Gemini directly (own risk)

### Issue 3: Unvalidated Prompts
```
CLIENT validation: ✅ Length check (50000 chars)
CLIENT validation: ✅ Type check (string)
CLIENT validation: ❌ NO XSS validation
CLIENT validation: ❌ NO SQL injection prevention
CLIENT validation: ❌ NO HTML escaping

SERVER validation: ✅ (in Server_v3_IMPROVED.gs)
```

### Issue 4: Response Handling
```
Response from Gemini:
  ↓
Line 579: processGeminiResponse(text) ✅
  ↓
Line 514: convertMarkdownToReadableText(text) ✅
  ↓
But:
  - ❌ No size limits on response
  - ❌ No HTML sanitization
  - ❌ Markdown processing could be exploited
```

---

## 📋 COMPLETE DATA FLOW TABLE

### From CLIENT to SERVER

| Data | Line | Value | Sent? | Safe? |
|------|------|-------|-------|-------|
| action | 977 | 'gm' | ✅ | ✅ |
| email | 976 | USER_EMAIL | ✅ | ⚠️ (plaintext) |
| token | 976 | USER_TOKEN | ✅ | ⚠️ (plaintext) |
| apiKey | 977 | GEMINI_KEY | ✅ | ❌ (exposed!) |
| prompt | 977 | USER_TEXT | ✅ | ⚠️ (unvalidated) |
| maxTokens | 977 | 25000 | ✅ | ✅ |
| temperature | 977 | 0.7 | ✅ | ✅ |

### From SERVER to Gemini

| Data | Status | Note |
|------|--------|------|
| text | prompt | Forwarded from CLIENT |
| apiKey | Gemini key | From CLIENT |
| maxTokens | Limit | From CLIENT |
| temperature | Param | From CLIENT |

### From Gemini to SERVER

| Data | Status | Note |
|------|--------|------|
| response.text | Result | Returned to CLIENT |
| error | Error msg | Returned to CLIENT |
| HTTP code | Status | Returned to CLIENT |

### From SERVER to CLIENT

| Data | Status | Note |
|------|--------|------|
| ok | Boolean | Success flag |
| data | text | Gemini response |
| error | text | Error message |

### From CLIENT to Sheet

| Data | Status | Note |
|------|--------|------|
| processed | text | Markdown-converted response |
| metadata | N/A | NOT stored |

---

## 🎯 VIOLATIONS SUMMARY

### Architecture Violations: 3 CRITICAL

1. **❌ VIOLATION: Direct Gemini calls from CLIENT**
   - Location: `Main.gs:553-580` (old GM)
   - Location: `Main.gs:1037-1050` (dev fallback)
   - Should: All Gemini calls through SERVER
   - Impact: CLIENT can bypass SERVER authorization

2. **❌ VIOLATION: Gemini API key sent to SERVER**
   - Location: `Main.gs:977`
   - Should: Key stays on CLIENT, never sent
   - Impact: Key exposure, SERVER unnecessary access

3. **❌ VIOLATION: No prompt sanitization before sending**
   - Location: `Main.gs:976-978`
   - Should: Validate/sanitize before transmission
   - Impact: Potential XSS or injection attacks

---

## 🔍 DETAILED CODE LOCATIONS

### CLIENT Gemini Calls:

**Location 1: Old GM() (DIRECT CALL)**
```
File: deploy/Main.gs
Lines: 553-580
Function: GM(prompt, maxTokens, temperature)
Implementation: Calls GEMINI_API_URL directly
Authentication: Uses CLIENT-stored apiKey
Issue: ❌ Violates architecture
```

**Location 2: New GM() (PROXY WITH FALLBACK)**
```
File: deploy/Main.gs
Lines: 985-1050
Function: GM(prompt, maxTokens, temperature)
Path 1: Calls serverGM_() → SERVER → Gemini ✅
Path 2 (DEV): Fallback to direct Gemini call ❌
Issue: ⚠️ DEV fallback violates architecture
```

**Location 3: serverGM_()**
```
File: deploy/Main.gs
Lines: 973-984
Function: serverGM_(prompt, maxTokens, temperature)
Implementation: Sends to SERVER (correct)
Issue: ✅ No issue
```

### Prompt Entry Points:

1. **Formula-based:** Line 243 `GM_IF(condition, prompt, ...)`
2. **Direct call:** Line 553, 985, 1006 `GM(prompt, ...)`
3. **Sheet reference:** Prompt_box!F2, F3, etc.

---

## ✅ WHAT'S CORRECT

### In Server_v3_IMPROVED.gs:
- ✅ All Gemini calls on SERVER
- ✅ Input validation on SERVER
- ✅ Rate limiting on SERVER
- ✅ Logging with trace IDs
- ✅ Caching on SERVER
- ✅ License validation on SERVER

### In Main_v3_REFACTORED.gs (NEW):
- ✅ Only UI operations
- ✅ No direct API calls
- ✅ Only SERVER calls
- ✅ Clean separation

### Problem:
- ❌ OLD Main.gs has mixed implementations
- ❌ Main_v3_REFACTORED.gs exists but OLD Main.gs is ACTIVE!

---

## 🚨 CRITICAL ACTION ITEMS

### Must Fix:

1. **Remove old GM() implementation from Main.gs**
   - Delete lines 553-580 (old direct Gemini call)
   - Keep only proxy version with SERVER validation

2. **Remove DEV fallback that calls Gemini directly**
   - Delete lines 1037-1050 (direct Gemini fallback)
   - Fail gracefully if SERVER unavailable

3. **Don't send Gemini API key to SERVER**
   - Option A: CLIENT calls Gemini directly (accept risk)
   - Option B: SERVER has pre-configured Gemini key
   - Option C: CLIENT authenticates to SERVER first, then SERVER calls Gemini

4. **Add input sanitization before sending**
   - Validate prompt format
   - Check for XSS patterns
   - Truncate if needed

---

## 📝 RECOMMENDATIONS

### For Immediate Fix:

```javascript
// CURRENT (WRONG):
const payload = {
  action: 'gm',
  email: email,
  token: token,
  apiKey: apiKey,      // ❌ Don't send key!
  prompt: prompt,
  maxTokens: maxTokens,
  temperature: temperature,
};

// RECOMMENDED (CORRECT):
const payload = {
  action: 'gm',
  email: email,        // ✅ Keep
  token: token,        // ✅ Keep
  // NO apiKey field!
  prompt: prompt,      // ✅ Keep (CLIENT-validated)
  maxTokens: maxTokens, // ✅ Keep
  temperature: temperature, // ✅ Keep
};

// SERVER side:
// Either use pre-configured GEMINI_KEY on SERVER
// Or reject the request if no key provided
```

---

## 📊 FINAL DATA FLOW DIAGRAM

### CURRENT STATE (MIXED):
```
CLIENT
├── UI (Main.gs:onOpen)
├── Prompt input
├── Path 1 (WRONG): GM() → GEMINI directly ❌
├── Path 2 (RIGHT): serverGM_() → SERVER → GEMINI ✅
│   └── Fallback (WRONG): → GEMINI directly ❌
└── Response → Sheet
```

### DESIRED STATE:
```
CLIENT
├── UI
├── Prompt input (validated)
├── Send to SERVER only ✅
└── Response → Sheet

SERVER
├── Validate input
├── Check license
├── Call GEMINI
├── Cache result
├── Log with trace ID
└── Return to CLIENT
```

---

## 🎯 CONCLUSION

**Data Flow Status: ⚠️ PARTIALLY BROKEN**

### Issues Found: 3 CRITICAL
- Direct Gemini calls from CLIENT
- API key exposure
- No input sanitization

### Security Score: 2/5 ⭐⭐
- Previous audit missed these!
- Main.gs has bypass capabilities
- Keys exposed in transmission

### Recommendation:
- **STOP** current deployment
- **USE** Main_v3_REFACTORED.gs (v3.0.0)
- **DELETE** old Main.gs implementations
- **REMOVE** dev fallback for direct Gemini
- **RETEST** all data flows

---

**Audit Date:** 2025-10-19  
**Status:** ⚠️ CRITICAL ISSUES FOUND - DO NOT DEPLOY
