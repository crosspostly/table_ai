# Table AI - AI-Powered Google Sheets Automation

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-3.5.2-brightgreen.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)]()
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-enabled-blue.svg)]()

> **🆕 Latest:** v3.5.2 - OTA backward compatibility + prompt_table feature

---

## 📌 Overview

**Table AI** is a powerful Google Sheets add-on that leverages **Gemini 2.0 AI** to automate and enhance spreadsheet workflows:

✅ **AI Transformations** - Process data with natural language prompts  
✅ **VK Import** - Automatically import posts from VKontakte  
✅ **OCR** - Extract text from images using Vision AI  
✅ **OTA Updates** - Automatic code updates via Over-The-Air system  
✅ **Licensing** - Multi-user license management  
✅ **Prompt Table** - Remote system prompts from centralized sheets  
✅ **Multi-Key Rotation** - 120 requests/day via 6 API keys

---

## 🚀 Quick Start

### 1. Installation

```bash
# Clone repository
git clone https://github.com/crosspostly/table_ai.git
cd table_ai

# Install dependencies (for development)
npm install
```

### 2. Deploy to Google Apps Script

#### Option A: Using clasp (CLI)

```bash
# Install clasp
npm install -g @google/clasp

# Login to Google
clasp login

# Clone your project
clasp clone <your-script-id>

# Push code
clasp push

# Deploy
clasp deploy
```

#### Option B: Manual Copy

1. Open Google Sheets
2. **Extensions → Apps Script**
3. Copy files from `/deploy/` folder:
   - Main.gs
   - server.gs
   - CollectConfig.gs
   - TemplateService.gs
   - (and all other files)
4. Save and close

### 3. First Run

1. Open your spreadsheet
2. Refresh page (F5)
3. Menu: **🤖 Table AI → ⚙️ Настройки**
4. Enter your Gemini API key (optional)
5. Enter license email and token (if required)
6. Save
7. ✅ Ready to use!

---

## 🏗️ Architecture

### System Overview

Table AI consists of **two separate Google Apps Script projects**:

```
┌─────────────────────────────────────────────────────┐
│  CLIENT (Container-bound Script in user's sheet)   │
│  ┌───────────────────────────────────────────────┐ │
│  │ Main.gs - UI, menus, client logic            │ │
│  │ CollectConfig.gs - AI Constructor             │ │
│  │ TemplateService.gs - Template management      │ │
│  │ VK.gs - VK import module                      │ │
│  │ UnpackingViewer.gs - Data viewer              │ │
│  │ ocrRunV2_client.gs - OCR client               │ │
│  │ reniewcell.gs - Batch operations              │ │
│  └───────────────────────────────────────────────┘ │
└──────────────┬──────────────────────────────────────┘
               │ HTTP POST (UrlFetchApp)
               │ - License validation
               │ - Gemini API proxy
               │ - OTA updates
               ▼
┌─────────────────────────────────────────────────────┐
│  SERVER (Standalone Web App)                        │
│  ┌───────────────────────────────────────────────┐ │
│  │ server.gs - API router, business logic        │ │
│  │ ota_updates.gs - OTA update system            │ │
│  │ license_module.gs - License validation        │ │
│  └───────────────────────────────────────────────┘ │
│  URL: https://script.google.com/macros/s/.../exec  │
└──────────────┬──────────────────────────────────────┘
               │ External APIs
               ├─→ GitHub (code repository)
               ├─→ Gemini AI (text/vision processing)
               ├─→ Google Sheets API (data access)
               └─→ Apps Script API (code updates)
```

### Key Components

#### Client Layer
- **Main.gs** (~2,150 lines) - Core client logic:
  - Menu system and UI dialogs
  - Gemini API wrappers (`GM()`, `GM_IF()`)
  - Logging system
  - OTA client
- **CollectConfig.gs** - AI Constructor for complex configs
- **TemplateService.gs** - Save/load template configurations
- **VK.gs** - VKontakte post import
- **UnpackingViewer.gs** - JSON data viewer
- **ocrRunV2_client.gs** - OCR batch processing
- **reniewcell.gs** - Batch cell updates

#### Server Layer
- **server.gs** (~800 lines) - Main API handler:
  - `doPost()` - Request router
  - Gemini API proxy
  - License validation
  - Rate limiting
- **ota_updates.gs** (~375 lines) - OTA system:
  - GitHub file downloads
  - Apps Script API integration
  - Version management
- **license_module.gs** - License management

#### Data Storage
- **License Spreadsheet:**
  - Tokens (email, token, expires, copies_count)
  - Bindings (email, sheet_id, script_id)
  - API Keys (multi-key rotation)
- **User Properties** - Personal API keys
- **Script Properties** - Sheet-level configurations
- **Cache Service** - Temporary logs (24h)

---

## ⚡ Features

### 1. AI Transformations

Use AI directly in spreadsheet formulas:

```
=GM("Translate to English: " & A2)
=GM("Summarize: " & B2, 5000, 0.5)
=GM_IF(A2<>"", "Extract email from: " & A2)
```

Or use the **AI Constructor** (Menu → 🛠️ AI Constructor):
- Configure system prompts
- Define data sources
- Save as templates
- Execute on demand

### 2. prompt_table (Remote Prompts)

Store system prompts in a centralized Google Sheet:

**Benefits:**
- Update prompts for all users at once
- A/B test different prompts
- License-specific prompts
- Multi-language support

**Configuration:**
```javascript
{
  "prompt_table": {
    "spreadsheetId": "1abc123...",
    "sheetName": "Prompts",
    "cellAddress": "B2"
  }
}
```

See [PROMPT_TABLE.md](docs/PROMPT_TABLE.md) for details.

### 3. Multi-Key Rate Limiting

Bypass Gemini API daily limits (20 RPD → 120 RPD):

**Setup:**
1. Create sheet `api_gem` in license spreadsheet:

| A | B | C |
|---|---|---|
| api_key_1 | AIza...key-1... | ACTIVE |
| api_key_2 | AIza...key-2... | ACTIVE |
| api_key_3 | AIza...key-3... | ACTIVE |
| api_key_4 | AIza...key-4... | ACTIVE |
| api_key_5 | AIza...key-5... | ACTIVE |
| api_key_6 | AIza...key-6... | ACTIVE |

2. System automatically rotates keys when limits hit
3. Monitor in `API_METRICS` sheet

**Result:** 6 keys × 20 RPD = **120 requests per day**

### 4. OTA (Over-The-Air) Updates

Automatic code updates without manual intervention:

**How it works:**
1. Every night at 3:00 AM (or manual trigger)
2. Client checks server for new version
3. Server downloads files from GitHub
4. Server updates client via Apps Script API
5. User receives email notification

**Features:**
- Backward compatibility (v3.5.2+)
- Private GitHub repository support
- Staged rollouts
- Version tracking

See [OTA_UPDATES.md](docs/OTA_UPDATES.md) for details.

### 5. License System

Multi-user license management:

**License Table:**
```
┌─────────────────┬──────────┬────────────┬──────────────┐
│ email           │ token    │ expires    │ copies_count │
├─────────────────┼──────────┼────────────┼──────────────┤
│ user@gmail.com  │ abc123   │ 2026-12-31 │ 100          │
└─────────────────┴──────────┴────────────┴──────────────┘
```

**Bindings Table:**
```
┌─────────────────┬─────────────┬─────────────┬────────────┐
│ email           │ sheet_id    │ script_id   │ created_at │
├─────────────────┼─────────────┼─────────────┼────────────┤
│ user@gmail.com  │ 1abc123...  │ 12bp9cBT... │ 2025-12-01 │
└─────────────────┴─────────────┴─────────────┴────────────┘
```

See [LICENSE_SYSTEM.md](docs/LICENSE_SYSTEM.md) for details.

### 6. VK Import

Automatically import VKontakte posts:

1. Configure VK owner ID and post count
2. Menu: **🤖 Table AI → 📥 VK Import**
3. Posts imported to "посты" sheet
4. Auto-filtering and formatting applied

### 7. OCR (Optical Character Recognition)

Extract text from images using Gemini Vision:

1. Insert image URLs in sheet
2. Menu: **🤖 Table AI → 📸 OCR Batch**
3. System extracts text from all images
4. Results written to adjacent cells

Supports: PNG, JPEG, GIF, WebP

---

## 🔑 API Key Management

Three-tier priority system:

### 1️⃣ Personal Key (Highest Priority)
**Storage:** UserProperties  
**Scope:** Current user only  
**Set via:** Menu → ⚙️ Настройки

```javascript
// Stored in UserProperties
PropertiesService.getUserProperties()
  .setProperty('GEMINI_API_KEY', 'AIza...')
```

### 2️⃣ Sheet Key (Medium Priority)
**Storage:** ScriptProperties (client)  
**Scope:** All users of this sheet  
**Set via:** Console or Settings

```javascript
// Stored in ScriptProperties
PropertiesService.getScriptProperties()
  .setProperty('GEMINI_API_KEY', 'AIza...')
```

### 3️⃣ Server Key (Fallback)
**Storage:** ScriptProperties (server)  
**Scope:** All clients without keys  
**Set via:** Server console (admin only)

```javascript
// Server console:
setDefaultGeminiKey_('AIza...')
```

**Priority:** Personal > Sheet > Server

---

## 📚 Documentation

### User Guides
- **[Quick Start](#quick-start)** - Get started in 5 minutes
- **[API Reference](docs/API.md)** - Complete API documentation
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Feature Guides
- **[prompt_table Feature](docs/PROMPT_TABLE.md)** - Remote prompts guide
- **[OTA Updates](docs/OTA_UPDATES.md)** - Automatic update system
- **[License System](docs/LICENSE_SYSTEM.md)** - Multi-user licensing

### Developer Docs
- **[Architecture](docs/ARCHITECTURE.md)** - System design and components
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Development workflow
- **[Deployment](docs/DEPLOYMENT.md)** - Production deployment guide
- **[Testing Guide](docs/TESTING_GUIDE.md)** - Test suite and practices

### Advanced Topics
- **[Private GitHub Repo](docs/GITHUB_PRIVATE_REPO.md)** - Private repo OTA setup
- **[Gemini API Config](docs/GEMINI_API_CONFIG.md)** - API key management
- **[Server Setup](docs/SERVER_SETUP.md)** - Server configuration
- **[Functions Reference](docs/FUNCTIONS_REFERENCE.md)** - All public functions
- **[Comprehensive API](docs/COMPREHENSIVE_PUBLIC_API.md)** - Full API reference

### Audit & Analysis
- **[Gemini API Audit Summary](docs/GEMINI_API_AUDIT_SUMMARY.md)** - API usage analysis
- **[Gemini API Flow Diagram](docs/GEMINI_API_FLOW_DIAGRAM.md)** - Request flows
- **[Gemini API Quick Reference](docs/GEMINI_API_QUICK_REFERENCE.md)** - Quick lookup

---

## 🛠️ Development

### Local Setup

```bash
# Clone repository
git clone https://github.com/crosspostly/table_ai.git
cd table_ai

# Install dependencies
npm install

# Install clasp globally
npm install -g @google/clasp

# Login to Google
clasp login

# Create new project (or clone existing)
clasp create --type sheets --title "Table AI Dev"
# or
clasp clone <your-script-id>

# Push code
clasp push

# Open in browser
clasp open
```

### Development Workflow

1. **Create feature branch:**
```bash
git checkout -b feature/amazing-feature
```

2. **Make changes in `/deploy/` folder**

3. **Test locally:**
```bash
clasp push
# Test in spreadsheet
```

4. **Run tests:**
```bash
npm test
```

5. **Commit and push:**
```bash
git add .
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature
```

6. **Create Pull Request**

### Release Process

1. **Update version numbers:**
   - `deploy/Main.gs`: `CLIENT_VERSION = '3.5.3'`
   - `deploy/server.gs`: `SERVER_VERSION = '3.5.3'`

2. **Update CHANGELOG:**
   - Add new version section
   - Document changes

3. **Commit and push:**
```bash
git add deploy/ docs/CHANGELOG.md
git commit -m "chore: release v3.5.3"
git push origin main
```

4. **Deploy server:**
```bash
# In server project:
clasp push
clasp deploy --description "v3.5.3: New features"
```

5. **OTA automatically updates clients** 🎉

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test __tests__/Main.test.js

# Run with coverage
npm run test:coverage
```

### Test Coverage

Current coverage: **67 tests passing**

Key areas tested:
- Gemini API integration
- License validation
- Template service
- OTA update flow
- Configuration management

See [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for details.

---

## 🐛 Debugging

### Enable DEV Mode

```javascript
// Main.gs, line ~50
const DEV_MODE = true;  // Enable debugging
```

### DEV Menu

Menu: **🧰 DEV** includes:
- 📝 Show Logs
- ⬇️ Export Logs
- 🗑 Clear Logs
- 🔍 Test Server Connection
- 🧪 Dev Self Test
- 🔑 Debug Gemini Keys
- 🔄 OTA Manual Update

### Console Commands

```javascript
// View logs
showLogsDialog()
getLogs(100)
exportLogsToSheet()

// Debug OTA
debugOTAFlow()
debugOTAStatus()

// Debug API keys
debugGeminiKeys()

// Test connection
testServerConnection()

// Self test
runDevSelfTest()
```

See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues.

---

## 📊 Roadmap

### v3.6 (Next Release)
- [ ] Improved mobile UI
- [ ] Multi-language support (i18n)
- [ ] Circuit breaker for rate limiting
- [ ] Failed cell queue system

### v4.0 (Future)
- [ ] Web dashboard for management
- [ ] Multi-AI support (Claude, GPT-4)
- [ ] Team collaboration features
- [ ] Advanced analytics

See [TODO.md](TODO.md) for detailed roadmap.

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork the repository**
2. **Create feature branch:**
```bash
git checkout -b feature/amazing-feature
```
3. **Make changes and test**
4. **Commit with conventional commits:**
```bash
git commit -m "feat: add amazing feature"
# or
git commit -m "fix: resolve issue #123"
```
5. **Push and create Pull Request**

### Commit Convention

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Add/update tests
- `chore:` - Maintenance tasks

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

Copyright (c) 2025 Table AI

---

## 📞 Support

### Get Help

- 🐛 **Bug Reports:** [Create an issue](https://github.com/crosspostly/table_ai/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/crosspostly/table_ai/discussions)
- 👨‍💻 **Direct Contact:** [@daoqub](https://vk.com/daoqub)

### Resources

- **Documentation:** [docs/](docs/)
- **Examples:** [examples/](examples/) (if exists)
- **Changelog:** [docs/CHANGELOG.md](docs/CHANGELOG.md)
- **Roadmap:** [TODO.md](TODO.md)

---

## 🌟 Credits

**Author:** [@daoqub](https://vk.com/daoqub)

**Technologies:**
- Google Apps Script
- Gemini 2.0 AI
- Node.js
- Jest (testing)
- clasp (deployment)

---

## ⚖️ Disclaimer

This project is not officially affiliated with Google. Gemini API usage subject to [Google's Terms of Service](https://ai.google.dev/gemini-api/terms).

---

**Made with ❤️ for automation enthusiasts**

[![Star on GitHub](https://img.shields.io/github/stars/crosspostly/table_ai?style=social)](https://github.com/crosspostly/table_ai)
