# Table AI - Детальный план рефакторинга

## 🎯 Цель рефакторинга

### Проблемы текущего кода:
- 🚫 Все функции в одном файле main.gs (~1500+ строк)
- 🚫 DEV и продакшн код перемешаны
- 🚫 Сложно поддерживать и отлаживать
- 🚫 В продакшн попадают тестовые функции
- 🚫 Нет четкого разделения ответственности

### Решение:
- ✅ Разделить код на 3 логических модуля
- ✅ Изолировать DEV-код в отдельный файл
- ✅ Чистый продакшн без отладочных функций
- ✅ Легкая поддержка и расширение

---

## 📁 Новая структура файлов

### 1️⃣ main.gs - Основная бизнес-логика (ПРОДАКШН)
**Назначение:** Ключевые пользовательские функции
**Размер:** ~800-1000 строк
**Удаляемость:** ❌ Никогда (критичный файл)

### 2️⃣ utils.gs - Утилиты и сервисы (ПРОДАКШН)
**Назначение:** Вспомогательные функции, логирование
**Размер:** ~300-500 строк
**Удаляемость:** ❌ Никогда (нужен в продакшн)

### 3️⃣ dev_mode.gs - Отладка и тестирование (РАЗРАБОТКА)
**Назначение:** Тесты, отладка, DEV-инструменты
**Размер:** ~200-400 строк
**Удаляемость:** ✅ В продакшн удаляется полностью

---

## 🔧 Подробный план миграции

### ШАГ 1: Создание новых файлов

1. **Откройте Apps Script проект**
2. **Создайте новый файл:** `utils.gs`
   - Нажмите `+` → `Script file`
   - Назовите `utils`
3. **Создайте новый файл:** `dev_mode.gs`
   - Нажмите `+` → `Script file`
   - Назовите `dev_mode`

### ШАГ 2: Миграция функций

#### 2.1. Перенос в utils.gs

**ИЗ main.gs ВЫРЕЗАТЬ И ВСТАВИТЬ В utils.gs:**

```javascript
// ===== ЛОГИРОВАНИЕ =====
function addLog(message, level) {
  // Весь код функции как есть
}

function getLogs(limit) {
  // Весь код функции как есть
}

function showLogsDialog() {
  try {
    SpreadsheetApp.getUi().alert(getLogs(100).join('\n'));
  } catch (e) {
    addLog('showLogsDialog in non-UI context: ' + e.message, 'WARN');
  }
}

function exportLogsToSheet() {
  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName('Логи') || ss.insertSheet('Логи');
    var cache = CacheService.getScriptCache();
    var logsStr = cache.get('SYSTEM_LOGS');
    if (!logsStr) {
      addLog('Нет логов для экспорта', 'WARN');
      return 'Нет логов для экспорта';
    }
    var list = JSON.parse(logsStr);
    var data = [['timestamp','level','message']];
    list.forEach(function(e){ data.push([e.timestamp, e.level, e.message]); });
    sheet.clear();
    sheet.getRange(1,1,data.length,3).setValues(data);
    sheet.getRange(1,1,1,3).setFontWeight('bold').setBackground('#E8F0FE');
    sheet.autoResizeColumns(1,3);
    addLog('Логи экспортированы', 'INFO');
    return 'Логи экспортированы в лист "Логи"';
  } catch (e) {
    addLog('exportLogsToSheet error: ' + e.message, 'ERROR');
    // НЕ ИСПОЛЬЗУЕМ SpreadsheetApp.getUi().alert() здесь!
    return 'ERROR: ' + e.message;
  }
}

function clearLogs() {
  // Весь код как есть
}
```

#### 2.2. Перенос в dev_mode.gs

**ИЗ main.gs ВЫРЕЗАТЬ И ВСТАВИТЬ В dev_mode.gs:**

```javascript
// ===== DEV КОНСТАНТЫ =====
const DEV_MODE = true;

// ===== DEV ФУНКЦИИ =====
function testServerConnection() {
  // Весь код функции как есть
}

function runDevSelfTest() {
  // Весь код функции как есть
}

function quickTest() {
  // Весь код функции как есть  
}

function initGeminiKey() {
  // Весь код функции как есть
}

function showGeminiKeyHelp() {
  // Весь код функции как есть
}

function setCorrectLicense() {
  // Если есть - тоже сюда
}

// Любые другие тестовые функции
```

#### 2.3. Изменения в main.gs

**ЗАМЕНИТЬ все проверки DEV_MODE:**

**БЫЛО:**
```javascript
if (DEV_MODE) {
  addLog('DEBUG: что-то', 'DEBUG');
}
```

**СТАЛО:**
```javascript
if (typeof DEV_MODE !== 'undefined' && DEV_MODE) {
  addLog('DEBUG: что-то', 'DEBUG');
}
```

**УДАЛИТЬ из main.gs:**
```javascript
// Удалить эту строку:
const DEV_MODE = true;

// Удалить все тестовые функции (они уже в dev_mode.gs)
```

---

## 📋 Детальный список функций по файлам

### main.gs (ОСТАЮТСЯ - НЕ ТРОГАТЬ)

#### Основные функции:
```javascript
GM(prompt, maxTokens, temperature)
GMIF(condition, prompt, ...)
onOpen()
onEdit()
refreshCurrentGMCell()
```

#### Цепочки и обработка:
```javascript
prepareChainSmart()
prepareChainFromPromptBox()  
prepareChainForA3()
clearChainForA3()
```

#### VK и дополнительные:
```javascript
importVkPosts()
createStopWordsFormulas()
refreshSelectedGMTriggers()
applyUniformFormatting()
```

#### Сетевые клиенты:
```javascript
serverStatus()
serverGM()
serverGMImage()  // Если есть
```

#### UI и настройки:
```javascript
checkLicenseStatusUI()
setLicenseCredentialsUI()
getLicenseEmail()
getLicenseToken()
openSettingsUI()
getSettingsData()
saveSettingsData()
```

#### Утилиты обработки:
```javascript
getGeminiApiKey()
gmCacheKey()
gmCacheGet() 
gmCachePut()
columnToLetter()
letterToColumn()
parseTargetA1()
processGeminiResponse()
convertMarkdownToReadableText()
isMarkdownText()
getCompletionPhrase()
isCompletionReady()
cleanupOldTriggers()
showActiveTriggersDialog()
```

### utils.gs (ПЕРЕНОСИМ)

```javascript
addLog(message, level)
getLogs(limit)
showLogsDialog()
exportLogsToSheet()  // С исправлением UI
clearLogs()
```

### dev_mode.gs (ПЕРЕНОСИМ + УДАЛЯЕМ В ПРОДАКШН)

```javascript
// Константа
const DEV_MODE = true;

// Функции
testServerConnection()
runDevSelfTest()
quickTest()
initGeminiKey()
showGeminiKeyHelp()
setCorrectLicense()  // Если есть
```

---

## 🧪 Тестирование после миграции

### 1. Проверка основного функционала:
```javascript
// В Apps Script запустите:
GM("тестовый промпт", 1000, 0.7)
```

### 2. Проверка логирования:
```javascript
// В Apps Script запустите:
addLog("тест", "INFO")
showLogsDialog()
```

### 3. Проверка DEV режима:
```javascript
// В Apps Script запустите:
quickTest()  // Должно работать
```

### 4. Тест продакшн режима:
1. **Удалите dev_mode.gs**
2. **Запустите:** `GM("тест", 1000, 0.7)`
3. **Проверьте:** Никаких DEV логов не должно быть

---

## 🚀 Развертывание в продакшн

### Для продакшн развертывания:

1. **Скопируйте проект** (сделайте бекап)
2. **Удалите файл dev_mode.gs**
   - Щелкните правой кнопкой → Delete
3. **Все проверки `DEV_MODE` станут `false`**
4. **Никакого отладочного кода не выполнится**
5. **Чистая, оптимизированная версия**

### Для разработки:
1. **Оставьте dev_mode.gs**
2. **Все DEV функции работают**
3. **Полная отладочная информация**

---

## 🎯 Преимущества новой структуры

### ✅ Для разработки:
- Все тесты в одном месте (dev_mode.gs)
- Легко добавлять новые DEV функции
- Четкое разделение DEV и продакшн кода
- Удобная отладка

### ✅ Для продакшн:
- Чистый код без тестов
- Меньший размер проекта  
- Лучшая производительность
- Профессиональный вид

### ✅ Для поддержки:
- Логическое разделение функций
- Легко найти нужную функцию
- Проще добавлять новые возможности
- Модульная архитектура

---

## ⚠️ Важные моменты

### НЕ ТРОГАТЬ в main.gs:
- Основные пользовательские функции
- Константы (кроме DEV_MODE)
- UI функции
- Бизнес-логику

### ОБЯЗАТЕЛЬНО ИЗМЕНИТЬ:
- Все `if (DEV_MODE)` на `if (typeof DEV_MODE !== 'undefined' && DEV_MODE)`
- Убрать вызовы `SpreadsheetApp.getUi()` из не-UI контекстов

### ТЕСТИРОВАТЬ:
- После каждого переноса функций
- Основной функционал GM()
- Логирование
- DEV функции

---

## 📞 Поддержка

Если что-то пошло не так:
1. **Восстановите из бекапа**
2. **Проверьте список функций выше**
3. **Убедитесь что не удалили важные функции**
4. **Проверьте синтаксис в каждом файле**

**Главное правило:** Переносите по одной функции и сразу тестируйте!
