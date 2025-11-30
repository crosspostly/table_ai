# OTA Quick Reference Guide

Quick answers to common OTA questions.

## Q: How do I trigger an update?

### Automatic (Background)
Updates run automatically every 6 hours:
```
In Google Sheets → Extensions → Table AI → [Auto check runs]
```

### Manual (Immediate)
```
In Google Sheets → Extensions → 🧰 DEV → 🔄 Обновить вручную
```

A dialog will:
1. Check if update is available
2. Show current vs new version
3. Ask for confirmation
4. Update if you click "YES"

## Q: How do I know if an update is happening?

### While Updating
Logs are recorded in real-time:
```
Extensions → 🧰 DEV → 📝 Показать логи
```

You'll see:
```
🌙 Background update check started
📌 STEP 1: Sending checkUpdates request...
🚀 Update available: 3.5.2 → 3.6.0
📌 STEP 2: Sending applyUpdates request...
🎉 Successfully updated!
```

### Quick Status Check
```
Extensions → 🧰 DEV → (debug function)
// or in Apps Script console:
debugOTAStatus()
```

## Q: Update failed - what do I do?

### Step 1: Check Recent Logs
```
Extensions → 🧰 DEV → 📝 Показать логи
```

Look for error message like:
- ❌ LICENSE_FAILED
- ❌ DOWNLOAD_FAILED
- ❌ UPDATE_FAILED
- ❌ Network error

### Step 2: Run Diagnostic
```javascript
// In Apps Script console:
debugOTAStatus()

// Then view logs:
View → Logs
```

### Step 3: Share Logs with Support

Export logs to sheet:
```
Extensions → 🧰 DEV → ⬇️ Экспорт логи
```

This creates "Логи" sheet. Share with support team.

### Step 4: Check Server Logs

If it's a server issue:
1. Open server Apps Script
2. Click `View → Logs`
3. Look for errors starting with `❌`

## Q: What version am I on?

### In Google Sheet
```javascript
// In Apps Script console:
Logger.log('Version: ' + CLIENT_VERSION)
```

Or check update dialog:
```
Extensions → 🧰 DEV → 🔄 Обновить вручную
// Shows: Current: 3.5.2
```

## Q: Can I update manually without waiting?

**Yes!** Two options:

### Option 1: Manual Menu
```
Extensions → 🧰 DEV → 🔄 Обновить вручную
```
- Checks for updates
- Shows version comparison
- Updates if you confirm

### Option 2: Force Background Update
In Apps Script console:
```javascript
checkForUpdatesBackground_()
```

Then check logs:
```
View → Logs
```

## Q: What if the server is down?

### Check Server Status
```javascript
// In Apps Script console:
debugOTAStatus()
```

Look for:
```
Server response code: [number]
```

- 200 = Server OK
- 403 = License issue
- 503 = Server down
- "Cannot reach server" = Network issue

### If Server is Down
1. Automatic updates will retry
2. Try manual update again in 15 minutes
3. Contact support with `debugOTAStatus()` logs

## Q: Does the update happen automatically?

**Yes!** Every 6 hours:

1. Google Sheets runs scheduled trigger
2. Calls `checkForUpdatesBackground_()`
3. If new version available → downloads & updates
4. All logged (view with 📝 Показать логи)

**Note**: Update only happens if:
- License is valid
- Server is reachable
- New version is available
- No errors occur

## Q: Where are logs stored?

### Client Logs
- **Location**: Google Apps Script Script Cache
- **Duration**: 24 hours
- **Max entries**: 300
- **View**: `Extensions → 🧰 DEV → 📝 Показать логи`

### Server Logs
- **Location**: Server Apps Script Execution Log
- **Duration**: 5 minutes
- **View**: Server Apps Script → `View → Logs`

## Q: Can I disable automatic updates?

The update trigger is set up to run every 6 hours.

### To Disable
1. Open Google Sheet
2. Click `Extensions → Apps Script`
3. Click `Triggers` (left sidebar)
4. Find trigger: `checkForUpdatesBackground_`
5. Click to edit → Disable or Delete

### To Re-enable
1. Open Google Sheet
2. Menu: `⚙️ Коллект Конфиг → Запустить самозапуск`
3. Or call in console:
   ```javascript
   smartOTASetup()
   ```

## Q: What files are updated?

**12 client files** are updated:

```
Main.gs
CollectConfig.gs
TemplateService.gs
UnpackingViewer.gs
VK.gs
ocrRunV2_client.gs
reniewcell.gs
CollectConfigUi.html
SettingsUI.html
UnpackingViewerUI.html
logging_system.html
appsscript.json
```

Downloaded from GitHub repo and updated via Google Apps Script API.

## Q: Can I update from a private GitHub repo?

**Yes!** If admin has set it up:

1. Server admin sets GitHub PAT:
   ```javascript
   setGithubPAT_('ghp_...')
   ```

2. Server sets repo type:
   ```javascript
   const REPO_IS_PUBLIC = false
   ```

3. Redeploy server

Then clients can update from private repo.

## Q: How long does an update take?

Typical timing:
- **License check**: 100-300ms
- **Download files**: 1-3 seconds (GitHub)
- **Update script**: 300-800ms
- **Total**: 2-5 seconds

Monitor in logs:
```
⏱️ Total time: 2450ms
   - License check: 150ms
   - File download: 1800ms
   - Script update: 500ms
```

## Q: Is the update safe?

**Yes!** The process:

1. ✅ License validation
2. ✅ Download from authorized source (GitHub)
3. ✅ Validation via Apps Script API
4. ✅ All steps logged
5. ✅ Rollback available (revert to old version)

No data loss. Only scripts updated.

## Q: I see "LICENSE_FAILED" error

**Cause**: License token expired or invalid

**Fix**:
1. Check if license is still active
2. Log out and back in
3. Get new license token
4. Try update again

**Debug**:
```javascript
debugOTAStatus()
// Check: Token: SET or NOT SET
```

## Q: I see "DOWNLOAD_FAILED" error

**Cause**: Cannot download files from GitHub

**Checks**:
1. Is GitHub repo accessible?
   ```
   https://github.com/crosspostly/table_ai
   ```

2. Are files in correct location?
   ```
   /deploy/Main.gs, /deploy/CollectConfig.gs, etc.
   ```

3. If private repo:
   - Check GitHub PAT is set
   - Check PAT has access to repo

## Q: I see "UPDATE_FAILED" error

**Cause**: Cannot update the Apps Script

**Checks**:
1. Does server have permission to update client?
2. Is client Script ID correct?
3. Check HTTP error code in server logs:
   - 403 = Permission denied
   - 404 = Script not found
   - 500 = Server error

## Helpful Commands

### View Client Logs
```javascript
getLogs(100)  // Last 100 logs
showLogsDialog()  // Show dialog
exportLogsToSheet()  // Create "Логи" sheet
clearLogs()  // Clear all logs
```

### Test Connection
```javascript
testServerConnection()  // Test server
debugOTAStatus()  // Full diagnostic
debugOTAFlow()  // Test OTA flow
```

### Manual Operations
```javascript
checkForUpdatesManual_()  // Manual check
checkForUpdatesBackground_()  // Force background check
```

### Server Operations (server console)
```javascript
checkForUpdates_('3.5.2', '3.6.0')  // Version check
applyUpdatesToClient_(token, email, scriptId, spreadId, true)
setGithubPAT_('ghp_...')  // Set PAT for private repo
getGithubPAT_()  // Get current PAT
```

## Links

- **Full Logging Guide**: [OTA_LOGGING_GUIDE.md](./OTA_LOGGING_GUIDE.md)
- **Architecture Details**: [OTA_UPDATES.md](./OTA_UPDATES.md)
- **What's New**: [OTA_LOGS_ADDED.md](./OTA_LOGS_ADDED.md)
- **Production Deploy**: [PRODUCTION_DEPLOY.md](./PRODUCTION_DEPLOY.md)

## Still Need Help?

When requesting support, include:

1. **Update logs**:
   ```
   Extensions → 🧰 DEV → ⬇️ Экспорт логи
   ```

2. **Diagnostic output**:
   ```javascript
   debugOTAStatus()
   // Copy from View → Logs
   ```

3. **Server logs** (if available):
   ```
   Server Apps Script → View → Logs
   ```

4. **Timestamp** when issue occurred

5. **Current version**:
   ```javascript
   CLIENT_VERSION
   ```
