# Система логирования Table AI

## Обзор

Система логирования в проекте Table AI построена на централизованном подходе с использованием CacheService для хранения логов и поддерживает несколько уровней логирования.

## Глобальное логирование (Main.gs)

Основная система логирования реализована в файле `Main.gs`:

```javascript
const LOGS_CACHE_KEY = 'SYSTEM_LOGS';
const MAX_LOGS = 300;
const LOGS_TTL = 86400; // 24ч

function addLog(msg, level = 'INFO') {
  try {
    const cache = CacheService.getScriptCache();
    let logs = cache.get(LOGS_CACHE_KEY);
    logs = logs ? JSON.parse(logs) : [];
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    logs.push({timestamp: ts, level: level, message: msg});
    if (logs.length > MAX_LOGS) logs.shift();
    cache.put(LOGS_CACHE_KEY, JSON.stringify(logs), LOGS_TTL);
    console.log(`[${ts}] ${level}: ${msg}`);
  } catch (e) {
    console.error('Ошибка записи лога:', e.message);
  }
}
```

**Особенности:**
- Хранение в CacheService (300 последних записей)
- Просмотр через DEV меню → "📝 Показать логи"
- Экспорт в лист через DEV меню → "⬇️ Экспорт логов"
- Единый формат: `{timestamp, level, message}`

## Локальное логирование UI (CollectConfig)

Модуль CollectConfig использует отдельный лог для UI:

```javascript
var COLLECT_CONFIG_UI_LOG = [];

function addCollectLog(message, level) {
  level = level || 'INFO';
  const timestamp = new Date().toLocaleTimeString('ru-RU');
  
  // Добавляем в локальный UI-лог
  const logEntry = {
    timestamp: timestamp,
    message: message,
    level: level.toUpperCase(),
  };
  COLLECT_CONFIG_UI_LOG.push(logEntry);
  
  // ВАЖНО: Добавляем также в глобальную систему логирования
  try {
    if (typeof addLog === 'function') {
      addLog(`[CollectConfig] ${message}`, level);
    } else {
      Logger.log(`[${level}] ${message}`);
    }
  } catch (e) {
    Logger.log(`[${level}] ${message}`);
  }
}

function clearCollectLog() {
  COLLECT_CONFIG_UI_LOG = [];
}

function getCollectLog() {
  return COLLECT_CONFIG_UI_LOG;
}
```

**Функции:**
- `addCollectLog()` - добавляет в UI-лог И в глобальный лог
- `getCollectLog()` - возвращает логи для отображения в интерфейсе
- `clearCollectLog()` - очищает UI-лог (не влияет на глобальный)

## Безопасное логирование (UnpackingViewer)

Модуль UnpackingViewer использует обёртку с fallback:

```javascript
function logUnpacking(message, level) {
  const logLevel = level || 'INFO';
  
  try {
    // Проверяем наличие глобальной функции addLog
    if (typeof addLog === 'function') {
      addLog(`[UnpackingViewer] ${message}`, logLevel);
    } else {
      // Fallback: используем встроенный Logger
      const timestamp = Utilities.formatDate(
        new Date(), 
        Session.getScriptTimeZone(), 
        'yyyy-MM-dd HH:mm:ss'
      );
      Logger.log(`[${timestamp}] ${logLevel}: ${message}`);
    }
  } catch (error) {
    // Критический fallback
    console.log(`[${logLevel}] ${message}`);
    console.error('Logging error:', error.message);
  }
}
```

**Преимущества:**
- Никогда не ломает выполнение при отсутствии логгера
- Использует глобальную систему, если доступна
- Fallback на Logger.log() при необходимости
- Префикс `[UnpackingViewer]` для фильтрации

## Уровни логирования

- **INFO** - Информационные сообщения
- **DEBUG** - Отладочная информация
- **WARN** - Предупреждения
- **ERROR** - Ошибки
- **SUCCESS** - Успешные операции

## Префиксы для удобства

- `[CollectConfig]` - логи из CollectConfig.gs
- `[UnpackingViewer]` - логи из UnpackingViewer.gs
- Без префикса - логи из Main.gs и других модулей

## Правила использования

### ✅ Правильно:

```javascript
// CollectConfig.gs
addCollectLog('🚀 Операция выполнена', 'SUCCESS');
const logs = getCollectLog();

// UnpackingViewer.gs
logUnpacking('📦 Данные обработаны', 'INFO');

// Main.gs и другие модули
addLog('✅ Готово', 'INFO');
```

### ❌ Неправильно:

```javascript
// НЕ ИСПОЛЬЗОВАТЬ прямые вызовы в CollectConfig.gs
addLog('Сообщение', 'INFO');  // ❌ Конфликт!

// НЕ ИСПОЛЬЗОВАТЬ без проверки в других модулях
addLog('Сообщение', 'INFO');  // ❌ Может быть undefined
```

## Просмотр логов

1. **В интерфейсе Apps Script:**
   - Меню → 🧰 DEV → 📝 Показать логи

2. **В Google Sheets:**
   - Меню → 🧰 DEV → ⬇️ Экспорт логов

3. **В консоли:**
   - Логи автоматически выводятся в console.log()

## Архитектура

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CollectConfig │    │ UnpackingViewer │    │     Main.gs     │
│                 │    │                 │    │                 │
│ addCollectLog() │    │ logUnpacking()  │    │    addLog()     │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          │                      │                       │
          └──────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │    CacheService Store    │
                    │   (SYSTEM_LOGS cache)    │
                    └───────────────────────────┘
```

## Тестирование

### Тест глобального логирования:
```javascript
function testGlobalLogging() {
  addLog('🧪 Test message from Main.gs', 'INFO');
  addLog('⚠️ Test warning', 'WARN');
  addLog('❌ Test error', 'ERROR');
}
```

### Тест CollectConfig логирования:
```javascript
function testCollectConfigLogging() {
  clearCollectLog();
  addCollectLog('🧪 Test CollectConfig message', 'INFO');
  const logs = getCollectLog();
  Logger.log('UI Logs: ' + JSON.stringify(logs));
}
```

### Тест UnpackingViewer логирования:
```javascript
// Открыть модальное окно: 📦 Просмотр Распаковки
// Проверить логи через: 🧰 DEV → 📝 Показать логи
```

## Важные замечания

1. **CollectConfig.gs больше не переопределяет** глобальную функцию `addLog()`
2. **UnpackingViewer.gs безопасно работает** с/без `addLog()`
3. **Все логи теперь централизованы** и доступны через DEV меню
4. **Функции обновления** (`updateReflectionConfigs()`, `updateUnpackingConfigs()`) логируют свои действия
5. **Префиксы модулей** помогают фильтровать логи при отладке

## История изменений

- **v2.0.0** - Создана централизованная система логирования
- **v2.0.1** - Исправлены конфликты между модулями
- **v2.0.2** - Добавлены безопасные обёртки и префиксы