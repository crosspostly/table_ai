# Table AI - API Reference

**Version:** 3.5.2+  
**Last Updated:** December 2025

This document provides comprehensive API documentation for Table AI's server endpoints, client functions, and integration points.

---

## Table of Contents

- [Server API Endpoints](#server-api-endpoints)
- [Client-Side Functions](#client-side-functions)
- [Gemini AI Functions](#gemini-ai-functions)
- [OTA Update API](#ota-update-api)
- [License API](#license-api)
- [Template API](#template-api)
- [OCR API](#ocr-api)
- [Error Codes](#error-codes)

---

## Server API Endpoints

### Base URL

```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

All POST requests should use `Content-Type: application/json`.

### Health Check (GET)

**Endpoint:** `GET /`

**Description:** Check server status

**Response:**
```json
{
  "ok": true,
  "ping": "pong",
  "time": "2025-12-11T10:30:00.000Z"
}
```

---

### Gemini Text Generation

**Endpoint:** `POST /`

**Action:** `gm`

**Request:**
```json
{
  "action": "gm",
  "email": "user@example.com",
  "token": "license-token-here",
  "apiKey": "optional-api-key",
  "prompt": "Your prompt here",
  "maxTokens": 25000,
  "temperature": 0.7
}
```

**Parameters:**
- `action` (required): Must be `"gm"`
- `email` (required): User email for license check
- `token` (required): License token
- `apiKey` (optional): Personal Gemini API key (falls back to server key)
- `prompt` (required): Text prompt for Gemini
- `maxTokens` (optional): Maximum tokens (default: 25000)
- `temperature` (optional): Creativity level 0-1 (default: 0.7)

**Success Response (200):**
```json
{
  "ok": true,
  "data": "Generated text response from Gemini"
}
```

**Error Response (400/403/500):**
```json
{
  "ok": false,
  "error": "Error message"
}
```

---

### Gemini Vision/Image (OCR)

**Endpoint:** `POST /`

**Action:** `gm_image`

**Request:**
```json
{
  "action": "gm_image",
  "email": "user@example.com",
  "token": "license-token-here",
  "apiKey": "optional-api-key",
  "images": [
    {
      "mimeType": "image/png",
      "data": "base64-encoded-image-data"
    }
  ],
  "lang": "ru",
  "delimiter": "____"
}
```

**Parameters:**
- `action` (required): Must be `"gm_image"`
- `email` (required): User email
- `token` (required): License token
- `apiKey` (optional): Personal Gemini API key
- `images` (required): Array of image objects
  - `mimeType`: Image MIME type (e.g., `image/png`, `image/jpeg`)
  - `data`: Base64-encoded image data
- `lang` (optional): OCR language (default: `"ru"`)
- `delimiter` (optional): Text delimiter between multiple images

**Success Response (200):**
```json
{
  "ok": true,
  "data": "Extracted text from images"
}
```

---

### License Status Check

**Endpoint:** `POST /`

**Action:** `status`

**Request:**
```json
{
  "action": "status",
  "email": "user@example.com",
  "token": "license-token-here"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "until": "2026-12-31T23:59:59.000Z",
  "row": 5
}
```

**Error Response (403):**
```json
{
  "ok": false,
  "error": "LICENSE_EXPIRED"
}
```

---

### OTA Update Check

**Endpoint:** `POST /`

**Action:** `ota`, **Subaction:** `checkUpdates`

**Request:**
```json
{
  "action": "ota",
  "subaction": "checkUpdates",
  "email": "user@example.com",
  "token": "license-token-here",
  "clientVersion": "3.5.2"
}
```

**Success Response (200):**
```json
{
  "updateAvailable": true,
  "serverVersion": "3.5.3",
  "clientVersion": "3.5.2"
}
```

---

### OTA Apply Updates

**Endpoint:** `POST /`

**Action:** `ota`, **Subaction:** `applyUpdates`

**Request:**
```json
{
  "action": "ota",
  "subaction": "applyUpdates",
  "email": "user@example.com",
  "token": "license-token-here",
  "scriptId": "script-id-here",
  "spreadsheetId": "spreadsheet-id-here"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "version": "3.5.3",
  "message": "Client updated successfully"
}
```

---

## Client-Side Functions

These functions are available in the Google Sheets client (Main.gs).

### Menu Functions

#### `onOpen()`
Creates the Table AI menu when the spreadsheet is opened.

**Usage:** Automatic (trigger)

---

#### `openSettingsUI()`
Opens the settings dialog for API key and license configuration.

**Usage:**
```javascript
// Menu: 🤖 Table AI → ⚙️ Настройки
```

---

#### `openCollectConfigUI()`
Opens the AI Constructor interface.

**Usage:**
```javascript
// Menu: 🤖 Table AI → 🛠️ AI Constructor
```

---

### Configuration Functions

#### `getSettingsData()`
Returns current settings (API key, email, token).

**Returns:**
```javascript
{
  apiKey: "AIza...",
  email: "user@example.com",
  token: "license-token"
}
```

---

#### `saveSettingsData(data)`
Saves user settings.

**Parameters:**
- `data.apiKey` (string): Gemini API key
- `data.email` (string): License email
- `data.token` (string): License token

**Returns:**
```javascript
{
  success: true,
  message: "Settings saved"
}
```

---

### Logging Functions

#### `addLog(message, level)`
Adds a log entry.

**Parameters:**
- `message` (string): Log message
- `level` (string): Log level (`INFO`, `WARN`, `ERROR`, `DEBUG`)

**Usage:**
```javascript
addLog('Operation completed', 'INFO');
addLog('Warning: rate limit approaching', 'WARN');
addLog('Error occurred', 'ERROR');
```

---

#### `getLogs(limit)`
Retrieves recent logs.

**Parameters:**
- `limit` (number): Maximum number of logs to retrieve (default: 100)

**Returns:** Array of log entries

---

#### `showLogsDialog()`
Opens a dialog showing recent logs.

**Usage:**
```javascript
// Menu: 🧰 DEV → 📝 Показать логи
```

---

#### `exportLogsToSheet()`
Exports logs to a new sheet named "Логи".

**Usage:**
```javascript
// Menu: 🧰 DEV → ⬇️ Экспорт логов
```

---

## Gemini AI Functions

These functions are used for AI operations in spreadsheet formulas.

### `GM(prompt, maxTokens, temperature)`

Main Gemini function for text generation.

**Parameters:**
- `prompt` (string): Text prompt for Gemini
- `maxTokens` (number, optional): Max tokens (default: 25000)
- `temperature` (number, optional): 0-1 creativity (default: 0.7)

**Returns:** Generated text or error message

**Usage in spreadsheet:**
```
=GM("Translate to English: " & A2, 2000, 0.7)
=GM(Prompt_box!E2, 25000, 0.7)
```

---

### `GM_IF(condition, prompt, maxTokens, temperature)`

Conditional Gemini call.

**Parameters:**
- `condition` (boolean): Condition to evaluate
- `prompt` (string): Prompt if condition is true
- `maxTokens` (number, optional): Max tokens
- `temperature` (number, optional): Creativity level

**Returns:** Generated text if condition is true, empty string otherwise

**Usage:**
```
=GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)
=GM_IF(LEN(A2)>0, "Summarize: " & A2, 5000, 0.5)
```

---

## OTA Update API

### Client Functions

#### `checkForUpdatesBackground_()`
Background OTA check (triggered automatically at 3:00 AM).

**Usage:** Automatic (time-based trigger)

---

#### `checkForUpdatesManual_()`
Manual OTA check triggered by user.

**Usage:**
```javascript
// Menu: 🤖 Table AI → 🔄 Автообновление
```

---

### Server Functions (Internal)

#### `checkForUpdates_(clientVersion, serverVersion)`
Compares versions and returns update availability.

---

#### `applyUpdatesToClient_(token, email, scriptId, spreadsheetId, sendEmail)`
Downloads files from GitHub and updates client script.

---

## License API

### `serverStatus(email, token)`

Checks license status on server.

**Parameters:**
- `email` (string): User email
- `token` (string): License token

**Returns:**
```javascript
{
  ok: true,
  until: "2026-12-31T23:59:59.000Z",
  row: 5
}
```

---

### `validateLicense(email, token)`

Client-side license validation (without binding).

**Parameters:**
- `email` (string): User email
- `token` (string): License token

**Returns:**
```javascript
{
  success: true,
  message: "License valid",
  expiresAt: "2026-12-31"
}
```

---

## Template API

### `serverGetAllTemplates()`

Retrieves all saved templates for current user.

**Returns:**
```javascript
{
  "Template 1": {
    "systemPrompt": { "sheet": "Prompts", "cell": "A1" },
    "userData": [ { "sheet": "Data", "cell": "B:B" } ],
    "created": "2025-12-01T10:00:00.000Z",
    "updated": "2025-12-10T15:30:00.000Z",
    "version": "1.0"
  },
  "Template 2": { ... }
}
```

---

### `serverSaveTemplate(name, config)`

Saves a new template.

**Parameters:**
- `name` (string): Template name
- `config` (object): Template configuration

**Returns:**
```javascript
{
  success: true,
  message: "Template saved",
  size: 1024
}
```

---

### `serverDeleteTemplate(name)`

Deletes a template.

**Parameters:**
- `name` (string): Template name

**Returns:**
```javascript
{
  success: true,
  message: "Template deleted"
}
```

---

### `serverGetTemplatesStats()`

Gets statistics about saved templates.

**Returns:**
```javascript
{
  count: 5,
  maxCount: 50,
  totalSize: 25600,
  maxSize: 512000,
  oldestTemplate: "Template 1",
  newestTemplate: "Template 5",
  templates: ["Template 1", "Template 2", ...]
}
```

---

## OCR API

### `ocrRun()`

Batch OCR processing for images in a sheet.

**Description:**
- Reads image URLs from cells
- Sends images to server for OCR processing
- Writes extracted text back to cells

**Usage:**
```javascript
// Menu: 🤖 Table AI → 📸 OCR Batch
```

---

## Error Codes

### License Errors

| Code | Description | Solution |
|------|-------------|----------|
| `LICENSE_EXPIRED` | License has expired | Renew license |
| `LICENSE_NOT_FOUND` | Email/token not found | Check credentials |
| `LICENSE_INVALID` | Invalid token format | Contact support |
| `NO_COPIES_LEFT` | No copies remaining | Purchase more copies |

### API Errors

| Code | Description | Solution |
|------|-------------|----------|
| `NO_API_KEY_AVAILABLE` | No Gemini API key configured | Set API key in settings |
| `API_RATE_LIMIT` | Rate limit exceeded | Wait and retry |
| `API_QUOTA_EXCEEDED` | Daily quota exceeded | Wait 24h or use different key |
| `INVALID_PROMPT` | Empty or too long prompt | Check prompt length (<50k chars) |

### OTA Errors

| Code | Description | Solution |
|------|-------------|----------|
| `NO_SCRIPT_ID` | Script ID not in Bindings | Check Bindings sheet |
| `DOWNLOAD_FAILED` | Cannot download from GitHub | Check network/GitHub status |
| `UPDATE_FAILED` | Cannot update script | Check permissions |
| `VERSION_CHECK_FAILED` | Cannot check version | Check server connection |

### Server Errors

| Code | Description | Solution |
|------|-------------|----------|
| `NETWORK_ERROR` | Cannot reach server | Check internet connection |
| `SERVER_TIMEOUT` | Server not responding | Retry later |
| `INVALID_REQUEST` | Malformed request | Check request format |

---

## Rate Limits

### Gemini API (Free Tier)

- **RPM** (Requests Per Minute): 10
- **RPD** (Requests Per Day): 20
- **TPM** (Tokens Per Minute): 250,000

**Multi-Key Rotation:** Use 6 keys to get 120 RPD total.

### Server Rate Limits

- **Per-token limit**: 3 requests/second
- **Global limit**: 10 requests/minute (if configured)

---

## Authentication

### API Key Priority

1. **Personal Key** (UserProperties) - Highest priority
2. **Sheet Key** (ScriptProperties) - Client-level
3. **Server Key** (Server ScriptProperties) - Fallback

### License Authentication

All server requests (except `status`) require:
- `email`: User email
- `token`: License token

Server validates against license spreadsheet.

---

## Example: Complete Workflow

### 1. Initialize Settings

```javascript
// User opens settings
openSettingsUI();

// User enters:
// - API Key: AIza...
// - Email: user@example.com
// - Token: abc123...

// System saves:
saveSettingsData({
  apiKey: "AIza...",
  email: "user@example.com",
  token: "abc123..."
});
```

### 2. Use AI Constructor

```javascript
// User opens AI Constructor
openCollectConfigUI();

// User configures:
// - System Prompt: Prompt_box!E2
// - User Data: Data!B:B
// - Target Cell: Results!A2

// System executes:
saveAndExecuteCollectConfig("Results", "A2", {
  systemPrompt: { sheet: "Prompt_box", cell: "E2" },
  userData: [{ sheet: "Data", cell: "B:B" }]
});

// Server processes:
// 1. Read system prompt from Prompt_box!E2
// 2. Read data from Data!B:B
// 3. Combine into final prompt
// 4. Call Gemini API
// 5. Write result to Results!A2
```

### 3. Automatic Updates

```javascript
// Every night at 3:00 AM:
checkForUpdatesBackground_();

// System:
// 1. Checks license
// 2. Compares CLIENT_VERSION vs SERVER_VERSION
// 3. If update available:
//    - Downloads files from GitHub
//    - Updates script via Apps Script API
//    - Sends email notification
```

---

## cURL Examples

### Check Server Status

```bash
curl "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
```

### Text Generation

```bash
curl -X POST "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "gm",
    "email": "user@example.com",
    "token": "your-token",
    "prompt": "Translate to English: Привет, мир!",
    "maxTokens": 1000,
    "temperature": 0.7
  }'
```

### OCR Request

```bash
curl -X POST "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "gm_image",
    "email": "user@example.com",
    "token": "your-token",
    "images": [{
      "mimeType": "image/png",
      "data": "iVBORw0KGgo..."
    }],
    "lang": "ru"
  }'
```

### License Check

```bash
curl -X POST "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "status",
    "email": "user@example.com",
    "token": "your-token"
  }'
```

---

## Additional Resources

- **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **OTA Updates:** [OTA_UPDATES.md](OTA_UPDATES.md)
- **License System:** [LICENSE_SYSTEM.md](LICENSE_SYSTEM.md)
- **Deployment:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Developer Guide:** [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)

---

**Last Updated:** December 2025  
**Version:** 3.5.2+
