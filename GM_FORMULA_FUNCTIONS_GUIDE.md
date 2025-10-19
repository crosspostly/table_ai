# 📐 GM() and GM_IF() Formula Functions Guide

## Overview

**GM()** and **GM_IF()** are formula functions that allow you to use Gemini AI directly in Google Sheets formulas.

- **GM()** - Main function to call Gemini from Sheet formulas
- **GM_IF()** - Conditional wrapper that only calls Gemini if a condition is true

## Architecture: CLIENT → SERVER → Gemini

```
┌─────────────────────────────────────┐
│  GOOGLE SHEETS (CLIENT)             │
│  Formula: =GM("prompt text")        │
└────────────┬────────────────────────┘
             │
             ↓ POST {email, token, apiKey, prompt}
┌─────────────────────────────────────┐
│  SERVER (TABLE AI SERVER)           │
│  Endpoint: 'gm'                     │
│  - Validates license                │
│  - Checks rate limits               │
│  - Uses cache (6h TTL)              │
│  - Calls Gemini API                 │
└────────────┬────────────────────────┘
             │
             ↓ Call Gemini API
┌─────────────────────────────────────┐
│  GOOGLE GEMINI API                  │
│  Model: gemini-2.0-flash            │
└─────────────────────────────────────┘
             │
             ↓ Response text
┌─────────────────────────────────────┐
│  SERVER (processes response)        │
│  - Converts markdown                │
│  - Caches result (6h)               │
│  - Returns to CLIENT                │
└─────────────────────────────────────┘
             │
             ↓ {ok: true, data: "response"}
┌─────────────────────────────────────┐
│  GOOGLE SHEETS                      │
│  Cell displays: "response"          │
└─────────────────────────────────────┘
```

## Requirements

Before using GM() and GM_IF(), you must set up:

### 1. Gemini API Key (on CLIENT)
```
Menu → 🤖 Table AI → 📝 Gemini: Set API Key
```
- Get key from: https://aistudio.google.com/app/apikey
- Stored in: `ScriptProperties.GEMINI_API_KEY`

### 2. License Credentials (on CLIENT)
```
Menu → 🤖 Table AI → ⚙️ Settings → License
```
- Format: `email|token`
- Stored in: `ScriptProperties.LICENSE_EMAIL` and `ScriptProperties.LICENSE_TOKEN`

### 3. SERVER Connection (automatic)
- SERVER_URL is hardcoded in `Main_v3_REFACTORED.gs`
- CLIENT sends credentials to SERVER for validation

## Function Reference

### GM(prompt, maxTokens, temperature)

**Call Gemini directly from Sheet formula.**

**Parameters:**
- `prompt` (string, required) - Question or instruction for Gemini
- `maxTokens` (number, optional) - Max response length (default: 25000, max: 30000)
- `temperature` (number, optional) - Randomness (default: 0.7, range: 0-1)

**Returns:**
- Success: `"response text"` (string)
- Error: `"Error: LICENSE_REQUIRED"` or similar error message

**Example Usage:**

```excel
=GM("What is artificial intelligence?")

=GM("Summarize this: " & A1, 500, 0.5)

=GM("Generate 3 ideas for: " & B2, 2000)
```

### GM_IF(condition, prompt, maxTokens, temperature)

**Call Gemini only if condition is true.**

**Parameters:**
- `condition` (any type) - Evaluated as boolean
  - TRUE: `TRUE`, `1`, `"true"`, `"истина"`, `"да"` (Russian)
  - FALSE: `FALSE`, `0`, `""`, `NULL`
- `prompt` (string) - Same as GM()
- `maxTokens` (number, optional)
- `temperature` (number, optional)

**Returns:**
- If condition is FALSE: `""` (empty string)
- If condition is TRUE: Same as GM()

**Example Usage:**

```excel
=GM_IF(A1 <> "", "Analyze: " & A1)

=GM_IF(LEN(B2) > 100, "Summarize: " & B2, 1000)

=GM_IF(C3 = TRUE, "Generate variations of: " & D3, 2000, 0.8)
```

## Caching Strategy

### CLIENT-side Cache (Main_v3_REFACTORED.gs)

```javascript
function gmCacheKey_(prompt, maxTokens, temperature)
```
- Creates SHA-256 hash of: `prompt|maxTokens|temperature`
- Result cache: 6 hours TTL (21600 seconds)
- Error cache: 1 minute TTL (prevents rapid retry storms)

**Use case:** If you use same prompt in multiple cells, second call is instant (cached).

### SERVER-side Cache (Server_v3_IMPROVED.gs)

```javascript
function gmCacheKey_(prompt, maxTokens, temperature)
```
- Same hash algorithm as CLIENT
- Prevents duplicate Gemini API calls even across multiple users
- TTL: `CACHE_TTL` (typically 6 hours)

## Error Handling

### License Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: LICENSE_REQUIRED` | Email/token not set | Set license in Settings |
| `Error: LICENSE_OR_SERVER` | License invalid or SERVER down | Check license or SERVER status |
| `Error: LICENSE_CHECK_FAILED` | Exception during check | Check logs, retry |

### API Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: EMPTY_PROMPT` | Prompt is empty string | Check formula, provide text |
| `Error: NO_CLIENT_KEY` | Gemini API key missing | Set Gemini key |
| `Error: RATE_LIMIT` | Too many calls too fast | Wait and retry |
| `Error: HTTP_429` | Gemini API rate limit | Wait and retry |

### Debug Logs

View logs to troubleshoot:
```
Menu → 🤖 Table AI → 📋 Logs
```

Or export to sheet:
```
Menu → 🤖 Table AI → 💾 Export Logs
```

## Performance Tips

### 1. Use GM_IF to avoid unnecessary calls

```excel
❌ Slow (calls Gemini even for empty cells)
=GM(A1)

✅ Fast (only calls if A1 has data)
=GM_IF(A1 <> "", A1)
```

### 2. Limit maxTokens when possible

```excel
❌ Slow (waits for 25000 tokens)
=GM(prompt)

✅ Fast (stops at 500 tokens)
=GM(prompt, 500)
```

### 3. Use lower temperature for consistent results

```excel
❌ Variable (temperature 0.7, unpredictable)
=GM(prompt)

✅ Consistent (temperature 0, deterministic)
=GM(prompt, 1000, 0)
```

### 4. Reuse prompts to hit cache

```excel
Cell A1: =GM("What is AI?")
Cell A2: =GM("What is AI?")  ← Instant (cached from A1)
```

## Security Model

### Credentials Flow

1. **CLIENT stores:**
   - `GEMINI_API_KEY` - Used to call Gemini API
   - `LICENSE_EMAIL` - User email
   - `LICENSE_TOKEN` - License validation token

2. **CLIENT sends to SERVER:**
   - `action: 'gm'`
   - `email` - For license validation
   - `token` - For license validation
   - `apiKey` - Passed through to Gemini API call
   - `prompt` - User's question

3. **SERVER validates:**
   - ✅ License is valid
   - ✅ Rate limit not exceeded
   - ✅ API key is present

4. **SERVER calls Gemini:**
   - Uses `apiKey` provided by CLIENT
   - Processes response (markdown conversion)
   - Caches result

### Key Points

- **Gemini API key stays on CLIENT** - Never stored on SERVER
- **License token checked on SERVER** - Prevents unauthorized use
- **Credentials passed per-request** - Not stored anywhere long-term
- **Rate limiting on SERVER** - Prevents abuse

## Troubleshooting

### GM() returns "Error: ..." instead of response

1. Check logs: `Menu → 🤖 Table AI → 📋 Logs`
2. Verify license: `Menu → 🤖 Table AI → 🔍 Check License Status`
3. Verify Gemini key is set: `Menu → 🤖 Table AI → 📝 Gemini: Set API Key`
4. Check SERVER status with self-test: `Menu → 🤖 Table AI → 🧪 DEV: Self Test`

### GM() is very slow

1. Check if you're hitting rate limit (see logs)
2. Reduce `maxTokens` parameter
3. Use GM_IF to avoid unnecessary calls
4. Wait for cache to fill (second call is faster)

### Different responses each time

1. Increase cache TTL (currently 6 hours)
2. Reduce `temperature` parameter (lower = more consistent)
3. Use `temperature: 0` for deterministic results

## Implementation Details

### CLIENT-side (Main_v3_REFACTORED.gs)

```javascript
function GM(prompt, maxTokens = 25000, temperature = 0.7) {
  // 1. Validate license
  // 2. Check cache
  // 3. Call serverGM_() to contact SERVER
  // 4. Process and cache response
  // 5. Return result
}

function serverGM_(prompt, maxTokens, temperature) {
  // Send {action: 'gm', email, token, apiKey, prompt, ...} to SERVER
  // Return {ok: true/false, data: "response", error: "..."}
}
```

### SERVER-side (Server_v3_IMPROVED.gs)

```javascript
case 'gm': {
  // 1. Extract prompt, params from request
  // 2. Validate license (email, token)
  // 3. Check rate limit
  // 4. Try cache first
  // 5. If not cached: call Gemini API
  // 6. Process markdown
  // 7. Cache result
  // 8. Return {ok: true, data: response}
}
```

## Code Examples

### Basic Analysis

```excel
=GM("Analyze this sentence: " & A1)
```

### Conditional Processing

```excel
=IF(LEN(B1) > 100, GM_IF(B1 <> "", "Summarize this text in 100 words: " & B1), B1)
```

### Multi-step Processing

```excel
Column A: Original text
Column B: =GM_IF(A2 <> "", "Extract key points from: " & A2, 500)
Column C: =GM_IF(B2 <> "", "Rate the sentiment: " & B2 & " (1-10)")
Column D: =IF(C2 > 7, GM_IF(C2 > 7, "This is positive. Generate 3 follow-up ideas"), "No follow-up needed")
```

### Template with Config

```excel
Config cells:
  A1: Temperature (e.g., 0.5)
  A2: Max Tokens (e.g., 1000)

Formula:
  =GM("Analyze: " & B1, $A$2, $A$1)
```

## Version Info

- **File:** `deploy/Main_v3_REFACTORED.gs`
- **Functions Added:** GM(), GM_IF(), gmCacheKey_(), gmCacheGet_(), gmCachePut_(), serverGM_()
- **Architecture:** v3.0.1 CLIENT-SERVER separation
- **Status:** Production-ready
- **Last Updated:** October 2025

## See Also

- [Architecture Plan](ARCHITECTURE_PLAN_ACTUAL.md)
- [Data Flow Verification](DATA_FLOW_ARCHITECTURE_VERIFIED.md)
- [Server Implementation](deploy/Server_v3_IMPROVED.gs)
- [Shared Utilities](deploy/SHARED_UTILITIES_v3.gs)
