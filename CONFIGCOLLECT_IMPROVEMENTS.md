# CollectConfig Improvements: Default Prompt Table & Enhanced Logging

## Обзор изменений

Добавлена поддержка кодового слова `"prompt_table"` для использования централизованной таблицы с промптами по умолчанию, а также существенно расширено логирование для отладки CollectConfig.

## Новые возможности

### 1. Кодовое слово "prompt_table"

**Проблема**: Раньше для использования таблицы с промптами нужно было указывать полный ID таблицы (44 символа).

**Решение**: Теперь можно использовать кодовое слово `"prompt_table"` (или `"promt_table"` для обратной совместимости).

**Пример использования в ConfigData**:
```
Sheet       | Cell | SystemPromptSheet | SystemPromptCell | UserDataJSON
---------------------------------------------------------------------------
Промты      | D1   | prompt_table      | A1               | [{"cell":"B1:B","sheet":"Отзывы"}]
```

**Логика работы** (в `serverGetSystemPrompt_()`, server.gs:859+):

1. **"prompt_table"** или **"promt_table"** (case-insensitive)
   → Использует `LICENSE_SHEET_ID` константу + лист "Промты"
   
2. **44-символьный ID таблицы** (проверка через `isTableId()`)
   → Использует указанный ID + лист "Промты"
   
3. **Любая другая строка**
   → Использует как имя листа в текущей таблице клиента

**Константа в server.gs**:
```javascript
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s'; // строка 6
```

## 2. Расширенное логирование

### Клиентская сторона (CollectConfig.gs)

**Добавлено в `callCollectConfigServer_()` (строка 572-575)**:
```javascript
addCollectLog(`📤 Отправка запроса на сервер: ${serverUrl}`, 'INFO');
addCollectLog(`📋 Payload config.systemPrompt: ${JSON.stringify(config.systemPrompt)}`, 'DEBUG');
addCollectLog(`📋 Payload config.userData: ${config.userData ? config.userData.length + ' источников' : 'нет'}`, 'DEBUG');
addCollectLog(`📋 SpreadsheetId: ${spreadsheetId}`, 'DEBUG');
```

**Что видно в логах**:
- Полная структура systemPrompt (sheet + cell)
- Количество источников userData
- ID таблицы клиента

### Серверная сторона (server.gs)

#### 1. Логи в обработчике `collect_config_execute` (строка 282-288)
```javascript
Logger.log('config.systemPrompt: ' + JSON.stringify(config.systemPrompt || null));
Logger.log('config.userData: ' + (config.userData ? config.userData.length + ' sources' : 'NONE'));
```

#### 2. Логи в `serverCollectConfigExecute_()` (строка 767-771)
```javascript
logs.push({timestamp: new Date().toISOString(), level: 'DEBUG', message: '🔧 Config: ' + JSON.stringify({
  systemPrompt: config.systemPrompt,
  userDataCount: config.userData ? config.userData.length : 0,
  spreadsheetId: spreadsheetId
})});
```

#### 3. Логи источников данных (строка 792)
```javascript
logs.push({timestamp: new Date().toISOString(), level: 'DEBUG', message: `  🔍 Источник ${index + 1} полный: ${JSON.stringify(source)}`});
```

#### 4. Логи определения таблицы промптов (строка 869-891)
```javascript
logs.push({timestamp: new Date().toISOString(), level: 'DEBUG', message: '🔍 SystemPrompt source: ' + promptSource});

// ... проверка на prompt_table ...

if (promptSourceLower === 'prompt_table' || promptSourceLower === 'promt_table') {
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📂 Использование DEFAULT таблицы с промптами: ' + LICENSE_SHEET_ID});
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📄 Лист: Промты'});
} else if (isTableId(promptSource)) {
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📂 Защищённая таблица (ID): ' + spreadsheetId});
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📄 Лист: Промты'});
} else {
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📂 Таблица клиента: ' + spreadsheetId});
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📄 Лист клиента: ' + sheetName});
}
```

#### 5. Логи чтения данных (строка 916-952)
```javascript
logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `  → Чтение ${sheetName}!${cellAddress} из ${spreadsheetId}`});
logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `  → Прочитано: ${values.length} строк × ${values[0] ? values[0].length : 0} столбцов`});
logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `  → После фильтрации: ${result.length} значений`});

// Превью данных (первые 100 символов)
logs.push({timestamp: new Date().toISOString(), level: 'DEBUG', message: `  → Превью данных (${previewLength} символов): ${dataPreview.substring(0, previewLength)}...`});
```

## Примеры логов

### Успешное выполнение с "prompt_table"

```
[INFO] 📤 Отправка запроса на сервер: https://script.google.com/macros/s/.../exec
[DEBUG] 📋 Payload config.systemPrompt: {"sheet":"prompt_table","cell":"A1"}
[DEBUG] 📋 Payload config.userData: 1 источников
[DEBUG] 📋 SpreadsheetId: 1abc...xyz
[INFO] 🚀 Начало выполнения CollectConfig на сервере
[DEBUG] 🔧 Config: {"systemPrompt":{"sheet":"prompt_table","cell":"A1"},"userDataCount":1,"spreadsheetId":"1abc...xyz"}
[INFO] 📖 Загрузка System Prompt...
[DEBUG] 🔍 SystemPrompt source: prompt_table
[INFO] 📂 Использование DEFAULT таблицы с промптами: 1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s
[INFO] 📄 Лист: Промты
[INFO] 📍 Ячейка: A1
[INFO]   → Чтение Промты!A1 из 1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s
[INFO]   → Прочитано: 5 строк × 1 столбцов
[INFO]   → После фильтрации: 5 значений
[DEBUG]   → Превью данных (100 символов): Проанализируйте отзыв и верните структурированный JSON...
[SUCCESS] ✅ Промпт прочитан, 450 символов
[INFO] 📦 Загрузка User Data...
[INFO] 📦 User Data: 1 источников
[INFO]   📍 Источник 1: Отзывы!B1:B
[DEBUG]   🔍 Источник 1 полный: {"sheet":"Отзывы","cell":"B1:B"}
[INFO]   → Чтение Отзывы!B1:B из 1abc...xyz
[INFO]   → Прочитано: 10 строк × 1 столбцов
[INFO]   → После фильтрации: 10 значений
[DEBUG]   → Превью данных (100 символов): Отличный продукт!\nХорошее качество\n...
[SUCCESS]   ✅ Прочитано: 250 символов
```

## Отладка

Если что-то не работает, проверьте логи по следующим уровням:

1. **[DEBUG] config.systemPrompt** - что отправлено с клиента
2. **[DEBUG] SystemPrompt source** - что получено на сервере
3. **[INFO] 📂 Использование...** - какая таблица выбрана
4. **[INFO] 📄 Лист** - какой лист используется
5. **[INFO] → Чтение...** - что читается (полный путь)
6. **[DEBUG] → Превью данных** - что прочитано (первые 100 символов)

## Файлы изменены

- `deploy/CollectConfig.gs` (строки 572-575) - логирование payload
- `deploy/server.gs` (строки 282-288, 767-771, 792, 869-891, 916-952) - логирование + логика prompt_table

## Обратная совместимость

✅ Все существующие конфигурации продолжат работать:
- Конфигурации с полным ID таблицы
- Конфигурации с именем листа в таблице клиента
- Новая возможность: конфигурации с "prompt_table"

## Рекомендации

1. **Используйте "prompt_table"** для централизованного управления промптами
2. **Проверяйте DEBUG логи** при возникновении проблем
3. **Убедитесь**, что лист "Промты" существует в LICENSE_SHEET_ID таблице
4. **Права доступа**: скрипт должен иметь доступ к LICENSE_SHEET_ID таблице
