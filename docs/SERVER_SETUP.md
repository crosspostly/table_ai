# 🚀 Server Setup - Настройка сервера Table AI

## 📌 Обзор

**Сервер Table AI** - это Google Apps Script Web App, который обеспечивает:
- ✅ OTA обновления клиентов
- ✅ Проверку лицензий
- ✅ Proxy для Gemini API
- ✅ Централизованное управление

---

## 🏗️ Требования

### Google Account
- ✅ Google Account с доступом к Apps Script
- ✅ Google Cloud Project (для Apps Script API)
- ✅ Права на создание Web Apps

### Google Cloud Console
- ✅ Включен Google Apps Script API
- ✅ Включен Google Drive API
- ✅ Включен Google Sheets API
- ✅ Service Account с правами на Apps Script

---

## 🚀 Шаг 1: Создание Apps Script проекта

### 1.1 Создать новый проект

```
1. Открыть: https://script.google.com
2. Нажать: "New Project"
3. Название: "Table AI Server"
4. ✅ Проект создан
```

### 1.2 Настроить манифест

```json
// appsscript.json
{
  "timeZone": "UTC",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.projects",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "webapp": {
    "access": "ANYONE",
    "executeAs": "ME"
  }
}
```

---

## 📁 Шаг 2: Развертывание файлов

### 2.1 Скопировать серверные файлы

```
Из репозитория скопировать в Apps Script:
├── server.gs              # Основной серверный код
├── license.gs              # Модуль лицензирования
└── appsscript.json        # Манифест
```

### 2.2 Порядок добавления файлов

```
1. Сначала appsscript.json (манифест)
2. Затем server.gs (основной код)
3. В конце license.gs (модуль лицензий)
```

---

## 🔧 Шаг 3: Настройка Google Cloud

### 3.1 Включить Apps Script API

```
1. Google Cloud Console: https://console.cloud.google.com
2. Выбрать проект
3. "APIs & Services" → "Library"
4. Найти: "Google Apps Script API"
5. Нажать: "Enable"
```

### 3.2 Создать Service Account

```
1. "IAM & Admin" → "Service Accounts"
2. "Create Service Account"
3. Name: "table-ai-server"
4. Role: "Apps Script Developer"
5. Create Key → JSON → Скачать
```

### 3.3 Настроить OAuth2

```
1. "APIs & Services" → "OAuth consent screen"
2. User Type: "External"
3. App name: "Table AI Server"
4. Scopes: Добавить необходимые:
   - https://www.googleapis.com/auth/spreadsheets
   - https://www.googleapis.com/auth/drive
   - https://www.googleapis.com/auth/script.projects
5. Test users: Добавить свой email
6. ✅ Сохранить
```

---

## 🌐 Шаг 4: Deploy Web App

### 4.1 Создать развертывание

```
В Apps Script Editor:
1. "Deploy" → "New deployment"
2. Type: "Web app"
3. Description: "Table AI Server v3.2"
4. Execute as: "Me"
5. Who has access: "Anyone"
6. Deploy
```

### 4.2 Получить URL

```
После деплоя увидишь:
Web app URL: https://script.google.com/macros/s/ABC123.../exec

Скопировать этот URL - он понадобится для клиентов!
```

---

## 🔑 Шаг 5: Настройка API ключей

### 5.1 Gemini API ключ

```
1. Открыть: https://aistudio.google.com/app/apikey
2. Создать новый API ключ
3. Скопировать ключ
4. В Apps Script Console выполнить:
   setDefaultGeminiKey_('AIzaSy...YOUR_KEY_HERE')
```

### 5.2 Проверить ключ

```javascript
// В Apps Script Console
function testGeminiKey() {
  const key = PropertiesService.getScriptProperties()
    .getProperty('GEMINI_API_KEY');
  Logger.log('Key: ' + key.substring(0, 10) + '...');
}
```

---

## 📊 Шаг 6: Настройка таблиц данных

### 6.1 Создать License Sheet

```
1. Создать новую Google Sheet: "Table AI Licenses"
2. Создать лист "Licenses" с колонками:
   A: email
   B: token  
   C: expires
   D: copies_count

3. Добавить тестового пользователя:
   A: test@example.com
   B: TEST_TOKEN_12345678901234567890123456789012
   C: =TODAY()+365
   D: 100
```

### 6.2 Создать Bindings Sheet

```
В той же таблице создать лист "Bindings":
   A: email
   B: sheet_id
   C: script_id  
   D: created_at

Формат для created_at: =NOW()
```

### 6.3 Настроить доступ

```
1. Share таблицу с серверным Service Account
2. Дать права: "Editor"
3. Записать Sheet ID:
   Файл → Share → Дополнительно → Копировать URL
   Sheet ID это часть между /d/ и /edit
```

---

## ⚙️ Шаг 7: Конфигурация сервера

### 7.1 Установить константы

```javascript
// server.gs, начало файла
const SERVER_VERSION = '3.2.0';
const LICENSE_SHEET_ID = 'YOUR_SHEET_ID_HERE';
const GITHUB_REPO = 'crosspostly/table_ai';
const GITHUB_BRANCH = 'main';
```

### 7.2 Настроить лицензии

```javascript
// В Apps Script Console
function setupLicenseSheet() {
  PropertiesService.getScriptProperties()
    .setProperty('LICENSE_SHEET_ID', 'YOUR_SHEET_ID');
}
```

---

## 🧪 Шаг 8: Тестирование

### 8.1 Проверить сервер

```javascript
// В Apps Script Console
function testServer() {
  // 1. Проверить версию
  Logger.log('Server version: ' + SERVER_VERSION);
  
  // 2. Проверить Gemini ключ
  const key = getGeminiApiKey();
  Logger.log('Gemini key: ' + (key ? 'SET' : 'NOT SET'));
  
  // 3. Проверить лицензии
  const sheetId = PropertiesService.getScriptProperties()
    .getProperty('LICENSE_SHEET_ID');
  Logger.log('License sheet: ' + (sheetId ? 'SET' : 'NOT SET'));
  
  // 4. Проверить GitHub доступ
  const test = fetchFileContent_('README.md');
  Logger.log('GitHub access: ' + (test ? 'OK' : 'FAILED'));
}
```

### 8.2 Тестировать Web App

```
1. Открыть Web App URL в браузере
2. Должен увидеть: {"status":"ok","version":"3.2.0"}
3. Если ошибка → проверить логи Apps Script
```

### 8.3 Тестировать OTA

```javascript
// В Apps Script Console
function testOTA() {
  const testPayload = {
    action: 'ota',
    subaction: 'checkUpdates',
    clientVersion: '3.1.0'
  };
  
  const result = handleOTARquest(testPayload);
  Logger.log(JSON.stringify(result, null, 2));
}
```

---

## 🔍 Шаг 9: Мониторинг

### 9.1 Включить логирование

```javascript
// В server.gs
function logEvent(level, message, details = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    level: level,
    message: message,
    details: details
  };
  
  Logger.log(JSON.stringify(log));
  
  // Опционально: записывать в Google Sheet
  if (level === 'ERROR') {
    writeToErrorLog(log);
  }
}
```

### 9.2 Настроить алерты

```
Google Cloud Console:
1. "Logging" → "Log Explorer"
2. Создать alert для:
   - ERROR уровней
   - High latency (>30s)
   - Quota exceeded
3. Настроить email уведомления
```

---

## 🚨 Шаг 10: Безопасность

### 10.1 Ограничить доступ

```javascript
// В server.gs, doPost()
function doPost(e) {
  // Проверка источника
  const source = e.parameter.source;
  if (!isValidSource(source)) {
    return ContentService.createTextOutput('Unauthorized')
      .setMimeType(ContentService.MimeType.TEXT);
  }
  
  // Продолжить обработку...
}
```

### 10.2 Rate limiting

```javascript
// Простая реализация rate limiting
const RATE_LIMIT = 100; // запросов в час
const RATE_LIMIT_KEY = 'rate_limit_';

function checkRateLimit(email) {
  const key = RATE_LIMIT_KEY + email;
  const count = PropertiesService.getScriptProperties()
    .getProperty(key) || '0';
  
  if (parseInt(count) > RATE_LIMIT) {
    return false;
  }
  
  PropertiesService.getScriptProperties()
    .setProperty(key, String(parseInt(count) + 1));
  
  return true;
}
```

---

## 📋 Шаг 11: Продакшен готовность

### Чек-лист перед продакшеном

```
✅ Apps Script API включен
✅ Service Account создан с правами
✅ OAuth2 настроен
✅ Web App развернут
✅ Gemini API ключ установлен
✅ License Sheet создан
✅ Bindings Sheet создан  
✅ Все тесты проходят
✅ Логирование включено
✅ Безопасность настроена
✅ Мониторинг настроен
```

---

## 🔄 Обновление сервера

### Версионирование

```
При обновлении:
1. Увеличить SERVER_VERSION в server.gs
2. Протестировать изменения
3. Создать новый deployment
4. Обновить клиентов через OTA
```

### Rollback

```
Если что-то пошло не так:
1. Apps Script → Deployments
2. Найти предыдущую стабильную версию
3. "Deploy" → "Select type" → "Web app"
4. Выбрать предыдущую версию
5. ✅ Откат выполнен
```

---

## 📞 Поддержка

- 🆘 Проблема с настройкой? → vk.com/daoqub
- 💬 Вопросы по серверу? → GitHub Discussions
- 🐛 Баг в сервере? → Создай Issue

---

**Последнее обновление:** 30.11.2025 | Server Setup v3.2
