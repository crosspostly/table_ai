# OTA Logging System Enhancement - v3.5.2+

## Summary of Changes

This document describes the comprehensive logging system added to diagnose and troubleshoot OTA (Over-The-Air) update failures.

**Problem**: Previously, when OTA updates failed, there were insufficient logs to determine where exactly the process broke.

**Solution**: Added detailed, step-by-step logging at every stage of the OTA pipeline with timestamps, parameters, response codes, and error details.

## Files Modified

### 1. `/deploy/Main.gs` - Client-side OTA Functions

#### Enhanced `checkForUpdatesBackground_()`
- **Before**: 3 log lines total
- **After**: 40+ log lines with full details

**What logs are now captured**:
- Client version
- License email/token status
- Script ID and Spreadsheet ID
- Server URL
- HTTP request payload (sanitized)
- HTTP response code
- HTTP response body (first 200 chars)
- Parsed response fields: `ok`, `updateAvailable`, `clientVersion`, `serverVersion`
- Error details with stack traces
- Timing information

**Example output**:
```
🌙 Background update check started
📱 CLIENT_VERSION: 3.5.2
📌 STEP 1: Sending checkUpdates request to server...
   📧 Email: ***
   🔑 Token: SET (45 chars)
   📄 ScriptId: AKfyc...
   📊 SpreadsheetId: ***
   📨 Payload: {...}
   🌐 SERVER_URL: https://...
   ✉️ Response code: 200
   📦 Response body: {"ok":true,...}
   ✅ Parsed response:
      - ok: true
      - updateAvailable: true
      - clientVersion: 3.5.2
      - serverVersion: 3.6.0
```

#### Enhanced `checkForUpdatesManual_()`
- Added logging for user-triggered checks
- Logs user confirmation/rejection decisions
- Better error messages with context

### 2. `/deploy/server.gs` - Server-side OTA Handler

#### Enhanced OTA case in `doPost()`
- **Before**: 2 log lines
- **After**: 15+ structured log lines

**What logs are now captured**:
- OTA request received notification
- Subaction type (checkUpdates or applyUpdates)
- Email, Token, ScriptId, SpreadsheetId status
- License check result and timing
- Version check results
- Final OTA result with success/error status

**Example output**:
```
═══════════════════════════════════════════════════════════════
⭐ OTA REQUEST RECEIVED
═══════════════════════════════════════════════════════════════
📌 Subaction: checkUpdates
📧 Email: SET
🔑 Token: SET (length: 45)
📄 ScriptId: AKfyc...
📊 SpreadsheetId: SET

📌 STEP: checkUpdates
📱 Client version: 3.5.2
🖥️ Server version: 3.6.0
✅ Version check result: {"ok":true,"updateAvailable":true,...}
═══════════════════════════════════════════════════════════════
```

### 3. `/deploy/ota_updates.gs` - OTA Core Logic

#### Enhanced `applyUpdatesToClient_()`
- Added comprehensive timing for each step
- Detailed parameter logging at start
- Full process breakdown:
  - License validation timing
  - File download timing
  - Script update timing
- Structured error reporting with timestamps

**Example output**:
```
═══════════════════════════════════════════════════════════════
🚀 СЕРВЕР ОБНОВЛЯЕТ КЛИЕНТА
═══════════════════════════════════════════════════════════════
⏱️ Started at: 2024-01-15T10:30:45.123Z
📋 Parameters:
   📧 Email: SET
   🔑 Token: SET (length: 45)
   📄 ClientScriptId: AKfyc...
   📊 SpreadsheetId: SET
   🔓 Public repo: true

📌 STEP 1: Validating license...
   ✅ License check completed in 150ms
   📋 License result: {"ok":true}

📌 STEP 2: Downloading files from GitHub...
   📥 Starting download of all client files
   🌐 Repo: crosspostly/table_ai
   🌳 Branch: main
   🔓 Public repo: true
   📦 Files to download: 12
   
   [1/12] Main.gs...
      ✉️ HTTP 200
      ✅ Downloaded: 45231 bytes
   [2/12] CollectConfig.gs...
      ✉️ HTTP 200
      ✅ Downloaded: 23456 bytes
   ... (more files)
   
   ✅ All files downloaded successfully!
   ✅ Success: 12
   ❌ Failed: 0
   📦 Total files: 12

📌 STEP 3: Updating client script...
   🔧 Updating client script...
   📄 Client Script ID: AKfyc...
   📦 Files to update: 12
   🔐 OAuth token: SET (length: 245)
   📨 Payload size: 892345 bytes
   ✉️ Response code: 200
   ✅ Client script updated successfully!

📌 STEP 4: Logging success...
   ✅ Success logged

═══════════════════════════════════════════════════════════════
🎉 ✅ CLIENT SUCCESSFULLY UPDATED!
⏱️ Total time: 2450ms
   - License check: 150ms
   - File download: 1800ms
   - Script update: 500ms
═══════════════════════════════════════════════════════════════
```

#### Enhanced `downloadAllClientFiles_()`
- Logs repo config (URL, branch, path)
- Progress for each file with counter
- Per-file success/failure status
- Total success/failure count

#### Enhanced `downloadFileFromGithub_()`
- Logs repo type (public/private)
- Which download function will be used

#### Enhanced `downloadFromPublicRepo_()`
- Logs full GitHub URL
- HTTP response code
- Downloaded size
- Error responses (first 200 chars)

#### Enhanced `downloadFromPrivateRepo_()`
- Logs PAT availability
- GitHub API URL
- Authentication failure details
- Helpful hints for configuration

#### Enhanced `updateClientScript_()`
- Lists all files being updated
- Logs OAuth token availability
- Logs payload size
- Full response details
- Detailed error information

### 4. `/deploy/DevTools.gs` - Diagnostic Functions

#### New Function: `debugOTAStatus()`

A comprehensive diagnostic function that checks:

1. **Client Information**:
   - Client version
   - Script ID (first 12 chars)
   - Spreadsheet ID

2. **License Information**:
   - Email set/not set
   - Token present and length

3. **Server Information**:
   - Server URL
   - Server reachability test
   - Response code and body
   - Parsed response (if JSON)

4. **OTA Logs**:
   - Last 20 OTA-related log entries
   - Filtered from all logs

5. **Next Steps**:
   - Instructions for further diagnosis
   - Links to relevant documentation

**How to use**:
```javascript
// In Apps Script console
debugOTAStatus()

// View logs
View → Logs
```

## Log Format

All logs use emoji prefixes for quick visual scanning:

### Client Logs (addLog)
- 🌙 Night/background operation
- 📱 Client-specific info
- 📌 Step markers
- 📧 Email/identity
- 🔑 Tokens/authentication
- 📄 Script IDs
- 📊 Spreadsheet IDs
- 🌐 Network URLs
- ✉️ HTTP response codes
- 📦 Data packages
- ✅ Success indicators
- ❌ Failure/error indicators
- 🚀 Major milestones
- 🎉 Celebration/completion
- 💡 Helpful hints
- ⏱️ Timing information

### Server Logs (Logger)
- Same emoji system as above
- === separators for major sections
- Indentation for hierarchy

## Storage and Access

### Client Logs
- **Storage**: Google Apps Script Script Cache Service
- **TTL**: 24 hours
- **Max entries**: 300 (oldest removed first)
- **Access**: 
  - `View → Logs` in Apps Script editor
  - `Extensions → DEV → 📝 Показать логи` (if DEV mode)
  - `Extensions → DEV → ⬇️ Экспорт логов` (exports to sheet)

### Server Logs
- **Storage**: Google Apps Script Execution logs
- **TTL**: 5 minutes (standard Apps Script limit)
- **Access**: Apps Script editor → `View → Logs`

## Benefits

1. **Debugging**: Exactly identify where OTA process fails
2. **Performance**: Timing breakdown for each step
3. **Diagnosis**: Health check function for system status
4. **Transparency**: Users see detailed progress
5. **Documentation**: Logs serve as operation history
6. **Safety**: Sanitized sensitive data (token length not full token)

## Integration with Existing Code

- ✅ Backward compatible - uses existing `addLog()` function
- ✅ No breaking changes to OTA logic
- ✅ No additional dependencies
- ✅ Works with both public and private repos
- ✅ Works with both licensed and unlicensed users
- ✅ Minimal performance impact

## Testing

To test the enhanced logging:

1. **Manual update check**:
   ```
   Extensions → DEV → Обновить вручную
   ```
   Then view logs

2. **System diagnostic**:
   ```javascript
   // In console
   debugOTAStatus()
   ```

3. **View all logs**:
   ```
   Extensions → DEV → 📝 Показать логи
   ```

4. **Export logs**:
   ```
   Extensions → DEV → ⬇️ Экспорт логи
   ```
   Creates new "Логи" sheet

## Next Steps After Implementation

1. **Run tests** to ensure logging works
2. **Check logs** during test OTA update
3. **Review timing** to identify bottlenecks
4. **Document patterns** for future troubleshooting
5. **Update SLA/support docs** to reference new logging

## Reference

- Full troubleshooting guide: [`docs/OTA_LOGGING_GUIDE.md`](./OTA_LOGGING_GUIDE.md)
- OTA architecture: [`docs/OTA_UPDATES.md`](./OTA_UPDATES.md)
- Production deployment: [`docs/PRODUCTION_DEPLOY.md`](./PRODUCTION_DEPLOY.md)
