# 🎯 ТЕХНИЧЕСКОЕ ЗАДАНИЕ: Исправление системы лицензирования в Table AI

**Дата:** 2025-11-28  
**Приоритет:** КРИТИЧЕСКИЙ  
**Статус:** READY FOR IMPLEMENTATION  
**Исполнитель:** AI Agent (первое знакомство с проектом)

---

## 📋 СОДЕРЖАНИЕ

1. [Контекст проекта](#-контекст-проекта)
2. [Архитектура системы](#-архитектура-системы)
3. [Суть проблемы](#-суть-проблемы)
4. [Техническое задание](#-техническое-задание)
5. [Детальный план изменений](#-детальный-план-изменений)
6. [Тестирование](#-тестирование)
7. [Критерии приёмки](#-критерии-приёмки)

---

## 🌍 КОНТЕКСТ ПРОЕКТА

### Что такое Table AI?

**Table AI** - это система для работы с Google Sheets, которая предоставляет AI-возможности (через Gemini API) для обработки данных в таблицах.

**Основные компоненты:**

```
┌─────────────────────────────────────────────────────────────┐
│                       TABLE AI                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │     CLIENT       │◄───────►│     SERVER       │         │
│  │   (Main.gs)      │  HTTP   │   (server.gs)    │         │
│  ├──────────────────┤         ├──────────────────┤         │
│  │ • UI меню        │         │ • Лицензии       │         │
│  │ • Логика клиента │         │ • Прокси Gemini  │         │
│  │ • Settings UI    │         │ • Логирование    │         │
│  │ • Формулы GM()   │         │ • Квоты          │         │
│  └──────────────────┘         └──────────────────┘         │
│         ▲                              ▲                    │
│         │                              │                    │
│         ▼                              ▼                    │
│  PropertiesService         PropertiesService               │
│  (контейнер таблицы)       (веб-приложение)                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Ключевые технологии:

- **Google Apps Script** - платформа выполнения (JavaScript ES6)
- **Google Sheets** - интерфейс для пользователя
- **PropertiesService** - хранилище настроек (key-value store)
- **Gemini API** - AI-модель для обработки текста
- **UrlFetchApp** - HTTP-клиент для запросов

---

## 🏗️ АРХИТЕКТУРА СИСТЕМЫ

### CLIENT (Main.gs) - Контейнерный скрипт

**Расположение:** `deploy/Main.gs`  
**Тип:** Container-bound script (привязан к Google Sheets документу пользователя)  
**Размер:** ~65,000 символов (огромный монолитный файл)

**Функции CLIENT:**
- UI меню в Google Sheets
- Формулы `GM()` и `GM_IF()` для ячеек
- Чтение настроек из PropertiesService
- Отправка запросов на SERVER
- Локальное кэширование

**PropertiesService CLIENT:**
- Хранится в контейнере таблицы пользователя
- У каждого пользователя свой набор Properties
- Ключи: `LICENSE_EMAIL`, `LICENSE_TOKEN`, `GEMINI_API_KEY`

### SERVER (server.gs) - Веб-приложение

**Расположение:** `deploy/server.gs`  
**Тип:** Standalone web app (отдельное веб-приложение)  
**URL:** `https://script.google.com/macros/s/AKfycby.../exec`

**Функции SERVER:**
- Проверка лицензий (чтение из таблицы лицензий)
- Прокси-запросы к Gemini API
- Логирование в админскую таблицу
- Rate limiting
- Квоты

**PropertiesService SERVER:**
- Хранится в отдельном веб-приложении
- НЕ имеет доступа к Properties CLIENT
- Используется только для дефолтных настроек сервера

### SettingsUI.html - Интерфейс настроек

**Расположение:** `deploy/SettingsUI.html`  
**Тип:** HTML Dialog в Google Sheets

**Функции:**
- Ввод API ключа Gemini
- Ввод email и token лицензии
- Отображение текущих значений
- Сохранение через функцию `saveSettingsData()`

---

## ⚠️ СУТЬ ПРОБЛЕМЫ

### Проблема 1: Дублирование имён ключей (КРИТИЧЕСКАЯ)

**ЧТО ПРОИСХОДИТ:**

```javascript
// SettingsUI.html → saveSettingsData() ПИШЕТ:
PropertiesService.getScriptProperties().setProperty('LICENSE_EMAIL', email);
PropertiesService.getScriptProperties().setProperty('LICENSE_TOKEN', token);

// Main.gs → getLicenseEmail() ЧИТАЕТ:
PropertiesService.getScriptProperties().getProperty('LICENSEEMAIL');  // ❌ ДРУГОЙ КЛЮЧ!
PropertiesService.getScriptProperties().getProperty('LICENSETOKEN');  // ❌ ДРУГОЙ КЛЮЧ!
```

**РЕЗУЛЬТАТ:**
1. Пользователь вводит email/token через Settings UI
2. Данные сохраняются в `LICENSE_EMAIL` / `LICENSE_TOKEN`
3. Клиент пытается прочитать из `LICENSEEMAIL` / `LICENSETOKEN`
4. **Клиент НЕ НАХОДИТ данные**
5. Система считает что лицензии нет
6. **Блокирует работу с ошибкой `LICENSE_REQUIRED`**

**ГДЕ В КОДЕ:**

```javascript
// Main.gs, строки ~1150-1157
function getLicenseEmail() {
  return PropertiesService.getScriptProperties().getProperty('LICENSEEMAIL'); // ❌
}
function getLicenseToken() {
  return PropertiesService.getScriptProperties().getProperty('LICENSETOKEN'); // ❌
}

// Main.gs, строки ~1287-1310 (в saveSettingsData)
props.setProperty('LICENSE_EMAIL', email);  // ❌ Несоответствие!
props.setProperty('LICENSE_TOKEN', token);  // ❌ Несоответствие!
```

---

### Проблема 2: Удаление Gemini API ключа (КРИТИЧЕСКАЯ)

**ЧТО ПРОИСХОДИТ:**

```javascript
// Main.gs → saveSettingsData()
if (data.apiKey !== undefined) {
  if (data.apiKey && String(data.apiKey).trim()) {
    props.setProperty('GEMINI_API_KEY', String(data.apiKey).trim());
  } else {
    props.deleteProperty('GEMINI_API_KEY'); // ❌ УДАЛЯЕТ СУЩЕСТВУЮЩИЙ КЛЮЧ!
  }
}
```

**СЦЕНАРИЙ:**
1. В системе есть дефолтный API ключ Gemini
2. Пользователь открывает Settings UI
3. Вводит только email/token (поле API key оставляет пустым)
4. Нажимает "Сохранить всё"
5. **Система УДАЛЯЕТ существующий дефолтный ключ!**
6. **Все запросы к Gemini перестают работать**

**ГДЕ В КОДЕ:**

```javascript
// Main.gs, строки ~1270-1285 (в saveSettingsData)
if (data.apiKey !== undefined) {
  if (data.apiKey && String(data.apiKey).trim()) {
    props.setProperty('GEMINI_API_KEY', String(data.apiKey).trim());
    updated.push('API ключ');
  } else {
    props.deleteProperty('GEMINI_API_KEY'); // ❌ ОШИБКА!
    updated.push('API ключ (удален)');
  }
}
```

---

### Проблема 3: Несовместимость CLIENT ↔ UI

**СЛЕДСТВИЕ проблем 1 и 2:**

```
Пользователь вводит данные → UI сохраняет → CLIENT не видит → Лицензия не работает
        ↓                          ↓                  ↓                    ↓
  Settings UI.html          LICENSE_EMAIL       LICENSEEMAIL          ERROR:
                            LICENSE_TOKEN       LICENSETOKEN      LICENSE_REQUIRED
```

**ВОСПРОИЗВЕДЕНИЕ:**

1. Открыть таблицу
2. Меню: 🤖 Table AI → ⚙️ Настройки
3. Ввести:
   - Email: `test@example.com`
   - Токен: `abc123`
   - API Key: (оставить пустым)
4. Нажать "💾 Сохранить всё"
5. **РЕЗУЛЬТАТ:**
   - ✅ Email сохранён в `LICENSE_EMAIL`
   - ✅ Token сохранён в `LICENSE_TOKEN`
   - ❌ API key УДАЛЁН (был дефолтный ключ)
   - ❌ Клиент читает из `LICENSEEMAIL` → НЕ НАХОДИТ
   - ❌ Клиент читает из `LICENSETOKEN` → НЕ НАХОДИТ
   - ❌ Система блокирует работу

---

## 🎯 ТЕХНИЧЕСКОЕ ЗАДАНИЕ

### Цель

Унифицировать систему хранения настроек так, чтобы:
1. CLIENT и UI использовали **ОДИНАКОВЫЕ** ключи
2. API ключ Gemini **НЕ УДАЛЯЛСЯ** при пустом вводе
3. Старые данные пользователей **автоматически мигрировались**
4. Обратная совместимость **сохранилась**

### Объём работ

**ИЗМЕНИТЬ:** `deploy/Main.gs` (только секцию лицензирования)

**НЕ ТРОГАТЬ:**
- `deploy/server.gs` (сервер работает правильно)
- `deploy/SettingsUI.html` (UI не требует изменений)
- Остальной код в `Main.gs` (только секция LICENSE & SERVER PROXY)

### Требования

1. **Единые ключи:** Везде использовать `LICENSE_EMAIL`, `LICENSE_TOKEN`, `GEMINI_API_KEY`
2. **Безопасное сохранение:** API ключ сохранять ТОЛЬКО если введено значение
3. **Автомиграция:** При первом обращении мигрировать старые ключи
4. **Логирование:** Все операции логировать через `addLog()`
5. **Совместимость:** Код должен работать со старыми и новыми данными

---

## 📝 ДЕТАЛЬНЫЙ ПЛАН ИЗМЕНЕНИЙ

### Изменение 1: Функция миграции

**СОЗДАТЬ новую функцию:**

```javascript
/**
 * Автоматическая миграция старых ключей в новый формат
 * Вызывается при первом обращении к getLicenseEmail/getLicenseToken
 * @return {boolean} true если была выполнена миграция
 */
function migrateLicenseKeysIfNeeded_() {
  try {
    const props = PropertiesService.getScriptProperties();
    
    // Проверяем наличие СТАРЫХ ключей
    const oldEmail = props.getProperty('LICENSEEMAIL');
    const oldToken = props.getProperty('LICENSETOKEN');
    
    // Проверяем наличие НОВЫХ ключей
    const newEmail = props.getProperty('LICENSE_EMAIL');
    const newToken = props.getProperty('LICENSE_TOKEN');
    
    let migrated = false;
    
    // Если есть старый email, но нет нового - мигрируем
    if (oldEmail && !newEmail) {
      props.setProperty('LICENSE_EMAIL', oldEmail);
      props.deleteProperty('LICENSEEMAIL');
      Logger.log('✅ Migrated LICENSEEMAIL → LICENSE_EMAIL');
      migrated = true;
    }
    
    // Если есть старый token, но нет нового - мигрируем
    if (oldToken && !newToken) {
      props.setProperty('LICENSE_TOKEN', oldToken);
      props.deleteProperty('LICENSETOKEN');
      Logger.log('✅ Migrated LICENSETOKEN → LICENSE_TOKEN');
      migrated = true;
    }
    
    if (migrated) {
      addLog('✅ Выполнена миграция лицензионных ключей в новый формат', 'INFO');
    }
    
    return migrated;
  } catch (e) {
    Logger.log('⚠️ Migration error (non-critical): ' + e.message);
    return false;
  }
}
```

**ГДЕ РАЗМЕСТИТЬ:** В начале секции `// ===== LICENSE & SERVER PROXY =====`

---

### Изменение 2: Исправить getLicenseEmail()

**БЫЛО (НЕВЕРНО):**
```javascript
function getLicenseEmail() {
  return PropertiesService.getScriptProperties().getProperty('LICENSEEMAIL') || '';
}
```

**СТАЛО (ВЕРНО):**
```javascript
function getLicenseEmail() {
  // Автомиграция при первом обращении
  migrateLicenseKeysIfNeeded_();
  
  return PropertiesService.getScriptProperties().getProperty('LICENSE_EMAIL') || '';
}
```

**ГДЕ:** `Main.gs`, строки ~1150

---

### Изменение 3: Исправить getLicenseToken()

**БЫЛО (НЕВЕРНО):**
```javascript
function getLicenseToken() {
  return PropertiesService.getScriptProperties().getProperty('LICENSETOKEN') || '';
}
```

**СТАЛО (ВЕРНО):**
```javascript
function getLicenseToken() {
  // Автомиграция при первом обращении
  migrateLicenseKeysIfNeeded_();
  
  return PropertiesService.getScriptProperties().getProperty('LICENSE_TOKEN') || '';
}
```

**ГДЕ:** `Main.gs`, строки ~1153

---

### Изменение 4: Исправить hasStoredLicense()

**БЫЛО (НЕВЕРНО):**
```javascript
function hasStoredLicense() {
  try {
    const email = PropertiesService.getScriptProperties().getProperty('LICENSEEMAIL');
    const token = PropertiesService.getScriptProperties().getProperty('LICENSETOKEN');
    return !!(email && token && String(email).trim() && String(token).trim());
  } catch (e) {
    addLog('hasStoredLicense: ' + e.message, 'WARN');
    return false;
  }
}
```

**СТАЛО (ВЕРНО):**
```javascript
function hasStoredLicense() {
  // Автомиграция перед проверкой
  migrateLicenseKeysIfNeeded_();
  
  try {
    const email = getLicenseEmail();
    const token = getLicenseToken();
    return !!(email && token && String(email).trim() && String(token).trim());
  } catch (e) {
    addLog('hasStoredLicense: ' + e.message, 'WARN');
    return false;
  }
}
```

**ГДЕ:** `Main.gs`, строки ~1156-1165

---

### Изменение 5: Исправить saveSettingsData() - API Key

**БЫЛО (НЕВЕРНО - удаляет ключ):**
```javascript
// ===== API KEY =====
if (data.apiKey !== undefined) {
  if (data.apiKey && String(data.apiKey).trim()) {
    props.setProperty('GEMINI_API_KEY', String(data.apiKey).trim());
    updated.push('API ключ');
    Logger.log('✅ GEMINI_API_KEY UPDATED, length: ' + data.apiKey.length);
  } else {
    props.deleteProperty('GEMINI_API_KEY');  // ❌ ОШИБКА!
    updated.push('API ключ (удален)');
    Logger.log('🗑️ GEMINI_API_KEY DELETED');
  }
}
```

**СТАЛО (ВЕРНО - сохраняет только при наличии значения):**
```javascript
// ===== API KEY (safe mode) =====
if (data.apiKey !== undefined && data.apiKey && String(data.apiKey).trim()) {
  // Сохраняем ТОЛЬКО если введено новое значение
  props.setProperty('GEMINI_API_KEY', String(data.apiKey).trim());
  updated.push('API ключ обновлён');
  Logger.log('✅ GEMINI_API_KEY UPDATED, length: ' + data.apiKey.length);
}
// Если поле пустое - НЕ трогаем существующий ключ
```

**ГДЕ:** `Main.gs`, функция `saveSettingsData()`, строки ~1270-1285

---

### Изменение 6: Исправить saveSettingsData() - License Email

**БЫЛО (НЕВЕРНО - неправильный ключ):**
```javascript
// ===== LICENSE EMAIL =====
if (data.email !== undefined) {
  if (data.email && String(data.email).trim()) {
    props.setProperty('LICENSE_EMAIL', String(data.email).trim()); // ❌ НЕВЕРНЫЙ КЛЮЧ
    updated.push('Email');
    Logger.log('✅ LICENSE_EMAIL UPDATED: ' + data.email);
  } else {
    Logger.log('⚠️ LICENSE_EMAIL not updated (empty value)');
  }
}
```

**СТАЛО (ВЕРНО - правильный ключ):**
```javascript
// ===== LICENSE EMAIL =====
if (data.email !== undefined && data.email && String(data.email).trim()) {
  props.setProperty('LICENSE_EMAIL', String(data.email).trim()); // ✅ ВЕРНЫЙ КЛЮЧ
  updated.push('Email обновлён');
  Logger.log('✅ LICENSE_EMAIL UPDATED: ' + data.email);
}
// Если пустое - не трогаем существующее значение
```

**ГДЕ:** `Main.gs`, функция `saveSettingsData()`, строки ~1287-1295

---

### Изменение 7: Исправить saveSettingsData() - License Token

**БЫЛО (НЕВЕРНО - неправильный ключ):**
```javascript
// ===== LICENSE TOKEN =====
if (data.token !== undefined) {
  if (data.token && String(data.token).trim()) {
    props.setProperty('LICENSE_TOKEN', String(data.token).trim()); // ❌ НЕВЕРНЫЙ КЛЮЧ
    updated.push('Токен');
    Logger.log('✅ LICENSE_TOKEN UPDATED, length: ' + data.token.length);
  } else {
    Logger.log('⚠️ LICENSE_TOKEN not updated (empty value)');
  }
}
```

**СТАЛО (ВЕРНО - правильный ключ):**
```javascript
// ===== LICENSE TOKEN =====
if (data.token !== undefined && data.token && String(data.token).trim()) {
  props.setProperty('LICENSE_TOKEN', String(data.token).trim()); // ✅ ВЕРНЫЙ КЛЮЧ
  updated.push('Токен обновлён');
  Logger.log('✅ LICENSE_TOKEN UPDATED, length: ' + data.token.length);
}
// Если пустое - не трогаем существующее значение
```

**ГДЕ:** `Main.gs`, функция `saveSettingsData()`, строки ~1297-1305

---

### Изменение 8: Исправить getSettingsData()

**БЫЛО (частично неверно):**
```javascript
function getSettingsData() {
  try {
    Logger.log('=== getSettingsData START ===');

    const userProps = PropertiesService.getUserProperties();
    const scriptProps = PropertiesService.getScriptProperties();

    const userApiKey = userProps.getProperty('GEMINI_API_KEY');
    const scriptApiKey = scriptProps.getProperty('GEMINI_API_KEY');
    const currentApiKey = userApiKey || scriptApiKey || '';
    const keySource = userApiKey ? 'USER' : (scriptApiKey ? 'DEFAULT' : 'NONE');

    const email = scriptProps.getProperty('LICENSEEMAIL') || '';  // ❌ НЕВЕРНЫЙ КЛЮЧ
    const token = scriptProps.getProperty('LICENSETOKEN') || '';  // ❌ НЕВЕРНЫЙ КЛЮЧ
    
    // ... остальной код
  }
}
```

**СТАЛО (верно):**
```javascript
function getSettingsData() {
  try {
    Logger.log('=== getSettingsData START ===');
    
    // Автомиграция перед чтением
    migrateLicenseKeysIfNeeded_();

    const userProps = PropertiesService.getUserProperties();
    const scriptProps = PropertiesService.getScriptProperties();

    const userApiKey = userProps.getProperty('GEMINI_API_KEY');
    const scriptApiKey = scriptProps.getProperty('GEMINI_API_KEY');
    const currentApiKey = userApiKey || scriptApiKey || '';
    const keySource = userApiKey ? 'USER' : (scriptApiKey ? 'DEFAULT' : 'NONE');

    // Используем функции-геттеры (они уже содержат миграцию и правильные ключи)
    const email = getLicenseEmail();
    const token = getLicenseToken();
    
    // ... остальной код
  }
}
```

**ГДЕ:** `Main.gs`, функция `getSettingsData()`, строки ~1250-1265

---

### Изменение 9: Исправить seedLicenseCredentialsFromParametersSheet()

**БЫЛО (частично неверно):**
```javascript
function seedLicenseCredentialsFromParametersSheet() {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    
    const curEmail = scriptProps.getProperty('LICENSE_EMAIL');
    const curToken = scriptProps.getProperty('LICENSE_TOKEN');
    
    // Если УЖЕ есть - НЕ перезаписываем
    if (curEmail && curToken) {
      Logger.log('DEBUG: LICENSE_EMAIL and LICENSE_TOKEN already exist, skipping seed');
      return false;
    }

    // ... чтение из листа Параметры ...

    // ✅ ПЕРЕЗАПИСЫВАЕМ (seed только если было пусто)
    scriptProps.setProperty('LICENSE_EMAIL', email);
    scriptProps.setProperty('LICENSE_TOKEN', token);
    
    // ...
  }
}
```

**СТАЛО (верно - используем правильные функции):**
```javascript
function seedLicenseCredentialsFromParametersSheet() {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    
    // Проверяем через функции-геттеры (они уже содержат миграцию)
    const curEmail = getLicenseEmail();
    const curToken = getLicenseToken();
    
    // Если УЖЕ есть - НЕ перезаписываем
    if (curEmail && curToken) {
      Logger.log('DEBUG: License already exists, skipping seed');
      return false;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Параметры');
    if (!sheet) {
      Logger.log('DEBUG: Sheet "Параметры" not found');
      return false;
    }

    // Читаем из G1 и H1
    const email = String(sheet.getRange('G1').getDisplayValue() || '').trim();
    const token = String(sheet.getRange('H1').getDisplayValue() || '').trim();
    
    if (!email || !token) {
      Logger.log('DEBUG: G1 or H1 empty');
      return false;
    }

    // Сохраняем в ПРАВИЛЬНЫЕ ключи
    scriptProps.setProperty('LICENSE_EMAIL', email);
    scriptProps.setProperty('LICENSE_TOKEN', token);
    
    Logger.log('INFO: License credentials seeded from Параметры sheet');
    Logger.log('  - LICENSE_EMAIL: ' + email);
    Logger.log('  - LICENSE_TOKEN: ' + token.substring(0, 4) + '***');
    
    addLog('✅ Лицензия загружена из листа "Параметры"', 'INFO');
    return true;
  } catch (e) {
    Logger.log('WARN: seed_license_from_params_error: ' + e.message);
    return false;
  }
}
```

**ГДЕ:** `Main.gs`, функция `seedLicenseCredentialsFromParametersSheet()`, строки ~1200-1235

---

## 🧪 ТЕСТИРОВАНИЕ

### Тест 1: Проверка миграции старых ключей

**Цель:** Убедиться что старые данные автоматически мигрируются

**Подготовка:**
```javascript
// Вручную установить СТАРЫЕ ключи
const props = PropertiesService.getScriptProperties();
props.setProperty('LICENSEEMAIL', 'old@example.com');
props.setProperty('LICENSETOKEN', 'old_token_123');
```

**Выполнение:**
```javascript
// Вызвать функцию миграции
const migrated = migrateLicenseKeysIfNeeded_();
Logger.log('Migration result: ' + migrated);

// Проверить результат
Logger.log('NEW EMAIL: ' + props.getProperty('LICENSE_EMAIL'));
Logger.log('NEW TOKEN: ' + props.getProperty('LICENSE_TOKEN'));
Logger.log('OLD EMAIL: ' + props.getProperty('LICENSEEMAIL'));
Logger.log('OLD TOKEN: ' + props.getProperty('LICENSETOKEN'));
```

**Ожидаемый результат:**
```
Migration result: true
NEW EMAIL: old@example.com
NEW TOKEN: old_token_123
OLD EMAIL: null
OLD TOKEN: null
```

**Критерий успеха:** ✅ Данные мигрированы, старые ключи удалены

---

### Тест 2: Проверка сохранения через UI (без API ключа)

**Цель:** Убедиться что API ключ НЕ удаляется при пустом вводе

**Подготовка:**
```javascript
// Установить дефолтный API ключ
const props = PropertiesService.getScriptProperties();
props.setProperty('GEMINI_API_KEY', 'AIzaSy_DEFAULT_KEY_12345');

// Проверить что ключ есть
Logger.log('BEFORE: ' + props.getProperty('GEMINI_API_KEY'));
```

**Выполнение:**
1. Открыть Settings UI: Меню → 🤖 Table AI → ⚙️ Настройки
2. Ввести:
   - Email: `test@example.com`
   - Токен: `test_token_123`
   - API Key: **(оставить пустым!)**
3. Нажать "💾 Сохранить всё"

**Проверка:**
```javascript
const props = PropertiesService.getScriptProperties();
Logger.log('AFTER EMAIL: ' + props.getProperty('LICENSE_EMAIL'));
Logger.log('AFTER TOKEN: ' + props.getProperty('LICENSE_TOKEN'));
Logger.log('AFTER API KEY: ' + props.getProperty('GEMINI_API_KEY'));
```

**Ожидаемый результат:**
```
AFTER EMAIL: test@example.com
AFTER TOKEN: test_token_123
AFTER API KEY: AIzaSy_DEFAULT_KEY_12345  ← НЕ УДАЛЁН!
```

**Критерий успеха:** ✅ Email и token сохранены, API ключ НЕ удалён

---

### Тест 3: Проверка чтения лицензии клиентом

**Цель:** Убедиться что CLIENT видит данные, которые сохранил UI

**Подготовка:**
```javascript
// Очистить все ключи
const props = PropertiesService.getScriptProperties();
props.deleteProperty('LICENSE_EMAIL');
props.deleteProperty('LICENSE_TOKEN');
props.deleteProperty('LICENSEEMAIL');
props.deleteProperty('LICENSETOKEN');
```

**Выполнение:**
1. Открыть Settings UI
2. Ввести email: `verify@test.com` и token: `verify_token`
3. Сохранить
4. Закрыть UI
5. Выполнить:
```javascript
Logger.log('getLicenseEmail(): ' + getLicenseEmail());
Logger.log('getLicenseToken(): ' + getLicenseToken());
Logger.log('hasStoredLicense(): ' + hasStoredLicense());
```

**Ожидаемый результат:**
```
getLicenseEmail(): verify@test.com
getLicenseToken(): verify_token
hasStoredLicense(): true
```

**Критерий успеха:** ✅ CLIENT видит данные из UI

---

### Тест 4: Проверка работы лицензии с сервером

**Цель:** Убедиться что лицензия проходит проверку на сервере

**Выполнение:**
```javascript
// Вызвать проверку статуса лицензии
const status = serverStatus();

Logger.log('License OK: ' + status.ok);
Logger.log('License Error: ' + status.error);
Logger.log('License Until: ' + status.until);
Logger.log('License Message: ' + status.message);
```

**Ожидаемый результат (при валидной лицензии):**
```
License OK: true
License Error: null
License Until: 2026-01-28T00:00:00.000Z
License Message: SHEET_ALLOWED
```

**Критерий успеха:** ✅ Лицензия валидна, сервер возвращает `ok: true`

---

### Тест 5: Проверка работы GM() функции

**Цель:** Убедиться что AI-запросы работают после исправлений

**Выполнение:**
1. Открыть лист "Распаковка"
2. В ячейку A3 ввести: `Привет, как дела?`
3. В ячейку B3 ввести формулу:
   ```
   =GM(A3, 100, 0.7)
   ```
4. Подождать выполнения

**Ожидаемый результат:**
```
B3: "Привет! Дела хорошо, спасибо что спросили. Чем могу помочь?"
```

**Критерий успеха:** ✅ Gemini отвечает корректно, нет ошибок лицензии

---

## ✅ КРИТЕРИИ ПРИЁМКИ

### Обязательные требования:

- [ ] **Миграция работает:** Старые ключи автоматически мигрируются в новый формат
- [ ] **Единые ключи:** Везде используется `LICENSE_EMAIL`, `LICENSE_TOKEN`
- [ ] **API ключ безопасен:** Не удаляется при пустом вводе через UI
- [ ] **UI ↔ CLIENT совместимость:** То что сохраняет UI, видит CLIENT
- [ ] **Обратная совместимость:** Код работает со старыми и новыми данными
- [ ] **Все тесты пройдены:** 5 тестовых сценариев выполнены успешно
- [ ] **Логирование работает:** Все операции логируются через `addLog()`
- [ ] **Нет регрессий:** Остальной функционал Main.gs не затронут

### Дополнительные требования:

- [ ] **Код читаем:** Комментарии на русском, ясная структура
- [ ] **Logger.log используется:** Для отладки в Script Editor
- [ ] **Ошибки обрабатываются:** try-catch блоки там где нужно
- [ ] **Нет хардкода:** Константы вынесены в переменные

---

## 📦 DELIVERABLES (Что нужно предоставить)

### 1. Исправленный файл Main.gs

**Формат:** Полный текст файла с исправлениями  
**Секция:** Только `// ===== LICENSE & SERVER PROXY =====`  
**Размер:** ~200-300 строк кода в секции лицензирования

### 2. Отчёт об изменениях

**Формат:** Markdown документ  
**Содержание:**
- Список всех изменённых функций
- Построчное описание изменений
- Обоснование каждого изменения

### 3. Результаты тестирования

**Формат:** Протокол тестирования  
**Содержание:**
- Выполнение всех 5 тестов
- Скриншоты логов (Logger.log)
- Фактические vs ожидаемые результаты

---

## 📚 СПРАВОЧНЫЕ МАТЕРИАЛЫ

### Структура PropertiesService

```javascript
// Два типа Properties:
PropertiesService.getUserProperties()   // Индивидуальные для пользователя
PropertiesService.getScriptProperties() // Общие для скрипта

// Методы:
.getProperty(key)           // Получить значение
.setProperty(key, value)    // Установить значение
.deleteProperty(key)        // Удалить ключ
.getProperties()            // Получить все ключи
```

### Функция addLog()

```javascript
// Уже существует в Main.gs
addLog(message, level)

// Уровни: 'INFO', 'DEBUG', 'WARN', 'ERROR'
// Пример:
addLog('✅ Миграция завершена', 'INFO');
addLog('⚠️ Ключ не найден', 'WARN');
```

### Ключевые константы

```javascript
// В Main.gs уже определены:
const SERVER_URL = 'https://script.google.com/macros/s/AKfycby.../exec';
const DEV_MODE = true; // Включает дополнительное логирование
```

---

## 🚨 ВАЖНЫЕ ОГРАНИЧЕНИЯ

### ЧТО НЕЛЬЗЯ ДЕЛАТЬ:

1. ❌ **НЕ менять** `deploy/server.gs` - сервер работает правильно
2. ❌ **НЕ менять** `deploy/SettingsUI.html` - UI не требует изменений
3. ❌ **НЕ удалять** существующие функции в Main.gs
4. ❌ **НЕ менять** сигнатуры функций (параметры, возвращаемые значения)
5. ❌ **НЕ менять** имена ключей кроме лицензионных (LICENSEEMAIL → LICENSE_EMAIL)

### ЧТО ОБЯЗАТЕЛЬНО ДЕЛАТЬ:

1. ✅ **Использовать** существующие функции `addLog()`, `Logger.log()`
2. ✅ **Сохранять** стиль кода (ES6, JSDoc комментарии)
3. ✅ **Обрабатывать** ошибки через try-catch
4. ✅ **Логировать** все критичные операции
5. ✅ **Тестировать** каждое изменение

---

## 🎯 ПРИОРИТЕЗАЦИЯ

### HIGH (Критично):
1. Исправить `saveSettingsData()` - API ключ не должен удаляться
2. Унифицировать имена ключей в `getLicenseEmail/Token()`
3. Добавить функцию `migrateLicenseKeysIfNeeded_()`

### MEDIUM (Важно):
4. Исправить `getSettingsData()`
5. Исправить `hasStoredLicense()`
6. Исправить `seedLicenseCredentialsFromParametersSheet()`

### LOW (Желательно):
7. Добавить дополнительное логирование
8. Улучшить комментарии в коде

---

## 📞 КОНТАКТЫ И ПОДДЕРЖКА

**Репозиторий:** https://github.com/crosspostly/table_ai  
**Ветка для работы:** `fix/license-properties-unification`  
**Pull Request:** #56  
**Документация:** `deploy/LICENSE_FIX_PATCH.md`

**При возникновении вопросов:**
1. Читать комментарии в коде
2. Смотреть логи через Logger.log
3. Проверять существующую логику в server.gs
4. Изучать примеры в LICENSE_FIX_PATCH.md

---

## ⏱️ TIMELINE

**Оценка времени:** 2-3 часа  
**Этапы:**
1. Изучение контекста: 30 мин
2. Реализация изменений: 60 мин
3. Тестирование: 45 мин
4. Документация: 30 мин

---

## 🎓 ЧТО НУЖНО ЗНАТЬ ИСПОЛНИТЕЛЮ

### Необходимые навыки:

1. **JavaScript ES6** (стрелочные функции, const/let, template literals)
2. **Google Apps Script API** (PropertiesService, Logger, SpreadsheetApp)
3. **Асинхронная логика** (понимание того что Properties - синхронное key-value хранилище)
4. **Debugging** (использование Logger.log для отладки)

### Полезные команды:

```javascript
// Просмотр всех Properties
const all = PropertiesService.getScriptProperties().getProperties();
Logger.log(JSON.stringify(all, null, 2));

// Очистка всех ключей (осторожно!)
const props = PropertiesService.getScriptProperties();
props.deleteAllProperties();

// Просмотр логов
// Script Editor → View → Logs (или Ctrl+Enter после выполнения функции)
```

---

## ✨ ФИНАЛЬНАЯ ПРОВЕРКА

Перед отправкой кода убедись что:

- [ ] Все 9 изменений реализованы
- [ ] Все 5 тестов пройдены
- [ ] Logger.log показывает корректные значения
- [ ] Нет синтаксических ошибок
- [ ] Нет предупреждений в Script Editor
- [ ] UI работает без ошибок
- [ ] GM() функция работает корректно
- [ ] Лицензия проверяется сервером успешно

---

**УДАЧИ! 🚀**

Если всё сделано правильно, то после внедрения этих изменений:
- ✅ Лицензия будет работать стабильно
- ✅ API ключ перестанет удаляться
- ✅ UI и CLIENT будут синхронизированы
- ✅ Старые пользователи автоматически мигрируются
- ✅ Никакой регрессии в остальном функционале
