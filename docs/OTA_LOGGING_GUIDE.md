# OTA Logging & Troubleshooting Guide

## Overview

This document explains how to diagnose and troubleshoot OTA (Over-The-Air) update issues using the comprehensive logging system.

## Log Architecture

### Client Logs (Main.gs)
- **Storage**: Google Apps Script Cache Service
- **Access**: `View → Logs` in the Sheets interface
- **Functions**: 
  - `addLog()` - adds to cache + console.log
  - `getLogs()` - retrieves from cache
  - `showLogsDialog()` - displays dialog
  - `exportLogsToSheet()` - exports to "Логи" sheet

### Server Logs (server.gs)
- **Storage**: Google Apps Script Execution logs
- **Access**: Extensions → Apps Script → Execution log
- **View**: `View → Logs` in Apps Script editor

## OTA Update Flow

### Step-by-Step Flow

```
CLIENT                              SERVER
  │                                   │
  ├─ checkForUpdatesBackground_() ──→ │ [OTA REQUEST]
  │  └─ Prepare payload              │
  │  └─ POST to SERVER_URL           │
  │  └─ addLog() at each step        │
  │                                   │
  │                          ← JSON response ──┤
  │  ├─ Parse response                │
  │  ├─ Check updateAvailable         │
  │  └─ addLog() result               │
  │                                   │
  │ [If update available]             │
  │                                   │
  ├─ Send applyUpdates ──────────────→ │ [OTA REQUEST 2]
  │                                   │
  │                          doPost() ─┤
  │                          ├─ Parse payload
  │                          ├─ Check license
  │                          ├─ [If OK]
  │                          │  └─ applyUpdatesToClient_()
  │                          │     ├─ Download from GitHub
  │                          │     ├─ Update via API
  │                          │     └─ Log success
  │                          │
  │                    ← JSON result ──┤
  │  └─ Parse & addLog()
  │
```

## Logging Points

### Client-Side Logging (`checkForUpdatesBackground_()`)

```javascript
addLog('🌙 Background update check started', 'INFO');
addLog(`📱 CLIENT_VERSION: ${CLIENT_VERSION}`, 'DEBUG');

// Step 1: Check request
addLog('📌 STEP 1: Sending checkUpdates request...', 'INFO');
addLog(`   📧 Email: ${email ? '***' : 'NOT SET'}`, 'DEBUG');
addLog(`   🔑 Token: ...`, 'DEBUG');
addLog(`   📄 ScriptId: ...`, 'DEBUG');
addLog(`   📊 SpreadsheetId: ...`, 'DEBUG');
addLog(`   🌐 SERVER_URL: ${SERVER_URL}`, 'DEBUG');

// Response parsing
addLog(`   ✉️ Response code: ${respCode}`, 'DEBUG');
addLog(`   📦 Response body: ...`, 'DEBUG');
addLog(`   ✅ Parsed response:`, 'DEBUG');

// Step 2: Apply updates (if available)
addLog('🚀 Update available: ${check.clientVersion} → ${check.serverVersion}', 'INFO');
addLog('📌 STEP 2: Sending applyUpdates request...', 'INFO');

// Final result
addLog(`🎉 ✅ Successfully updated to ${update.version}!`, 'INFO');
addLog(`❌ Update failed: ${update.error}`, 'ERROR');
```

### Server-Side Logging (`server.gs`)

```javascript
// OTA case handler
Logger.log('⭐ OTA REQUEST RECEIVED');
Logger.log('📌 Subaction: ' + subaction);
Logger.log('📧 Email: ' + (email ? 'SET' : 'NOT SET'));

// checkUpdates
Logger.log('📌 STEP: checkUpdates');
Logger.log('📱 Client version: ' + clientVersion);
Logger.log('🖥️ Server version: ' + SERVER_VERSION);

// applyUpdates
Logger.log('📌 STEP: applyUpdates');
Logger.log('🔐 Checking license...');
```

### File Download Logging (`ota_updates.gs`)

```javascript
// Download all files
Logger.log('📥 Starting download of all client files');
Logger.log('   🌐 Repo: ' + OTA_CONFIG.REPO);
Logger.log('   🌳 Branch: ' + OTA_CONFIG.BRANCH);
Logger.log('   🔓 Public repo: ' + isPublicRepo);
Logger.log('   📦 Files to download: ' + OTA_CONFIG.CLIENT_FILES.length);

for (let i = 0; i < OTA_CONFIG.CLIENT_FILES.length; i++) {
  Logger.log('   [' + (i + 1) + '/' + count + '] ' + fileName + '...');
  
  // For each file
  Logger.log('      ✉️ HTTP ' + respCode);
  Logger.log('      ✅ Downloaded: ' + content.length + ' bytes');
}

// Update client script
Logger.log('🔧 Updating client script...');
Logger.log('   📄 Client Script ID: ...');
Logger.log('   📦 Files to update: ' + files.length);
Logger.log('   ✉️ Response code: ' + respCode);
Logger.log('✅ Client script updated successfully!');
```

## Viewing Logs

### Client Logs

#### Method 1: Via Extensions Menu
1. Open your Google Sheet
2. Click `Extensions → Apps Script`
3. Click `View → Logs`

#### Method 2: Via Custom Menu (if DEV mode)
1. Open your Google Sheet
2. Click `🧰 DEV → 📝 Показать логи`
3. Dialog appears with recent 100 logs

#### Method 3: Export to Sheet
1. Open your Google Sheet
2. Click `🧰 DEV → ⬇️ Экспорт логов`
3. New sheet "Логи" is created with all logs

### Server Logs

1. Open your server Apps Script (the web app)
2. Click `View → Logs`
3. See all Logger.log() output from server.gs

## Diagnostic Function: `debugOTAStatus()`

Run the OTA diagnostic function to see a complete system status:

### For Client
```javascript
// In browser console or Apps Script editor
debugOTAStatus()
```

This will log:
- Client version
- Script ID & Spreadsheet ID
- License email & token status
- Server reachability test
- Recent OTA logs
- Next steps

## Common Issues & Solutions

### Issue 1: "Update Failed: LICENSE_FAILED"

**Symptoms:**
- Log shows: `❌ License validation FAILED`
- `applyUpdates` request returns 403

**Diagnosis Steps:**
1. Run `debugOTAStatus()`
2. Check: "Token: SET (length: ...)" or "Token: NOT SET"
3. Check: "Email: ..." or "Email: NOT SET"

**Solutions:**
- Verify license is active
- Check `getLicenseToken()` returns valid token
- Check `getLicenseEmail()` returns valid email
- Run server's `checkLicense_()` directly

### Issue 2: "Update Failed: DOWNLOAD_FAILED"

**Symptoms:**
- Log shows: `❌ Download FAILED`
- Files from GitHub not downloaded

**Diagnosis Steps:**
1. Check server logs for `downloadAllClientFiles_()` output
2. Look for: `❌ Download FAILED` with filename
3. Check HTTP response code (404, 403, etc.)

**Solutions:**
- Verify GitHub repo is accessible
- Check `OTA_CONFIG.REPO` is correct
- If private repo: verify `REPO_IS_PUBLIC = false`
- If private repo: verify PAT is set via `setGithubPAT_()`

**For Public Repo:**
- URL should be: `https://raw.githubusercontent.com/crosspostly/table_ai/main/deploy/...`
- Verify file exists in GitHub repo

**For Private Repo:**
- Verify PAT: `Extensions → Console → getGithubPAT_()`
- Verify PAT has `repo` scope
- Set PAT: `setGithubPAT_('ghp_...')`

### Issue 3: "Update Failed: UPDATE_FAILED"

**Symptoms:**
- Files downloaded ✅
- Script update fails ❌
- Log shows: `❌ HTTP <error_code>` in `updateClientScript_()`

**Diagnosis Steps:**
1. Check server logs for `updateClientScript_()` output
2. Look for HTTP response code
3. Check OAuth token availability

**Possible HTTP Codes:**
- `401`: Authentication failed
- `403`: Permission denied
- `404`: Script not found
- `400`: Bad request (invalid JSON)
- `429`: Rate limited
- `500`: Server error

**Solutions:**
- Verify OAuth token has access to client script
- Verify `clientScriptId` is correct
- Check file format is valid JSON
- Check payload size is not too large

### Issue 4: "Network Error" or Cannot Reach Server

**Symptoms:**
- `❌ Error: Network error` in client logs
- Server URL not responding

**Diagnosis Steps:**
1. Run `debugOTAStatus()`
2. Check server response code
3. Verify server is deployed

**Solutions:**
- Verify `SERVER_URL` is correct
- Check server web app is published
- Check network connectivity
- Try manual test via browser

### Issue 5: Client Still on Old Version After Update

**Symptoms:**
- Update shows success ✅
- But `CLIENT_VERSION` didn't change
- Old scripts still running

**Diagnosis Steps:**
1. Check server logs show ✅ `Client script updated successfully!`
2. Refresh browser page
3. Check client script files in Apps Script editor

**Solutions:**
- Hard refresh: `Ctrl+Shift+R` (Cmd+Shift+R on Mac)
- Clear browser cache
- Wait 30 seconds (Apps Script cache)
- Manually refresh client script: `Extensions → Apps Script → Refresh`

## Logging Best Practices

### What to Include in Bug Reports

When reporting OTA issues, include:

1. **Full logs** (screenshot or export to sheet):
   ```
   [timestamp] LEVEL: message
   [timestamp] LEVEL: message
   ...
   ```

2. **Version info**:
   - Client version
   - Server version
   - Browser/OS

3. **Diagnostic output**:
   - Copy-paste from `debugOTAStatus()` logs
   - Server logs from same time period

4. **Timestamps**:
   - When update was triggered
   - Time in log messages

### Example: Complete Bug Report

```
CLIENT LOGS:
🌙 Background update check started
📱 CLIENT_VERSION: 3.5.2
📌 STEP 1: Sending checkUpdates request...
   🌐 SERVER_URL: https://script.google.com/macros/s/...
   ✉️ Response code: 200
   ✅ Parsed response:
      - ok: true
      - updateAvailable: true
      - serverVersion: 3.6.0
🚀 Update available: 3.5.2 → 3.6.0
📌 STEP 2: Sending applyUpdates request...
   ✉️ Response code: 403
❌ Update failed: LICENSE_FAILED

SERVER LOGS:
⭐ OTA REQUEST RECEIVED
📌 Subaction: applyUpdates
❌ License FAILED: Token expired
```

## Performance Monitoring

### Timing Breakdown

Server logs include timing for each step:

```
⏱️ Total time: 2450ms
   - License check: 150ms
   - File download: 1800ms
   - Script update: 500ms
```

### Expected Timings
- License check: 100-300ms
- File download: 1000-3000ms (depends on file size, network)
- Script update: 300-800ms

### Optimization Tips

If updates are slow:
1. Check network connectivity
2. Monitor GitHub rate limits
3. Check Apps Script API quotas
4. Consider caching file downloads

## Testing OTA Locally

### Manual Test: Check Updates

```javascript
// In client Apps Script console
checkForUpdatesManual_()
```

This triggers:
1. Dialog showing version check
2. If update available, ask user confirmation
3. If yes, call `checkForUpdatesBackground_()`
4. All steps logged with timestamps

### Manual Test: Full Diagnostic

```javascript
// In client Apps Script console
debugOTAStatus()

// Then view logs
// View → Logs (or 🧰 DEV → 📝 Показать логи)
```

### Manual Test: Server

```javascript
// In server Apps Script console
checkForUpdates_('3.5.2', '3.6.0')
// Should return: {ok: true, updateAvailable: true, ...}
```

## Performance Considerations

### Log Storage

- **Client logs**: Stored in Script Cache (6-hour TTL)
- **Server logs**: 5-minute execution log window
- **Max logs**: 300 entries (oldest auto-deleted)

### Export Large Logs

If logs exceed UI limits:
```javascript
// In client Apps Script console
exportLogsToSheet()
// Creates "Логи" sheet with all logs
```

## Debugging Checklist

- [ ] Verify client version with `CLIENT_VERSION`
- [ ] Check license token with `getLicenseToken()`
- [ ] Test server reachability: `debugOTAStatus()`
- [ ] View client logs: `🧰 DEV → 📝 Показать логи`
- [ ] View server logs: Apps Script editor → View → Logs
- [ ] Check GitHub repo accessibility
- [ ] Verify files exist in repo
- [ ] For private repo: check PAT is set
- [ ] Check `REPO_IS_PUBLIC` setting matches repo type
- [ ] Monitor timing to identify bottlenecks

## Additional Resources

- [OTA Updates Architecture](./OTA_UPDATES.md)
- [Backward Compatibility](./OTA_UPDATES.md#backward-compatibility)
- [Production Deployment](./PRODUCTION_DEPLOY.md)
- [GitHub PAT Setup](./OTA_UPDATES.md#setup-private-repo-with-github-pat)
