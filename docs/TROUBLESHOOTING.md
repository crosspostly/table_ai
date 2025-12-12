# Troubleshooting Guide - Table AI

**Version:** 3.5.2+  
**Last Updated:** December 2025

This guide helps you diagnose and fix common issues with Table AI.

---

## Table of Contents

- [API & Rate Limiting Issues](#api--rate-limiting-issues)
- [License Problems](#license-problems)
- [OTA Update Issues](#ota-update-issues)
- [Gemini API Errors](#gemini-api-errors)
- [UI & Configuration Issues](#ui--configuration-issues)
- [Performance Problems](#performance-problems)
- [Debugging Tools](#debugging-tools)

---

## API & Rate Limiting Issues

### 429 Error: Rate Limit Exceeded

**Symptom:** You see "Error 429: Resource has been exhausted" or "Rate limit exceeded"

**Causes:**
- Hit Gemini API daily quota (20 requests/day on free tier)
- Too many requests per minute (10 RPM limit)
- Token limit exceeded (250k tokens/minute)

**Solutions:**

#### 1. Check Current Usage
```javascript
// Extensions → Apps Script → Console
logTripleRateLimiterStatus()
```

This shows:
- Current RPD usage (e.g., 18/20)
- Which key is active
- Status of all keys

#### 2. Wait for Quota Reset
Free tier limits reset at **midnight Pacific Time** (not UTC).

- **RPD:** Resets daily at 00:00 PT
- **RPM:** Resets every minute
- **TPM:** Resets every minute

#### 3. Use Multi-Key Rotation (Recommended)

Set up 6 API keys to get 120 RPD instead of 20:

**Step 1:** Create a sheet named `api_gem` in license spreadsheet:

| A | B | C |
|---|---|---|
| api_key_1 | AIzaSy...full-key... | ACTIVE |
| api_key_2 | AIzaSy...full-key... | ACTIVE |
| api_key_3 | AIzaSy...full-key... | ACTIVE |
| api_key_4 | AIzaSy...full-key... | ACTIVE |
| api_key_5 | AIzaSy...full-key... | ACTIVE |
| api_key_6 | AIzaSy...full-key... | ACTIVE |

**Step 2:** Server will automatically rotate keys when one hits limit

**Step 3:** Monitor in `API_METRICS` sheet

#### 4. Upgrade to Paid Tier

Google AI Studio paid tier removes most limits:
- 10,000 RPM (vs 10 on free)
- No daily limit
- Higher token limits

#### 5. Implement Exponential Backoff

If you're getting 429 errors frequently, increase retry delays in `reniewcell.gs`:

```javascript
// Current: 1s, 2s, 4s = 7s total
// Change to: 4s, 8s, 16s = 28s total
Math.pow(2, attempt + 2) * 1000
```

---

### 503 Error: Service Unavailable

**Symptom:** "Error 503: The service is currently unavailable"

**Cause:** Gemini API is temporarily down or experiencing issues

**Solutions:**
1. Check [Google AI Studio status](https://status.cloud.google.com/)
2. Wait 5-10 minutes and retry
3. Check Twitter/X for @GoogleAI announcements
4. Use exponential backoff with longer delays

---

### Quota Exhausted Across All Keys

**Symptom:** "ALL_KEYS_EXHAUSTED" in logs

**Cause:** All 6 API keys have hit their daily quota (120 requests total)

**Solutions:**
1. **Wait until midnight PT** - all keys reset simultaneously
2. **Add more keys** - System supports up to 10 keys
3. **Optimize prompts** - Reduce unnecessary API calls:
   - Use caching where possible
   - Batch process data
   - Remove redundant requests
4. **Upgrade to paid tier**

---

## License Problems

### "LICENSE_NOT_FOUND" Error

**Symptom:** Cannot use features, error says license not found

**Checks:**
1. Email is correct in Settings
2. Token is correct in Settings
3. Email/token combo exists in license spreadsheet

**Fix:**
```javascript
// Menu: ⚙️ Настройки
// Verify:
// - Email: user@example.com
// - Token: abc123...

// Or check in console:
Logger.log(getLicenseEmail());
Logger.log(getLicenseToken());
```

---

### "LICENSE_EXPIRED" Error

**Symptom:** License was working, now expired

**Check expiration:**
```javascript
// Menu: 🤖 Table AI → Check License Status
// Shows: "License valid until: 2025-12-31"
```

**Fix:**
1. Contact administrator to extend license
2. Purchase new license
3. Update token in Settings after renewal

---

### "NO_COPIES_LEFT" Error

**Symptom:** Cannot create more copies of spreadsheet

**Cause:** License has 0 copies remaining

**Check:**
```sql
-- In license spreadsheet, check "copies_count" column
```

**Fix:**
1. Delete unused copies (frees up slots)
2. Purchase additional copies
3. Contact administrator to increase limit

---

### "Script ID Not in Bindings" Error

**Symptom:** OTA updates fail, license check says script not bound

**Cause:** Script ID not registered in Bindings sheet

**Check:**
```javascript
// Console:
Logger.log(ScriptApp.getScriptId());
```

Then check if this ID exists in license spreadsheet's "Bindings" sheet.

**Fix:**
1. Open spreadsheet once (triggers auto-bind)
2. Or manually add to Bindings sheet:
   - Email: user@example.com
   - sheet_id: [spreadsheet ID]
   - script_id: [script ID]
   - created_at: [timestamp]

---

## OTA Update Issues

### Update Check Fails

**Symptom:** Manual update says "Cannot check for updates"

**Debug:**
```javascript
// Console:
debugOTAFlow()
```

**Common causes:**

#### 1. Server Unreachable
```javascript
// Check server URL:
Logger.log(SERVER_URL);

// Test connection:
testServerConnection();
```

**Fix:** Verify SERVER_URL is correct in Main.gs

#### 2. License Issue
```javascript
// Check license:
debugGeminiKeys();
```

**Fix:** Ensure email and token are set correctly

#### 3. Network Issue
**Symptoms:**
- "Exception: Request failed" in logs
- Timeout errors

**Fix:**
- Check internet connection
- Try again in 5 minutes
- Check Google Apps Script status

---

### Update Download Fails

**Symptom:** "DOWNLOAD_FAILED" error during update

**Causes:**
1. GitHub repository inaccessible
2. Files missing from /deploy/ folder
3. Private repo without PAT token

**Check:**
```bash
# Verify files exist:
https://github.com/crosspostly/table_ai/tree/main/deploy
```

**Fix for Private Repo:**
```javascript
// Server console:
setGithubPAT_('ghp_YOUR_GITHUB_TOKEN');

// In server.gs:
const REPO_IS_PUBLIC = false;  // Change to false
```

---

### Update Apply Fails

**Symptom:** "UPDATE_FAILED" after downloading files

**Causes:**
1. Apps Script API not enabled
2. Server lacks permission to update client
3. Script ID mismatch

**Check permissions:**
1. Google Cloud Console
2. Enable "Apps Script API"
3. Verify OAuth scopes include script editing

**Fix:**
```javascript
// Verify script ID:
Logger.log(ScriptApp.getScriptId());

// Check Bindings sheet has correct script_id
```

---

### Backward Compatibility Issue

**Symptom:** Old client (v3.4.x) cannot update

**Cause:** Deprecated function `checkForUpdates_()` not found

**Fix:** This is already fixed in v3.5.2+. If still seeing error:

1. Manually copy new code from GitHub
2. Or use server-side force update:
```javascript
// Server console:
applyUpdatesToClient_(token, email, scriptId, spreadsheetId, true)
```

---

## Gemini API Errors

### "NO_API_KEY_AVAILABLE" Error

**Symptom:** Cannot make Gemini requests

**Cause:** No API key configured anywhere (personal, sheet, server)

**Check:**
```javascript
// Console:
debugGeminiKeys()
```

Shows key status at all 3 levels.

**Fix:**

#### Option 1: Personal Key (Recommended)
```
Menu: ⚙️ Настройки
Enter: Gemini API Key
Save
```

#### Option 2: Sheet-Level Key
```javascript
// Console:
PropertiesService.getScriptProperties()
  .setProperty('GEMINI_API_KEY', 'AIza...');
```

#### Option 3: Server Key (Admin Only)
```javascript
// Server console:
setDefaultGeminiKey_('AIza...');
```

---

### Prompt Too Long Error

**Symptom:** "Error: Prompt exceeds maximum length"

**Cause:** Prompt > 50,000 characters

**Fix:**
1. Reduce prompt length
2. Split into multiple requests
3. Summarize input data first
4. Use prompt compression techniques

---

### Invalid Response Format

**Symptom:** Response is garbled or incomplete

**Possible causes:**
1. Network interruption during response
2. Token limit hit mid-response
3. Gemini API issue

**Fix:**
1. Retry the request
2. Reduce maxTokens parameter
3. Check response in logs:
```javascript
showLogsDialog()
// Look for "Gemini response:" entries
```

---

### Image OCR Fails

**Symptom:** OCR returns "Error processing image"

**Causes:**
1. Image format not supported (HEIC, WebP)
2. Image too large (>4MB)
3. Image base64 encoding issue

**Fix:**
1. Convert to PNG or JPEG
2. Resize image to <2MB
3. Verify base64 encoding:
```javascript
// Check image data:
Logger.log(imageData.substring(0, 100));
```

---

## UI & Configuration Issues

### AI Constructor Not Loading

**Symptom:** UI shows blank or doesn't open

**Check:**
```javascript
// Console:
openCollectConfigUI()
// Check for errors in logs
```

**Causes:**
1. HTML file corrupted
2. JavaScript error in UI
3. Missing dependencies

**Fix:**
1. Check browser console (F12)
2. Clear Apps Script cache:
   - Close spreadsheet
   - Wait 5 minutes
   - Reopen
3. Verify CollectConfigUi.html exists

---

### Template Not Saving

**Symptom:** "Template save failed" error

**Causes:**
1. Template name too long
2. Config too large (>8KB)
3. Total templates exceed limit (500KB)

**Check size:**
```javascript
serverGetTemplatesStats()
// Shows: count, totalSize, maxSize
```

**Fix:**
1. Use shorter template names
2. Simplify configuration
3. Delete old unused templates:
```javascript
serverDeleteTemplate('Old Template Name')
```

---

### Prompt Table Not Working

**Symptom:** Remote prompt not loading

**Check:**
```javascript
// In AI Constructor UI:
// Verify:
// - Spreadsheet ID is correct
// - Sheet name exists
// - Cell address is valid
```

**Access check:**
1. Open remote spreadsheet manually
2. Verify you have access
3. Check sheet name spelling
4. Verify cell has content

**Fix:**
```javascript
// Test direct access:
SpreadsheetApp.openById('1abc123...').getSheetByName('Промты').getRange('B2').getValue()
```

If error: sharing/permission issue with remote sheet

---

## Performance Problems

### Slow Response Time

**Symptom:** Requests take >10 seconds

**Causes:**
1. Large prompt
2. High maxTokens
3. Server overload
4. Network latency

**Optimize:**

#### 1. Reduce Prompt Size
```javascript
// Before: 10,000 chars
// After: 2,000 chars (summarize first)
```

#### 2. Lower maxTokens
```javascript
// Before: maxTokens = 25000
// After: maxTokens = 5000
```

#### 3. Use Caching
```javascript
// Check if already processed:
const cached = getCachedResult(key);
if (cached) return cached;
```

---

### High Memory Usage

**Symptom:** "Exceeded maximum execution time" or memory errors

**Causes:**
1. Processing too much data at once
2. Large arrays in memory
3. Inefficient loops

**Fix:**

#### Batch Processing
```javascript
// Before: Process 1000 rows at once
// After: Process 100 rows per batch

for (let i = 0; i < data.length; i += 100) {
  const batch = data.slice(i, i + 100);
  processBatch(batch);
  Utilities.sleep(1000); // Rate limiting
}
```

#### Use Range Values
```javascript
// Before: getValue() in loop (slow)
for (let i = 0; i < 100; i++) {
  const val = sheet.getRange(i, 1).getValue();
}

// After: getValues() once (fast)
const values = sheet.getRange(1, 1, 100, 1).getValues();
for (let i = 0; i < values.length; i++) {
  const val = values[i][0];
}
```

---

## Debugging Tools

### Show Logs
```javascript
// Menu: 🧰 DEV → 📝 Показать логи
// Or console:
showLogsDialog()
```

### Export Logs
```javascript
// Menu: 🧰 DEV → ⬇️ Экспорт логов
// Creates "Логи" sheet with all logs
exportLogsToSheet()
```

### Debug OTA
```javascript
// Console:
debugOTAFlow()      // Full OTA diagnostic
debugOTAStatus()    // Quick status check
```

### Debug Gemini Keys
```javascript
// Console:
debugGeminiKeys()   // Shows all 3 key levels
```

### Test Server Connection
```javascript
// Console:
testServerConnection()  // Ping server
```

### Check Rate Limiter
```javascript
// Console:
logTripleRateLimiterStatus()  // Multi-key status
```

### Dev Self Test
```javascript
// Menu: 🧰 DEV → 🧪 Dev Self Test
// Tests all major systems
runDevSelfTest()
```

---

## Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `NO_API_KEY_AVAILABLE` | No Gemini key configured | Set API key in Settings |
| `LICENSE_EXPIRED` | License no longer valid | Renew license |
| `LICENSE_NOT_FOUND` | Email/token not in system | Check credentials |
| `RATE_LIMIT_EXCEEDED` | Too many API calls | Wait or use multi-key |
| `QUOTA_EXCEEDED` | Daily quota hit | Wait until midnight PT |
| `ALL_KEYS_EXHAUSTED` | All keys hit quota | Wait or add more keys |
| `NO_SCRIPT_ID` | Script not in Bindings | Open sheet to auto-bind |
| `DOWNLOAD_FAILED` | Cannot get files from GitHub | Check repo access |
| `UPDATE_FAILED` | Cannot update script | Check permissions |
| `INVALID_PROMPT` | Prompt empty or too long | Fix prompt length |
| `NETWORK_ERROR` | Cannot reach server | Check connection |
| `TEMPLATE_TOO_LARGE` | Template exceeds 8KB | Simplify config |
| `TOO_MANY_TEMPLATES` | Hit 50 template limit | Delete old templates |

---

## Still Having Issues?

### 1. Check Logs First
```javascript
showLogsDialog()  // or exportLogsToSheet()
```

### 2. Run Diagnostics
```javascript
debugOTAFlow()
debugGeminiKeys()
testServerConnection()
```

### 3. Gather Information
- Current version (check in Update dialog)
- Error message (exact text)
- Logs (export to sheet)
- Timestamps (when did it start)

### 4. Get Help

- **GitHub Issues:** [Create an issue](https://github.com/crosspostly/table_ai/issues)
- **VK:** [@daoqub](https://vk.com/daoqub)
- **Email:** Include logs and diagnostic output

---

## Preventive Maintenance

### Weekly Checks
1. Review logs for warnings
2. Check rate limit usage
3. Verify license expiration date
4. Test OTA updates manually

### Monthly Tasks
1. Clean up old templates
2. Archive old logs
3. Review API usage patterns
4. Update to latest version

### Best Practices
1. Enable automatic updates
2. Use multi-key rotation
3. Monitor rate limits
4. Keep personal API key set
5. Regularly export important data

---

**Need More Help?**
- [API Reference](API.md)
- [OTA Updates Guide](OTA_UPDATES.md)
- [Architecture](ARCHITECTURE.md)
- [Developer Guide](DEVELOPER_GUIDE.md)

---

**Last Updated:** December 2025  
**Version:** 3.5.2+
