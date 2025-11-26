# Table AI — Комплексный справочник публичного API

Версия: 3.0.0 (обновлено)
Дата: 2025-06-18

Этот документ объединяет все публичные API, функции и компоненты проекта. Он включает вызываемые функции Apps Script, веб-эндпоинты и методы пользовательского интерфейса с примерами использования.

## Примечания
- Публичные API исключают внутренние вспомогательные функции. По соглашению, имена функций, заканчивающиеся на подчеркивание (например, `checkLicense_`) или начинающиеся с подчеркивания (например, `_getTemplateStorageWithLock`), считаются внутренними и опущены, если они не релевантны для контекста.
- Пути в обратных кавычках относятся к файлам в этом репозитории.

---

## Содержание
- Клиент (Google Sheets)
  - Функции Gemini
  - Умные цепочки и вспомогательные функции
  - Импорт VK и утилиты
  - UI, настройки, логирование, триггеры
- Система Collect Config (UI + эндпоинты)
- TemplateService (бизнес-логика)
- Сервер (Apps Script Web App)
- OCR
- Общие утилиты
  - Utils
  - LoggingService
  - DetailedLogger
  - EmojiRemover
  - VersionInfo
  - SecurityValidator
- Клиент ↔ Сервер (google.script.run) примеры
- Примеры cURL для серверных эндпоинтов

---

## Клиент (Google Sheets)
Файл: `deploy/Main.gs`

### Функции Gemini
- `GM(prompt, maxTokens = 25000, temperature = 0.7): string`
  - Вызов Gemini через лицензированный серверный прокси с кэшированием и пост-обработкой Markdown.
  - Генерирует ошибку для невалидного промпта (пустой или > 50,000 символов). Возвращает `"Error: ..."` при ошибках.
  - Пример (формула в таблице):
    ```
    =GM("Проанализируй данные: " & A2, 2000, 0.7)
    ```

- `GM_IF(condition, prompt, maxTokens, temperature): string`
  - Условный вызов Gemini. Вычисляет `condition` в boolean (поддерживает диапазоны/массивы, числа, строки). Если false → возвращает пустую строку. Если true → вызывает `GM`.
  - Пример:
    ```
    =GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)
    ```

### Умные цепочки и вспомогательные функции
- `prepareChainSmart(): void`
  - Использует цели `Prompt_box!B` если присутствуют; иначе возвращается к фиксированной цепочке A3→B3..G3.

- `prepareChainFromPromptBox(): void`
  - Размещает формулы `GM_IF` в целевых ячейках, указанных в `Prompt_box!B2:B`, связывая шаги используя фразу завершения.

- `prepareChainForA3(): void`
  - Размещает формулы `GM_IF` в `Распаковка!B3..G3` связанные с `A3` и фразой завершения.

- `clearChainForA3(): void`
  - Очищает значения `Распаковка!B3..G3`.

- `refreshCurrentGMCell(): void`
  - Повторно применяет формулу в активной ячейке для принудительного пересчета.

- `getCompletionPhrase(): string`
  - Читает фразу завершения из `Параметры!B10` → Script Properties → константа по умолчанию.

- `isCompletionReady(text: string): boolean`
  - Проверяет, начинается ли `text` с фразы завершения.

- `parseTargetA1(a1: string): {sheetName,row,col,a1}`
  - Парсит нотацию A1, по умолчанию используя лист `Распаковка` когда опущен.

- `columnToLetter(column: number): string`
- `letterToColumn(letters: string): number`

### Импорт VK и утилиты
- `importVkPosts(): void`
  - Импортирует посты через `VK_PARSER_URL` используя owner и count из `Параметры!B1:B2`, записывает в лист `посты` и подготавливает фильтрующие формулы.

- `createStopWordsFormulas(sheet, totalRows): void`
  - Заполняет колонки E-J фильтрующими и нумерующими формулами (логика стоп/промо слов).

- `applyUniformFormatting(sheet): void`
  - Применяет единое форматирование для листа.

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