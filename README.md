# Table AI - Google Sheets AI Automation

[![Version](https://img.shields.io/badge/version-3.0.1-blue.svg)](https://github.com/crosspostly/table_ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **⚠️ КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ ДЛЯ РАЗРАБОТЧИКОВ:**
> 
> При добавлении новых функций обновления (типа `updateXXXConfigs()`):
> 
> 1. 🚫 **НЕ ИСПОЛЬЗУЙТЕ систему CollectConfig (ConfigData)** если ваш модуль не связан с AI Constructor
> 2. 🚫 **НЕ ПЕРЕОПРЕДЕЛЯЙТЕ функцию `addLog()`** - используйте обёртки (`logXXX()`)
> 3. ✅ **Создавайте независимые функции** в файле вашего модуля
> 4. ✅ **Документируйте зависимости** явно в комментариях
> 
> **Пример правильной реализации:** см. `UnpackingViewer.gs` → `updateUnpackingConfigs()`
> 
> **Нарушение этих правил ЛОМАЕТ весь AI Constructor!**

## О проекте

Table AI - система автоматизации работы с AI в Google Sheets через Gemini API.

### Основные модули

- **Main.gs** - Центральная система управления, меню, логирование
- **CollectConfig.gs** - AI Constructor (сбор данных из разных источников)
- **UnpackingViewer.gs** - Просмотр и экспорт данных распаковки
- **OCR Module** - Распознавание текста с изображений
- **VK Parser** - Импорт постов из ВКонтакте

### Архитектура логирования

```
Main.gs (глобальное логирование)
↓
addLog() - централизованная функция
↓
├── CollectConfig.gs → addCollectLog() - обёртка для UI
├── UnpackingViewer.gs → logUnpacking() - безопасная обёртка
└── Другие модули → используют addLog() напрямую
```

**⚠️ ВАЖНО:** Каждый модуль должен использовать СВОЮ обёртку, не переопределять `addLog()`!

---

## 🚨 Критические правила разработки

### 1. Система логирования

#### ✅ ПРАВИЛЬНО:

```javascript
// В вашем модуле создайте обёртку:
function logYourModule(message, level) {
  try {
    if (typeof addLog === 'function') {
      addLog(`[YourModule] ${message}`, level || 'INFO');
    } else {
      Logger.log(`[${level || 'INFO'}] ${message}`);
    }
  } catch (e) {
    Logger.log(`[${level || 'INFO'}] ${message}`);
  }
}

// Используйте только свою обёртку:
logYourModule('✅ Модуль запущен', 'INFO');
```

#### ❌ НЕПРАВИЛЬНО:

```javascript
// НЕ переопределяйте addLog()!
function addLog(message, level) { // ← ЭТО ЛОМАЕТ ВСЁ!
  // ваш код
}

// НЕ используйте напрямую без проверки:
addLog('Сообщение'); // ← может упасть с ReferenceError
```

---

### 2. Функции обновления конфигураций

#### ✅ ПРАВИЛЬНО - Независимая функция:

```javascript
// deploy/YourModule.gs
/**
 * Обновляет ваш модуль
 * ВАЖНО: НЕ использует CollectConfig (ConfigData)!
 */
function updateYourModuleConfigs() {
  logYourModule('🔄 Обновление модуля', 'INFO');
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('YourSheet');
  
  if (!sheet) {
    logYourModule('❌ Лист не найден', 'ERROR');
    return;
  }
  
  // Ваша логика обновления
  // Работает ТОЛЬКО с данными вашего модуля
  
  logYourModule('✅ Обновление завершено', 'SUCCESS');
}
```

#### ❌ НЕПРАВИЛЬНО - Использование чужой системы:

```javascript
// НЕ ДЕЛАЙТЕ ТАК!
function updateYourModuleConfigs() {
  // ❌ Пытается использовать ConfigData из CollectConfig
  const configSheet = ss.getSheetByName('ConfigData');
  const configs = /* читаем конфигурации */;
  
  // ❌ Вызывает executeCollectConfig() - это для AI Constructor!
  const result = executeCollectConfig(sheetName, cellAddress);
  
  // ЭТО ЛОМАЕТ AI CONSTRUCTOR!
}
```

---

### 3. Независимость модулей

**Каждый модуль должен быть самодостаточным:**

| Модуль | Ответственность | Система хранения | Функции обновления |
|--------|-----------------|------------------|--------------------|
| **CollectConfig** | AI Constructor | `ConfigData` (лист) | `updateReflectionConfigs()` |
| **UnpackingViewer** | Просмотр распаковки | Напрямую `Распаковка!B3:G3` | `updateUnpackingConfigs()` |
| **OCR Module** | Распознавание | `отзывы` (лист) | Собственные функции |
| **VK Parser** | Импорт постов | `посты` (лист) | Собственные функции |

**Правило:** Если ваш модуль НЕ про AI Constructor → НЕ используйте ConfigData!

---

## 📚 Структура проекта

```
table_ai/
├── deploy/
│   ├── Main.gs                 # Центральная система (меню, логи, GM)
│   ├── CollectConfig.gs        # AI Constructor (ConfigData)
│   ├── UnpackingViewer.gs      # Просмотр распаковки (независимый)
│   ├── UnpackingViewerUI.html  # UI для UnpackingViewer
│   ├── SettingsUI.html         # Настройки
│   └── ...
├── docs/
│   ├── CollectConfig.md        # Документация AI Constructor
│   ├── UnpackingViewer.md      # Документация просмотра распаковки
│   ├── LOGGING.md              # ⚠️ НОВЫЙ ФАЙЛ - правила логирования
│   └── MODULE_INDEPENDENCE.md  # ⚠️ НОВЫЙ ФАЙЛ - независимость модулей
├── tests/
│   └── ...
└── README.md                   # Этот файл
```

---

## 🔧 Разработка

### Добавление нового модуля

**1. Создайте файл модуля:**

```javascript
// deploy/YourModule.gs
/**
 * YOUR MODULE - Module Description
 * v1.0.0
 * 
 * ВАЖНО: Независимый модуль, НЕ использует CollectConfig!
 */

/**
 * Безопасное логирование для вашего модуля
 */
function logYourModule(message, level) {
  const logLevel = level || 'INFO';
  try {
    if (typeof addLog === 'function') {
      addLog(`[YourModule] ${message}`, logLevel);
    } else {
      const timestamp = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd HH:mm:ss'
      );
      Logger.log(`[${timestamp}] ${logLevel}: ${message}`);
    }
  } catch (error) {
    console.log(`[${logLevel}] ${message}`);
  }
}

/**
 * Ваши функции модуля
 */
function yourModuleFunction() {
  logYourModule('🚀 Запуск функции', 'INFO');
  // ваш код
}
```

**2. Добавьте в меню (Main.gs):**

```javascript
// В функции onOpen()
  .addSeparator()
  .addItem('🔥 Ваша функция', 'yourModuleFunction') // → YourModule.gs
```

**3. Создайте документацию:**

```markdown
# docs/YourModule.md

## Обзор
Описание вашего модуля

## Независимость
- ✅ НЕ использует ConfigData
- ✅ НЕ использует CollectConfig систему
- ✅ Работает с собственными листами/данными
- ✅ Использует logYourModule() для логирования

## Функции
...
```

---

## 🧪 Тестирование

### Перед коммитом проверьте:

- [ ] **Логирование работает** - логи появляются в DEV меню
- [ ] **AI Constructor НЕ сломан** - можно открыть и использовать
- [ ] **Ваш модуль работает независимо**
- [ ] **Нет конфликтов имён функций**
- [ ] **Документация обновлена**

### Команды для проверки:

```bash
# Проверка конфликтов функций
grep -n "function addLog" deploy/*.gs
# Должна быть ТОЛЬКО ОДНА функция в Main.gs!

# Проверка использования ConfigData
grep -n "ConfigData" deploy/YourModule.gs
# НЕ должно быть, если модуль НЕ про AI Constructor!

# Проверка логирования
grep -n "addLog(" deploy/YourModule.gs
# Должно быть 0 прямых вызовов, только через обёртку!
```

---

## 📖 Дополнительная документация

- [docs/LOGGING.md](docs/LOGGING.md) - Детальное руководство по логированию
- [docs/MODULE_INDEPENDENCE.md](docs/MODULE_INDEPENDENCE.md) - Правила независимости модулей
- [docs/CollectConfig.md](docs/CollectConfig.md) - AI Constructor документация
- [docs/UnpackingViewer.md](docs/UnpackingViewer.md) - Пример независимого модуля

---

## 🐛 Известные проблемы и решения

### Проблема: "Конфигурация не найдена"

**Причина:** Функция `updateXXXConfigs()` пытается использовать ConfigData, но она для AI Constructor!

**Решение:** Создайте независимую функцию в файле вашего модуля, см. `UnpackingViewer.gs`

### Проблема: "ReferenceError: addLog is not defined"

**Причина:** Прямой вызов `addLog()` без проверки наличия

**Решение:** Используйте безопасную обёртку `logYourModule()`

### Проблема: Логи не появляются в DEV меню

**Причина:** Переопределена функция `addLog()` в другом модуле

**Решение:** Удалите переопределение, используйте обёртку

---

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: **🧰 DEV → 📝 Показать логи**
2. Экспортируйте логи: **🧰 DEV → ⬇️ Экспорт логов**
3. Создайте Issue с логами и описанием проблемы

---

## 🏆 Best Practices

### ✅ DO:
- Создавайте обёртки для логирования (`logYourModule()`)
- Делайте модули независимыми
- Документируйте зависимости
- Тестируйте перед коммитом
- Используйте префиксы в логах `[ModuleName]`

### ❌ DON'T:
- Не переопределяйте `addLog()`
- Не используйте ConfigData вне AI Constructor
- Не вызывайте `executeCollectConfig()` из других модулей
- Не забывайте обновлять документацию
- Не коммитьте без тестирования AI Constructor

---

## 📜 Лицензия

MIT License - see [LICENSE](LICENSE) for details

---

**⚠️ ПОМНИТЕ: Каждый сломанный AI Constructor - это потерянное время команды!**

**Следуйте правилам, читайте документацию, тестируйте изменения!**
