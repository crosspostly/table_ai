# Prompt Table Feature Guide

**Version:** 3.5.2+  
**Feature:** prompt_table (Remote System Prompts)  
**Last Updated:** December 2025

---

## Table of Contents

- [Overview](#overview)
- [Why Use Prompt Table?](#why-use-prompt-table)
- [How It Works](#how-it-works)
- [Setup Guide](#setup-guide)
- [Configuration](#configuration)
- [Use Cases](#use-cases)
- [Troubleshooting](#troubleshooting)
- [Migration](#migration)
- [Best Practices](#best-practices)

---

## Overview

**prompt_table** is a feature that allows you to store System Prompts in a **remote Google Spreadsheet** instead of local sheets.

### Traditional Approach (Local)
```
Your Sheet → Prompt_box → Cell A1 → System Prompt
```

### New Approach (Remote)
```
Your Sheet → Remote Sheet (ID: 1abc...) → Prompts → Cell B2 → System Prompt
```

---

## Why Use Prompt Table?

### ✅ Benefits

#### 1. Centralized Management
- One prompt source for all users
- Update once, applies everywhere
- No need to update individual sheets

#### 2. Security & Control
- Keep proprietary prompts private
- License-specific prompts
- Control access via Google Sheets permissions

#### 3. Dynamic Updates
- Change prompts without script updates
- A/B test different prompts
- Roll out new prompts instantly

#### 4. Team Collaboration
- Share prompts across team
- Version control for prompts
- Audit trail of changes

#### 5. Scalability
- Manage 100+ users with one sheet
- Different prompts per license tier
- Regional/language-specific prompts

---

## How It Works

### Architecture

```
┌────────────────────────────────────┐
│  USER SHEET (Client)               │
│  ┌──────────────────────────────┐  │
│  │ AI Constructor Config:       │  │
│  │ prompt_table: {              │  │
│  │   spreadsheetId: "1abc..."   │  │
│  │   sheetName: "Prompts"       │  │
│  │   cellAddress: "B2"          │  │
│  │ }                            │  │
│  └──────────────────────────────┘  │
└────────────┬───────────────────────┘
             │ Request system prompt
             ▼
┌────────────────────────────────────┐
│  SERVER (server.gs)                │
│  serverGetSystemPrompt_()          │
│  1. Check config.prompt_table      │
│  2. If set → read remote sheet     │
│  3. Else → read local sheet        │
└────────────┬───────────────────────┘
             │ Read remote sheet
             ▼
┌────────────────────────────────────┐
│  REMOTE SHEET (Prompt Storage)     │
│  ┌──────────────────────────────┐  │
│  │ Sheet: Prompts               │  │
│  │ Cell B2: "You are a helpful  │  │
│  │ assistant that translates    │  │
│  │ text to English..."          │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Flow

1. User opens AI Constructor
2. Enables "📡 prompt_table" checkbox
3. Enters remote spreadsheet details:
   - Spreadsheet ID
   - Sheet name
   - Cell address
4. Saves configuration
5. When executing:
   - Server checks `config.prompt_table`
   - If present → reads from remote sheet
   - If not → falls back to local sheet
6. System prompt retrieved and used

---

## Setup Guide

### Step 1: Create Remote Prompt Sheet

**1.1 Create new Google Spreadsheet**
```
File → New → Google Sheets
Name: "Table AI Prompts"
```

**1.2 Create sheet for prompts**
```
Sheet name: Prompts
```

**1.3 Add your prompts**

| A | B |
|---|---|
| Prompt Name | Prompt Text |
| Translation EN | You are a professional translator. Translate the following text to English... |
| Summarize | You are a summarization expert. Summarize the following text concisely... |
| Extract Data | You are a data extraction specialist. Extract structured data from... |

**1.4 Get Spreadsheet ID**
```
URL: https://docs.google.com/spreadsheets/d/1abc123def456ghi/edit
                                            ^^^^^^^^^^^^^^^
                                            This is the ID
```

---

### Step 2: Configure Permissions

**2.1 Share with users** (if individual access)
```
Share button → Add users → Can view
```

**2.2 Share with service account** (if using server key)
```
Share → Add: your-project@appspot.gserviceaccount.com → Editor
```

**2.3 Or make link-accessible**
```
Share → Anyone with the link → Viewer
```

**⚠️ Security Note:**
- Don't make public if prompts are proprietary
- Use "Specific people" sharing for sensitive prompts
- Audit access regularly

---

### Step 3: Enable prompt_table in Client

**3.1 Open AI Constructor**
```
Menu: 🤖 Table AI → 🛠️ AI Constructor
```

**3.2 Enable remote prompts**
```
☑️ 📡 prompt_table (удалённый сервер)
```

**3.3 Fill in details**

| Field | Value | Example |
|-------|-------|---------|
| 📋 ID таблицы | Spreadsheet ID from URL | `1abc123def456ghi` |
| 📄 Лист | Sheet name with prompt | `Prompts` |
| 📍 Ячейка | Cell address (A1 notation) | `B2` |

**3.4 Save configuration**
```
Click: 🚀 Запустить
```

---

### Step 4: Verify It Works

**4.1 Check logs**
```javascript
// Menu: 🧰 DEV → 📝 Показать логи
// Look for:
"✅ Using prompt_table (новый формат): 1abc123def456ghi / Prompts / B2"
```

**4.2 Test execution**
```
Run AI Constructor with remote prompt
Check result in target cell
```

**4.3 Debug if needed**
```javascript
// Console:
const config = loadCollectConfig(sheetName, cellAddress);
Logger.log(config.prompt_table);
// Should show: { spreadsheetId, sheetName, cellAddress }
```

---

## Configuration

### Config Format

#### New Format (prompt_table)
```json
{
  "prompt_table": {
    "spreadsheetId": "1abc123def456ghi",
    "sheetName": "Prompts",
    "cellAddress": "B2"
  },
  "userData": [
    { "sheet": "Data", "cell": "A:A" }
  ]
}
```

#### Legacy Format (systemPrompt)
```json
{
  "systemPrompt": {
    "sheet": "Prompt_box",
    "cell": "E2"
  },
  "userData": [
    { "sheet": "Data", "cell": "A:A" }
  ]
}
```

### Priority

**prompt_table takes priority** over systemPrompt:

```javascript
// Server logic:
if (config.prompt_table) {
  // Use remote prompt
  return readRemotePrompt(config.prompt_table);
} else if (config.systemPrompt) {
  // Use local prompt (legacy)
  return readLocalPrompt(config.systemPrompt);
}
```

---

## Use Cases

### 1. Multi-User SaaS

**Scenario:** 100 users, 1 prompt source

```
REMOTE SHEET (Table AI Prompts)
├─ Sheet: Basic (for free tier)
│  └─ B2: Basic translation prompt
├─ Sheet: Pro (for pro tier)
│  └─ B2: Advanced translation with context
└─ Sheet: Enterprise (for enterprise tier)
   └─ B2: Custom translation with glossary
```

**Configuration per tier:**
```javascript
// Free tier users:
{ spreadsheetId: "1abc...", sheetName: "Basic", cellAddress: "B2" }

// Pro tier users:
{ spreadsheetId: "1abc...", sheetName: "Pro", cellAddress: "B2" }

// Enterprise users:
{ spreadsheetId: "1abc...", sheetName: "Enterprise", cellAddress: "B2" }
```

---

### 2. A/B Testing

**Scenario:** Test two different prompts

```
REMOTE SHEET (Prompts A/B Test)
├─ B2: Prompt A (control)
│  "You are a translator..."
└─ B3: Prompt B (experimental)
   "You are an expert translator with 10 years experience..."
```

**Configuration:**
```javascript
// Group A users:
{ spreadsheetId: "1abc...", sheetName: "Test", cellAddress: "B2" }

// Group B users:
{ spreadsheetId: "1abc...", sheetName: "Test", cellAddress: "B3" }
```

**Measure results and choose winner.**

---

### 3. Localization

**Scenario:** Different prompts per language

```
REMOTE SHEET (Localized Prompts)
├─ Sheet: EN
│  └─ B2: English instructions
├─ Sheet: RU
│  └─ B2: Русские инструкции
├─ Sheet: ES
│  └─ B2: Instrucciones en español
└─ Sheet: FR
   └─ B2: Instructions en français
```

**Configuration:**
```javascript
// Russian users:
{ spreadsheetId: "1abc...", sheetName: "RU", cellAddress: "B2" }

// English users:
{ spreadsheetId: "1abc...", sheetName: "EN", cellAddress: "B2" }
```

---

### 4. Dynamic Prompt Updates

**Scenario:** Improve prompt without updating sheets

**Day 1:**
```
Remote B2: "You are a translator. Translate text."
→ 100 users use this prompt
```

**Day 10:** (prompt not good enough)
```
Remote B2: "You are a professional translator with expertise in technical content. Translate the following text accurately..."
→ All 100 users automatically use new prompt (no update needed!)
```

---

### 5. License-Specific Features

**Scenario:** Advanced prompts for licensed users only

```
REMOTE SHEET (Licensed Features)
├─ Public sheet (free users can access)
│  └─ B2: Basic prompt
└─ Private sheet (only licensed users can access)
   └─ B2: Advanced proprietary prompt with secret techniques
```

**Access control via Google Sheets permissions.**

---

## Troubleshooting

### Error: "Cannot access remote sheet"

**Possible causes:**
1. No access permission
2. Wrong spreadsheet ID
3. Sheet name doesn't exist
4. Cell address invalid

**Debug:**
```javascript
// Console:
try {
  const ss = SpreadsheetApp.openById('1abc123...');
  Logger.log('✅ Can open sheet');
  const sheet = ss.getSheetByName('Prompts');
  Logger.log('✅ Sheet exists');
  const value = sheet.getRange('B2').getValue();
  Logger.log('✅ Cell value: ' + value);
} catch (e) {
  Logger.log('❌ Error: ' + e.toString());
}
```

**Fix based on error:**
- "Permission denied" → Share sheet with user
- "Cannot find sheet" → Check sheet name spelling
- "Invalid range" → Check cell address format

---

### Error: "Empty prompt returned"

**Cause:** Cell is empty or contains formula that returns empty

**Check:**
```javascript
// Verify cell has content:
SpreadsheetApp.openById('1abc...').getSheetByName('Prompts').getRange('B2').getValue()
```

**Fix:**
- Ensure cell B2 has text
- If using formula, verify it returns text
- Check no extra spaces in cell address

---

### Remote prompt not being used

**Symptom:** System uses local prompt instead

**Check config:**
```javascript
const config = loadCollectConfig(sheetName, cellAddress);
Logger.log(JSON.stringify(config, null, 2));
```

**Expected:**
```json
{
  "prompt_table": { ... },
  "userData": [ ... ]
}
```

**If missing:** Re-save configuration in AI Constructor with prompt_table enabled.

---

### Access denied error

**Symptom:** "You do not have permission to access spreadsheet"

**Cause:** User doesn't have access to remote sheet

**Fix:**
1. Share remote sheet with user's email
2. Or share with "Anyone with the link"
3. Or use service account (share with service account email)

---

## Migration

### From Local to Remote

**Step 1: Copy existing prompts**
```
1. Open local sheet (e.g., Prompt_box)
2. Copy prompts from cells (e.g., E2, F2, G2)
3. Paste into remote sheet
```

**Step 2: Update configurations**
```
1. Open AI Constructor for each target cell
2. Enable prompt_table
3. Enter remote sheet details
4. Save
```

**Step 3: Verify**
```
1. Test each configuration
2. Check logs show "Using prompt_table"
3. Confirm results are correct
```

---

### From Remote to Local (Rollback)

**Step 1: Copy prompts back**
```
1. Open remote sheet
2. Copy prompt text
3. Paste into local sheet (e.g., Prompt_box!E2)
```

**Step 2: Update configurations**
```
1. Open AI Constructor
2. Uncheck prompt_table
3. Select local sheet and cell
4. Save
```

**Step 3: Verify**
```
1. Test configuration
2. Check logs show local sheet access
3. Confirm results unchanged
```

---

## Best Practices

### 1. Organization

**Structure your remote sheet:**
```
Sheet: Prompts
├─ Column A: Prompt ID/Name
├─ Column B: Prompt Text
├─ Column C: Version
├─ Column D: Last Updated
└─ Column E: Notes

Example:
A2: TRANSLATE_EN
B2: You are a professional translator...
C2: 1.2
D2: 2025-12-10
E2: Updated to handle technical terms better
```

---

### 2. Version Control

**Track prompt changes:**
```
Sheet: Prompt_History
├─ Date | Prompt_ID | Version | Changes | Editor
├─ 2025-12-01 | TRANSLATE_EN | 1.0 | Initial version | admin@...
├─ 2025-12-05 | TRANSLATE_EN | 1.1 | Added context handling | admin@...
└─ 2025-12-10 | TRANSLATE_EN | 1.2 | Improved technical terms | admin@...
```

---

### 3. Testing

**Before rolling out new prompts:**
```
1. Create test sheet with new prompt
2. Configure 1-2 test users to use it
3. Monitor results for 24-48 hours
4. If successful → update production prompt
5. If issues → rollback to previous version
```

---

### 4. Access Control

**Security tiers:**
```
1. Public prompts → Anyone with link can view
2. Licensed prompts → Specific users only
3. Enterprise prompts → Dedicated private sheet
```

**Regular audits:**
```
Monthly: Review who has access
Quarterly: Remove inactive users
Annually: Rotate service account keys
```

---

### 5. Performance

**Optimize for speed:**
```
1. Keep prompts concise (< 2,000 chars)
2. Use single cell reference (not ranges)
3. Avoid complex formulas in prompt cells
4. Cache frequently used prompts
```

---

### 6. Backup

**Backup strategy:**
```
1. Export prompts weekly
   File → Download → CSV
2. Version in Git:
   git add prompts_backup_2025-12-11.csv
   git commit -m "Weekly prompt backup"
3. Store in cloud (Google Drive, Dropbox)
```

---

### 7. Documentation

**Document each prompt:**
```
Sheet: Prompt_Documentation
├─ Prompt_ID | Purpose | Input Format | Expected Output | Examples
├─ TRANSLATE_EN | English translation | Any language text | English text | ...
├─ SUMMARIZE | Text summarization | Long text | Brief summary | ...
└─ EXTRACT_DATA | Data extraction | Unstructured text | JSON data | ...
```

---

## Advanced: Multiple Prompts

### Scenario: Use different prompts for different data types

**Remote Sheet Structure:**
```
Sheet: Prompts
├─ A2: Translation | B2: [translation prompt]
├─ A3: Summarization | B3: [summary prompt]
├─ A4: Data Extraction | B4: [extraction prompt]
└─ A5: Sentiment Analysis | B5: [sentiment prompt]
```

**Configurations:**

```javascript
// Config 1: Translation task
{
  "prompt_table": {
    "spreadsheetId": "1abc...",
    "sheetName": "Prompts",
    "cellAddress": "B2"  // Translation prompt
  }
}

// Config 2: Summarization task
{
  "prompt_table": {
    "spreadsheetId": "1abc...",
    "sheetName": "Prompts",
    "cellAddress": "B3"  // Summary prompt
  }
}
```

---

## FAQ

### Q: Can I use ranges instead of single cells?

**A:** Yes! Use A1 notation for ranges:
```javascript
{
  "cellAddress": "B2:B5"  // Concatenates B2, B3, B4, B5
}
```

---

### Q: Does prompt_table work with templates?

**A:** Yes! Save configuration with prompt_table to template:
```javascript
serverSaveTemplate('Remote Translation', {
  prompt_table: { ... },
  userData: [ ... ]
})
```

---

### Q: Can I mix local and remote?

**A:** No, it's either local OR remote:
- If `prompt_table` set → uses remote
- If `systemPrompt` set → uses local
- Priority: prompt_table > systemPrompt

---

### Q: What happens if remote sheet is deleted?

**A:** Error will occur when executing. System logs:
```
❌ Cannot access remote sheet: [spreadsheet ID]
```

**Fallback:** Reconfigure to use local prompt.

---

### Q: Performance impact?

**A:** Minimal:
- Remote read: ~100-300ms
- Local read: ~50-100ms
- Difference: ~200ms per request

**Caching:** Future versions may cache remote prompts.

---

## Resources

- **API Reference:** [API.md](API.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Developer Guide:** [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)

---

**Feature Version:** 3.5.2+  
**Last Updated:** December 2025
