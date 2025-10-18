# 🚀 ЧТО КУДА КОПИРОВАТЬ - КРИТИЧНО!

**Дата:** 18 октября 2025

---

## 🚨 ГЛАВНОЕ ПРАВИЛО!

**ТРИ ОТДЕЛЬНЫХ Apps Script ПРОЕКТА! НЕ СМЕШИВАТЬ!**

```
1️⃣ CLIENT  - у каждого пользователя свой
2️⃣ SERVER  - один для всех (УЖЕ РАЗВЁРНУТ)
3️⃣ VK_PARSER - третий сервис (НЕ ТРОГАЕМ)
```

---

## 📦 ЧТО В ПАПКЕ `deploy/`

```
deploy/
├── Main.gs                    ← ДЛЯ CLIENT ✅
├── server.gs                  ← ДЛЯ SERVER ⚠️ (УЖЕ РАЗВЁРНУТ!)
├── TemplateService.gs         ← ДЛЯ CLIENT ✅
├── CollectConfigUI.gs         ← ДЛЯ CLIENT ✅
├── CollectConfigUI_v2.html    ← ДЛЯ CLIENT ✅
└── MIGRATION.gs               ← ДЛЯ CLIENT ✅ (опционально)
```

---

## 🎯 ПОЛЬЗОВАТЕЛЬ (CLIENT): ЧТО КОПИРОВАТЬ

### ✅ КОПИРОВАТЬ В СВОЙ GOOGLE SHEETS:

**Эти 4 файла ОБЯЗАТЕЛЬНО:**

1. **Main.gs** (60 KB)
   - Куда: Apps Script привязанный к вашему Google Sheets
   - Заменяет: старый Main.gs или Code.gs
   - Содержит: меню, функции, GM()

2. **TemplateService.gs** (15 KB)
   - Куда: Apps Script → Add file → Script → назвать "TemplateService"
   - Содержит: getAllTemplates(), saveTemplate(), deleteTemplate()

3. **CollectConfigUI.gs** (15 KB)
   - Куда: Apps Script → Add file → Script → назвать "CollectConfigUI"
   - Содержит: serverGetAllTemplates(), serverSaveTemplate(), и т.д.

4. **CollectConfigUI_v2.html** (17 KB)
   - Куда: Apps Script → Add file → HTML → назвать "CollectConfigUI" (БЕЗ _v2!)
   - Содержит: UI интерфейс

**Опционально:**

5. **MIGRATION.gs** (13 KB)
   - Только если есть старые данные ConfigData
   - Куда: Apps Script → Add file → Script → назвать "MIGRATION"

---

### ❌ НЕ КОПИРОВАТЬ В CLIENT:

**server.gs** - ЭТО ФАЙЛ ДЛЯ ЦЕНТРАЛИЗОВАННОГО СЕРВЕРА!

❌ НЕ копируйте в Google Sheets пользователя!  
❌ НЕ добавляйте в Apps Script проект!

**Почему?**
- server.gs содержит doPost() для Web App
- Он УЖЕ РАЗВЁРНУТ по адресу: `https://script.google.com/macros/s/[ID]/exec`
- Каждый CLIENT вызывает этот сервер через UrlFetchApp.fetch()

---

## 🖥️ АДМИНИСТРАТОР (SERVER): ЧТО РАЗВОРАЧИВАТЬ

### ✅ РАЗВЕРНУТЬ КАК WEB APP:

**Только этот файл:**

1. **server.gs** (13 KB)
   - Создать ОТДЕЛЬНЫЙ Apps Script проект (не привязанный к Sheets!)
   - Скопировать server.gs
   - Deploy → New deployment → Web app
   - Execute as: Me
   - Who has access: Anyone
   - Получить URL: `https://script.google.com/macros/s/[ID]/exec`
   - Этот URL идёт в Main.gs как константа SERVER_URL

---

### ❌ НЕ КОПИРОВАТЬ В SERVER:

**Эти файлы НЕ НУЖНЫ на сервере:**

❌ Main.gs - это CLIENT функции  
❌ TemplateService.gs - хранит данные у CLIENT  
❌ CollectConfigUI.gs - server endpoints для CLIENT  
❌ CollectConfigUI_v2.html - UI для CLIENT  
❌ MIGRATION.gs - миграция на CLIENT  

**Почему?**
- SERVER не имеет доступа к документам пользователей
- SERVER не создаёт UI
- Template System = 100% CLIENT-side функционал

---

## 📋 ПОШАГОВАЯ ИНСТРУКЦИЯ

### ДЛЯ ПОЛЬЗОВАТЕЛЯ (УСТАНОВКА CLIENT):

**Шаг 1: Открыть свой Google Sheets**
```
1. Открыть документ
2. Extensions → Apps Script
```

**Шаг 2: Скопировать Main.gs**
```
1. Найти файл Code.gs или Main.gs
2. Скопировать ВЕСЬ контент из deploy/Main.gs
3. Заменить содержимое
4. Ctrl+S
```

**Шаг 3: Добавить TemplateService.gs**
```
1. Apps Script → + → Script
2. Назвать: "TemplateService"
3. Скопировать из deploy/TemplateService.gs
4. Ctrl+S
```

**Шаг 4: Добавить CollectConfigUI.gs**
```
1. Apps Script → + → Script
2. Назвать: "CollectConfigUI"
3. Скопировать из deploy/CollectConfigUI.gs
4. Ctrl+S
```

**Шаг 5: Добавить CollectConfigUI.html**
```
1. Apps Script → + → HTML
2. Назвать: "CollectConfigUI" (БЕЗ _v2!)
3. Скопировать из deploy/CollectConfigUI_v2.html
4. Ctrl+S
```

**Шаг 6: Проверка**
```
1. Закрыть Apps Script Editor
2. Ctrl+F5 в Google Sheets
3. Проверить меню: 🤖 Table AI → 🎯 AI Конструктор
```

---

### ДЛЯ АДМИНИСТРАТОРА (РАЗВЁРТЫВАНИЕ SERVER):

**ЭТО УЖЕ СДЕЛАНО! НЕ НУЖНО ПОВТОРЯТЬ!**

Но если нужно обновить сервер:

**Шаг 1: Создать Standalone проект**
```
1. script.google.com → New project
2. Назвать: "Table AI Server"
```

**Шаг 2: Скопировать server.gs**
```
1. Скопировать ВЕСЬ контент из deploy/server.gs
2. Вставить в Code.gs
3. Ctrl+S
```

**Шаг 3: Развернуть как Web App**
```
1. Deploy → New deployment
2. Type: Web app
3. Execute as: Me
4. Who has access: Anyone
5. Deploy
6. Скопировать URL
```

**Шаг 4: Обновить SERVER_URL у клиентов**
```
1. В deploy/Main.gs найти строку:
   const SERVER_URL = 'https://...'
2. Заменить на новый URL
3. Пользователи должны обновить свой Main.gs
```

---

## ⚠️ ЧТО НЕЛЬЗЯ ДЕЛАТЬ

### ❌ НЕЛЬЗЯ: Копировать server.gs в CLIENT

**Если скопируете:**
- doPost() не будет работать (Container-bound не поддерживает)
- Будут дублироваться функции
- Нарушится архитектура

**Правильно:**
- server.gs ТОЛЬКО в отдельном standalone проекте
- CLIENT вызывает SERVER через HTTP (UrlFetchApp.fetch)

---

### ❌ НЕЛЬЗЯ: Копировать Main.gs на SERVER

**Если скопируете:**
- SpreadsheetApp.getActiveSheet() не будет работать
- onOpen() не сработает (нет документа)
- Меню не создастся

**Правильно:**
- Main.gs ТОЛЬКО в CLIENT (привязан к Sheets)

---

### ❌ НЕЛЬЗЯ: Называть HTML файл CollectConfigUI_v2

**Если назовёте:**
- Main.gs ищет 'CollectConfigUI'
- HtmlService.createHtmlOutputFromFile('CollectConfigUI')
- Будет ошибка: "File not found"

**Правильно:**
- Имя HTML файла: `CollectConfigUI` (без _v2)
- Контент копировать из `CollectConfigUI_v2.html`

---

## 🔍 КАК ПРОВЕРИТЬ ЧТО ВСЁ ПРАВИЛЬНО

### Проверка CLIENT (у пользователя):

```
✅ В Apps Script Editor должны быть файлы:
   ├── Main.gs (или Code.gs)
   ├── TemplateService.gs
   ├── CollectConfigUI.gs
   └── CollectConfigUI.html

❌ НЕ должно быть:
   ├── server.gs
   └── CollectConfigUI_v2.html (с _v2)
```

### Проверка SERVER (администратор):

```
✅ В standalone Apps Script должны быть:
   └── Code.gs (содержимое из server.gs)

❌ НЕ должно быть:
   ├── Main.gs
   ├── TemplateService.gs
   ├── CollectConfigUI.gs
   └── любых HTML файлов
```

---

## 🎯 ТАБЛИЦА: КТО КУДА КОПИРУЕТ

| Файл | CLIENT (пользователь) | SERVER (админ) | Примечание |
|------|-----------------------|----------------|-----------|
| **Main.gs** | ✅ ДА | ❌ НЕТ | Привязан к Sheets |
| **server.gs** | ❌ НЕТ | ✅ ДА | Web App standalone |
| **TemplateService.gs** | ✅ ДА | ❌ НЕТ | Локальное хранение |
| **CollectConfigUI.gs** | ✅ ДА | ❌ НЕТ | Server endpoints для HTML |
| **CollectConfigUI_v2.html** | ✅ ДА (rename→CollectConfigUI) | ❌ НЕТ | UI интерфейс |
| **MIGRATION.gs** | ⭕ Опционально | ❌ НЕТ | Если есть старые данные |

---

## 📊 АРХИТЕКТУРА: КТО С КЕМ ГОВОРИТ

```
┌─────────────────────────────────────────────┐
│  CLIENT (Google Sheets + Apps Script)       │
│                                             │
│  Файлы:                                     │
│  ├── Main.gs           ← onOpen(), меню    │
│  ├── TemplateService   ← хранение шаблонов │
│  ├── CollectConfigUI   ← endpoints для HTML│
│  └── CollectConfigUI   ← HTML UI           │
│       .html                                 │
│                                             │
│  Связь внутри CLIENT:                       │
│  HTML → google.script.run → .gs функции    │
└─────────────────────────────────────────────┘
                    │
                    │ UrlFetchApp.fetch(SERVER_URL)
                    │ POST { action, email, token, data }
                    ▼
┌─────────────────────────────────────────────┐
│  SERVER (Standalone Apps Script Web App)    │
│                                             │
│  Файлы:                                     │
│  └── Code.gs (из server.gs) ← doPost()    │
│                                             │
│  URL:                                       │
│  https://script.google.com/macros/s/.../exec│
└─────────────────────────────────────────────┘
```

---

## 🆘 ЧАСТЫЕ ОШИБКИ

### Ошибка 1: "Меню не появляется"

**Причина:** Main.gs не скопирован или не сохранён

**Проверка:**
```javascript
// Открыть Apps Script Editor → Main.gs
// Найти строку:
.addSubMenu(ui.createMenu('🎯 AI Конструктор (Template System v2.0)')
```

**Решение:** Скопировать ВЕСЬ Main.gs из deploy/, Ctrl+S, Ctrl+F5

---

### Ошибка 2: "Function not found: getAllTemplates"

**Причина:** TemplateService.gs не добавлен в CLIENT

**Проверка:** Apps Script Editor → должен быть файл "TemplateService"

**Решение:** Добавить TemplateService.gs (Шаг 3)

---

### Ошибка 3: "File not found: CollectConfigUI"

**Причина:** HTML файл называется CollectConfigUI_v2 (с _v2)

**Проверка:** Apps Script Editor → HTML файл должен быть "CollectConfigUI"

**Решение:** Переименовать HTML файл (убрать _v2)

---

### Ошибка 4: "doPost is not a function"

**Причина:** Кто-то скопировал server.gs в CLIENT!

**Проверка:** Apps Script Editor → НЕ должно быть файла "server" в CLIENT

**Решение:** Удалить server.gs из CLIENT проекта

---

## ✅ ИТОГОВЫЙ ЧЕКЛИСТ

### ДЛЯ ПОЛЬЗОВАТЕЛЯ (CLIENT):

- [ ] Скопировал Main.gs в свой Sheets → Apps Script
- [ ] Добавил TemplateService.gs
- [ ] Добавил CollectConfigUI.gs
- [ ] Добавил CollectConfigUI.html (БЕЗ _v2)
- [ ] НЕ копировал server.gs
- [ ] Ctrl+F5 → меню появилось
- [ ] UI открывается

### ДЛЯ АДМИНИСТРАТОРА (SERVER):

- [ ] server.gs развёрнут как Web App (УЖЕ СДЕЛАНО)
- [ ] URL доступен: https://script.google.com/macros/s/.../exec
- [ ] НЕ копировал CLIENT файлы на SERVER
- [ ] Клиенты используют правильный SERVER_URL

---

## 🎉 ГОТОВО!

**Правильная установка:**
- CLIENT: 4 файла (.gs + .html)
- SERVER: 1 файл (уже развёрнут)
- Нет смешивания!

---

**Дата:** 18 октября 2025  
**Автор:** Droid @ Factory AI
