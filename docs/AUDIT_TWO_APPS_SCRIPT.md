# 🔍 АУДИТ АРХИТЕКТУРЫ: Два отдельных Apps Script проекта

**Дата аудита:** 2025-11-28  
**Версия table_ai:** v3.0  
**Статус:** ✅ Документировано

---

## 🎯 EXECUTIVE SUMMARY

**table_ai состоит из ДВУХ полностью отдельных Apps Script проектов:**

```
┌──────────────────────────────────────────────────────────────┐
│  ПРОЕКТ 1: КЛИЕНТ (в пользовательской таблице)              │
│  Расположение: Внутри каждой Google Sheets как встроенный    │
│  Размер: ~75KB кода (Main.gs + UI + модули)                 │
│  Роль: Тонкий клиент для взаимодействия с сервером          │
└──────────────────────────────────────────────────────────────┘
                         ↓ HTTP POST (UrlFetchApp)
┌──────────────────────────────────────────────────────────────┐
│  ПРОЕКТ 2: СЕРВЕР (отдельный Web App)                       │
│  Расположение: Развёрнут как Web Application                │
│  URL: https://script.google.com/macros/s/[ID]/exec          │
│  Размер: ~34KB основного кода (server.gs)                   │
│  Роль: API сервер + бизнес-логика + лицензирование          │
└──────────────────────────────────────────────────────────────┘
                         ↓ SpreadsheetApp.openById()
┌──────────────────────────────────────────────────────────────┐
│  БАЗА ДАННЫХ                                                 │
│  • Таблица лицензий (LICENSE_SHEET_ID)                      │
│  • Пользовательские таблицы (spreadsheetId)                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 СРАВНЕНИЕ ДВУХ ПРОЕКТОВ

| Характеристика | КЛИЕНТ (в таблице) | СЕРВЕР (Web App) |
|----------------|-------------------|------------------|
| **Тип проекта** | Container-bound Script | Standalone Web App |
| **Развёртывание** | clasp push в каждую таблицу | Deploy as Web App (один раз) |
| **URL** | Нет (embedded) | `https://script.google.com/macros/s/.../exec` |
| **Доступ к таблице** | Только своя (SpreadsheetApp.getActive()) | Любая по ID (openById) |
| **Хранение данных** | ScriptProperties клиента | ScriptProperties сервера |
| **API ключи** | Хранятся у клиента | Хранятся у сервера |
| **Лицензирование** | Отправляет запрос на сервер | Проверяет и управляет |
| **UI** | HTML диалоги и sidebar | Нет UI (только API) |

---

## 📂 ДЕТАЛЬНАЯ СТРУКТУРА ПРОЕКТОВ

### 🟦 ПРОЕКТ 1: КЛИЕНТ (в пользовательской таблице)

#### **Файловая структура:**

```
CLIENT_PROJECT/
├── 📄 Main.gs (75,348 bytes, ~1,900 строк)
│   ├─ onOpen() - создание меню
│   ├─ GM() - клиентская обёртка для Gemini
│   ├─ serverStatus() - проверка лицензии
│   ├─ validateLicense() - валидация без привязки
│   ├─ saveSettingsData() - сохранение настроек
│   └─ getLicenseEmail/Token() - чтение credentials
│
├── 📄 CollectConfig.gs (25,453 bytes, ~630 строк)
│   ├─ getCollectConfigInitData() - инициализация UI
│   ├─ saveAndExecuteCollectConfig() - выполнение
│   ├─ getCellPreview() - предпросмотр данных
│   └─ executeCollectConfig() - сборка и отправка
│
├── 📄 VK.gs (5,074 bytes, ~130 строк)
│   └─ VK импорт (клиентская часть)
│
├── 📄 TemplateService.gs (14,183 bytes, ~432 строк)
│   ├─ getAllTemplates() - список шаблонов
│   ├─ saveTemplate() - сохранение шаблона
│   └─ deleteTemplate() - удаление шаблона
│
├── 📄 UnpackingViewer.gs (16,821 bytes, ~420 строк)
│   └─ Просмотр JSON данных
│
├── 📄 ocrRunV2_client.gs (27,270 bytes, ~680 строк)
│   └─ OCR клиент (отправка на сервер)
│
├── 📄 reniewcell.gs (20,856 bytes, ~520 строк)
│   └─ Batch операции над ячейками
│
├── 📄 CollectConfigUi.html (27,094 bytes)
│   └─ AI Конструктор UI
│
├── 📄 SettingsUI.html (12,953 bytes)
│   └─ Настройки лицензии
│
├── 📄 UnpackingViewerUI.html (20,827 bytes)
│   └─ JSON viewer UI
│
└── 📄 appsscript.json (501 bytes)
    └─ Манифест проекта
```

#### **Ключевые возможности клиента:**

✅ **Доступ к текущей таблице:**
```javascript
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getActiveSheet();
const range = sheet.getActiveRange();
```

✅ **Хранение настроек:**
```javascript
const props = PropertiesService.getUserProperties();
props.setProperty('email', email);
props.setProperty('token', token);
```

✅ **HTTP вызовы к серверу:**
```javascript
const SERVER_URL = 'https://script.google.com/macros/s/[ID]/exec';
const response = UrlFetchApp.fetch(SERVER_URL, {
  method: 'post',
  contentType: 'application/json',
  payload: JSON.stringify({action: 'status', email, token})
});
```

❌ **НЕ может:**
- Открыть другие таблицы (только свою)
- Управлять лицензиями глобально
- Напрямую вызывать Gemini (только через сервер)

---

### 🟨 ПРОЕКТ 2: СЕРВЕР (отдельный Web App)

#### **Файловая структура:**

```
SERVER_PROJECT/
├── 📄 server.gs (34,228 bytes, ~843 строк)
│   ├─ doPost(e) - главный API endpoint
│   ├─ Роутинг по action:
│   │   ├─ 'status' → checkLicense_()
│   │   ├─ 'validate' → checkLicense_()
│   │   ├─ 'gm' → serverGM_()
│   │   ├─ 'gm_image' → serverGMImage_()
│   │   ├─ 'collect_config_*' → CollectConfig handlers
│   │   └─ 'ocr_*' → OCR handlers
│   ├─ serverGM_() - вызов Gemini API
│   ├─ serverGMImage_() - обработка изображений
│   └─ serverLog_() - централизованное логирование
│
├── 📄 license.gs (15,043 bytes, ~360 строк)
│   ├─ checkLicense_() - основная проверка
│   ├─ validateLicense_() - проверка в "Tokens"
│   ├─ getBindings_() - чтение привязок
│   ├─ addBinding_() - добавление привязки
│   ├─ updateCopiesCount_() - обновление квоты
│   └─ sortSheetByEmail_() - автосортировка
│
├── 📄 migrate_license_v3.gs (9,082 bytes, ~209 строк)
│   └─ Миграция v2.0 → v3.0 (выполняется вручную)
│
├── 📄 test_license_v3.gs (4,827 bytes, ~136 строк)
│   └─ Тесты лицензирования
│
└── 📄 appsscript.json
    └─ Манифест сервера
```

#### **API Endpoints (action в doPost):**

| Action | Описание | Требует лицензию |
|--------|----------|------------------|
| `status` | Проверка лицензии + привязка если нужно | ❌ (сам проверяет) |
| `validate` | Валидация БЕЗ привязки | ❌ (сам проверяет) |
| `gm` | Вызов Gemini API | ✅ |
| `gm_image` | Обработка изображений через Gemini Vision | ✅ |
| `collect_config_preview` | Предпросмотр данных | ✅ |
| `collect_config_execute` | Выполнение AI Конструктора | ✅ |
| `ocr_process` | OCR обработка | ✅ |

#### **Ключевые возможности сервера:**

✅ **Доступ к любой таблице:**
```javascript
const ss = SpreadsheetApp.openById(spreadsheetId);
const sheet = ss.getSheetByName(sheetName);
```

✅ **Управление лицензиями:**
```javascript
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s';
const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
const tokensSheet = ss.getSheetByName('Tokens');
const bindingsSheet = ss.getSheetByName('Bindings');
```

✅ **Централизованное хранение ключей:**
```javascript
const props = PropertiesService.getScriptProperties();
const apiKey = props.getProperty('GEMINI_API_KEY');
```

✅ **Глобальное логирование:**
```javascript
function serverLog_(logData) {
  const LOG_SHEET_ID = '...';
  const ss = SpreadsheetApp.openById(LOG_SHEET_ID);
  const sheet = ss.getSheetByName('Logs');
  sheet.appendRow([new Date(), logData.action, logData.email, ...]);
}
```

---

## 🔄 FLOW ВЗАИМОДЕЙСТВИЯ

### **Сценарий 1: Сохранение настроек (Email + Token)**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ПОЛЬЗОВАТЕЛЬ                                             │
│    Открывает: Меню → Настройки                              │
│    Вводит: email + token                                    │
│    Нажимает: Сохранить                                      │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. КЛИЕНТ: SettingsUI.html                                  │
│    google.script.run.saveSettingsData({email, token})       │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. КЛИЕНТ: Main.gs → saveSettingsData()                    │
│    ✓ Получает scriptId = ScriptApp.getScriptId()           │
│    ✓ Получает spreadsheetId = SpreadsheetApp.getId()       │
│    ✓ Вызывает validateLicense(email, token)                │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. КЛИЕНТ: Main.gs → validateLicense()                     │
│    ✓ Формирует payload:                                     │
│      {action: 'validate', email, token, scriptId, sheetId}  │
│    ✓ UrlFetchApp.fetch(SERVER_URL, {method: 'post', ...})  │
└────────────────┬────────────────────────────────────────────┘
                 ↓ HTTP POST
┌─────────────────────────────────────────────────────────────┐
│ 5. СЕРВЕР: server.gs → doPost(e)                           │
│    ✓ Парсит JSON из e.postData.contents                    │
│    ✓ action = 'validate'                                    │
│    ✓ Роутинг: case 'validate'                              │
│    ✓ Вызывает checkLicense_() из license.gs                │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. СЕРВЕР: license.gs → checkLicense_()                    │
│    ✓ Открывает таблицу лицензий (LICENSE_SHEET_ID)         │
│    ✓ Читает лист "Tokens"                                   │
│    ✓ Ищет email + token                                     │
│    ✓ Проверяет status = 'active'                           │
│    ✓ Проверяет ExpiredDate >= TODAY                        │
│    ✓ Читает copies_count                                    │
│    ✓ Читает лист "Bindings"                                 │
│    ✓ Ищет привязки для этого email                         │
│    ✓ Проверяет scriptId в привязках                        │
│                                                             │
│    Результат: {ok: true, message: 'SCRIPT_ALLOWED', ...}   │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. СЕРВЕР: server.gs → doPost()                            │
│    ✓ Получает результат от checkLicense_()                 │
│    ✓ Логирует в serverLog_()                               │
│    ✓ Возвращает JSON response                              │
└────────────────┬────────────────────────────────────────────┘
                 ↓ HTTP Response
┌─────────────────────────────────────────────────────────────┐
│ 8. КЛИЕНТ: Main.gs → validateLicense()                     │
│    ✓ Парсит JSON.parse(response.getContentText())          │
│    ✓ Возвращает результат в saveSettingsData()             │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. КЛИЕНТ: Main.gs → saveSettingsData()                    │
│    ✓ Анализирует result.ok                                 │
│    ✓ Если ok: сохраняет в PropertiesService                │
│    ✓ Возвращает результат в UI                             │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. UI: SettingsUI.html                                     │
│     ✓ Показывает статус: "Настройки сохранены!"            │
│     ✓ Отображает квоту: "Копий: 3 из 5"                    │
└─────────────────────────────────────────────────────────────┘
```

---

### **Сценарий 2: Вызов AI Конструктора**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ПОЛЬЗОВАТЕЛЬ                                             │
│    Меню → AI Конструктор → Настроить запрос                │
│    Настраивает источники данных                             │
│    Нажимает: Запустить                                      │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. КЛИЕНТ: CollectConfigUi.html                            │
│    google.script.run                                        │
│      .saveAndExecuteCollectConfig(sheetName, cell, config)  │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. КЛИЕНТ: CollectConfig.gs → saveAndExecuteCollectConfig()│
│    ✓ Сохраняет конфигурацию в ConfigData (скрытый лист)    │
│    ✓ Читает System Prompt из указанной ячейки              │
│    ✓ Читает User Data из источников                        │
│    ✓ Формирует финальный промпт                            │
│    ✓ Вызывает GM(prompt) → serverGM()                      │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. КЛИЕНТ: Main.gs → serverGM()                            │
│    ✓ Читает credentials из PropertiesService                │
│    ✓ Получает scriptId, spreadsheetId                      │
│    ✓ Формирует payload:                                     │
│      {action: 'gm', prompt, email, token, scriptId, ...}    │
│    ✓ UrlFetchApp.fetch(SERVER_URL)                         │
└────────────────┬────────────────────────────────────────────┘
                 ↓ HTTP POST
┌─────────────────────────────────────────────────────────────┐
│ 5. СЕРВЕР: server.gs → doPost(e)                           │
│    ✓ action = 'gm'                                          │
│    ✓ checkLicense_() (проверка перед выполнением)          │
│    ✓ Если ok: вызывает serverGM_(prompt, apiKey)           │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. СЕРВЕР: server.gs → serverGM_()                         │
│    ✓ Читает GEMINI_API_KEY из PropertiesService сервера    │
│    ✓ UrlFetchApp.fetch('https://generativelanguage...')    │
│    ✓ Парсит ответ от Gemini                                │
│    ✓ Возвращает текст результата                           │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. СЕРВЕР: server.gs → doPost()                            │
│    ✓ Логирует запрос (serverLog_)                          │
│    ✓ Возвращает JSON: {ok: true, result: aiResponse}       │
└────────────────┬────────────────────────────────────────────┘
                 ↓ HTTP Response
┌─────────────────────────────────────────────────────────────┐
│ 8. КЛИЕНТ: Main.gs → serverGM()                            │
│    ✓ Парсит result                                         │
│    ✓ Возвращает aiResponse                                 │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. КЛИЕНТ: CollectConfig.gs → saveAndExecuteCollectConfig()│
│    ✓ Записывает результат в целевую ячейку                 │
│    ✓ Возвращает {success: true, result, logs}              │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. UI: CollectConfigUi.html                                │
│     ✓ Показывает результат                                  │
│     ✓ Отображает логи выполнения                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 РАСПРЕДЕЛЕНИЕ КОДА ПО ФУНКЦИЯМ

### **Таблица: Что где находится**

| Функция | КЛИЕНТ | СЕРВЕР | Описание |
|---------|--------|--------|-----------|
| **UI / Меню** | ✅ Main.gs | ❌ | onOpen(), showSidebar(), открытие диалогов |
| **Лицензирование (проверка)** | ❌ | ✅ license.gs | checkLicense_(), validateLicense_() |
| **Лицензирование (запрос)** | ✅ Main.gs | ❌ | validateLicense(), serverStatus() |
| **Gemini API (вызов)** | ❌ | ✅ server.gs | serverGM_(), serverGMImage_() |
| **Gemini API (обёртка)** | ✅ Main.gs | ❌ | GM(), GMImage() - отправляют на сервер |
| **AI Конструктор (UI)** | ✅ CollectConfigUi.html | ❌ | HTML интерфейс |
| **AI Конструктор (логика)** | ✅ CollectConfig.gs | ✅ server.gs | Клиент собирает, сервер выполняет |
| **Шаблоны (хранение)** | ✅ TemplateService.gs | ❌ | PropertiesService пользователя |
| **OCR (клиент)** | ✅ ocrRunV2_client.gs | ❌ | Подготовка данных |
| **OCR (обработка)** | ❌ | ✅ server.gs | Google Vision API |
| **VK импорт (клиент)** | ✅ VK.gs | ❌ | UI и подготовка |
| **VK импорт (парсинг)** | ❌ | ✅ server.gs | Вызов VK Parser API |
| **Batch операции** | ✅ reniewcell.gs | ❌ | Работа с множественными ячейками |
| **Логирование (локальное)** | ✅ Main.gs | ❌ | addLog() в пределах клиента |
| **Логирование (глобальное)** | ❌ | ✅ server.gs | serverLog_() в централизованную таблицу |

---

## 🔐 БЕЗОПАСНОСТЬ И РАЗДЕЛЕНИЕ ПРАВ

### **Что может КЛИЕНТ:**

| Действие | Возможность | Почему |
|----------|-------------|--------|
| Читать свою таблицу | ✅ | SpreadsheetApp.getActive() |
| Писать в свою таблицу | ✅ | Имеет полные права |
| Читать другие таблицы | ❌ | Нет доступа к openById() |
| Управлять лицензиями | ❌ | Нет доступа к таблице лицензий |
| Вызывать Gemini напрямую | ❌ | API ключ на сервере |
| Хранить свои настройки | ✅ | PropertiesService.getUserProperties() |

### **Что может СЕРВЕР:**

| Действие | Возможность | Почему |
|----------|-------------|--------|
| Читать любую таблицу | ✅ | openById(spreadsheetId) |
| Писать в любую таблицу | ✅ | Если есть spreadsheetId |
| Управлять лицензиями | ✅ | Прямой доступ к LICENSE_SHEET_ID |
| Вызывать Gemini | ✅ | API ключ в ScriptProperties |
| Логировать глобально | ✅ | Доступ к таблице логов |

### **Архитектурное преимущество:**

```
┌─────────────────────────────────────────────────────────────┐
│  БЕЗОПАСНОСТЬ ЧЕРЕЗ РАЗДЕЛЕНИЕ                              │
│                                                             │
│  • API ключи НЕ хранятся у клиента                          │
│  • Лицензии проверяются централизованно                     │
│  • Пользователь не может обойти проверку лицензии          │
│  • Все критичные операции логируются на сервере            │
│  • Клиент не имеет доступа к данным других пользователей   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 РАЗВЁРТЫВАНИЕ

### **КЛИЕНТ: Установка в пользовательскую таблицу**

**Способ 1: Вручную (для одной таблицы)**
```bash
1. Открыть Google Sheets
2. Extensions → Apps Script
3. Скопировать файлы из deploy/:
   - Main.gs
   - CollectConfig.gs
   - VK.gs
   - TemplateService.gs
   - UnpackingViewer.gs
   - ocrRunV2_client.gs
   - reniewcell.gs
   - CollectConfigUi.html
   - SettingsUI.html
   - UnpackingViewerUI.html
4. Сохранить проект
5. Обновить Google Sheets (F5)
```

**Способ 2: clasp (для множественных таблиц)**
```bash
# Установить clasp
npm install -g @google/clasp

# Авторизоваться
clasp login

# Создать новый проект или подключиться к существующему
clasp create --type sheets --title "table_ai_client"
# ИЛИ
clasp clone <SCRIPT_ID>

# Загрузить файлы
cd deploy/
clasp push

# Результат: все .gs и .html файлы загружены в проект
```

### **СЕРВЕР: Развёртывание Web App**

**Шаг 1: Создать проект**
```bash
1. Открыть https://script.google.com
2. Новый проект → Назвать "table_ai_server"
3. Добавить файлы:
   - server.gs
   - license.gs
   - migrate_license_v3.gs
   - test_license_v3.gs
```

**Шаг 2: Настроить Script Properties**
```bash
Project Settings → Script Properties:

• GEMINI_API_KEY = твой_ключ_gemini
• VK_PARSER_API_KEY = твой_ключ_vk (опционально)
• GOOGLE_VISION_API_KEY = твой_ключ_vision (для OCR)
```

**Шаг 3: Deploy as Web App**
```bash
1. Deploy → New deployment
2. Type: Web app
3. Description: "table_ai v3.0 server"
4. Execute as: Me
5. Who has access: Anyone
6. Deploy
7. Скопировать URL: https://script.google.com/macros/s/[ID]/exec
```

**Шаг 4: Обновить SERVER_URL в клиенте**
```javascript
// В deploy/Main.gs найти:
const SERVER_URL = 'https://script.google.com/macros/s/[СТАРЫЙ_ID]/exec';

// Заменить на:
const SERVER_URL = 'https://script.google.com/macros/s/[НОВЫЙ_ID]/exec';

// Сохранить и переразвернуть клиентов
```

---

## 🐛 ТЕКУЩИЕ ПРОБЛЕМЫ И ТЕХНИЧЕСКИЙ ДОЛГ

### **1. Дублирование кода**

**Проблема:**
Некоторые файлы существуют и в клиенте, и на сервере:
- `CollectConfig.gs` - присутствует в обоих проектах
- `VK.gs` - есть клиентская и серверная части

**Решение:**
Разделить на:
- `CollectConfig_client.gs` - только UI обёртки
- `CollectConfig_server.gs` - бизнес-логика

### **2. Отсутствие версионирования**

**Проблема:**
Клиент и сервер могут быть несовместимы если обновить только один.

**Решение:**
```javascript
// В клиенте:
const CLIENT_VERSION = '3.0.0';

// В сервере:
const SERVER_VERSION = '3.0.0';
const MIN_CLIENT_VERSION = '3.0.0';

// Проверка при каждом запросе:
if (clientVersion < MIN_CLIENT_VERSION) {
  return {error: 'CLIENT_OUTDATED', message: 'Обновите клиент'};
}
```

### **3. Отсутствие CI/CD**

**Проблема:**
Ручное развёртывание клиента в каждую таблицу.

**Решение:**
Использовать clasp + GitHub Actions:
```yaml
# .github/workflows/deploy-client.yml
name: Deploy Client
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install -g @google/clasp
      - run: clasp login --creds ${{ secrets.CLASP_CREDS }}
      - run: cd deploy && clasp push
```

### **4. Отсутствие мобильного приложения (файлы найдены но не используются)**

**Найденные файлы:**
В репозитории НЕ найдены файлы:
- `!MobileApp.gs`
- `!MobileLogin.html`
- `!MobileMain.html`

**Статус:** Возможно удалены или находятся в другой ветке.

**Рекомендация:** Если планируется мобильное приложение:
1. Создать отдельный Web App для мобильной версии
2. Использовать тот же SERVER_URL
3. Адаптировать UI под мобильные устройства

---

## 📊 МЕТРИКИ ПРОЕКТА

### **Размеры файлов:**

```
КЛИЕНТ (общий размер: ~232 KB)
├── Main.gs:                75.3 KB  (32.4%)
├── CollectConfig.gs:       25.5 KB  (11.0%)
├── ocrRunV2_client.gs:     27.3 KB  (11.8%)
├── reniewcell.gs:          20.9 KB   (9.0%)
├── UnpackingViewer.gs:     16.8 KB   (7.2%)
├── TemplateService.gs:     14.2 KB   (6.1%)
└── HTML файлы:             51.9 KB  (22.4%)

СЕРВЕР (общий размер: ~63 KB)
├── server.gs:              34.2 KB  (54.3%)
├── license.gs:             15.0 KB  (23.8%)
├── migrate_license_v3.gs:   9.1 KB  (14.4%)
└── test_license_v3.gs:      4.8 KB   (7.6%)
```

### **Строки кода (приблизительно):**

| Компонент | Строк кода |
|-----------|------------|
| КЛИЕНТ | ~4,500 |
| СЕРВЕР | ~1,500 |
| **ИТОГО** | **~6,000** |

### **Функции (приблизительно):**

| Проект | Количество функций |
|--------|-----------------|
| КЛИЕНТ | ~80-100 |
| СЕРВЕР | ~30-40 |

---

## ✅ ПРИЁМКА АУДИТА

- [x] ✅ Ясно понимаем архитектуру: ДВА отдельных Apps Script проекта
- [x] ✅ Задокументировано текущее распределение кода (клиент vs сервер)
- [x] ✅ Определена роль каждого проекта
- [x] ✅ Выявлены все файлы в deploy/
- [x] ✅ Описаны flow взаимодействия клиент → сервер
- [x] ✅ Задокументированы API endpoints
- [x] ✅ Описаны процессы развёртывания
- [x] ✅ Выявлены текущие проблемы и технический долг
- [x] ✅ Добавлены метрики проекта

---

## 🎯 РЕКОМЕНДАЦИИ

### **Краткосрочные (1-2 недели):**

1. ✅ **Добавить версионирование**
   - CLIENT_VERSION и SERVER_VERSION
   - Проверка совместимости при каждом запросе

2. ✅ **Разделить дублирующийся код**
   - CollectConfig_client.gs и CollectConfig_server.gs
   - Чёткое разграничение ответственности

3. ✅ **Документировать SERVER_URL**
   - Добавить в README.md
   - Инструкция по обновлению URL в клиентах

### **Среднесрочные (1-2 месяца):**

4. ✅ **Настроить CI/CD с clasp**
   - Автоматическое развёртывание клиента
   - Тесты перед deploy

5. ✅ **Создать миграционный скрипт**
   - Автоматическое обновление старых клиентов
   - Проверка версии и предложение обновления

6. ✅ **Добавить мониторинг**
   - Dashboard с метриками использования
   - Алерты при ошибках

### **Долгосрочные (3+ месяца):**

7. ✅ **Рефакторинг на TypeScript**
   - Типизация всех API
   - Компиляция с clasp

8. ✅ **Создание marketplace add-on**
   - Публикация в Google Workspace Marketplace
   - Упрощённая установка для пользователей

9. ✅ **Мобильное приложение**
   - Отдельный Web App для мобильных
   - Progressive Web App (PWA)

---

## 📞 КОНТАКТЫ И ПОДДЕРЖКА

**Документация:**
- 📋 Этот аудит: `docs/AUDIT_TWO_APPS_SCRIPT.md`
- 📚 Deployment Guide: `deploy/DEPLOYMENT_GUIDE.md`
- 📖 README: `deploy/README.md`

**Репозиторий:**
- 🔗 GitHub: https://github.com/crosspostly/table_ai

**Связь:**
- 📧 VK: https://vk.com/daoqub

---

**🎉 АУДИТ ЗАВЕРШЁН!**

**Дата:** 2025-11-28  
**Версия документа:** 1.0  
**Автор:** AI Assistant (Claude) + crosspostly
