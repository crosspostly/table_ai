# Production Deployment Guide

> **COMPLETE GUIDE FOR DEPLOYING TABLE AI TO PRODUCTION**

## Overview

Table AI is split into two independent Apps Script projects:
- **CLIENT** (`deploy/Main.gs`) - Container-bound script for Google Sheets
- **SERVER** (`deploy/server.gs`) - Standalone Web App for backend

This guide covers how to prepare both for production deployment and remove all development tools.

## 🎯 Pre-Deployment Checklist

### 1. Client-Side Cleanup

#### Remove Development Tools
```bash
# 1. Delete the development tools file
rm deploy/DevTools.gs

# 2. Verify .claspignore excludes DevTools.gs
cat .claspignore | grep "DevTools"
# Should see: "DevTools.gs"

# 3. Deploy client (without DevTools.gs)
clasp push --force
```

#### Verify Production Configuration
After deployment, verify in Google Apps Script editor:
- ✅ No `DevTools.gs` file in project
- ✅ `Main.gs` does NOT have DEV constants (`DEV_MODE`, `DEVMODE`)
- ✅ `Main.gs` does NOT have DEV functions
- ✅ Menu does NOT show "🧰 DEV" section
- ✅ No console errors about missing `debugGeminiKeys()` or `runDevSelfTest()`

#### Test Client Functionality
1. Open Google Sheet with Table AI
2. Check that main menu appears: "🤖 Table AI" ✅
3. Check that DEV menu is NOT present ✅
4. Test basic functions (e.g., "🎯 AI Конструктор") ✅
5. Check logs: no errors about missing functions ✅

### 2. Server-Side Verification

#### Check Configuration
Review `deploy/server.gs`:
```javascript
const REPO_IS_PUBLIC = true; // or false for private repo
const SERVER_VERSION = '3.5.0';
```

#### Deploy Server (if needed)
```bash
# If server.gs was updated
clasp push --force

# Verify deployment
curl "https://script.google.com/macros/s/[SERVER_SCRIPT_ID]/exec?test=ping"
```

#### Test Server Connectivity
In Google Sheets, run menu: `🤖 Table AI → ⚙️ Настройки`
- License status should work ✅
- No connection errors ✅

### 3. Clean Up Before Final Push

```bash
# 1. Verify no DEV files are committed
git status

# Should NOT show:
# - deploy/DevTools.gs
# - deploy/DevToolsServer.gs (if created)

# 2. Stage only production code
git add deploy/Main.gs deploy/server.gs .claspignore

# 3. Verify what will be committed
git diff --cached

# 4. Commit with proper message
git commit -m "chore: remove dev tools from production deployment"

# 5. Push to production branch
git push origin production
```

## 🔧 Development vs Production

### What's Different?

| Feature | DEV | PRODUCTION |
|---------|-----|-----------|
| DEV Menu | ✅ Present | ❌ Absent |
| DEV Logging | ✅ Verbose | ❌ Essential only |
| Fallback (Direct Gemini) | ✅ Available | ❌ Server-only |
| Self-tests | ✅ Available | ❌ Removed |
| Debug functions | ✅ Available | ❌ Removed |
| File: DevTools.gs | ✅ Present | ❌ Deleted |

### Keeping DEV Tools During Development

If you want to keep development tools active:

```javascript
// In deploy/DevTools.gs
const DEV_MODE = true; // Keep as true

// In deploy/Main.gs - keep the old menu check:
if (typeof createDevMenu === 'function') {
  createDevMenu().addToUi();
}
```

This way, if `DevTools.gs` is present, DEV menu appears automatically.

## 📋 Structure After Cleanup

### Production Directory Structure
```
deploy/
├── Main.gs                    ✅ Client code (no DEV)
├── server.gs                  ✅ Server code (no DEV)
├── CollectConfig.gs          ✅ Feature
├── OcrRunV2_client.gs        ✅ Feature
├── VK.gs                     ✅ Feature
├── UnpackingViewer.gs        ✅ Feature
├── TemplateService.gs        ✅ Utility
├── license.gs                ✅ License logic
├── ota_updates.gs            ✅ Update logic
├── appsscript.json           ✅ Manifest
├── *.html                    ✅ UI Templates
└── [DevTools.gs]             ❌ DELETED
```

### .claspignore Exclusions
```
# .claspignore (root)
DevTools.gs                   ← Always excluded
*.md                          ← Documentation excluded
node_modules/                 ← Dependencies excluded
system_integrations/          ← Build tools excluded
```

## 🧪 Testing Production Deployment

### Manual Testing Checklist

```javascript
// 1. Verify no DEV_MODE reference
Search in Main.gs: "DEV_MODE"  → SHOULD FIND NOTHING in code

// 2. Test menu creation
onOpen() should work WITHOUT errors

// 3. Test basic function
GM() should work through SERVER only (no fallback)

// 4. Test OTA updates (if configured)
checkForUpdatesManual_() should query server

// 5. Check logs
Should only have INFO, WARN, ERROR (no DEBUG for trivial things)
```

### Automated Testing
```bash
# Run lint checks (before commit)
npm run lint

# Run type checks (if TypeScript)
npm run type-check

# Run tests
npm run test

# All checks pass? Ready to deploy! ✅
```

## 🚨 Common Issues & Solutions

### Issue: "Cannot find function debugGeminiKeys"
**Cause**: DevTools.gs is still being pushed
**Solution**: 
```bash
# Verify .claspignore includes DevTools.gs
grep "DevTools" .claspignore

# If not, add it:
echo "DevTools.gs" >> .claspignore
```

### Issue: DEV menu still visible after push
**Cause**: DevTools.gs wasn't deleted or push failed
**Solution**:
```bash
# 1. Delete locally
rm deploy/DevTools.gs

# 2. Force push
clasp push --force

# 3. Verify in Apps Script UI (https://script.google.com/home)
# Should NOT see DevTools.gs in file list
```

### Issue: Production still has DEV logging
**Cause**: Main.gs still has `if (DEV_MODE)` blocks
**Solution**: 
- Ensure Main.gs uses `if (typeof getDevMode === 'function' && getDevMode())`
- This check will be false in production (DevTools.gs not available)

## 📚 Related Documentation

- [OTA_UPDATES.md](./OTA_UPDATES.md) - Update system documentation
- [GITHUB_PRIVATE_REPO.md](./GITHUB_PRIVATE_REPO.md) - Private repo setup
- [../deploy/DEPLOYMENT_GUIDE.md](../deploy/DEPLOYMENT_GUIDE.md) - Deployment specifics

## ✅ Production Sign-Off

Before marking as ready for production:

- [ ] No DevTools.gs in deploy directory
- [ ] .claspignore includes DevTools.gs
- [ ] clasp push --force completed successfully
- [ ] Verified Main.gs does NOT have DEV_MODE constants
- [ ] Verified Main.gs does NOT have DEV functions
- [ ] Main.gs menu loads without errors
- [ ] No "🧰 DEV" menu appears in Google Sheets
- [ ] All tests pass
- [ ] Git commit with proper message
- [ ] Code review completed

## Quick Reference

### For DevOps / Release Manager

```bash
# Full production deployment sequence
cd /path/to/table-ai

# 1. Ensure DevTools.gs is deleted
rm -f deploy/DevTools.gs

# 2. Verify configuration
grep "const DEV_MODE" deploy/Main.gs || echo "✅ No DEV_MODE in Main.gs"

# 3. Push to production
clasp push --force

# 4. Verify in UI
echo "Go to: https://script.google.com/home → Check for Table AI script"
echo "Verify: NO DevTools.gs file in project"

# 5. Test from Sheets
echo "Go to: Linked Google Sheet"
echo "Test: Click menu → 🤖 Table AI should appear without DEV menu"
```

---

**Version**: 1.0  
**Last Updated**: November 2024  
**Compatible with**: Table AI v3.5.0+
