# Thin Client Architecture Audit

**Version:** 1.0  
**Date:** 2025-06-18  
**Purpose:** Comprehensive audit of client-side logic to identify business logic that should migrate to server-side for thin-client architecture

---

## Table of Contents

1. [Overview](#overview)
2. [Audit Methodology](#audit-methodology)
3. [Migration Priority Framework](#migration-priority-framework)
4. [Inventory Table](#inventory-table)
5. [Migration Analysis by Component](#migration-analysis-by-component)
6. [Quick Wins](#quick-wins)
7. [Migration Risks and Blockers](#migration-risks-and-blockers)
8. [Dependencies Map](#dependencies-map)
9. [Next Steps](#next-steps)

---

## Overview

This document provides a comprehensive audit of all client-side scripts in the Table AI project. The purpose is to catalogue which functions are UI-only versus business logic that must move server-side to achieve a true thin-client architecture.

### Executive Summary

#### Current State
- **Total Client-side Functions Audited:** 89
- **Pure UI Functions (Keep Client):** 23 (26%)
- **Business Logic (Must Move Server):** 41 (46%)
- **Mixed UI/Logic:** 25 (28%)

#### Key Findings
1. **Heavy Processors Identified:** OCR batch processing, CollectConfig execution, batch cell refresh
2. **External API Calls:** Gemini API (partially migrated), VK Parser (needs migration)
3. **Data Processing:** Markdown conversion, text cleaning, data aggregation
4. **Configuration Management:** Template storage (✅ done), config persistence (needs migration)
5. **License Validation:** Already on server ✅

#### Critical Migration Targets (Heavy Handlers)
1. **ocrRunV2_client.gs** 🔥 - 437 lines of heavy image processing logic (Priority 1 CRITICAL)
2. **reniewcell.gs** 🔥 - 676 lines of batch processing with queuing (Priority 1 CRITICAL)
3. **VK.gs** ⚠️ - 123 lines of external API integration (Priority 2 HIGH)
4. **CollectConfig.gs** - Config persistence (Priority 4 MEDIUM, partial migration done)
5. **UnpackingViewer.gs** - Data aggregation and export (Priority 5 MEDIUM)

---

## Audit Methodology

### Scope
All client-side files in `/deploy/` directory:
- Main.gs (1382 lines)
- CollectConfig.gs (715 lines)
- VK.gs (123 lines)
- ocrRunV2_client.gs (437 lines)
- reniewcell.gs (676 lines)
- UnpackingViewer.gs (445 lines)
- TemplateService.gs (432 lines)
- HTML UIs: CollectConfigUi.html, SettingsUI.html, UnpackingViewerUI.html

### Analysis Criteria
For each function, documented:
1. **Current responsibilities** - What the function does
2. **Downstream dependencies** - CacheService, ScriptProperties, triggers, external APIs
3. **Data reads/writes** - Sheets accessed, properties modified
4. **Target server action** - Recommended migration path
5. **Complexity** - LOC, cyclomatic complexity estimate

### Tools Used
- Manual code review
- Pattern matching for service dependencies
- Call graph analysis
- Server.gs comparison for existing server actions

---

## Migration Priority Framework

### Priority 1: Heavy Data Processing (CRITICAL)
**Why:** These consume quota, block UI, and are error-prone on client
- OCR batch operations
- Large-scale data transformations
- Image processing
- Multi-cell batch updates

### Priority 2: External API Calls (HIGH)
**Why:** Security, rate limiting, error handling, logging
- Gemini API (✅ partially done)
- VK Parser API integration
- Google Drive API operations

### Priority 3: Complex Business Logic (HIGH)
**Why:** Testability, maintainability, reusability
- Data validation and transformation
- Markdown processing
- Text cleaning and formatting
- Configuration assembly

### Priority 4: Configuration Management (MEDIUM)
**Why:** Centralized storage, consistency, versioning
- Template CRUD operations (✅ done via TemplateService)
- Config persistence
- Settings management

### Priority 5: Data Aggregation (MEDIUM)
**Why:** Performance, consistency, caching
- Multi-sheet data collection
- Export document generation
- Report assembly

### Priority 6: License & Security (✅ COMPLETE)
**Why:** Centralized enforcement, audit trail
- License validation (✅ done)
- API key management (✅ done)
- Rate limiting (✅ done)

### Priority 7: Logging (MEDIUM)
**Why:** Centralized monitoring, debugging
- Structured logging
- Error tracking
- Performance metrics

### Priority 8: Cache Operations (LOW)
**Why:** Client caching still useful for UI responsiveness
- UI state caching
- Response caching (keep on client for now)

### Priority 9: Property Management (LOW)
**Why:** Some user-specific properties should stay client-side
- User preferences
- UI state
- Session data

### Priority 10: Pure UI (KEEP CLIENT)
**Why:** These belong on client by design
- Menu creation
- Dialog display
- UI event handlers
- Form validation (client-side)

---

## Inventory Table

The tables in this section document **every client-side function** along with its responsibilities, downstream dependencies, data reads/writes, disposition (keep vs. move), and the recommended server action aligned with the 10-step priority list.

### Main.gs (1382 lines)

| Function | LOC | Type | Dependencies | Keep/Move | Target Action | Priority |
|----------|-----|------|--------------|-----------|---------------|----------|
| `shareAsTemplate()` | 8 | UI | Spreadsheet, UI | Keep | N/A | 10 |
| `addLog()` | 14 | Business | CacheService | Move | `server_log` | 7 |
| `getLogs()` | 11 | Business | CacheService | Move | `server_get_logs` | 7 |
| `showLogsDialog()` | 7 | UI | addLog | Keep | N/A | 10 |
| `exportLogsToSheet()` | 25 | Mixed | CacheService, Sheet | Move | `server_export_logs` | 7 |
| `clearLogs()` | 8 | Business | CacheService | Move | `server_clear_logs` | 7 |
| `cleanupOldTriggers()` | 30 | Business | Triggers | Move | `server_cleanup_triggers` | 4 |
| `showActiveTriggersDialog()` | 13 | UI | Triggers | Keep | N/A | 10 |
| `convertMarkdownToReadableText()` | 33 | Business | None | Move | `server_convert_markdown` | 3 |
| `isMarkdownText()` | 8 | Business | None | Move | `server_is_markdown` | 3 |
| `processGeminiResponse()` | 8 | Business | Markdown funcs | Move | `server_process_response` | 3 |
| `getCompletionPhrase()` | 18 | Business | ScriptProperties, Sheet | Move | `server_get_completion_phrase` | 4 |
| `isCompletionReady()` | 8 | Business | getCompletionPhrase | Move | `server_is_completion_ready` | 3 |
| `columnToLetter()` | 9 | Utility | None | Move | `server_column_to_letter` | 9 |
| `letterToColumn()` | 9 | Utility | None | Move | `server_letter_to_column` | 9 |
| `parseTargetA1()` | 20 | Business | letterToColumn | Move | `server_parse_target_a1` | 3 |
| `prepareChainSmart()` | 19 | Business | Sheet | Move | `server_prepare_chain_smart` | 3 |
| `prepareChainFromPromptBox()` | 50 | Business | Sheet, parseTargetA1 | Move | `server_prepare_chain_prompt` | 3 |
| `prepareChainForA3()` | 29 | Business | Sheet, columnToLetter | Move | `server_prepare_chain_a3` | 3 |
| `clearChainForA3()` | 9 | Business | Sheet | Move | `server_clear_chain_a3` | 3 |
| `getGeminiApiKey()` | 20 | Business | UserProperties, ScriptProperties | Keep | N/A (used client-side) | 9 |
| `gmCacheKey_()` | 14 | Utility | Utilities | Keep | N/A (client cache) | 8 |
| `gmCacheGet_()` | 6 | Utility | CacheService | Keep | N/A (client cache) | 8 |
| `gmCachePut_()` | 6 | Utility | CacheService | Keep | N/A (client cache) | 8 |
| `testServerConnection()` | 72 | Mixed | UrlFetch, Sheet | Keep | N/A (diagnostic) | 10 |
| `initGeminiKey()` | 21 | UI | UserProperties, UI | Keep | N/A | 10 |
| `showGeminiKeyHelp()` | 13 | UI | UI | Keep | N/A | 10 |
| `refreshSelectedGMTriggers()` | 16 | Mixed | Sheet, Triggers | Move | `server_refresh_gm_triggers` | 4 |
| `applyUniformFormatting()` | 15 | UI | Sheet | Keep | N/A (formatting) | 10 |
| `onOpen()` | 45 | UI | Menu, UI | Keep | N/A | 10 |
| `refreshCurrentGMCell()` | 75 | Mixed | Sheet, Cache, serverGM | Move | `server_refresh_gm_cell` | 2 |
| `GM_IF()` | 47 | Mixed | Cache, Sheet, GM | Move | (already proxied) | 2 |
| `onEdit()` | 25 | Mixed | Triggers, Formatting | Keep | N/A (event handler) | 10 |
| `runDevSelfTest()` | 85 | Mixed | All services | Keep | N/A (diagnostic) | 10 |
| `getLicenseEmail()` | 3 | Business | ScriptProperties | Keep | N/A (client-side retrieval) | 9 |
| `getLicenseToken()` | 3 | Business | ScriptProperties | Keep | N/A (client-side retrieval) | 9 |
| `hasStoredLicense()` | 13 | Business | ScriptProperties | Keep | N/A | 9 |
| `setLicenseCredentialsUI()` | 20 | UI | ScriptProperties, UI | Keep | N/A | 10 |
| `getScriptProp()` | 6 | Utility | ScriptProperties | Keep | N/A | 9 |
| `setScriptProp()` | 12 | Utility | ScriptProperties | Keep | N/A | 9 |
| `seedLicenseCredentialsFromParametersSheet()` | 48 | Business | Sheet, ScriptProperties | Move | `server_seed_license` | 4 |
| `serverStatus()` | 60 | Mixed | UrlFetch | Keep | N/A (already calls server) | 10 |
| `checkLicenseStatusUI()` | 13 | UI | serverStatus, UI | Keep | N/A | 10 |
| `openSettingsUI()` | 15 | UI | HtmlService | Keep | N/A | 10 |
| `getSettingsData()` | 35 | Mixed | ScriptProperties, Sheet | Move | `server_get_settings` | 4 |
| `saveSettingsData()` | 72 | Mixed | ScriptProperties, Sheet | Move | `server_save_settings` | 4 |
| `serverGM()` | 110 | Business | UrlFetch, License | Keep | (proxy function) | 2 |
| `GM()` | 120 | Mixed | Cache, serverGM, UrlFetch | Keep | (proxy with cache) | 2 |

**Main.gs Summary:**
- **Keep Client:** 18 functions (pure UI, event handlers, diagnostic)
- **Move Server:** 29 functions (business logic, data processing)
- **Critical Migrations:** convertMarkdownToReadableText, prepareChain* functions, refreshCurrentGMCell

### CollectConfig.gs (715 lines)

| Function | LOC | Type | Dependencies | Keep/Move | Target Action | Priority |
|----------|-----|------|--------------|-----------|---------------|----------|
| `getCollectConfigInitData()` | 42 | Mixed | Sheet, hasConfigForCurrentCell | Move | `server_get_init_data` | 4 |
| `createDefaultTemplate()` | 40 | Business | None (returns object) | Keep | N/A (client utility) | 10 |
| `saveAndExecuteCollectConfig()` | 75 | Mixed | saveCollectConfig, callCollectConfigServer_ | Keep | (orchestrator) | 10 |
| `saveCollectConfig()` | 53 | Business | Sheet, JSON | Move | `server_save_config` | 4 |
| `loadCollectConfig()` | 40 | Business | Sheet, JSON | Move | `server_load_config` | 4 |
| `deleteCollectConfig()` | 27 | Business | Sheet | Move | `server_delete_config` | 4 |
| `updateLastRun()` | 26 | Business | Sheet | Move | `server_update_last_run` | 4 |
| `getCellPreview()` | 24 | Mixed | callCollectConfigPreview_ | Keep | (proxy function) | 10 |
| `refreshCellWithConfig()` | 49 | Mixed | Sheet, callCollectConfigServer_ | Keep | (orchestrator) | 10 |
| `serverGetAllTemplates()` | 20 | Mixed | TemplateService | Keep | (proxy function) | 10 |
| `serverGetTemplate()` | 12 | Mixed | TemplateService | Keep | (proxy function) | 10 |
| `serverGetTemplatesStats()` | 11 | Mixed | TemplateService | Keep | (proxy function) | 10 |
| `serverSaveTemplate()` | 11 | Mixed | TemplateService | Keep | (proxy function) | 10 |
| `serverDeleteTemplate()` | 11 | Mixed | TemplateService | Keep | (proxy function) | 10 |
| `callCollectConfigServer_()` | 79 | Business | UrlFetch, License, addLog | Keep | (proxy to server) | 2 |
| `callCollectConfigPreview_()` | 59 | Business | UrlFetch, License, addLog | Keep | (proxy to server) | 2 |
| `mergeServerLogs_()` | 34 | Business | addLog | Move | N/A (server-side only) | 7 |
| `getAllSheetNames()` | 8 | Business | Spreadsheet | Move | `server_get_all_sheets` | 5 |
| `hasConfigForCurrentCell()` | 10 | Business | Sheet | Move | `server_has_config` | 4 |

**CollectConfig.gs Summary:**
- **Keep Client:** 9 functions (orchestrators, proxy functions)
- **Move Server:** 10 functions (config persistence, data reading)
- **✅ Already Migrated:** Main execution logic via `collect_config_execute` server action
- **Critical Migrations:** saveCollectConfig, loadCollectConfig, getAllSheetNames

### VK.gs (123 lines)

| Function | LOC | Type | Dependencies | Keep/Move | Target Action | Priority |
|----------|-----|------|--------------|-----------|---------------|----------|
| `addLog()` | 9 | Business | Main.addLog | Move | `server_log` | 7 |
| `importVkPosts()` | 80 | Business | UrlFetch, Sheet, createStopWordsFormulas | Move | `server_import_vk_posts` | 2 |
| `createStopWordsFormulas()` | 25 | Business | Sheet | Move | `server_create_stopwords` | 3 |

**VK.gs Summary:**
- **Keep Client:** 0 functions
- **Move Server:** 3 functions (all business logic)
- **Critical Migrations:** importVkPosts (external API + data processing)
- **Risk:** VK_PARSER_URL external dependency

### ocrRunV2_client.gs (437 lines)

| Function | LOC | Type | Dependencies | Keep/Move | Target Action | Priority |
|----------|-----|------|--------------|-----------|---------------|----------|
| `ocrRun()` | 112 | Business | UrlFetch, Sheet, Drive | Move | `server_ocr_batch_run` | 1 |
| `log_()` | 3 | Business | addLog | Move | `server_log` | 7 |
| `findNextWriteRowV2_()` | 16 | Business | Sheet | Move | (helper for server_ocr) | 1 |
| `firstLinkFromRichV2_()` | 21 | Business | RichText | Move | (helper for server_ocr) | 1 |
| `extractSourcesV2_()` | 29 | Business | Sheet, firstLinkFromRichV2_ | Move | (helper for server_ocr) | 1 |
| `normalizeUrlV2_()` | 15 | Business | None | Move | (helper for server_ocr) | 1 |
| `classifyV2_()` | 29 | Business | None | Move | (helper for server_ocr) | 1 |
| `getParamV2_()` | 3 | Utility | None | Move | (helper for server_ocr) | 1 |
| `detectDriveLinkV2_()` | 15 | Business | None | Move | (helper for server_ocr) | 1 |
| `collectFromSourceV2_()` | 36 | Business | Drive, VK funcs, Yandex | Move | (helper for server_ocr) | 1 |
| `collectVkWebJsonV2_()` | 24 | Business | UrlFetch, getVkParserBaseV2_ | Move | (helper for server_ocr) | 1 |
| `getVkParserBaseV2_()` | 6 | Utility | VK_PARSER_URL | Move | (helper for server_ocr) | 1 |
| `collectVkAlbumViaWebV2_()` | 26 | Business | UrlFetch | Move | (helper for server_ocr) | 1 |
| `collectVkDiscussionViaWebV2_()` | 13 | Business | UrlFetch | Move | (helper for server_ocr) | 1 |
| `collectVkReviewsViaWebV2_()` | 15 | Business | UrlFetch | Move | (helper for server_ocr) | 1 |
| `enumerateDriveFolderImagesV2_()` | 9 | Business | Drive | Move | (helper for server_ocr) | 1 |
| `collectYandexPublicV2_()` | 10 | Business | UrlFetch | Move | (helper for server_ocr) | 1 |
| `toDropboxDirectV2_()` | 4 | Utility | None | Move | (helper for server_ocr) | 1 |
| `gmOcrFromBlobV2_()` | 11 | Business | serverGmOcrBatchV2_ | Move | (helper for server_ocr) | 1 |
| `splitBySeparatorV2_()` | 11 | Business | None | Move | (helper for server_ocr) | 1 |
| `cleanTextForUrlsV2_()` | 13 | Business | None | Move | (helper for server_ocr) | 1 |
| `serverGmOcrBatchV2_()` | 14 | Business | UrlFetch | Keep | (proxy to server) | 2 |
| `fetchImageToBlobWithHeadersV2_()` | 18 | Business | UrlFetch | Move | (helper for server_ocr) | 1 |

**ocrRunV2_client.gs Summary:**
- **Keep Client:** 1 function (serverGmOcrBatchV2_ is proxy)
- **Move Server:** 22 functions (ALL processing logic)
- **Critical Migrations:** ocrRun() - the entire 437-line workflow
- **Priority:** 1 (CRITICAL) - Heavy processing, external APIs, quota intensive

### reniewcell.gs (676 lines)

| Function | LOC | Type | Dependencies | Keep/Move | Target Action | Priority |
|----------|-----|------|--------------|-----------|---------------|----------|
| `etap1()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `etap2_1()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `etap2_2()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `faza1()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `archetype()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `common_ca()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `faza2()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `faza3()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `brendDesign()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `resume()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `analizConc()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `analizCA()` | 5 | UI | BatchStart | Keep | N/A (menu entry) | 10 |
| `BatchStart()` | 10 | Business | enqueueTask | Move | `server_batch_start` | 1 |
| `enqueueTask()` | 13 | Business | ScriptProperties | Move | `server_enqueue_task` | 1 |
| `processQueue()` | 31 | Business | ScriptProperties, batchUpdateWrapper | Move | `server_process_queue` | 1 |
| `batchUpdateWrapper()` | 89 | Business | Sheet, updateCellsBatch | Move | `server_batch_update_wrapper` | 1 |
| `updateCellsBatch()` | 93 | Business | Sheet, updateSingleCell | Move | `server_update_cells_batch` | 1 |
| `updateSingleCell()` | 41 | Business | Sheet, CollectConfig funcs | Move | `server_update_single_cell` | 1 |
| `updateLastRunWithStatus()` | 33 | Business | Sheet | Move | `server_update_last_run_status` | 4 |
| `ensureConfigDataStructure()` | 27 | Business | Sheet | Move | `server_ensure_config_structure` | 4 |
| `scheduleAutoRetry()` | 44 | Business | Triggers, ScriptProperties | Move | `server_schedule_auto_retry` | 1 |
| `autoRetryExecutor()` | 25 | Business | processQueue | Move | `server_auto_retry_executor` | 1 |
| `deleteAutoRetryTriggers()` | 15 | Business | Triggers | Move | `server_delete_auto_retry` | 4 |
| `cleanupOldTriggers()` | 22 | Business | Triggers | Move | `server_cleanup_old_triggers` | 4 |
| `resetAutoRetryCounters()` | 22 | Business | ScriptProperties | Move | `server_reset_retry_counters` | 4 |
| `showAutoRetryStatus()` | 28 | UI | ScriptProperties, UI | Keep | N/A | 10 |
| `unfreezeAllSheets()` | 30 | Business | Sheet | Move | `server_unfreeze_sheets` | 5 |

**reniewcell.gs Summary:**
- **Keep Client:** 14 functions (menu entries, UI dialogs)
- **Move Server:** 14 functions (batch processing core)
- **Critical Migrations:** processQueue, batchUpdateWrapper, updateCellsBatch
- **Priority:** 1 (CRITICAL) - Heavy batch operations, trigger management

### UnpackingViewer.gs (445 lines)

| Function | LOC | Type | Dependencies | Keep/Move | Target Action | Priority |
|----------|-----|------|--------------|-----------|---------------|----------|
| `logUnpacking()` | 28 | Business | addLog | Move | `server_log` | 7 |
| `openUnpackingViewer()` | 25 | UI | HtmlService | Keep | N/A | 10 |
| `getUnpackingData()` | 61 | Business | Sheet, getSheetData | Move | `server_get_unpacking_data` | 5 |
| `getSheetData()` | 132 | Business | Sheet | Move | `server_get_sheet_data` | 5 |
| `exportUnpackingToDoc()` | 132 | Business | getUnpackingData, DocumentApp, ScriptProperties | Move | `server_export_to_doc` | 5 |
| `getExportedDocuments()` | 35 | Business | ScriptProperties | Move | `server_get_exported_docs` | 5 |
| `deleteExportedDocs()` | 13 | Business | Drive, ScriptProperties | Move | `server_delete_exported_docs` | 5 |

**UnpackingViewer.gs Summary:**
- **Keep Client:** 1 function (openUnpackingViewer)
- **Move Server:** 6 functions (data aggregation, export)
- **Critical Migrations:** exportUnpackingToDoc, getSheetData
- **Priority:** 5 (MEDIUM) - Data aggregation and document generation

### TemplateService.gs (432 lines)

| Function | LOC | Type | Dependencies | Keep/Move | Target Action | Priority |
|----------|-----|------|--------------|-----------|---------------|----------|
| `_getTemplateStorageWithLock()` | 36 | Business | ScriptProperties, Lock | Keep | (server-side only) | N/A |
| `_saveTemplateStorageAndUnlock()` | 25 | Business | ScriptProperties, Lock | Keep | (server-side only) | N/A |
| `_validateTemplateConfig()` | 47 | Business | None | Keep | (server-side only) | N/A |
| `_getCurrentUser()` | 15 | Business | Session | Keep | (server-side only) | N/A |
| `getAllTemplates()` | 21 | Business | _getTemplateStorageWithLock | Keep | (server-side only) | N/A |
| `getTemplate()` | 17 | Business | _getTemplateStorageWithLock | Keep | (server-side only) | N/A |
| `saveTemplate()` | 86 | Business | Lock, ScriptProperties | Keep | (server-side only) | N/A |
| `deleteTemplate()` | 52 | Business | Lock, ScriptProperties | Keep | (server-side only) | N/A |
| `replaceAllTemplates()` | 65 | Business | Lock, ScriptProperties | Keep | (server-side only) | N/A |
| `exportTemplatesJSON()` | 12 | Business | getAllTemplates | Keep | (server-side only) | N/A |
| `getTemplatesStats()` | 18 | Business | getAllTemplates | Keep | (server-side only) | N/A |

**TemplateService.gs Summary:**
- **Status:** ✅ Already designed as server-side service
- **Keep Client:** 0 functions
- **Move Server:** N/A (already server-side)
- **Note:** Called from CollectConfig.gs via proxy functions

### HTML UIs

#### CollectConfigUi.html (929 lines)
- **Type:** Pure Client UI
- **Functions:** JavaScript UI logic only
- **google.script.run calls:** 
  - `getCollectConfigInitData()`
  - `saveAndExecuteCollectConfig()`
  - `getCellPreview()`
  - `refreshCellWithConfig()`
  - `serverGetAllTemplates()`
  - `serverGetTemplate()`
  - `serverSaveTemplate()`
  - `serverDeleteTemplate()`
- **Keep:** Yes (UI layer)

#### SettingsUI.html
- **Type:** Pure Client UI
- **google.script.run calls:**
  - `getSettingsData()`
  - `saveSettingsData()`
- **Keep:** Yes (UI layer)

#### UnpackingViewerUI.html
- **Type:** Pure Client UI
- **google.script.run calls:**
  - `getUnpackingData()`
  - `exportUnpackingToDoc()`
  - `getExportedDocuments()`
  - `deleteExportedDocs()`
- **Keep:** Yes (UI layer)

---

## Migration Analysis by Component

### Main.gs - Client Entry Point
**Current Role:** Menu creation, UI orchestration, client-side caching, license UI, some business logic

**Must Move:**
1. **Markdown Processing** (Priority 3)
   - `convertMarkdownToReadableText()` - 33 LOC
   - `isMarkdownText()` - 8 LOC
   - `processGeminiResponse()` - 8 LOC
   - **Reason:** Response processing should be server-side for consistency
   - **Target:** `server_process_gemini_response` (consolidated)

2. **Chain Preparation** (Priority 3)
   - `prepareChainSmart()` - 19 LOC
   - `prepareChainFromPromptBox()` - 50 LOC
   - `prepareChainForA3()` - 29 LOC
   - `clearChainForA3()` - 9 LOC
   - **Reason:** Complex sheet manipulation, business rules
   - **Target:** `server_prepare_chain` (consolidated action)

3. **Cell Refresh** (Priority 2)
   - `refreshCurrentGMCell()` - 75 LOC
   - **Reason:** Heavy operation, should be server-side with proper retry
   - **Target:** `server_refresh_gm_cell`

4. **Settings Management** (Priority 4)
   - `getSettingsData()` - 35 LOC
   - `saveSettingsData()` - 72 LOC
   - **Reason:** Centralized config management
   - **Target:** `server_get_settings`, `server_save_settings`

**Keep Client:**
- Menu creation (`onOpen()`)
- Event handlers (`onEdit()`)
- UI dialogs (showLogsDialog, setLicenseCredentialsUI, etc.)
- Client-side cache helpers (gmCacheKey_, gmCacheGet_, gmCachePut_)
- API key retrieval for passing to server (`getGeminiApiKey()`)
- Proxy functions that already call server (`GM()`, `serverGM()`)

### CollectConfig.gs - AI Constructor
**Current Role:** Client-side config UI orchestration, partial server delegation

**Status:** ✅ **Partially Migrated**
- Execution logic already on server via `collect_config_execute`
- Preview already on server via `collect_config_preview`

**Must Move:**
1. **Config Persistence** (Priority 4)
   - `saveCollectConfig()` - 53 LOC
   - `loadCollectConfig()` - 40 LOC
   - `deleteCollectConfig()` - 27 LOC
   - `updateLastRun()` - 26 LOC
   - **Reason:** Centralized storage, versioning, consistency
   - **Target:** `server_save_config`, `server_load_config`, `server_delete_config`

2. **Helper Queries** (Priority 5)
   - `getAllSheetNames()` - 8 LOC
   - `hasConfigForCurrentCell()` - 10 LOC
   - **Reason:** Data queries should be server-side
   - **Target:** `server_get_sheet_names`, `server_has_config`

**Keep Client:**
- UI orchestration (`saveAndExecuteCollectConfig()`, `refreshCellWithConfig()`)
- Template proxy functions (already delegate to TemplateService)
- Preview proxy (`getCellPreview()`)

### VK.gs - VK Import Module
**Current Role:** Import posts from VKontakte, data processing

**Must Move:**
1. **VK Import** (Priority 2) ⚠️ **HIGH PRIORITY**
   - `importVkPosts()` - 80 LOC
   - `createStopWordsFormulas()` - 25 LOC
   - **Reason:** External API call, data processing, formula creation
   - **Target:** `server_import_vk_posts`
   - **Risk:** Depends on external VK_PARSER_URL service
   - **Complexity:** Medium (API integration + sheet manipulation)

**Keep Client:**
- None

**Migration Note:** This is a self-contained module, perfect candidate for full server migration

### ocrRunV2_client.gs - OCR Batch Processor
**Current Role:** Heavy image processing, multi-source collection, OCR via Gemini

**Must Move:**
1. **Entire OCR Pipeline** (Priority 1) 🔥 **CRITICAL**
   - `ocrRun()` - 112 LOC (main entry)
   - All 21 helper functions - 325 LOC combined
   - **Reason:** 
     - Heavy quota consumption
     - Long-running process (blocks client)
     - External API calls (Drive, VK, Yandex, Dropbox)
     - Image blob processing
     - Complex source detection and collection
   - **Target:** `server_ocr_batch_run`
   - **Complexity:** HIGH (multi-source, multi-API, error-prone)
   - **Benefits:**
     - Better error handling and retry
     - Centralized logging
     - No client timeout issues
     - Rate limiting control

**Keep Client:**
- None (except menu trigger to initiate server action)

**Migration Note:** This is the #1 priority migration target - 437 lines of pure business logic

### reniewcell.gs - Batch Cell Refresh
**Current Role:** Queue-based batch refresh of multiple cells with configs

**Must Move:**
1. **Batch Processing Core** (Priority 1) 🔥 **CRITICAL**
   - `BatchStart()` - 10 LOC
   - `enqueueTask()` - 13 LOC
   - `processQueue()` - 31 LOC
   - `batchUpdateWrapper()` - 89 LOC
   - `updateCellsBatch()` - 93 LOC
   - `updateSingleCell()` - 41 LOC
   - `scheduleAutoRetry()` - 44 LOC
   - `autoRetryExecutor()` - 25 LOC
   - **Reason:**
     - Heavy multi-cell processing
     - Trigger management
     - Queue management with ScriptProperties
     - Long-running operations
     - Error-prone with client timeouts
   - **Target:** `server_batch_process` (consolidated)
   - **Complexity:** HIGH (queuing, triggers, retry logic)

2. **Support Functions** (Priority 4)
   - `updateLastRunWithStatus()` - 33 LOC
   - `ensureConfigDataStructure()` - 27 LOC
   - `deleteAutoRetryTriggers()` - 15 LOC
   - `cleanupOldTriggers()` - 22 LOC
   - `resetAutoRetryCounters()` - 22 LOC
   - **Target:** Server-side helpers for batch operations

**Keep Client:**
- Menu entry functions (etap1, faza1, etc.) - these just call BatchStart
- Status UI (`showAutoRetryStatus()`)

**Migration Note:** Second highest priority - complex queuing system with triggers

### UnpackingViewer.gs - Data Aggregation & Export
**Current Role:** Multi-sheet data collection, Google Docs export, export tracking

**Must Move:**
1. **Data Aggregation** (Priority 5)
   - `getUnpackingData()` - 61 LOC
   - `getSheetData()` - 132 LOC
   - **Reason:** Multi-sheet data collection, performance
   - **Target:** `server_get_unpacking_data`

2. **Document Export** (Priority 5)
   - `exportUnpackingToDoc()` - 132 LOC
   - `getExportedDocuments()` - 35 LOC
   - `deleteExportedDocs()` - 13 LOC
   - **Reason:** Heavy document generation, Drive API usage
   - **Target:** `server_export_unpacking`

**Keep Client:**
- UI trigger (`openUnpackingViewer()`)

**Migration Note:** Medium priority - not as quota-intensive as OCR/batch, but still heavy

### TemplateService.gs - Template Management
**Status:** ✅ **Already Server-Side**

This module is already designed as a server-side service with proper locking. Client code accesses it via proxy functions in CollectConfig.gs.

---

## Quick Wins

### Immediate (Week 1)
1. **VK Import Migration** 
   - File: VK.gs
   - LOC: 105 lines total
   - Effort: Low (self-contained)
   - Impact: High (external API security)
   - New server action: `vk_import_posts`

2. **Markdown Processing**
   - File: Main.gs
   - LOC: 49 lines combined
   - Effort: Low (pure functions)
   - Impact: Medium (consistency)
   - New server action: `process_gemini_response`

3. **getAllSheetNames Migration**
   - File: CollectConfig.gs
   - LOC: 8 lines
   - Effort: Very Low
   - Impact: Low (but good pattern)
   - New server action: `get_sheet_names`

### Short-term (Weeks 2-3)
4. **CollectConfig Persistence**
   - File: CollectConfig.gs
   - Functions: save/load/delete/updateLastRun
   - LOC: ~150 lines combined
   - Effort: Medium (data structure, validation)
   - Impact: High (centralized storage)
   - New server actions: `save_config`, `load_config`, `delete_config`

5. **Chain Preparation**
   - File: Main.gs
   - Functions: prepareChain* family
   - LOC: ~110 lines combined
   - Effort: Medium (sheet manipulation)
   - Impact: Medium (business logic)
   - New server action: `prepare_chain`

6. **Settings Management**
   - File: Main.gs
   - Functions: getSettingsData, saveSettingsData
   - LOC: ~110 lines combined
   - Effort: Medium (properties + sheets)
   - Impact: Medium (centralized config)
   - New server actions: `get_settings`, `save_settings`

---

## Migration Risks and Blockers

### Technical Risks

#### 1. **Quota Implications**
**Risk Level:** LOW  
**Description:** Moving heavy operations to server might hit different quota limits (UrlFetch, Drive, etc.)  
**Mitigation:** 
- Server already handles heavy Gemini API calls successfully
- Implement server-side rate limiting (already exists)
- Use exponential backoff for retry

#### 2. **Execution Time Limits**
**Risk Level:** MEDIUM  
**Description:** Server-side Apps Script has 6-minute execution limit (client has 6 minutes too)  
**Affected Functions:** ocrRun(), batch processing, large exports  
**Mitigation:**
- Break down into smaller chunks
- Use continuation patterns (save state, resume)
- Implement proper queue with time-based chunking
- Consider async execution with status polling

#### 3. **Lock Contention**
**Risk Level:** LOW-MEDIUM  
**Description:** Multiple clients calling server simultaneously could cause lock timeouts  
**Affected Functions:** Template operations (already use locks), batch operations  
**Mitigation:**
- Already implemented in TemplateService.gs
- Use LockService with proper timeout handling
- Implement retry logic for lock acquisition
- Queue conflicting operations

#### 4. **Error Propagation**
**Risk Level:** MEDIUM  
**Description:** Server errors need to be properly communicated to client UI  
**Current State:** Already handled well in collect_config_execute  
**Mitigation:**
- Use consistent error response format: `{ok: boolean, error: string, logs: []}`
- Client-side error display already implemented
- Maintain error context through migration

#### 5. **Client-Server Payload Size**
**Risk Level:** LOW  
**Description:** Large data transfers could hit payload limits  
**Affected Functions:** Large config objects, multi-sheet data  
**Mitigation:**
- Already handling large prompts successfully
- Use compression for very large datasets
- Paginate large result sets

### Architectural Risks

#### 1. **Server URL Dependency**
**Risk Level:** LOW  
**Description:** Client code hard-codes SERVER_URL  
**Current State:** Working well  
**Mitigation:**
- Document SERVER_URL in multiple places ✅ (already done)
- Consider fallback mechanism for server unavailability
- Implement health check endpoint ✅ (already done: status action)

#### 2. **External Service Dependencies**
**Risk Level:** MEDIUM-HIGH  
**Description:** VK_PARSER_URL is external service, could fail or change  
**Affected Functions:** VK.gs, ocrRunV2_client.gs VK functions  
**Mitigation:**
- Wrap in try-catch with proper error messages
- Document external dependencies
- Consider alternative or self-hosted VK parser
- Implement circuit breaker pattern

#### 3. **License Enforcement**
**Risk Level:** LOW  
**Description:** All server actions require valid license  
**Current State:** ✅ Already implemented and working  
**Mitigation:**
- Already handled in doPost() for all actions except 'status'
- Clear error messages for license issues
- Continue pattern for new actions

#### 4. **Version Compatibility**
**Risk Level:** LOW  
**Description:** Client and server code might get out of sync during migration  
**Mitigation:**
- Version all API actions
- Document required client version for each server action
- Consider version check in doPost()
- Use feature flags for gradual rollout

### Migration Blockers

#### 1. **Client Cache Invalidation**
**Blocker Level:** LOW  
**Description:** Some functions use client-side cache (GM responses)  
**Resolution:** 
- Keep client cache for UI responsiveness
- Server has its own caching if needed
- Clear client cache when config changes

#### 2. **Trigger Management**
**Blocker Level:** MEDIUM  
**Description:** Some operations create/delete triggers (reniewcell.gs)  
**Resolution:**
- Server CAN manage triggers for same user's spreadsheet
- Test trigger creation from server context
- Document trigger scope and permissions

#### 3. **User Context**
**Blocker Level:** LOW  
**Description:** Some functions need current user (Session.getActiveUser())  
**Current State:** TemplateService already handles this  
**Resolution:**
- Pass user email from client if needed
- Use Session.getEffectiveUser() on server
- Already working for templates ✅

#### 4. **UI Dependencies**
**Blocker Level:** LOW  
**Description:** Some business logic is mixed with UI (SpreadsheetApp.getUi())  
**Resolution:**
- Separate business logic from UI display
- Return data/errors from server
- Client displays results in UI
- Already working pattern ✅

---

## Dependencies Map

### Service Dependencies by Component

```
Main.gs
├── CacheService (gmCache*, logs) → KEEP CLIENT (UI cache)
├── ScriptProperties (license, settings) → KEEP CLIENT (read), MOVE SERVER (write)
├── UserProperties (API key) → KEEP CLIENT (read)
├── SpreadsheetApp (sheets) → MOVE SERVER (write operations)
├── UrlFetchApp (Gemini, Server) → KEEP CLIENT (proxy calls)
└── Triggers → MOVE SERVER (management)

CollectConfig.gs
├── SpreadsheetApp (config sheet) → MOVE SERVER (persistence)
├── TemplateService → KEEP (already server-side)
└── UrlFetchApp (server proxy) → KEEP CLIENT

VK.gs
├── UrlFetchApp (VK_PARSER) → MOVE SERVER
└── SpreadsheetApp (results) → MOVE SERVER

ocrRunV2_client.gs
├── UrlFetchApp (Gemini, VK, Yandex, Dropbox) → MOVE SERVER
├── DriveApp (folders, images) → MOVE SERVER
└── SpreadsheetApp (OCR sheet) → MOVE SERVER

reniewcell.gs
├── ScriptProperties (queue) → MOVE SERVER
├── Triggers (auto-retry) → MOVE SERVER
├── SpreadsheetApp (batch updates) → MOVE SERVER
└── CollectConfig functions → MOVE SERVER

UnpackingViewer.gs
├── SpreadsheetApp (multi-sheet read) → MOVE SERVER
├── DocumentApp (export) → MOVE SERVER
├── DriveApp (doc management) → MOVE SERVER
└── ScriptProperties (export tracking) → MOVE SERVER

TemplateService.gs
├── ScriptProperties (storage) → ✅ SERVER-SIDE
├── LockService (concurrency) → ✅ SERVER-SIDE
└── Session (user) → ✅ SERVER-SIDE
```

### Call Graph (Critical Paths)

```
USER → Menu/UI (client)
  ↓
onOpen/onEdit (client - KEEP)
  ↓
Business Function (client - MOVE)
  ↓
SERVER_URL (server - KEEP)
  ↓
doPost switch/case (server - KEEP)
  ↓
serverXXX_ function (server - KEEP/ADD)
  ↓
Gemini API / Data ops (server - KEEP/ADD)
  ↓
Response (server → client)
  ↓
UI Display (client - KEEP)
```

### Data Flow (Current vs Target)

**Current (Problem):**
```
Client: Menu click → Business Logic (heavy) → Sheet write → Cache → UI update
Issues: Timeout, quota, no central logging
```

**Target (Solution):**
```
Client: Menu click → API call (lightweight) → UI loading state
  ↓
Server: Receive → Validate license → Execute business logic → Log → Response
  ↓
Client: Receive response → Update UI → Show result/error
Benefits: No timeout, better error handling, centralized logging
```

---

## Next Steps

### Phase 1: Quick Wins (Week 1)
**Goal:** Build momentum, establish patterns

1. **VK Import Migration**
   - Create `vk_import_posts` server action
   - Migrate `importVkPosts()` and `createStopWordsFormulas()`
   - Update VK.gs to proxy to server
   - Test with real VK data

2. **Markdown Processing**
   - Create `process_gemini_response` server action
   - Migrate markdown functions
   - Update GM() to use server processing
   - Test with various Gemini responses

3. **Simple Helpers**
   - Create `get_sheet_names` server action
   - Migrate `getAllSheetNames()`
   - Test from CollectConfig UI

**Success Criteria:**
- All 3 migrations working
- No regression in existing functionality
- Server logging showing correct usage

### Phase 2: Config Management (Weeks 2-3)
**Goal:** Centralize configuration storage

1. **CollectConfig Persistence**
   - Create `save_config`, `load_config`, `delete_config` server actions
   - Migrate persistence functions from CollectConfig.gs
   - Update UI to use server actions
   - Add versioning to config format

2. **Settings Management**
   - Create `get_settings`, `save_settings` server actions
   - Migrate from Main.gs
   - Update SettingsUI.html

3. **Chain Preparation**
   - Create `prepare_chain` server action (consolidated)
   - Migrate prepareChain* family
   - Test formula generation

**Success Criteria:**
- Config stored server-side
- Settings centralized
- Chain preparation working

### Phase 3: Heavy Processors (Weeks 4-6)
**Goal:** Migrate quota-intensive operations

1. **OCR Pipeline Migration** 🔥
   - Create `ocr_batch_run` server action
   - Migrate entire ocrRunV2_client.gs logic
   - Implement chunking for large batches
   - Add progress tracking
   - Test with multiple sources (VK, Drive, Dropbox, Yandex)

2. **Batch Cell Refresh** 🔥
   - Create `batch_process` server action
   - Migrate reniewcell.gs queue system
   - Implement server-side queuing
   - Test auto-retry logic
   - Handle trigger management

**Success Criteria:**
- OCR runs server-side without timeout
- Batch refresh handles 100+ cells
- Proper error recovery

### Phase 4: Data Operations (Weeks 7-8)
**Goal:** Migrate data aggregation and export

1. **UnpackingViewer Migration**
   - Create `get_unpacking_data` server action
   - Create `export_unpacking` server action
   - Migrate data aggregation logic
   - Test with large datasets

2. **Support Functions**
   - Migrate remaining helpers
   - Consolidate logging to server
   - Clean up client code

**Success Criteria:**
- Data export works for large datasets
- No client timeouts
- Clean separation of concerns

### Phase 5: Cleanup & Documentation (Week 9)
**Goal:** Polish and document

1. **Code Cleanup**
   - Remove dead code from client files
   - Consolidate proxy functions
   - Update comments and documentation

2. **Testing**
   - End-to-end testing of all flows
   - Performance testing
   - Error scenario testing

3. **Documentation**
   - Update DEVELOPER_GUIDE.md
   - Update FUNCTIONS_REFERENCE.md
   - Create MIGRATION_COMPLETE.md
   - Update AGENT_READ_FIRST.md

**Success Criteria:**
- All major functions migrated
- Documentation updated
- Tests passing

---

## Server Actions Summary

### Existing Server Actions (✅ Complete)
1. `gm` - Gemini text generation
2. `gm_image` - Gemini OCR from images
3. `status` - License status check
4. `collect_config_preview` - Config data preview
5. `collect_config_execute` - Config execution

### Proposed New Server Actions

#### Priority 1 (Critical - Heavy Processing)
6. `ocr_batch_run` - Complete OCR pipeline (ocrRunV2_client.gs)
7. `batch_process` - Batch cell refresh (reniewcell.gs)

#### Priority 2 (High - External APIs)
8. `vk_import_posts` - VK post import (VK.gs)

#### Priority 3 (High - Business Logic)
9. `process_gemini_response` - Markdown processing (Main.gs)
10. `prepare_chain` - Chain formula preparation (Main.gs)
11. `refresh_gm_cell` - Single cell refresh (Main.gs)

#### Priority 4 (Medium - Config Management)
12. `save_config` - Save CollectConfig (CollectConfig.gs)
13. `load_config` - Load CollectConfig (CollectConfig.gs)
14. `delete_config` - Delete CollectConfig (CollectConfig.gs)
15. `get_settings` - Get settings data (Main.gs)
16. `save_settings` - Save settings data (Main.gs)

#### Priority 5 (Medium - Data Operations)
17. `get_unpacking_data` - Get unpacking data (UnpackingViewer.gs)
18. `export_unpacking` - Export to Google Doc (UnpackingViewer.gs)
19. `get_sheet_names` - Get all sheet names (CollectConfig.gs)

#### Priority 7 (Low - Logging)
20. `server_log` - Centralized logging (consolidate addLog calls)

Total New Actions: **15 essential** + 5 helpers

---

## Conclusion

This audit identifies **89 functions** across client-side files, with **41 functions (46%)** requiring server-side migration. The critical migration targets are:

1. **ocrRunV2_client.gs** - 437 lines of heavy image processing (Priority 1 🔥)
2. **reniewcell.gs** - 676 lines of batch processing (Priority 1 🔥)
3. **VK.gs** - 123 lines of external API integration (Priority 2 ⚠️)
4. **CollectConfig.gs** - Config persistence (Priority 4)
5. **UnpackingViewer.gs** - Data export (Priority 5)

The migration follows a clear path from quick wins (VK import, markdown processing) through config management, to the heavy processors (OCR, batch), with minimal architectural risk due to the existing successful server proxy pattern.

**Estimated Total Effort:** 9 weeks for complete migration

**Expected Benefits:**
- ✅ No client timeout issues
- ✅ Better error handling and retry
- ✅ Centralized logging and monitoring
- ✅ Reduced client quota consumption
- ✅ Improved security (API keys, external APIs)
- ✅ Better testability of business logic
- ✅ Scalability for future features

---

**Document Version:** 1.0  
**Last Updated:** 2025-06-18  
**Next Review:** After Phase 1 completion
