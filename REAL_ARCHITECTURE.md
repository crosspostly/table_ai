# 🏗️ РЕАЛЬНАЯ АРХИТЕКТУРА ПРОЕКТА - Table AI

**Дата:** 18 октября 2025  
**Автор:** Droid @ Factory AI

---

## 🚨 КРИТИЧЕСКАЯ ПРАВДА!

Я НЕПРАВИЛЬНО понял архитектуру! Это НЕ метафора client-side/server-side JavaScript!

Это **ТРИ ОТДЕЛЬНЫХ Google Apps Script ПРИЛОЖЕНИЯ**!

---

## 🎯 ТРИ APPS SCRIPT ПРОЕКТА

```
┌──────────────────────────────────────────────────────────┐
│ 1️⃣ CLIENT (Container-bound script)                       │
│                                                            │
│  Файл: Main.txt → deploy/Main.gs                         │
│  Где: Привязан к Google Sheets документу пользователя    │
│  Тип: Container-bound Apps Script                         │
│                                                            │
│  Что делает:                                              │
│  • onOpen() - создаёт меню                               │
│  • GM() - функции для ячеек                              │
│  • Собирает данные из листа                              │
│  • callServer() - HTTP вызовы к SERVER                   │
│                                                            │
│  Script ID: (у каждого польз<wbr/>ователя свой!)                │
└──────────────────────────────────────────────────────────┘
                            │
                            │ UrlFetchApp.fetch()
                            │ POST https://script.google.com/...
                            ▼
┌──────────────────────────────────────────────────────────┐
│ 2️⃣ SERVER (Standalone Web App)                           │
│                                                            │
│  Файл: server.txt → deploy/server.gs                     │
│  Где: Отдельный Apps Script проект                        │
│  Тип: Standalone - развёрнут как Web App                 │
│  URL: https://script.google.com/macros/s/[ID]/exec       │
│                                                            │
│  Что делает:                                              │
│  • doPost() - принимает HTTP запросы                     │
│  • Проверяет лицензии                                    │
│  • Обрабатывает AI запросы                               │
│  • Роутинг к сервисам (VK, Telegram, OCR)               │
│                                                            │
│  Script ID: AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfr...   │
└──────────────────────────────────────────────────────────┘
                            │
                            │ UrlFetchApp.fetch() (для VK)
                            │ POST к VK_PARSER_URL
                            ▼
┌──────────────────────────────────────────────────────────┐
│ 3️⃣ VK_PARSER (отдельный сервис)                          │
│                                                            │
│  Файл: VK_PARSER.txt (не в этом репо)                    │
│  Где: Третий отдельный Apps Script проект                 │
│  Тип: Standalone Web App                                 │
│                                                            │
│  Что делает:                                              │
│  • doPost() - принимает запросы от SERVER                │
│  • VK_TOKEN хранится ЗДЕСЬ                               │
│  • Вызывает VK API                                       │
│  • Возвращает посты в SERVER                             │
│                                                            │
│  Script ID: (отдельный проект)                            │
└──────────────────────────────────────────────────────────┘
```

---

## 📦 ЧТО ТАКОЕ `deploy/` ПАПКА?

**deploy/** - это НЕ deployment target!

Это **TEMPLATE/DISTRIBUTION** файлы!

```
deploy/
├── Main.gs              ← КЛИЕНТ (копировать в Sheets пользователя)
├── server.gs            ← СЕРВЕР (уже развёрнут централизованно)
├── TemplateService.gs   ← КЛИЕНТ (новая функция)
├── CollectConfigUI.gs   ← КЛИЕНТ (серверные функции для HTML)
├── CollectConfigUI_v2.html ← КЛИЕНТ (UI)
└── MIGRATION.gs         ← КЛИЕНТ (утилиты)
```

**Процесс развёртывания:**

1. **АДМИНИСТРАТОР** развёртывает `server.gs`:
   ```
   1. Создаёт Apps Script проект
   2. Копирует server.gs
   3. Deploy → New deployment → Web app
   4. Получает URL: https://script.google.com/macros/s/[ID]/exec
   5. Этот URL - константа SERVER_URL для ВСЕХ клиентов
   ```

2. **ПОЛЬЗОВАТЕЛЬ** устанавливает клиент:
   ```
   1. Создаёт Google Sheets
   2. Extensions → Apps Script
   3. Копирует Main.gs (и другие client файлы)
   4. В Main.gs есть константа:
      const SERVER_URL = 'https://script.google.com/...'
   5. Refresh → меню появляется
   ```

---

## 🔗 КАК ОНИ ОБЩАЮТСЯ?

### CLIENT → SERVER

**В Main.gs (CLIENT):**
```javascript
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec';

function callServer(action, params) {
  var payload = {
    action: action,
    email: getUserEmail(),
    token: getUserToken(),
    data: params
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(SERVER_URL, options);
  return JSON.parse(response.getContentText());
}
```

**В server.gs (SERVER):**
```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Роутинг
    switch(data.action) {
      case 'gemini_request':
        return handleGeminiRequest(data);
      case 'vk_import':
        return handleVkImport(data);
      case 'ocr_process':
        return handleOCR(data);
      default:
        return createErrorResponse('Unknown action');
    }
  } catch(e) {
    return createErrorResponse(e.message);
  }
}
```

---

### SERVER → VK_PARSER

**В server.gs (SERVER):**
```javascript
function handleVkImport(data) {
  var VK_PARSER_URL = 'https://script.google.com/macros/s/[VK_PARSER_ID]/exec';
  
  var vkPayload = {
    action: 'get_posts',
    owner: data.owner,
    count: data.count
  };
  
  var response = UrlFetchApp.fetch(VK_PARSER_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(vkPayload)
  });
  
  return response.getContentText();
}
```

**В VK_PARSER (третий проект):**
```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var VK_TOKEN = PropertiesService.getScriptProperties().getProperty('VK_TOKEN');
  
  // Вызов VK API
  var vkApiUrl = 'https://api.vk.com/method/wall.get?owner_id=' + data.owner + 
                  '&count=' + data.count + '&access_token=' + VK_TOKEN;
  
  var vkResponse = UrlFetchApp.fetch(vkApiUrl);
  return vkResponse.getContentText();
}
```

---

## ❌ МОЯ ОШИБКА В ARCHITECTURE.md

**Что я написал (НЕПРАВИЛЬНО):**
```
deploy/
├── CollectConfigUI_v2.html  ← Client-side (browser)
├── CollectConfigUI.gs       ← Server-side (Apps Script)
```

**Проблема:** Я думал что это про JavaScript client/server в одном Apps Script!

**Реальность:** Это ДВА (или ТРИ) РАЗНЫХ Apps Script ПРОЕКТА!

---

## ✅ ПРАВИЛЬНОЕ ПОНИМАНИЕ

### CollectConfigUI_v2.html

**Где выполняется:** В БРАУЗЕРЕ пользователя (iframe внутри Sheets)

**Что делает:**
- Рисует UI (HTML/CSS)
- Собирает input от пользователя
- Вызывает **серверные функции Apps Script** через `google.script.run`

**ВАЖНО:** "Серверные функции" здесь = функции из того же CLIENT Apps Script проекта!

```javascript
// HTML (браузер)
google.script.run
  .withSuccessHandler(function(result) {
    console.log('Got from Apps Script:', result);
  })
  .serverGetAllTemplates();  // ← Вызов функции из CLIENT .gs файла
```

---

### CollectConfigUI.gs

**Где выполняется:** В Apps Script runtime (на серверах Google)

**Что делает:**
- Функции которые вызывает HTML через `google.script.run`
- Работает с PropertiesService, SpreadsheetApp
- НЕ может работать с DOM (это не браузер!)

```javascript
// CollectConfigUI.gs (Apps Script)
function serverGetAllTemplates() {
  // Эта функция вызывается из HTML через google.script.run
  var templates = TemplateService.getAllTemplates();
  return templates;  // ← Вернётся в successHandler в HTML
}
```

---

## 🎯 ДВА УРОВНЯ "CLIENT-SERVER"

### Уровень 1: HTML ↔ Apps Script (внутри CLIENT проекта)

```
┌─────────────────────────────────────────┐
│  CLIENT APPS SCRIPT PROJECT             │
│                                         │
│  ┌──────────────┐    google.script.run │
│  │ HTML         │  ════════════════►   │
│  │ (browser)    │                  │   │
│  │              │  ◄════════════════   │
│  │ CollectConfig│         ┌─────────┐  │
│  │ UI_v2.html   │         │ .gs     │  │
│  └──────────────┘         │ files   │  │
│                            │         │  │
│                            │ Collect │  │
│                            │ ConfigUI│  │
│                            │ .gs     │  │
│                            └─────────┘  │
└─────────────────────────────────────────┘
```

---

### Уровень 2: CLIENT ↔ SERVER (два Apps Script проекта)

```
┌──────────────────┐         ┌──────────────────┐
│  CLIENT          │         │  SERVER          │
│  (Main.gs)       │         │  (server.gs)     │
│                  │  HTTP   │                  │
│  callServer()    │ ══════► │  doPost()        │
│                  │         │                  │
│  UrlFetchApp     │ ◄══════ │  return JSON     │
└──────────────────┘         └──────────────────┘
```

---

## 📋 DEPLOYMENT CHECKLIST (ПРАВИЛЬНЫЙ)

### ✅ Что развёртывается ЦЕНТРАЛИЗОВАННО (АДМИН):

- [x] **server.gs** → Apps Script Web App
- [x] **VK_PARSER** → Apps Script Web App (отдельный)
- [x] Получить SERVER_URL
- [x] Получить VK_PARSER_URL

### ✅ Что копируют ПОЛЬЗОВАТЕЛИ:

- [x] **Main.gs** → в свой Google Sheets
- [x] **TemplateService.gs** → в свой Sheets
- [x] **CollectConfigUI.gs** → в свой Sheets
- [x] **CollectConfigUI_v2.html** → в свой Sheets (rename → CollectConfigUI)
- [x] **MIGRATION.gs** → в свой Sheets (опционально)

### ✅ Что настраивают ПОЛЬЗОВАТЕЛИ:

- [x] Ввести GEMINI_API_KEY
- [x] Ввести LICENSE_EMAIL, LICENSE_TOKEN
- [x] SERVER_URL уже прописан в Main.gs

---

## 🚀 ТЕПЕРЬ ПРАВИЛЬНАЯ ИНТЕГРАЦИЯ COLLECT CONFIG

### Шаг 1: Template System - CLIENT-side

**Файлы для CLIENT проекта (пользователь копирует):**

1. **TemplateService.gs** - управление шаблонами
   - Хранит в PropertiesService.getUserProperties()
   - Каждый пользователь свои шаблоны

2. **CollectConfigUI.gs** - server endpoints для HTML
   - Функции: serverGetAllTemplates(), serverSaveTemplate(), etc
   - Вызываются через google.script.run из HTML

3. **CollectConfigUI_v2.html** - UI
   - Выполняется в браузере
   - Вызывает функции из CollectConfigUI.gs

4. **Main.gs** - добавить пункт меню
   - "🎯 AI Конструктор (Template System v2.0)"

---

### Шаг 2: SERVER (если нужно)

**ВОПРОС:** Нужна ли серверная часть для Template System?

**ОТВЕТ:** НЕТ! Потому что:
- ✅ Шаблоны хранятся локально (PropertiesService.getUserProperties)
- ✅ Нет централизованной логики
- ✅ Нет общих шаблонов между пользователями
- ✅ Не требуется лицензирование для этой функции

**Template System = 100% CLIENT-side!**

---

## 🎉 ВЫВОД

### Что я НЕПРАВИЛЬНО понял:

1. ❌ Думал что deploy/ это production deployment
2. ❌ Думал что client/server = JavaScript client-side/server-side
3. ❌ Думал что CollectConfigUI.gs это "server" в смысле централизованного сервера

### Что ПРАВИЛЬНО:

1. ✅ deploy/ = template files для пользователей
2. ✅ CLIENT = Apps Script проект у пользователя (Main.gs)
3. ✅ SERVER = Apps Script Web App (server.gs) - централизованный
4. ✅ VK_PARSER = третий Apps Script Web App
5. ✅ CollectConfigUI.gs = "server functions" в смысле Apps Script runtime (не browser)
6. ✅ CollectConfigUI_v2.html = client в смысле browser (не Apps Script)

---

**Template System интеграция ПРАВИЛЬНАЯ!**

Все 6 файлов в deploy/ корректны! Они будут работать в CLIENT Apps Script проекте!

---

**Извините за путаницу! 🙏**

**Дата:** 18 октября 2025  
**Автор:** Droid @ Factory AI
