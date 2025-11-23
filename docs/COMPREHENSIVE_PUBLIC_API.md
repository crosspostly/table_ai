# Table AI — Comprehensive Public API Reference

Version: 3.0 (generated)
Date: 2025-10-23

This document consolidates all public APIs, functions, and components exposed by the project. It focuses on callable Apps Script functions, web endpoints, and UI-facing methods, with examples and usage guidance.

Notes
- Public APIs exclude internal helpers. As a convention here, function names ending with an underscore (e.g., `checkLicense_`) or starting with an underscore (e.g., `_getTemplateStorageWithLock`) are considered internal and omitted unless relevant for context.
- Paths in backticks refer to files in this repository.

---

## Contents
- Client (Google Sheets)
  - Gemini functions
  - Smart chains & helpers
  - VK import & utilities
  - UI, settings, logging, triggers
- Collect Config System (UI + endpoints)
- TemplateService (business logic)
- Server (Apps Script Web App)
- OCR
- Shared Utilities
  - Utils
  - LoggingService
  - DetailedLogger
  - EmojiRemover
  - VersionInfo
  - SecurityValidator
- Client ↔ Server (google.script.run) examples
- cURL examples for server endpoints

---

## Client (Google Sheets)
File: `deploy/Main.gs`

### Gemini functions
- `GM(prompt, maxTokens = 25000, temperature = 0.7): string`
  - Call Gemini via licensed server proxy with caching and Markdown post-processing.
  - Throws for invalid prompt (empty or > 50,000 chars). Returns `"Error: ..."` on failures.
  - Example (Spreadsheet formula):
    ```
    =GM("Проанализируй данные: " & A2, 2000, 0.7)
    ```

- `GM_IF(condition, prompt, maxTokens, temperature): string`
  - Conditional Gemini call. Evaluates `condition` to boolean (supports ranges/arrays, numbers, strings). If false → returns empty string. If true → calls `GM`.
  - Example:
    ```
    =GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)
    ```

### Smart chains & helpers
- `prepareChainSmart(): void`
  - Uses `Prompt_box!B` targets if present; otherwise falls back to fixed A3→B3..G3 chain.

- `prepareChainFromPromptBox(): void`
  - Places `GM_IF` formulas in target cells specified by `Prompt_box!B2:B`, chaining steps using the completion phrase.

- `prepareChainForA3(): void`
  - Places `GM_IF` formulas in `Распаковка!B3..G3` chained off `A3` and the completion phrase.

- `clearChainForA3(): void`
  - Clears `Распаковка!B3..G3` values.

- `refreshCurrentGMCell(): void`
  - Re-applies the formula in the active cell to force recalculation.

- `getCompletionPhrase(): string`
  - Reads completion phrase from `Параметры!B10` → Script Properties → default constant.

- `isCompletionReady(text: string): boolean`
  - Checks if `text` starts with completion phrase.

- `parseTargetA1(a1: string): {sheetName,row,col,a1}`
  - Parses A1 notation, defaulting sheet to `Распаковка` when omitted.

- `columnToLetter(column: number): string`
- `letterToColumn(letters: string): number`

### VK import & utilities
- `importVkPosts(): void`
  - Imports posts via `VK_PARSER_URL` using owner and count from `Параметры!B1:B2`, writes to `посты` sheet, and prepares filtering formulas.

- `createStopWordsFormulas(sheet, totalRows): void`
  - Populates E–J columns with filtering and numbering formulas (stop/promo words logic).

- `applyUniformFormatting(sheet): void`
  - Uniform formatting for a sheet.

### UI, settings, logging, triggers
- `openSettingsUI(): void`
- `getSettingsData(): {apiKey,email,token}`
- `saveSettingsData(data): {success:boolean, message:string}`
- `initGeminiKey(): void`
- `showGeminiKeyHelp(): void`

- `checkLicenseStatusUI(): void`
  - Shows license status via server `status` action.

- `onOpen(): void` (trigger)
  - Builds main menus, including AI Constructor, VK import, OCR, and DEV.

- `onEdit(e): void` (trigger)
  - Auto-converts Markdown in `Распаковка!B3..G3`.

- Logging helpers
  - `addLog(msg, level = 'INFO'): void`
  - `getLogs(limit = 100): string`
  - `showLogsDialog(): void`
  - `exportLogsToSheet(): void`
  - `clearLogs(): void`
  - `refreshSelectedGMTriggers(): void`

- Dev/diagnostics
  - `cleanupOldTriggers(): string`
  - `showActiveTriggersDialog(): void`
  - `runDevSelfTest(): void`

---

## Collect Config System (UI + endpoints)
Files: `deploy/CollectConfigUi.html`, `deploy/CollectConfig.gs`, `deploy/TemplateService.gs`

High-level flow
1) `openCollectConfigUI()` opens modal UI.
2) UI calls server endpoints via `google.script.run`.
3) Config is saved in hidden `ConfigData` sheet per target cell.
4) `executeCollectConfig()` reads configured ranges, builds final prompt, calls `GM`, and writes result to the target cell.

Primary UI entrypoints (callable from menu/UI)
- `openCollectConfigUI(): void`
- `getCollectConfigInitData(): {sheetName, cellAddress, sheets, version, lastUpdate, logs}`
- `refreshCellWithConfig(): void`
- `openTemplatesUI(): void`
- `showCollectConfigHelp(): void`

Execution & storage
- `saveAndExecuteCollectConfig(sheetName, cellAddress, config): {success, result?, error?, logs}`
- `executeCollectConfig(sheetName, cellAddress): {success, result?}|{success:false, error}`
- `readData(sheetName, cellAddress): string`
  - Reads A1/column/range, flattens and joins non-empty values with newlines.
- `getCellPreview(sheetName, cellAddress): string`
- `saveCollectConfig(sheetName, cellAddress, config): boolean`
- `loadCollectConfig(sheetName, cellAddress): {systemPrompt?, userData[]} | null`
- `updateLastRun(sheetName, cellAddress): void`
- `deleteCollectConfig(sheetName, cellAddress): {success:boolean, message:string}`
- `getAllSheetNames(): string[]`
- `hasConfigForCurrentCell(): boolean`

Template endpoints (used by UI via `google.script.run`)
- `serverGetAllTemplates(): { [name: string]: TemplateConfig }`
- `serverGetTemplate(templateName: string): TemplateConfig | null`
- `serverSaveTemplate(templateName: string, config: TemplateConfig): {success, message, size?}`
- `serverDeleteTemplate(templateName: string): {success, message}`
- `serverGetTemplatesStats(): {count, maxCount, totalSize, maxSize, oldestTemplate?, newestTemplate?, templates: string[]}`

TemplateConfig shape (typical)
```json
{
  "systemPrompt": {"sheet": "Prompt_box", "cell": "E2"},
  "userData": [ {"sheet": "Отзывы", "cell": "B:B"} ]
}
```

Usage (from HTML/Client)
```javascript
google.script.run
  .withSuccessHandler((templates) => { console.log(templates); })
  .withFailureHandler((err) => { alert(err.message); })
  .serverGetAllTemplates();
```

---

## TemplateService (business logic)
File: `deploy/TemplateService.gs`

Public API
- `getAllTemplates(user?: string): Record<string, TemplateWithMeta | TemplateConfig>`
- `getTemplate(user: string, templateName: string): TemplateWithMeta | TemplateConfig | null`
- `saveTemplate(user: string, templateName: string, config: TemplateConfig): {success, message, size?}`
- `deleteTemplate(user: string, templateName: string): {success, message}`
- `replaceAllTemplates(user: string, newTemplates: Record<string, Template|TemplateWithMeta>): {success, message, count?}`
- `exportTemplatesJSON(user?: string): string`
- `getTemplatesStats(user?: string): {count, maxCount, totalSize, maxSize, oldestTemplate?, newestTemplate?, templates: string[]}`

Notes
- Enforces lock with `LockService` and validates sizes (8KB/template guard, ~500KB total Properties limit).
- `TemplateWithMeta` extends config with `created`, `updated`, `version` fields.

Example (programmatic)
```javascript
const user = Session.getActiveUser().getEmail() || 'anonymous';
const cfg = { systemPrompt: {sheet: 'Prompt_box', cell: 'E2'}, userData: [{sheet: 'Отзывы', cell: 'B:B'}] };
const res = saveTemplate(user, 'Перевод EN', cfg);
if (!res.success) throw new Error(res.message);
```

---

## Server (Apps Script Web App)
File: `deploy/server.gs`

Entry points
- `doGet(e): JSON` — health/ping
  - Response: `{ ok: true, ping: 'pong', time: ISOString }`

- `doPost(e): JSON` — main API router
  - License check for all actions except `status`.
  - Actions:
    - `gm` — text generation
      - Request: `{ action:'gm', email, token, apiKey, prompt, maxTokens?, temperature? }`
      - Response OK: `{ ok:true, data: string }`
    - `gm_image` — image (Vision) OCR/transcription prompt
      - Request: `{ action:'gm_image', email, token, apiKey, images:[{mimeType,data(Base64)}], lang?, delimiter? }`
      - Response OK: `{ ok:true, data: string }`
    - `status` — license check
      - Request: `{ action:'status', email, token }`
      - Response: `{ ok:boolean, error?:string, until?:ISOString, row?:number }`
  - Error responses: `{ ok:false, error:string }` with appropriate HTTP codes.
  - Rate limiting: `RATE_LIMIT_PER_SEC` per token.

---

## OCR
File: `deploy/ocrRunV2_client.gs`

- `ocrRun(): void`
  - Batch OCR for a sheet of image sources, leveraging server Vision endpoint via Gemini.
  - Extracts sources from cell formulas, rich text links, or direct URLs; writes results back, with optional multi-result handling.

---

## Client ↔ Server (google.script.run) examples
Load all templates into UI
```javascript
google.script.run
  .withSuccessHandler((templates) => {
    // { "Template 1": {...}, "Template 2": {...} }
    renderList(templates);
  })
  .withFailureHandler((error) => {
    console.error(error); alert(error.message);
  })
  .serverGetAllTemplates();
```

Save and delete templates
```javascript
const cfg = { prompt: 'Переведи: {{value}}', maxTokens: 10000, temperature: 0.7 };
google.script.run
  .withSuccessHandler((res) => { alert(res.success ? 'Saved' : 'Failed: ' + res.message); })
  .serverSaveTemplate('Перевод EN', cfg);

google.script.run
  .withSuccessHandler((res) => { alert(res.success ? 'Deleted' : 'Failed: ' + res.message); })
  .serverDeleteTemplate('Перевод EN');
```

Execute Collect Config for active cell
```javascript
google.script.run
  .withSuccessHandler((result) => {
    if (result.success) alert('OK'); else alert(result.error);
  })
  .saveAndExecuteCollectConfig(sheetName, cellAddress, config);
```

---

## cURL examples for server endpoints
Health check (GET)
```bash
curl -s "https://script.google.com/macros/s/YOUR_ID/exec"
```

Text generation (POST action=gm)
```bash
curl -s -X POST "https://script.google.com/macros/s/YOUR_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "gm",
    "email": "user@example.com",
    "token": "abcd1234",
    "apiKey": "YOUR_GEMINI_API_KEY",
    "prompt": "Hello, world",
    "maxTokens": 1000,
    "temperature": 0.7
  }'
```

Vision/OCR (POST action=gm_image)
```bash
curl -s -X POST "https://script.google.com/macros/s/YOUR_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "gm_image",
    "email": "user@example.com",
    "token": "abcd1234",
    "apiKey": "YOUR_GEMINI_API_KEY",
    "images": [ { "mimeType": "image/png", "data": "BASE64_DATA" } ],
    "lang": "ru",
    "delimiter": "____"
  }'
```

License status (POST action=status)
```bash
curl -s -X POST "https://script.google.com/macros/s/YOUR_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{ "action": "status", "email": "user@example.com", "token": "abcd1234" }'
```

---

## Quick usage recap
- Spreadsheet formulas:
  - `=GM("…", 25000, 0.7)` — call Gemini
  - `=GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)` — conditional call
- Open AI Constructor: Menu → 🤖 Table AI → 🎯 AI Конструктор → 🎯 Настроить запрос
- Templates: managed via `serverGetAllTemplates`, `serverSaveTemplate`, `serverDeleteTemplate`, `serverGetTemplatesStats`
- Logs: `showLogsDialog`, `exportLogsToSheet`, shared log utilities
- Server: `doPost` actions `gm`, `gm_image`, `status`

---

If you need additional examples or SDK snippets for a specific API, open an issue and reference the function name from this document.