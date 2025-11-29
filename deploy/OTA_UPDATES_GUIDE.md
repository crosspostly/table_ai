# 🚀 OTA Automatic Updates Guide (Table AI v3.1.0)

## 📋 Overview

Система **автоматических обновлений Over-The-Air (OTA)** позволяет обновлять код прямо в текущем скрипте без копирования таблиц.

**Основной flow:**
1. Клиент устанавливает триггер в `onOpen()` (быстро, <1 сек)
2. Каждый день в 3:00 триггер запускает фоновую проверку обновлений
3. Если доступна новая версия - файлы скачиваются с GitHub
4. Через Apps Script API файлы обновляются прямо в скрипте
5. Email уведомление пользователю о успехе/ошибке

---

## 🔧 НАСТРОЙКА (один раз)

### ШАГ 1: Включить Apps Script API

1. Открой любую таблицу с Table AI
2. Extensions → Apps Script → Project Settings
3. Скопируй **GCP Project Number** (не Project ID)
4. Перейди в [Google Cloud Console](https://console.cloud.google.com/)
5. Открой свой GCP Project
6. APIs & Services → Library
7. Найди **"Apps Script API"** → нажми **ENABLE**

**✅ Готово!** Apps Script API включен

### ШАГ 2: Добавить scope в appsscript.json

Файл: `deploy/appsscript.json`

```json
{
  "timeZone": "Europe/Moscow",
  "dependencies": {
    "enabledAdvancedServices": []
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/script.projects"  // ← ДОБАВЛЕНО
  ]
}
```

**Важно:** Новый scope требует переавторизации пользователей при следующем открытии таблицы.

---

## 📐 АРХИТЕКТУРА OTA

### Константы версионирования

**server.gs:**
```javascript
const SERVER_VERSION = '3.1.0';
```

**Main.gs:**
```javascript
const CLIENT_VERSION = '3.1.0';
```

Обновление доступно когда `CLIENT_VERSION !== SERVER_VERSION`

### Файлы для обновления (12)

Все файлы скачиваются с GitHub при обновлении:
```
Main.gs
CollectConfig.gs
TemplateService.gs
UnpackingViewer.gs
VK.gs
ocrRunV2_client.gs
reniewcell.gs
CollectConfigUi.html
SettingsUI.html
UnpackingViewerUI.html
logging_system.html
appsscript.json
```

### Реестр конфигурации

Список файлов находится в `server.gs`:
```javascript
case 'ota': {
  if (subaction === 'getUpdatedFiles') {
    const clientFiles = [
      'Main.gs',
      'CollectConfig.gs',
      // ... полный список
    ];
    // Скачиваем и отправляем через API
  }
}
```

**При добавлении нового файла:**
1. Разместить в `/deploy` директории
2. Добавить имя в массив `clientFiles` в `server.gs`
3. Увеличить версию `SERVER_VERSION`

---

## 🔄 ПРОЦЕСС ОБНОВЛЕНИЯ

### 1️⃣ Установка триггера (onOpen)

```javascript
function onOpen() {
  installUpdateTrigger_();  // Вызывается при каждом открытии таблицы
  // ... остальной код
}

function installUpdateTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.find(t => 
    t.getHandlerFunction() === 'checkForUpdatesBackground_'
  );
  
  if (exists) return;  // Триггер уже установлен
  
  ScriptApp.newTrigger('checkForUpdatesBackground_')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();
  
  addLog('✅ Триггер обновлений установлен', 'INFO');
}
```

**Проверка:** Extensions → Triggers → найти `checkForUpdatesBackground_`

### 2️⃣ Фоновая проверка (3:00 каждый день)

```javascript
function checkForUpdatesBackground_() {
  // ШАГ 1: Проверка версии
  const updateInfo = /* запрос на сервер */;
  if (!updateInfo.updateAvailable) return;  // Версия актуальна
  
  // ШАГ 2: Получение файлов с GitHub
  const filesData = /* запрос на сервер */;
  
  // ШАГ 3: Получение Script ID из лицензии
  const scriptId = getLicenseScriptId();
  
  // ШАГ 4: Обновление через Apps Script API
  UrlFetchApp.fetch(`https://script.googleapis.com/v1/projects/${scriptId}/content`, {
    method: 'put',
    payload: JSON.stringify({ files: filesData.files }),
  });
  
  // ШАГ 5: Email уведомление
  sendUpdateEmail_(serverVersion);
}
```

### 3️⃣ Проверка версии на сервере

**Request:**
```javascript
{
  action: 'ota',
  subaction: 'checkUpdates',
  clientVersion: '3.0.0',
  email: 'user@example.com',
  token: '...'
}
```

**Response:**
```javascript
{
  ok: true,
  updateAvailable: true,
  clientVersion: '3.0.0',
  serverVersion: '3.1.0'
}
```

### 4️⃣ Скачивание файлов с GitHub

**Request:**
```javascript
{
  action: 'ota',
  subaction: 'getUpdatedFiles',
  email: 'user@example.com',
  token: '...'
}
```

**Response:**
```javascript
{
  ok: true,
  files: [
    {
      name: 'Main.gs',
      type: 'SERVER_JS',
      source: '// ... код файла ...'
    },
    {
      name: 'appsscript.json',
      type: 'JSON',
      source: '{ ... }'
    }
  ],
  count: 12,
  version: '3.1.0'
}
```

---

## 🔐 БЕЗОПАСНОСТЬ

### Проверка лицензии

Обновление доступно **только авторизованным пользователям**:

```javascript
// В server.gs doPost()
if (action !== 'status' && action !== 'validate') {
  const lic = checkLicense_(token, email, scriptId, spreadsheetId);
  if (!lic.ok) {
    return json_({ok: false, error: 'UNAUTHORIZED'}, 403);
  }
}
```

**OTA действие требует** действительный:
- Email из лицензионной таблицы
- Token из лицензионной таблицы
- Script ID из лицензионной таблицы

### Скачивание только из main ветки GitHub

```javascript
const REPO = 'crosspostly/table_ai';
const BRANCH = 'main';  // Только main!
```

**Безопасность:** Никакие пользовательские данные не передаются при обновлении

---

## 🧪 ТЕСТИРОВАНИЕ

### ТЕСТ 1: Триггер установился

1. Открой таблицу
2. Extensions → Apps Script → Triggers
3. Найди триггер `checkForUpdatesBackground_` с расписанием каждый день 3:00
4. ✅ **PASS** если триггер есть

### ТЕСТ 2: Ручная проверка обновлений

1. Открой таблицу → Extensions → Apps Script
2. 🧰 DEV → 🔄 Обновить вручную
3. Должно показать диалог с текущей версией
4. Если версии одинаковые → "✅ Версия актуальна"
5. ✅ **PASS** если диалог показывается

### ТЕСТ 3: Обновление версии (требует изменения кода)

1. На сервере: измени `SERVER_VERSION = '3.2.0'`
2. На клиенте: оставь `CLIENT_VERSION = '3.1.0'` (не deploy!)
3. Открой таблицу → 🧰 DEV → 🔄 Обновить вручную
4. Должно предложить обновиться до 3.2.0
5. Нажми YES → 'Обновление запущено...'
6. Проверь email на успех обновления
7. Перезагрузи таблицу
8. Extensions → Apps Script → Main.gs
9. Проверь что `CLIENT_VERSION = '3.2.0'`
10. ✅ **PASS** если версия обновилась

### ТЕСТ 4: Проверка логов

1. 🧰 DEV → 📝 Показать логи
2. Найди записи:
   - `✅ Триггер обновлений установлен` (при первом открытии)
   - `🌙 Фоновая проверка обновлений запущена` (в 3:00)
   - `📥 Получено X файлов` (при наличии обновлений)
   - `✅ Файлы обновлены через API` (успех)
3. ✅ **PASS** если логи есть

---

## 🛠️ РАЗВЕРТЫВАНИЕ ОБНОВЛЕНИЯ

### Процедура Release

1. **Подготовка:**
   ```bash
   # Обновить все файлы в /deploy
   git add deploy/
   # Увеличить версию в server.gs
   # SERVER_VERSION = 'X.Y.Z' →  SERVER_VERSION = 'X.Y.(Z+1)'
   ```

2. **Commit & Push:**
   ```bash
   git commit -m "OTA Update: v3.1.0 -> vX.Y.Z"
   git push origin main
   ```

3. **Deploy server.gs как Web App:**
   - Extensions → Apps Script
   - Deploy → New deployment → Web app
   - Execute as: (ваш аккаунт)
   - Who has access: Anyone
   - Deploy

4. **Результат:**
   - ✅ Все текущие пользователи получат обновление ночью в 3:00
   - ✅ Email уведомления будут отправлены
   - ✅ Новые пользователи скачают свежую версию

### Откат версии

Если обновление сломало что-то:

1. Откатить изменения в GitHub:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. Вернуть `SERVER_VERSION` на старую версию

3. Deploy server.gs заново

4. ✅ Пользователи получат откат в 3:00 следующего дня

---

## 📊 МОНИТОРИНГ

### Проверка статуса обновлений

**Server logs:**
```
Logger.log(`OTA check: client=${clientVersion}, server=${SERVER_VERSION}, update=${updateAvailable}`);
Logger.log(`OTA: prepared ${files.length} files`);
```

**Client logs:**
- 🧰 DEV → 📝 Показать логи
- Поиск: "OTA", "🔄 Обновить", "📥 Получено"

### Email уведомления

**Успешное обновление:**
```
From: Google Apps Script
Subject: ✅ Table AI обновлён до версии X.Y.Z
Body: Все данные сохранены. Готово к работе.
```

**Ошибка обновления:**
```
From: Google Apps Script
Subject: ❌ Ошибка обновления Table AI
Body: Не удалось обновить таблицу. Ошибка: [детали ошибки]
```

---

## ⚙️ КОНФИГУРАЦИЯ

### Время проверки обновлений

**Текущее время:** 3:00 ночи (UTC+3 Moscow)

Изменение в `Main.gs`:
```javascript
ScriptApp.newTrigger('checkForUpdatesBackground_')
  .timeBased()
  .atHour(3)        // ← Измени на нужное время (0-23)
  .everyDays(1)
  .create();
```

### GitHub репозиторий

**Текущий:** `crosspostly/table_ai` main branch

Изменение в `server.gs`:
```javascript
const REPO = 'crosspostly/table_ai';      // Твой репозиторий
const BRANCH = 'main';                    // Ветка (обычно main/master)
```

### Список обновляемых файлов

Редактировать в `server.gs`, функция `case 'ota'`:
```javascript
const clientFiles = [
  'Main.gs',              // Обязательно!
  'CollectConfig.gs',     // Обязательно!
  'appsscript.json',      // Обязательно!
  // ... добавлять новые файлы сюда
];
```

---

## 🚨 TROUBLESHOOTING

### ❌ Триггер не создается

**Проблема:** Нет прав на создание триггеров

**Решение:**
1. Открыть как редактор (не зритель)
2. Проверить что Apps Script API включен
3. Удалить старые триггеры Extensions → Triggers
4. Перезагрузить таблицу и открыть снова

### ❌ "Script ID not found in license"

**Проблема:** scriptId не сохранен в лицензионной таблице

**Решение:**
1. Открыть лицензионную таблицу
2. Добавить Script ID вручную в лист "Tokens"
3. Повторить попытку обновления

### ❌ "Failed to fetch: Main.gs"

**Проблема:** GitHub возвращает 404 (файл не найден)

**Решение:**
1. Проверить что файл есть в `/deploy` на main ветке GitHub
2. Проверить имя файла (чувствительно к регистру)
3. Проверить что репозиторий публичный
4. Проверить что интернет доступен в Google Apps Script

### ❌ "HTTP 403 - Permission denied" при обновлении API

**Проблема:** OAuth token недостаточно для обновления скрипта

**Решение:**
1. Проверить что Apps Script API включен в Google Cloud Console
2. Проверить что у пользователя есть права редактирования на скрипт
3. Переавторизоваться (удалить разрешение и открыть таблицу снова)

### ❌ Email не приходит

**Проблема:** MailApp.sendEmail() не работает

**Решение:**
1. Проверить email в лицензионной таблице - должен быть действительный
2. Проверить логи: 🧰 DEV → 📝 Показать логи
3. Проверить что это основной аккаунт (MailApp работает только с основным)

---

## 📚 API ENDPOINTS

### OTA Check Updates
```javascript
POST /exec
{
  action: 'ota',
  subaction: 'checkUpdates',
  clientVersion: '3.0.0',
  email: 'user@example.com',
  token: '...'
}

RESPONSE:
{
  ok: true,
  updateAvailable: true | false,
  clientVersion: '3.0.0',
  serverVersion: '3.1.0'
}
```

### OTA Get Updated Files
```javascript
POST /exec
{
  action: 'ota',
  subaction: 'getUpdatedFiles',
  email: 'user@example.com',
  token: '...'
}

RESPONSE:
{
  ok: true,
  files: [
    {
      name: 'Main.gs',
      type: 'SERVER_JS',
      source: '...'
    },
    ...
  ],
  count: 12,
  version: '3.1.0'
}
```

---

## 🔗 СВЯЗАННЫЕ ДОКУМЕНТЫ

- [ARCHITECTURE_AFTER_REFACTOR.md](./ARCHITECTURE_AFTER_REFACTOR.md) - Общая архитектура v3.0
- [README.md](./README.md) - Основная документация
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Руководство развертывания

---

## ✅ CHECKLIST НАСТРОЙКИ

- [ ] Apps Script API включена в Google Cloud Console
- [ ] Scope `script.projects` добавлен в appsscript.json
- [ ] Server версия развернута как Web App
- [ ] Script ID добавлен в лицензионную таблицу
- [ ] Первый пользователь открыл таблицу (триггер создан)
- [ ] Проверена ручная проверка обновлений (DEV → 🔄)
- [ ] Email нотификации работают
- [ ] Server version увеличена для тестирования
- [ ] Тестовое обновление пройдено успешно
- [ ] Логирование работает (DEV → 📝)

**🎉 OTA обновления настроены и готовы к использованию!**
