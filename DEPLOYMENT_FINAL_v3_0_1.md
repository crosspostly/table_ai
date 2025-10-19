# 📦 DEPLOYMENT GUIDE - Table AI v3.0.1 ENHANCED

**Status:** ✅ READY FOR PRODUCTION  
**Version:** v3.0.1 ENHANCED  
**Architecture:** Clean CLIENT-SERVER Separation  
**Last Updated:** October 2025

---

## 🎯 DEPLOYMENT OVERVIEW

Table AI v3.0.1 uses a **CLIENT-SERVER architecture** where:

- **CLIENT**: Google Sheets Script (UI, formulas, user interactions)
- **SERVER**: Separate backend (Gemini API calls, VK integration, caching, logging)

All files are in `/deploy` folder, ready to upload.

---

## 📂 CLIENT DEPLOYMENT (Google Sheets Script)

### Files to Upload:

```
deploy/
├── Main_v3_REFACTORED.gs          ← MAIN CLIENT UI (998 lines)
├── CollectConfig.gs               ← AI Constructor functions (1000+ lines)
├── OcrRunV2.gs                    ← OCR transcription (437 lines)
├── TemplateService.gs             ← Template management
├── SHARED_UTILITIES_v3.gs         ← Utilities library (1100+ lines)
│
├── SettingsUI.html                ← Settings interface
├── CollectConfigUi.html           ← AI Constructor UI
├── logging_system.html            ← Logging interface
│
└── appsscript.json                ← Script configuration (IMPORTANT!)
```

### CLIENT Functionality:

| File | Lines | Purpose |
|------|-------|---------|
| **Main_v3_REFACTORED.gs** | 998 | Menu system, GM/GM_IF formulas, settings, logging |
| **CollectConfig.gs** | 1000+ | AI Constructor UI - configure Gemini requests |
| **OcrRunV2.gs** | 437 | OCR image transcription with Gemini Vision |
| **TemplateService.gs** | 300+ | Template management and storage |
| **SHARED_UTILITIES_v3.gs** | 1100+ | Email validation, JSON parsing, logging, utilities |
| **SettingsUI.html** | 50+ | Settings HTML interface |
| **CollectConfigUi.html** | 100+ | Collect Config HTML interface |
| **logging_system.html** | 100+ | Logging HTML interface |

### CLIENT Menu Structure:

```
🤖 Table AI
├── ▶️ Подготовить формулы (умный режим)     → prepareChainSmart()
├── 🔁 Обновить текущую ячейку (GM)         → refreshCurrentGMCell()
├── 🧹 Очистить B3..G3                      → clearChainForA3()
├── ─────────────────────────────────────────
├── 🎯 AI Конструктор
│   ├── 🎯 Настроить запрос                  → openCollectConfigUI()
│   ├── 🔄 Обновить ячейку                  → refreshCellWithConfig()
│   ├── 🗂️ Управление шаблонами             → openTemplatesUI()
│   └── ❓ Справка                           → showCollectConfigHelp()
├── ─────────────────────────────────────────
├── 📥 Импорт VK постов                     → importVkPosts()
├── 🖼️ Транскрибация отзывов               → ocrRun()
├── ─────────────────────────────────────────
├── ⚙️ Настройки                            → openSettingsUI()
│
└── 🧰 [DEV] (if DEV_MODE = true)
    ├── 📝 Показать логи                    → showLogsDialog()
    ├── ⬇️ Экспорт логов                    → exportLogsToSheet()
    └── 🗑 Очистить логи                   → clearLogs()
```

### CLIENT Configuration:

**In appsscript.json:**
- TimeZone: `Europe/Moscow`
- Runtime: `V8`
- Required OAuth Scopes: ✅ Already configured
  - `spreadsheets` - Read/write sheets
  - `script.external_request` - Call SERVER
  - `script.container.ui` - UI dialogs
  - `userinfo.email` - Get user email

### CLIENT Environment Variables:

Set in **PropertiesService** (or in settings UI):

```javascript
// Required on CLIENT:
GEMINI_API_KEY          // Gemini API key (stays on CLIENT)
VK_PARSER_URL           // VK Parser SERVER endpoint
SERVER_URL              // Main SERVER endpoint for API calls

// Optional:
DEV_MODE                // true/false - shows DEV menu
COMPLETION_PHRASE       // Phrase for chain completion (default: "Завершено")
```

---

## 🖥️ SERVER DEPLOYMENT

### Files to Upload:

```
deploy/
└── Server_v3_IMPROVED.gs              ← ALL SERVER LOGIC (350+ lines)
```

### SERVER Functionality:

**Location:** Separate Google Apps Script deployment (or Cloud Function / Node.js)

**Key Endpoints:**

```javascript
function doPost(e) {
  // Main SERVER entry point
  // Receives: { action, params, data }
  // Returns: { success, result, error }
}

// Available Actions:
POST /gm_image        → serverGmOcrBatchV2_()    - OCR images
POST /gm              → gmServerRequest_()        - Gemini text API
POST /checkLicense    → checkLicense_()          - License validation
POST /setLicense      → setLicense_()            - Update license
```

### SERVER Configuration:

**Environment Variables Required:**

```javascript
// Required on SERVER:
GEMINI_API_KEY           // Gemini API key (on SERVER for server-side calls)
VK_PARSER_URL            // VK Parser endpoint
DATABASE_KEY             // Firebase/DB key (optional, for caching)

// Optional:
CACHE_TTL               // Cache time-to-live in seconds
RATE_LIMIT_CALLS        // Rate limit requests per minute
```

### SERVER Features:

- ✅ **Gemini API Integration** - Text generation with caching
- ✅ **OCR (Vision API)** - Image transcription with batch processing
- ✅ **License Validation** - Email-based licensing
- ✅ **Request Caching** - Reduce API calls
- ✅ **Rate Limiting** - Prevent abuse
- ✅ **Trace IDs** - Request tracking
- ✅ **Comprehensive Logging** - Security events, license usage

---

## 📋 DEPLOYMENT CHECKLIST

### ☑️ Pre-Deployment

- [ ] Review all files in deploy/ folder
- [ ] Verify `appsscript.json` is correct
- [ ] Confirm all .gs files are complete (no syntax errors)
- [ ] All HTML files are valid
- [ ] Check git status: `git status` (should be clean)

### ☑️ CLIENT Deployment

1. **Open Google Sheet** in production
2. **Go to Extensions → Apps Script**
3. **Upload each file:**
   ```
   ├── Main_v3_REFACTORED.gs
   ├── CollectConfig.gs
   ├── OcrRunV2.gs
   ├── TemplateService.gs
   ├── SHARED_UTILITIES_v3.gs
   ├── SettingsUI.html
   ├── CollectConfigUi.html
   ├── logging_system.html
   └── appsscript.json
   ```
4. **Set Environment Variables** (via UI or Script Properties):
   ```
   GEMINI_API_KEY → Your API key
   VK_PARSER_URL → http://server/vk-parser
   SERVER_URL → http://server/api
   ```
5. **Test Menu:**
   - Refresh sheet (F5)
   - Menu should appear: `🤖 Table AI`
   - Click each item - should work without errors
6. **Deploy as add-on** (optional) or keep as script

### ☑️ SERVER Deployment

**Option A: Google Apps Script (Separate Project)**
1. Create new Apps Script project
2. Upload `Server_v3_IMPROVED.gs`
3. Deploy as **New Deployment → Web App**
4. Set execution as: **Me** (or service account)
5. Get deployment URL
6. Add to CLIENT as `SERVER_URL`

**Option B: Node.js/Express (Recommended for scale)**
1. Extract server logic from `Server_v3_IMPROVED.gs`
2. Convert to Node.js (Gemini SDK, Express)
3. Deploy to Heroku, Google Cloud Run, or AWS
4. Configure environment variables
5. Add URL to CLIENT

**Option C: Python/Flask**
1. Convert server logic to Python
2. Use `google-generativeai` SDK
3. Deploy to Cloud Run or similar
4. Configure environment variables

---

## 🔑 API KEYS & SECRETS

### Gemini API Key

**Two options:**

**Option 1: On CLIENT (Current v3.0.1)**
- ✅ Simpler setup
- ✅ No server infrastructure needed
- ⚠️ Key exposed to users
- Use for: Internal/trusted users only

**Option 2: On SERVER (Recommended)**
- ✅ Keys hidden from clients
- ✅ Better security
- ✅ Rate limiting possible
- Requires: SERVER deployment

### VK Parser URL

- Must be externally accessible
- Receives: `?owner=XXX&count=YYY`
- Returns: JSON array of posts
- Example: `http://vk-parser-server:3000/api/posts`

---

## 📊 FILE SUMMARY

| File | Type | Lines | Purpose | Deploy To |
|------|------|-------|---------|-----------|
| Main_v3_REFACTORED.gs | .gs | 998 | UI, Menu, Formulas | CLIENT |
| CollectConfig.gs | .gs | 1000+ | AI Constructor | CLIENT |
| OcrRunV2.gs | .gs | 437 | OCR | CLIENT |
| TemplateService.gs | .gs | 300+ | Templates | CLIENT |
| SHARED_UTILITIES_v3.gs | .gs | 1100+ | Utilities | CLIENT |
| Server_v3_IMPROVED.gs | .gs | 350+ | Endpoints | SERVER |
| SettingsUI.html | .html | 50+ | Settings UI | CLIENT |
| CollectConfigUi.html | .html | 100+ | Config UI | CLIENT |
| logging_system.html | .html | 100+ | Logs UI | CLIENT |
| appsscript.json | .json | 14 | Config | CLIENT |

**TOTAL: ~5500 lines of code**

---

## 🚀 QUICK START DEPLOYMENT

### For Development:

```bash
# 1. Review changes
git diff main refactor/v3-client-server-separation

# 2. Create PR for review
# (Use GitHub UI to create PR)

# 3. Deploy to test sheet
# Upload files from deploy/ to test Google Sheet
```

### For Production:

```bash
# 1. Merge PR to main
git checkout main
git pull origin main

# 2. Copy files from deploy/ to production Google Sheets
#    - Use Apps Script editor
#    - Or use clasp CLI: clasp push

# 3. Update SERVER_URL in CLIENT settings

# 4. Test all menu items

# 5. Monitor logs for issues
```

---

## 🔗 ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────┐
│   GOOGLE SHEETS (CLIENT)                │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Main_v3_REFACTORED.gs (998)     │   │
│  │ - Menu                          │   │
│  │ - GM() formula                  │   │
│  │ - GM_IF() formula               │   │
│  └─────────────────────────────────┘   │
│                │                       │
│  ┌─────────────┴─────────────────────┐ │
│  │ CollectConfig.gs (1000+)         │ │
│  │ OcrRunV2.gs (437)                │ │
│  │ TemplateService.gs (300+)        │ │
│  │ SHARED_UTILITIES_v3.gs (1100+)   │ │
│  └─────────────────────────────────┘ │
│                │                      │
└────────────────┼──────────────────────┘
                 │ HTTP POST
                 │ (SERVER_URL)
                 ▼
┌──────────────────────────────────────┐
│   SERVER                             │
│                                      │
│  Server_v3_IMPROVED.gs (350+)        │
│  ├── doPost() - Entry point          │
│  ├── gmServerRequest_()              │
│  ├── serverGmOcrBatchV2_()          │
│  ├── checkLicense_()                 │
│  └── Caching, Rate limiting, Logging │
│                                      │
│  ┌──────────────────────────────────┐ │
│  │ GEMINI API                       │ │
│  │ (Text & Vision)                  │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌──────────────────────────────────┐ │
│  │ VK PARSER                        │ │
│  │ (VK_PARSER_URL)                  │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌──────────────────────────────────┐ │
│  │ DATABASE / CACHE                 │ │
│  │ (License, requests)              │ │
│  └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

---

## ✅ VALIDATION BEFORE DEPLOYMENT

### Syntax Check:
```bash
# Check all .gs files for syntax errors
cd deploy
ls *.gs | while read f; do echo "=== $f ==="; head -5 "$f"; done
```

### File Completeness:
```bash
# Verify all required files exist
ls -lh deploy/*.gs deploy/*.html deploy/appsscript.json
```

### Git Status:
```bash
# Ensure clean working directory
git status
git log --oneline -5
```

---

## 🆘 TROUBLESHOOTING

### Menu not appearing:
- ✅ Check if appsscript.json is deployed
- ✅ Reload sheet (F5)
- ✅ Check logs: `🧰 [DEV] → 📝 Show Logs`

### Formulas not working:
- ✅ Check SERVER_URL is set correctly
- ✅ Verify GEMINI_API_KEY on server
- ✅ Check browser console for errors

### OCR not transcribing:
- ✅ Verify images are accessible
- ✅ Check Gemini Vision API is enabled
- ✅ Review server logs

### VK import failing:
- ✅ Check VK_PARSER_URL is accessible
- ✅ Verify Параметры sheet has owner/count
- ✅ Check VK API response format

---

## 📞 SUPPORT

- **GitHub Issues**: Report bugs or feature requests
- **Logs**: Use DEV menu to view detailed logs
- **Documentation**: See README.md and individual file headers

---

**Version:** v3.0.1 ENHANCED  
**Status:** ✅ READY FOR PRODUCTION  
**Total Files:** 12  
**Total Lines:** ~5500  

**Deployment Mode:** Ready for pull request and production release

