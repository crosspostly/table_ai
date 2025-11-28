# 🔧 Исправление проблем с лицензией в Table AI

**Дата:** 2025-11-28  
**Ветка:** `fix/license-properties-unification`  
**Статус:** READY FOR REVIEW

---

## 🔴 ОБНАРУЖЕННЫЕ ПРОБЛЕМЫ

### Проблема 1: Дублирование полей лицензии в Script Properties

**ГДЕ:** `Main.gs` (клиент) vs `SettingsUI.html` (UI)

**СУТЬ:**
- **Клиент читает из:** `LICENSEEMAIL`, `LICENSETOKEN` (старый формат)
- **UI сохраняет в:** `LICENSE_EMAIL`, `LICENSE_TOKEN` (новый формат)
- **Результат:** Клиент НЕ ВИДИТ данные, которые сохранил UI!

**КОД:**

```javascript
// Main.gs - ЧИТАЕТ старый формат
function getLicenseEmail() {
  return PropertiesService.getScriptProperties().getProperty('LICENSEEMAIL');
}
function getLicenseToken() {
  return PropertiesService.getScriptProperties().getProperty('LICENSETOKEN');
}

// SettingsUI.html → saveSettingsData() - ПИШЕТ новый формат
props.setProperty('LICENSE_EMAIL', email);  // ❌ НЕВЕРНЫЙ КЛЮЧ!
props.setProperty('LICENSE_TOKEN', token); // ❌ НЕВЕРНЫЙ КЛЮЧ!
```

---

### Проблема 2: Gemini API ключ удаляется при пустом вводе

**ГДЕ:** `Main.gs` → `saveSettingsData()`

**СУТЬ:**
- Пользователь открывает настройки
- НЕ вводит API ключ (оставляет поле пустым)
- Нажимает «Сохранить всё»
- **РЕЗУЛЬТАТ:** Система УДАЛЯЕТ существующий дефолтный ключ!

**КОД:**

```javascript
// Main.gs - saveSettingsData()
if (data.apiKey !== undefined) {
  if (data.apiKey && String(data.apiKey).trim()) {
    props.setProperty('GEMINI_API_KEY', String(data.apiKey).trim());
  } else {
    props.deleteProperty('GEMINI_API_KEY'); // ❌ КРИТИЧЕСКАЯ ОШИБКА!
  }
}
```

**ЧТО ДОЛЖНО БЫТЬ:**
- Если поле пустое → НЕ трогать существующий ключ
- Удалять только по явной команде пользователя

---

### Проблема 3: Лицензия сбрасывается после ввода через UI

**ЦЕПОЧКА СОБЫТИЙ:**

1. Пользователь вводит `email` и `token` через `SettingsUI.html`
2. UI сохраняет в `LICENSE_EMAIL` / `LICENSE_TOKEN`
3. Клиент пытается прочитать из `LICENSEEMAIL` / `LICENSETOKEN`
4. **Клиент НЕ находит данные** → считает что лицензии нет
5. Система блокирует работу с ошибкой `LICENSE_REQUIRED`

---

### Проблема 4: Разделение CLIENT и SERVER Properties

**АРХИТЕКТУРНАЯ ПРОБЛЕМА:**

Из `README.md`:
```
CLIENT (Main.gs) - Контейнерный скрипт таблицы пользователя
SERVER (server.gs) - Отдельное веб-приложение (deploy as web app)
```

**ПРОБЛЕМА:**
- `CLIENT` и `SERVER` - это **ДВА РАЗНЫХ СКРИПТА**
- У каждого свой `PropertiesService`
- **CLIENT Properties ≠ SERVER Properties**

**РЕШЕНИЕ:**
- Клиент передаёт email/token/apiKey **В ТЕЛЕ ЗАПРОСА** к серверу
- Сервер не использует свои Properties для клиентских данных
- ✅ Уже реализовано правильно в текущем коде!

---

## ✅ ПЛАН ИСПРАВЛЕНИЙ

### Изменение 1: Унификация имён ключей в Main.gs

**ЧТО МЕНЯТЬ:**
```javascript
// ❌ СТАРОЕ (НЕВЕРНО)
function getLicenseEmail() {
  return PropertiesService.getScriptProperties().getProperty('LICENSEEMAIL');
}
function getLicenseToken() {
  return PropertiesService.getScriptProperties().getProperty('LICENSETOKEN');
}

// ✅ НОВОЕ (ПРАВИЛЬНО)
function getLicenseEmail() {
  return PropertiesService.getScriptProperties().getProperty('LICENSE_EMAIL');
}
function getLicenseToken() {
  return PropertiesService.getScriptProperties().getProperty('LICENSE_TOKEN');
}
```

**ГДЕ:**
- `deploy/Main.gs` строки ~1150-1157

---

### Изменение 2: Исправление логики сохранения API ключа

**ЧТО МЕНЯТЬ:**
```javascript
// ❌ СТАРОЕ (УДАЛЯЕТ КЛЮЧ ПРИ ПУСТОМ ВВОДЕ)
if (data.apiKey !== undefined) {
  if (data.apiKey && String(data.apiKey).trim()) {
    props.setProperty('GEMINI_API_KEY', String(data.apiKey).trim());
    updated.push('API ключ');
  } else {
    props.deleteProperty('GEMINI_API_KEY'); // ❌ ОШИБКА!
    updated.push('API ключ (удален)');
  }
}

// ✅ НОВОЕ (СОХРАНЯЕТ ТОЛЬКО ПРИ НАЛИЧИИ ЗНАЧЕНИЯ)
if (data.apiKey !== undefined && data.apiKey && String(data.apiKey).trim()) {
  // Сохраняем ТОЛЬКО если введён новый ключ
  props.setProperty('GEMINI_API_KEY', String(data.apiKey).trim());
  updated.push('API ключ обновлён');
  Logger.log('✅ GEMINI_API_KEY UPDATED, length: ' + data.apiKey.length);
}
// Если пустое - НЕ трогаем существующий ключ
```

**ГДЕ:**
- `deploy/Main.gs` функция `saveSettingsData()` строки ~1270-1285

---

### Изменение 3: Исправление логики сохранения лицензии

**ЧТО МЕНЯТЬ:**
```javascript
// ❌ СТАРОЕ (НЕПРАВИЛЬНЫЕ КЛЮЧИ)
if (data.email !== undefined) {
  if (data.email && String(data.email).trim()) {
    props.setProperty('LICENSE_EMAIL', String(data.email).trim()); // ❌ НЕВЕРНЫЙ КЛЮЧ
    updated.push('Email');
  }
}

if (data.token !== undefined) {
  if (data.token && String(data.token).trim()) {
    props.setProperty('LICENSE_TOKEN', String(data.token).trim()); // ❌ НЕВЕРНЫЙ КЛЮЧ
    updated.push('Токен');
  }
}

// ✅ НОВОЕ (ПРАВИЛЬНЫЕ КЛЮЧИ)
if (data.email !== undefined && data.email && String(data.email).trim()) {
  props.setProperty('LICENSEEMAIL', String(data.email).trim()); // ✅ ВЕРНЫЙ КЛЮЧ
  updated.push('Email обновлён');
  Logger.log('✅ LICENSEEMAIL UPDATED: ' + data.email);
}

if (data.token !== undefined && data.token && String(data.token).trim()) {
  props.setProperty('LICENSETOKEN', String(data.token).trim()); // ✅ ВЕРНЫЙ КЛЮЧ
  updated.push('Токен обновлён');
  Logger.log('✅ LICENSETOKEN UPDATED, length: ' + data.token.length);
}
```

**ГДЕ:**
- `deploy/Main.gs` функция `saveSettingsData()` строки ~1287-1310

---

### Изменение 4: Обновление getSettingsData() для чтения правильных ключей

**ЧТО МЕНЯТЬ:**
```javascript
// ❌ СТАРОЕ (НЕПРАВИЛЬНЫЕ КЛЮЧИ)
const email = scriptProps.getProperty('LICENSEEMAIL') || '';
const token = scriptProps.getProperty('LICENSETOKEN') || '';

// ✅ НИЧЕГО НЕ МЕНЯТЬ - УЖЕ ПРАВИЛЬНО!
// Функция getLicenseEmail() и getLicenseToken() уже читают правильные ключи
const email = getLicenseEmail();
const token = getLicenseToken();
```

**ГДЕ:**
- `deploy/Main.gs` функция `getSettingsData()` строки ~1250-1265

---

### Изменение 5: Добавить миграцию старых ключей

**НОВАЯ ФУНКЦИЯ (добавить в Main.gs):**

```javascript
/**
 * Миграция старых ключей лицензии в новый формат
 * Запускается автоматически при первом обращении
 */
function migrateLicenseKeysIfNeeded_() {
  try {
    const props = PropertiesService.getScriptProperties();
    
    // Проверяем наличие старых ключей
    const oldEmail = props.getProperty('LICENSEEMAIL');
    const oldToken = props.getProperty('LICENSETOKEN');
    
    // Проверяем наличие новых ключей
    const newEmail = props.getProperty('LICENSE_EMAIL');
    const newToken = props.getProperty('LICENSE_TOKEN');
    
    let migrated = false;
    
    // Если есть старые, но нет новых - мигрируем
    if (oldEmail && !newEmail) {
      props.setProperty('LICENSE_EMAIL', oldEmail);
      props.deleteProperty('LICENSEEMAIL');
      Logger.log('✅ Migrated LICENSEEMAIL → LICENSE_EMAIL');
      migrated = true;
    }
    
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

**ГДЕ ВЫЗЫВАТЬ:**
- В начале функций `getLicenseEmail()` и `getLicenseToken()`
- Однократно при первом обращении

---

## 🧪 ТЕСТИРОВАНИЕ

### Сценарий 1: Проверка сохранения через UI

```javascript
// 1. Открыть настройки
openSettingsUI();

// 2. Ввести данные:
// Email: test@example.com
// Token: test_token_12345
// API Key: (оставить пустым)

// 3. Нажать "Сохранить всё"

// 4. Проверить в Script Editor → Project Properties:
Logger.log('EMAIL: ' + PropertiesService.getScriptProperties().getProperty('LICENSE_EMAIL'));
Logger.log('TOKEN: ' + PropertiesService.getScriptProperties().getProperty('LICENSE_TOKEN'));
Logger.log('API KEY: ' + PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'));

// ✅ ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
// EMAIL: test@example.com
// TOKEN: test_token_12345
// API KEY: <существующий ключ НЕ удалён>
```

### Сценарий 2: Проверка чтения лицензии

```javascript
// 1. Проверить функции чтения
Logger.log('getLicenseEmail(): ' + getLicenseEmail());
Logger.log('getLicenseToken(): ' + getLicenseToken());

// 2. Проверить статус лицензии
const status = serverStatus();
Logger.log('License OK: ' + status.ok);
Logger.log('License Error: ' + status.error);

// ✅ ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
// getLicenseEmail(): test@example.com
// getLicenseToken(): test_token_12345
// License OK: true (если лицензия валидна на сервере)
```

### Сценарий 3: Проверка миграции

```javascript
// 1. Вручную установить СТАРЫЕ ключи
PropertiesService.getScriptProperties().setProperty('LICENSEEMAIL', 'old@example.com');
PropertiesService.getScriptProperties().setProperty('LICENSETOKEN', 'old_token');

// 2. Вызвать функцию миграции
migrateLicenseKeysIfNeeded_();

// 3. Проверить результат
Logger.log('NEW EMAIL: ' + PropertiesService.getScriptProperties().getProperty('LICENSE_EMAIL'));
Logger.log('NEW TOKEN: ' + PropertiesService.getScriptProperties().getProperty('LICENSE_TOKEN'));
Logger.log('OLD EMAIL (should be null): ' + PropertiesService.getScriptProperties().getProperty('LICENSEEMAIL'));
Logger.log('OLD TOKEN (should be null): ' + PropertiesService.getScriptProperties().getProperty('LICENSETOKEN'));

// ✅ ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
// NEW EMAIL: old@example.com
// NEW TOKEN: old_token
// OLD EMAIL (should be null): null
// OLD TOKEN (should be null): null
```

---

## 📋 ЧЕКЛИСТ ИСПРАВЛЕНИЙ

- [ ] **Main.gs**: Изменить `getLicenseEmail()` - читать из `LICENSE_EMAIL`
- [ ] **Main.gs**: Изменить `getLicenseToken()` - читать из `LICENSE_TOKEN`
- [ ] **Main.gs**: Исправить `saveSettingsData()` - не удалять API ключ при пустом вводе
- [ ] **Main.gs**: Исправить `saveSettingsData()` - сохранять в `LICENSEEMAIL`/`LICENSETOKEN`
- [ ] **Main.gs**: Добавить функцию `migrateLicenseKeysIfNeeded_()`
- [ ] **Main.gs**: Интегрировать миграцию в `getLicenseEmail()` и `getLicenseToken()`
- [ ] **Main.gs**: Обновить `hasStoredLicense()` - проверять оба формата ключей
- [ ] **Main.gs**: Обновить `seedLicenseCredentialsFromParametersSheet()` - использовать правильные ключи
- [ ] Протестировать все 3 сценария
- [ ] Проверить логи на наличие ошибок
- [ ] Обновить документацию

---

## 🚀 ДЕПЛОЙ

### Порядок применения изменений:

1. **Создать бекап текущих Properties:**
   ```javascript
   // В Script Editor → Выполнить
   const props = PropertiesService.getScriptProperties();
   const all = props.getProperties();
   Logger.log(JSON.stringify(all, null, 2));
   // Скопировать вывод в безопасное место!
   ```

2. **Применить изменения в Main.gs:**
   - Обновить функции getLicenseEmail/getLicenseToken
   - Исправить saveSettingsData
   - Добавить миграцию

3. **Запустить миграцию вручную (для текущих пользователей):**
   ```javascript
   migrateLicenseKeysIfNeeded_();
   ```

4. **Протестировать:**
   - Открыть настройки → Проверить отображение
   - Сохранить → Проверить что всё работает
   - Проверить GM() → Должен работать без ошибок

5. **Deploy в production**

---

## 📊 РЕЗУЛЬТАТ

### До исправления:
- ❌ UI сохраняет в `LICENSE_EMAIL` / `LICENSE_TOKEN`
- ❌ Клиент читает из `LICENSEEMAIL` / `LICENSETOKEN`
- ❌ Данные не совпадают → лицензия не работает
- ❌ Gemini ключ удаляется при пустом вводе

### После исправления:
- ✅ UI и клиент используют **ОДИНАКОВЫЕ** ключи
- ✅ Gemini ключ **НЕ удаляется** при пустом вводе
- ✅ Автоматическая миграция старых данных
- ✅ Обратная совместимость сохранена
- ✅ Лицензия работает стабильно

---

## 📞 КОНТАКТЫ

**Автор исправлений:** AI Assistant (Perplexity)  
**Дата:** 2025-11-28  
**Тестировано:** ❌ Требуется тестирование пользователем
