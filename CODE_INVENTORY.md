# 📋 CODE INVENTORY - Реестр кода Table AI

**Дата анализа:** 2025-06-18  
**Всего файлов:** 8 .gs файлов  
**Общий размер:** ~4300 строк кода

---

## 🗂️ СТРУКТУРА ФАЙЛОВ

### 1. Main.gs (1273 строк) - **КЛИЕНТСКИЙ ЦЕНТР**
**Роль:** Основной файл клиента, содержит меню и бизнес-логику
**Проблема:** СЛИШКОМ БОЛЬШОЙ, содержит всё подряд

#### Основные функции:
- **Меню и UI:** `onOpen()`, `openDialog()`, `showSidebar()`
- **Gemini AI:** `GM()`, `callGeminiAPI()`, `processGeminiResponse()`
- **Логирование:** `addLog()`, `getLogs()`, `showLogsDialog()`
- **Утилиты:** `columnToLetter()`, `parseTargetA1()`, `prepareChainSmart()`
- **Конфигурация:** `getCompletionPhrase()`, `getGeminiApiKey()`
- **Кэширование:** `gmCacheKey_()`, `gmCacheGet_()`, `gmCachePut_()`
- **Триггеры:** `cleanupOldTriggers()`, `showActiveTriggersDialog()`
- **Markdown:** `convertMarkdownToReadableText()`, `isMarkdownText()`

#### Зависимости:
- Использует: `CollectConfig.gs`, `TemplateService.gs`, `server.gs`
- Константы: `GEMINI_API_URL`, `SERVER_URL`, `VK_PARSER_URL`

---

### 2. CollectConfig.gs (657 строк) - **AI КОНСТРУКТОР**
**Роль:** UI система для создания AI-конфигураций
**Статус:** ХОРОШО ОРГАНИЗОВАН

#### Основные функции:
- **UI:** `openCollectConfigUI()`, `getCollectConfigInitData()`
- **Исполнение:** `saveAndExecuteCollectConfig()`, `executeCollectConfig()`
- **Данные:** `readData()`, `saveCollectConfig()`, `loadCollectConfig()`
- **Templates:** Интеграция с `TemplateService.gs`
- **Логирование:** `addCollectLog()` (локальное)

#### Зависимости:
- Использует: `TemplateService.gs`, `Main.gs` (через `addLog()`)
- Хранит данные в листе `ConfigData`

---

### 3. server.gs (407 строк) - **СЕРВЕРНЫЙ БЭКЕНД**
**Роль:** Веб-приложение для лицензий и прокси к Gemini
**Статус:** ХОРОШО ОРГАНИЗОВАН

#### Основные функции:
- **Entry Points:** `doGet()`, `doPost()`
- **Лицензии:** `checkLicense_()`
- **Gemini Proxy:** `serverGM_()`, `serverGMImage_()`
- **Rate Limiting:** `rateLimitOk_()`
- **Логирование:** `serverLog_()`

#### Зависимости:
- Внешний: LICENSE_SHEET_ID (Google Sheets)
- Константы: `S_GEMINI_API_URL`

---

### 4. VK.gs (124 строки) - **VK ИМПОРТ**
**Роль:** Модуль импорта постов из VK
**Статус:** ХОРОШО ОРГАНИЗОВАН

#### Основные функции:
- **Импорт:** `importVkPosts()`
- **Формулы:** `createStopWordsFormulas()`
- **Логирование:** `addLog()` (локальная реализация)

#### Зависимости:
- Использует: `VK_PARSER_URL` (из Main.gs)
- Требует: лист "Посты"

---

### 5. UnpackingViewer.gs (292 строки) - **ПРОСМОТР РАСПАКОВКИ**
**Роль:** Просмотр и экспорт данных из листа "Распаковка"
**Статус:** ХОРОШО ОРГАНИЗОВАН

#### Основные функции:
- **UI:** `openUnpackingViewer()`
- **Данные:** `getUnpackingData()`
- **Экспорт:** `exportUnpackingToDoc()`
- **Логирование:** `logUnpacking()`

#### Зависимости:
- Использует: `Main.gs` (через `addLog()`)
- Требует: лист "Распаковка"

---

### 6. TemplateService.gs (433 строки) - **СЕРВИС ШАБЛОНОВ**
**Роль:** Управление шаблонами конфигураций
**Статус:** ОТЛИЧНО ОРГАНИЗОВАН

#### Основные функции:
- **CRUD:** `getAllTemplates()`, `saveTemplate()`, `deleteTemplate()`
- **Storage:** `_getTemplateStorageWithLock()`, `_saveTemplateStorageAndUnlock()`
- **Валидация:** `_validateTemplateConfig()`
- **Статистика:** `getTemplatesStats()`

#### Зависимости:
- Хранилище: PropertiesService
- Блокировка: LockService

---

### 7. ocrRunV2_client.gs (438 строк) - **OCR КЛИЕНТ**
**Роль:** Распознавание текста из изображений
**Статус:** СЛОЖНЫЙ, НО РАБОЧИЙ

#### Основные функции:
- **Основная:** `ocrRun()`
- **Источники:** `extractSourcesV2_()`, `collectFromSourceV2_()`
- **VK:** `collectVkAlbumViaWebV2_()`, `collectVkReviewsViaWebV2_()`
- **Drive:** `enumerateDriveFolderImagesV2_()`
- **OCR:** `gmOcrFromBlobV2_()`, `serverGmOcrBatchV2_()`

#### Зависимости:
- Использует: `Main.gs` (`addLog`, `processGeminiResponse`)
- Использует: `server.gs` (`SERVER_URL`)
- Требует: лист "Отзывы"

---

### 8. reniewcell.gs (681 строка) - **BATCH ОБНОВЛЕНИЯ**
**Роль:** Система пакетного обновления ячеек
**Статус:** СЛОЖНАЯ, НО ФУНКЦИОНАЛЬНАЯ

#### Основные функции:
- **Batch:** `BatchStart()`, `batchUpdateWrapper()`, `updateCellsBatch()`
- **Очередь:** `enqueueTask()`, `processQueue()`
- **Auto-retry:** `scheduleAutoRetry()`, `autoRetryExecutor()`
- **Статус:** `updateLastRunWithStatus()`, `ensureConfigDataStructure()`

#### Зависимости:
- Использует: `CollectConfig.gs` (`loadCollectConfig`, `executeCollectConfig`)
- Использует: `Main.gs` (`addLog`)
- Требует: лист "ConfigData"

---

## 🔗 ГРАФ ЗАВИСИМОСТЕЙ

```
Main.gs (ЦЕНТР)
├── CollectConfig.gs ← TemplateService.gs
├── server.gs (внешний)
├── VK.gs
├── UnpackingViewer.gs
├── ocrRunV2_client.gs ← server.gs
└── reniewcell.gs ← CollectConfig.gs

Общие зависимости:
├── CacheService (логирование)
├── PropertiesService (конфиги, API ключи)
├── SpreadsheetApp (работа с таблицами)
└── UrlFetchApp (API вызовы)
```

---

## 📊 СТАТИСТИКА КОДА

| Файл | Строк | Функций | Основная роль | Сложность |
|------|-------|---------|--------------|-----------|
| Main.gs | 1273 | ~50 | Клиентский центр | 🔴 ВЫСОКАЯ |
| CollectConfig.gs | 657 | ~25 | AI конструктор | 🟡 СРЕДНЯЯ |
| server.gs | 407 | ~15 | Серверный бэкенд | 🟡 СРЕДНЯЯ |
| reniewcell.gs | 681 | ~20 | Batch обновления | 🟡 СРЕДНЯЯ |
| TemplateService.gs | 433 | ~15 | Сервис шаблонов | 🟢 НИЗКАЯ |
| ocrRunV2_client.gs | 438 | ~30 | OCR клиент | 🟡 СРЕДНЯЯ |
| UnpackingViewer.gs | 292 | ~10 | Просмотр данных | 🟢 НИЗКАЯ |
| VK.gs | 124 | ~5 | VK импорт | 🟢 НИЗКАЯ |

---

## 🎯 ВЫВОДЫ

### ✅ ХОРОШО ОРГАНИЗОВАННЫЕ МОДУЛИ:
- `TemplateService.gs` - чистая архитектура
- `server.gs` - чёткий бэкенд
- `VK.gs` - простой модуль
- `UnpackingViewer.gs` - автономный

### ⚠️ ПРОБЛЕМНЫЕ МОДУЛИ:
- `Main.gs` - монолит 1273 строк, содержит всё подряд
- `CollectConfig.gs` - смешивает UI и бизнес-логику
- `ocrRunV2_client.gs` - сложная логика, много зависимостей
- `reniewcell.gs` - сложная batch система

### 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ:
1. **Main.gs** нужно разбить на модули
2. **Дублирование addLog()** в разных файлах
3. **Смешанная архитектура** - логика везде
4. **Отсутствие единых констант** - разбросаны по файлам

---

## 📋 РЕКОМЕНДАЦИИ

### 🔥 ПРИОРИТЕТ 1: Минимизировать Main.gs
- Оставить только меню, UI обёртки, утилиты
- Перенести бизнес-логику в server.gs или модули

### 🔥 ПРИОРИТЕТ 2: Унифицировать логирование
- Создать единый LoggingService
- Убрать дублирующие функции addLog()

### 🔥 ПРИОРИТЕТ 3: Чёткая архитектура
- Клиент: UI + меню + обёртки
- Сервер: бизнес-логика + API
- Модули: специфическая функциональность