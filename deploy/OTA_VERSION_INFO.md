# 📦 OTA Version Info

Quick reference for OTA versioning system.

## Current Versions

### Server
```javascript
// File: deploy/server.gs
const SERVER_VERSION = '3.1.0';
```

### Client
```javascript
// File: deploy/Main.gs
const CLIENT_VERSION = '3.1.0';
```

## Update Triggers

Update is available when: `SERVER_VERSION !== CLIENT_VERSION`

Example:
```
If SERVER_VERSION = '3.2.0' and CLIENT_VERSION = '3.1.0'
→ updateAvailable = true
→ Update will be downloaded and applied
```

## Version Format

All versions follow semantic versioning: `X.Y.Z`
- X = Major version (breaking changes)
- Y = Minor version (new features)
- Z = Patch version (bug fixes)

Example progression:
```
3.1.0 → 3.1.1 (patch fix)
3.1.1 → 3.2.0 (new feature)
3.2.0 → 4.0.0 (major refactor)
```

## How to Release a New Version

### 1. Update Version in server.gs
```javascript
// Before:
const SERVER_VERSION = '3.1.0';

// After:
const SERVER_VERSION = '3.1.1';  // or 3.2.0, 4.0.0, etc.
```

### 2. Commit to GitHub
```bash
git add deploy/server.gs
git commit -m "Release: OTA v3.1.1"
git push origin main
```

### 3. Deploy Server
```
Extensions → Apps Script
Deploy → New Deployment → Web app
```

### 4. Verify
```
All users will get update at 3:00 AM
Check email notifications for confirmation
```

## Checking Current Versions

### In Script
```javascript
// Get server version (server.gs)
Logger.log(SERVER_VERSION);  // '3.1.0'

// Get client version (Main.gs)
Logger.log(CLIENT_VERSION);  // '3.1.0'
```

### In Logs
```
🧰 DEV → 📝 Показать логи
Search for: "OTA check: client=", "version"
```

### In Email
```
Email subject: ✅ Table AI обновлён до версии X.Y.Z
Shows new version and previous version
```

## Files Updated

When version increments, these 12 files are updated:

1. Main.gs (client code)
2. CollectConfig.gs
3. TemplateService.gs
4. UnpackingViewer.gs
5. VK.gs
6. ocrRunV2_client.gs
7. reniewcell.gs
8. CollectConfigUi.html
9. SettingsUI.html
10. UnpackingViewerUI.html
11. logging_system.html
12. appsscript.json

All downloaded from: `https://raw.githubusercontent.com/crosspostly/table_ai/main/deploy/`

## Version History

| Version | Date | Changes | Client Update |
|---------|------|---------|---|
| 3.1.0 | 2024-11-29 | Initial OTA implementation | Auto at 3:00 AM |

## Troubleshooting

### Version mismatch?
```
Check: Extensions → Apps Script → Main.gs
Search for: CLIENT_VERSION
```

### Update not working?
```
1. Check SERVER_VERSION > CLIENT_VERSION
2. Verify server.gs deployed as Web App
3. Check logs: 🧰 DEV → 📝 Показать логи
4. Review: deploy/OTA_UPDATES_GUIDE.md
```

### Need to rollback?
```
1. Revert SERVER_VERSION to previous value
2. Deploy server.gs again
3. Users will get rollback at 3:00 AM
```

---

**For details:** See `OTA_UPDATES_GUIDE.md`
**For testing:** See `OTA_TESTING_GUIDE.md`
**For full info:** See `OTA_IMPLEMENTATION_SUMMARY.md`
