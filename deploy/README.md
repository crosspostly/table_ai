# 🎯 AI Конструктор - CollectConfig v2.1.0

## 📋 ОГЛАВЛЕНИЕ
1. [Что это](#что-это)
2. [Архитектура](#архитектура)
3. [Файлы проекта](#файлы-проекта)
4. [API: Клиент → Сервер](#api-клиент--сервер)
5. [Развертывание](#развертывание)
6. [Как работает](#как-работает)
7. [Тестирование](#тестирование)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 ЧТО ЭТО

**AI Конструктор** — система для сбора данных из Google Sheets и отправки их в Gemini AI.

### Проблема
Google Sheets ограничивает формулы 50,000 символами. Если собираешь данные из сотен ячеек:
```javascript
=GM("Промпт: " & A1 & A2 & ... & A1000)
```
❌ Формула слишком длинная = ОШИБКА!

### Решение
AI Конструктор собирает данные **на сервере** Apps Script:
1. Выбираешь ячейку для результата
2. Настраиваешь источники данных
3. Нажимаешь "Запустить"
4. Результат записывается в ячейку

✅ Нет лимита формулы
✅ Логирование всех шагов
✅ Сохранение конфигураций
✅ Шаблоны для повторного использования

---

## 🏗️ АРХИТЕКТУРА

### Клиент-Сервер модель

```
┌─────────────────────────────────────┐
│  HTML UI (CollectConfigUi_v2.1.html) │
│  - Отображение интерфейса           │
│  - Сбор параметров от пользователя │
│  - Отправка запросов на сервер     │
└──────────┬──────────────────────────┘
           │ google.script.run
           ▼
┌─────────────────────────────────────┐
│  Server (CollectConfig.gs)          │
│  - Чтение данных из листов          │
│  - Вызов GM() для Gemini            │
│  - Сохранение конфигураций          │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Gemini AI (Main.gs → GM())         │
│  - Обработка промпта                │
│  - Возврат результата               │
└─────────────────────────────────────┘
```

### ⚠️ КРИТИЧНО: СИНХРОНИЗАЦИЯ ФУНКЦИЙ

**HTML вызывает функции через `google.script.run`:**
```javascript
google.script.run
  .withSuccessHandler(callback)
  .myServerFunction(param1, param2);
```

**Эта функция ДОЛЖНА существовать в .gs файле:**
```javascript
function myServerFunction(param1, param2) {
  // код на сервере
}
```

❌ **Если функция отсутствует** → ошибка в консоли, UI не работает  
✅ **Все функции синхронизированы** → всё работает

---

## 📦 ФАЙЛЫ ПРОЕКТА

### Основные файлы

| Файл | Строк | Назначение |
|------|-------|-----------|
| `CollectConfig.gs` | 630 | **Главный сервер** - обработка запросов из UI |
| `CollectConfigUi.html` | 983 | **HTML интерфейс** - UI для пользователя |
| `TemplateService.gs` | 432 | **Шаблоны** - сохранение/загрузка конфигураций |
| `Main.gs` | 1219 | **Gemini API** - функция GM() для AI |
| `server.gs` | 293 | **Меню** - добавление в Google Sheets UI |

### Вспомогательные файлы

| Файл | Назначение |
|------|-----------|
| `CollectConfig_OLD_BACKUP.gs` | Бэкап старой версии |
| `logging_system.html` | Система логирования (встроена в UI) |
| `appsscript.json` | Манифест проекта Apps Script |
| `DEPLOYMENT_GUIDE.md` | Детальная инструкция развертывания |

---

## 🔌 API: КЛИЕНТ → СЕРВЕР

### ✅ ВСЕ ФУНКЦИИ, КОТОРЫЕ ВЫЗЫВАЕТ HTML

#### 1. Инициализация UI
```javascript
// HTML вызывает:
google.script.run
  .withSuccessHandler(initialize)
  .getCollectConfigInitData();

// Server отвечает (CollectConfig.gs):
function getCollectConfigInitData() {
  return {
    sheetName: "Лист1",
    cellAddress: "A1",
    sheets: ["Лист1", "Лист2"],
    version: "3.0.0",
    lastUpdate: "2025-10-18 18:20:00",
    logs: [...]
  };
}
```

#### 2. Предпросмотр данных
```javascript
// HTML вызывает:
google.script.run
  .withSuccessHandler(showPreview)
  .getCellPreview("Лист1", "A1:A100");

// Server отвечает:
function getCellPreview(sheetName, cellAddress) {
  return "Первые 100 символов данных...";
}
```

#### 3. Сохранение и выполнение
```javascript
// HTML вызывает:
google.script.run
  .withSuccessHandler(handleResult)
  .saveAndExecuteCollectConfig(sheetName, cellAddress, config);

// Server отвечает:
function saveAndExecuteCollectConfig(sheetName, cellAddress, config) {
  return {
    success: true,
    result: "Ответ от AI",
    logs: [...]
  };
}
```

#### 4. Работа с конфигурациями
```javascript
// Сохранить конфигурацию
saveCollectConfig(sheetName, cellAddress, config) → boolean

// Загрузить конфигурацию
loadCollectConfig(sheetName, cellAddress) → {systemPrompt, userData} | null

// Удалить конфигурацию
deleteCollectConfig(sheetName, cellAddress) → {success, message}
```

#### 5. Работа с шаблонами
```javascript
// Получить все шаблоны
serverGetAllTemplates() → {templateName: config, ...}

// Получить один шаблон
serverGetTemplate(templateName) → config | null

// Сохранить шаблон
serverSaveTemplate(templateName, config) → {success, message}

// Удалить шаблон
serverDeleteTemplate(templateName) → {success, message}

// Статистика
serverGetTemplatesStats() → {count, totalSize, templates: [...]}
```

#### 6. Вспомогательные функции
```javascript
// Список всех листов
getAllSheetNames() → ["Лист1", "Лист2", ...]

// Проверка наличия конфигурации
hasConfigForCurrentCell() → boolean
```

---

## 🚀 РАЗВЕРТЫВАНИЕ

### Шаг 1: Создать проект Apps Script

1. Открой Google Sheets
2. **Extensions → Apps Script**
3. Удали код по умолчанию

### Шаг 2: Добавить файлы

**ПОРЯДОК ВАЖЕН!** Добавляй файлы в таком порядке:

```bash
1. Main.gs           # Сначала GM() функция
2. TemplateService.gs # Функции шаблонов
3. CollectConfig.gs   # Основной сервер
4. server.gs          # Меню
5. CollectConfigUi.html # UI (Files → + → HTML file)
```

⚠️ **КРИТИЧНО:** 
- HTML файл должен называться **`CollectConfigUi`** (без `.html` в названии!)
- В коде: `HtmlService.createHtmlOutputFromFile('CollectConfigUi')`
- Если название не совпадёт → ошибка "Template not found"

### Шаг 3: Сохранить и авторизовать

1. **Нажми 💾 Save**
2. Выбери функцию `onOpen` в выпадающем меню
3. **Нажми ▶️ Run**
4. Разреши доступ (первый раз)

### Шаг 4: Обновить Google Sheets

1. Закрой и открой Google Sheets заново
2. Появится меню **🤖 AI Tools**
3. Выбери **🎯 AI Конструктор → Настроить запрос**

✅ **Готово!**

---

## ⚙️ КАК РАБОТАЕТ

### 1. Открытие UI

```javascript
// Пользователь: Меню → AI Конструктор → Настроить запрос
// ↓
function openCollectConfigUI() {
  const html = HtmlService.createHtmlOutputFromFile('CollectConfigUi')
    .setWidth(700)
    .setTitle('🎯 AI Конструктор v3.0');
  SpreadsheetApp.getUi().showModalDialog(html, 'AI Конструктор');
}
```

### 2. Инициализация

```javascript
// HTML загружается
// ↓
window.onload = function() {
  google.script.run
    .withSuccessHandler(initialize)
    .getCollectConfigInitData();
}
// ↓
function getCollectConfigInitData() {
  // 1. Определяем активную ячейку
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  
  // 2. Создаём базовый шаблон если нужно
  createDefaultTemplate();
  
  // 3. Возвращаем данные для UI
  return {
    sheetName: sheet.getName(),
    cellAddress: range.getA1Notation(),
    sheets: getAllSheetNames(),
    version: "3.0.0",
    logs: getLog()
  };
}
```

### 3. Настройка данных

```javascript
// Пользователь выбирает:
// - System Prompt: Prompt_box!E2
// - User Data: отзывы!B:B
// ↓
// Нажимает "Запустить"
// ↓
google.script.run
  .withSuccessHandler(showResult)
  .saveAndExecuteCollectConfig(sheetName, cellAddress, config);
```

### 4. Выполнение на сервере

```javascript
function saveAndExecuteCollectConfig(sheetName, cellAddress, config) {
  // 1. Очищаем логи
  clearLog();
  addLog('🚀 CollectConfig v3.0.0 (обновлено: 2025-10-18 18:20:00)', 'INFO');
  
  // 2. Сохраняем конфигурацию
  saveCollectConfig(sheetName, cellAddress, config);
  
  // 3. Выполняем
  const result = executeCollectConfig(sheetName, cellAddress);
  
  // 4. Возвращаем результат + логи
  result.logs = getLog();
  return result;
}
```

### 5. Сбор данных

```javascript
function executeCollectConfig(sheetName, cellAddress) {
  // 1. Загружаем конфигурацию
  const config = loadCollectConfig(sheetName, cellAddress);
  
  // 2. Читаем System Prompt
  const systemPrompt = readData(config.systemPrompt.sheet, config.systemPrompt.cell);
  
  // 3. Читаем User Data из всех источников
  const userDataParts = [];
  config.userData.forEach(source => {
    const data = readData(source.sheet, source.cell);
    userDataParts.push(`Источник (${source.sheet}!${source.cell}):\n${data}`);
  });
  
  // 4. Формируем финальный промпт
  const finalPrompt = systemPrompt + '\n\n---\n\n' + 
                     'ДАННЫЕ:\n' + userDataParts.join('\n\n');
  
  // 5. Отправляем в AI
  const aiResult = GM(finalPrompt);
  
  // 6. Записываем результат
  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(sheetName)
    .getRange(cellAddress)
    .setValue(aiResult);
  
  return {success: true, result: aiResult};
}
```

### 6. Чтение данных (ПРОСТЕЙШАЯ версия)

```javascript
function readData(sheetName, cellAddress) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const range = sheet.getRange(cellAddress);
  const values = range.getValues();
  
  // Фильтруем пустые и объединяем
  const result = [];
  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const val = values[r][c];
      if (val !== null && val !== undefined && val.toString().trim() !== '') {
        result.push(val.toString());
      }
    }
  }
  
  return result.join('\n');
}
```

---

## 🧪 ТЕСТИРОВАНИЕ

### Запуск всех тестов

```bash
npm test
```

**Ожидаемый результат:**
```
PASS __tests__/ClientServer.test.js
PASS __tests__/TemplateService.test.js
PASS __tests__/CollectDataFromRange.test.js

Test Suites: 3 passed, 3 total
Tests:       43 passed, 43 total
```

### Юнит-тесты

| Файл | Тесты | Что проверяет |
|------|-------|---------------|
| `ClientServer.test.js` | 10 | Взаимодействие клиент-сервер |
| `TemplateService.test.js` | 18 | Сохранение/загрузка шаблонов |
| `CollectDataFromRange.test.js` | 15 | Чтение данных из диапазонов |

### Ручное тестирование

1. **Открыть UI:**
   - Меню → AI Конструктор → Настроить запрос
   - ✅ UI открывается
   - ✅ Показывает версию: "CollectConfig v3.0.0"

2. **Проверить базовый шаблон:**
   - Dropdown "Шаблоны"
   - ✅ Есть шаблон "По умолчанию"
   - Выбрать его
   - ✅ Поля заполнились:
     - System Prompt: `Prompt_box!E2`
     - User Data: `отзывы!B:B`

3. **Предпросмотр данных:**
   - Ввести лист и ячейку
   - ✅ Показывает первые 100 символов

4. **Запуск:**
   - Нажать "Запустить"
   - ✅ Правая панель показывает логи:
     ```
     🚀 CollectConfig v3.0.0 (обновлено: 2025-10-18 18:20:00)
     📍 Целевая ячейка: Лист1!A1
     📖 Конфигурация загружена
     📍 System Prompt: Prompt_box!E2
     ✅ System Prompt: 250 символов
     📦 User Data: 1 источников
       📍 Источник 1: отзывы!B:B
       ✅ Прочитано: 1500 символов
     📝 Финальный промпт: 1750 символов
     🤖 Отправка запроса в Gemini...
     ✅ Получен ответ от AI: 500 символов
     ✅ Результат записан в Лист1!A1
     ✅ УСПЕХ!
     ```

---

## 🐛 TROUBLESHOOTING

### Проблема 1: "Template not found"

**Ошибка:**
```
Exception: Template 'CollectConfigUi' not found
```

**Причины:**
- ❌ HTML файл называется `CollectConfig.html` вместо `CollectConfigUi`
- ❌ В коде указано неправильное имя

**Решение:**
1. В Apps Script Editor переименуй HTML файл в **`CollectConfigUi`**
2. В `CollectConfig.gs` проверь:
   ```javascript
   HtmlService.createHtmlOutputFromFile('CollectConfigUi')
   ```

---

### Проблема 2: Функция не работает в UI

**Симптомы:**
- Нажимаешь кнопку → ничего не происходит
- В консоли браузера (F12): `myFunction is not defined`

**Причина:**
HTML вызывает функцию, которой нет в .gs файле

**Решение:**

1. **Открой консоль браузера (F12)**
2. **Найди ошибку:**
   ```
   Failed to load: myFunction is not a function
   ```
3. **Найди вызов в HTML:**
   ```javascript
   google.script.run.myFunction(param);
   ```
4. **Добавь функцию в .gs:**
   ```javascript
   function myFunction(param) {
     // код
   }
   ```

---

### Проблема 3: Не показывает версию в логах

**Симптомы:**
- Логи пустые
- Нет строки "CollectConfig v3.0.0"

**Причина:**
Используешь старую версию файла

**Решение:**

1. **Проверь версию в коде:**
   ```javascript
   const COLLECT_CONFIG_VERSION = '3.0.0';
   const COLLECT_CONFIG_LAST_UPDATE = '2025-10-18 18:20:00';
   ```

2. **Проверь что функция вызывает addLog:**
   ```javascript
   function getCollectConfigInitData() {
     clearLog();
     addLog(`🚀 CollectConfig v${COLLECT_CONFIG_VERSION} (обновлено: ${COLLECT_CONFIG_LAST_UPDATE})`, 'INFO');
     // ...
   }
   ```

3. **Убедись что логи возвращаются в UI:**
   ```javascript
   return {
     // ...
     logs: getLog()
   };
   ```

---

### Проблема 4: Нет базового шаблона "По умолчанию"

**Причина:**
Функция `createDefaultTemplate()` не вызывается или падает

**Решение:**

1. **Проверь что вызывается при инициализации:**
   ```javascript
   function getCollectConfigInitData() {
     // ...
     createDefaultTemplate();  // ← должно быть здесь
     // ...
   }
   ```

2. **Проверь что TemplateService.gs подключен:**
   - Должны быть функции: `getAllTemplates()`, `saveTemplate()`

3. **Проверь логи:**
   ```javascript
   addLog('✅ Создан базовый шаблон "По умолчанию"', 'SUCCESS');
   ```

---

### Проблема 5: Ошибка "Диапазон должен содержать как минимум одну строку"

**Причина:**
Пытаешься прочитать пустой диапазон

**Решение:**

Новая версия `readData()` **не должна** выдавать эту ошибку, потому что:
```javascript
function readData(sheetName, cellAddress) {
  const range = sheet.getRange(cellAddress);
  const values = range.getValues();
  
  // Фильтруем пустые
  const result = [];
  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const val = values[r][c];
      if (val !== null && val !== undefined && val.toString().trim() !== '') {
        result.push(val.toString());
      }
    }
  }
  
  return result.join('\n'); // Вернёт '' если нет данных
}
```

Если всё равно ошибка → проверь что используешь **новую версию v3.0.0**!

---

### Проблема 6: GM() is not defined

**Ошибка:**
```
ReferenceError: GM is not defined
```

**Причина:**
Файл `Main.gs` не подключен или функция GM() отсутствует

**Решение:**

1. **Добавь Main.gs в проект**
2. **Проверь что функция GM() есть:**
   ```javascript
   function GM(prompt, maxTokens = 25000, temperature = 0.7) {
     // вызов Gemini API
   }
   ```

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ

### Структура хранения

**ConfigData (скрытый лист):**
| Sheet | Cell | SystemPromptSheet | SystemPromptCell | UserDataJSON | CreatedAt | LastRun |
|-------|------|-------------------|------------------|--------------|-----------|---------|
| Лист1 | A1   | Prompt_box        | E2               | [{"sheet":"отзывы","cell":"B:B"}] | 2025-10-18T15:30:00 | 2025-10-18T16:00:00 |

**TemplatesData (PropertiesService):**
```javascript
{
  "user@example.com": {
    "По умолчанию": {
      config: {
        systemPrompt: {sheet: "Prompt_box", cell: "E2"},
        userData: [{sheet: "отзывы", cell: "B:B"}]
      },
      created: "2025-10-18T15:00:00",
      updated: "2025-10-18T15:00:00"
    }
  }
}
```

---

## 🎓 BEST PRACTICES

### 1. Всегда синхронизируй HTML и GS

**Перед добавлением вызова в HTML:**
```javascript
// 1. Сначала создай функцию в .gs
function myNewServerFunction(param) {
  return "result";
}

// 2. Потом вызывай в HTML
google.script.run
  .withSuccessHandler(callback)
  .myNewServerFunction(param);
```

### 2. Используй логирование

```javascript
function myFunction() {
  addLog('🔍 Начало работы myFunction', 'INFO');
  try {
    // код
    addLog('✅ myFunction успешно', 'SUCCESS');
  } catch (e) {
    addLog(`❌ Ошибка: ${e.message}`, 'ERROR');
    throw e;
  }
}
```

### 3. Проверяй входные параметры

```javascript
function myFunction(param) {
  if (!param) {
    throw new Error('Параметр не может быть пустым!');
  }
  // код
}
```

### 4. Возвращай структурированные ответы

```javascript
// ❌ Плохо
function myFunction() {
  return "OK";
}

// ✅ Хорошо
function myFunction() {
  return {
    success: true,
    message: "Операция выполнена",
    data: {...}
  };
}
```

---

## 📞 ПОДДЕРЖКА

**Проблемы?** Проверь:
1. ✅ Все файлы добавлены
2. ✅ HTML называется `CollectConfigUi`
3. ✅ Функции в .gs совпадают с вызовами в HTML
4. ✅ Main.gs содержит функцию GM()
5. ✅ TemplateService.gs подключен

**Всё ещё не работает?**
- Открой консоль браузера (F12)
- Скопируй ошибку
- Проверь что используешь версию 3.0.0

---

## 📝 CHANGELOG

### v3.0.0 (2025-10-18)
- ✅ Полностью переписана функция `readData()` - максимальная простота
- ✅ Добавлена глобальная система логирования (`GLOBAL_LOG`)
- ✅ Версия отображается в логах: "CollectConfig v3.0.0"
- ✅ Автоматическое создание базового шаблона "По умолчанию"
- ✅ Добавлены недостающие функции: `serverGetTemplate()`, `deleteCollectConfig()`
- ✅ Синхронизированы все вызовы HTML ↔ GS
- ✅ 43/43 тестов проходят

### v2.1.0 (2025-01-18)
- Детальное логирование
- Версия в метаданных
- Попытка автокоррекции диапазонов (откачена)

### v2.0.0
- Первая рабочая версия
- Базовая функция collectDataFromRange

---

**🚀 Готово к работе!**
