# 🚀 Template System v2.0 - Инструкция по интеграции

> **Быстрая интеграция нового функционала шаблонов в существующий проект**

---

## 📦 Что добавлено?

### Новые файлы:

1. **`TemplateService.gs`** - Сервис управления шаблонами (400+ строк)
2. **`CollectConfigUI_v2.html`** - Обновлённый UI с поддержкой шаблонов
3. **`MIGRATION.gs`** - Скрипт миграции данных
4. **`TEMPLATES_GUIDE.md`** - Руководство пользователя

### Обновлённые файлы:

1. **`CollectConfigUI.gs`** - добавлено 7 новых endpoints (+ 225 строк)

---

## ⚡ Быстрая интеграция (15 минут)

### Шаг 1: Скопировать новые файлы

```bash
# В вашем Google Apps Script проекте создайте:

1. TemplateService.gs     ← Скопируйте содержимое
2. MIGRATION.gs           ← Скопируйте содержимое  
3. CollectConfigUI_v2     ← Переименуйте HTML файл (без .html!)
```

**ВАЖНО:** Apps Script требует имя файла БЕЗ расширения!

---

### Шаг 2: Обновить CollectConfigUI.gs

Добавьте в **конец** файла `CollectConfigUI.gs`:

```javascript
// ============================================================================
// НОВЫЕ ФУНКЦИИ ДЛЯ TEMPLATE SYSTEM v2.0
// ============================================================================

function getActiveCellContext() {
  // ... код из обновлённого файла
}

function serverGetAllTemplates() {
  // ... код из обновлённого файла
}

// ... и остальные 5 функций
```

Или замените весь файл на обновлённую версию.

---

### Шаг 3: Обновить меню (опционально)

Если хотите добавить пункт миграции в меню:

```javascript
// В вашем onOpen() функции:
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🎯 AI Конструктор')
    .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
    .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
    .addSeparator()
    .addItem('📦 Миграция данных', 'showMigrationPreview')
    .addItem('💾 Экспорт шаблонов', 'exportTemplatesToSheet')
    .addToUi();
}
```

---

### Шаг 4: Изменить UI загрузку

Замените `CollectConfigUI` на `CollectConfigUI_v2` в функции:

```javascript
function openCollectConfigUI() {
  try {
    // СТАРО:
    // var html = HtmlService.createHtmlOutputFromFile('CollectConfigUI')
    
    // НОВО:
    var html = HtmlService.createHtmlOutputFromFile('CollectConfigUI_v2')
      .setWidth(650)
      .setHeight(650)  // Увеличили высоту для шаблонов
      .setTitle('🎯 AI Конструктор v2.0');
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Настройка запроса');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}
```

---

### Шаг 5: Тестирование

1. **Сохраните** все изменения в редакторе скриптов
2. **Перезагрузите** таблицу Google Sheets
3. **Откройте** меню → 🎯 AI Конструктор → 🎯 Настроить запрос
4. **Проверьте** наличие секции "📋 Шаблоны конфигураций"

---

## 🔄 Миграция существующих данных

Если у вас есть данные в листе `ConfigData`:

```javascript
// 1. Откройте редактор скриптов
// 2. Выполните функцию:
showMigrationPreview();

// 3. Если всё ОК, выполните:
interactiveMigration();
```

Или через UI:
```
Меню → 📦 Миграция данных
```

---

## ✅ Проверка работоспособности

### Тест 1: Создание шаблона

```
1. Откройте AI Конструктор
2. Заполните System Prompt и User Data
3. Введите имя: "Test Template"
4. Нажмите 💾 Сохранить
5. Проверьте: шаблон появился в списке
```

### Тест 2: Загрузка шаблона

```
1. Выберите "Test Template" из списка
2. Нажмите 📂 Загрузить
3. Проверьте: поля заполнились
```

### Тест 3: Удаление шаблона

```
1. Выберите "Test Template"
2. Нажмите ❌
3. Подтвердите удаление
4. Проверьте: шаблон исчез из списка
```

### Тест 4: Выполнение с шаблоном

```
1. Создайте простой шаблон
2. Загрузите его
3. Нажмите 🚀 Запустить
4. Проверьте: результат в ячейке
```

---

## 🐛 Troubleshooting

### Проблема: "getAllTemplates is not defined"

**Причина:** Не скопирован `TemplateService.gs`

**Решение:**
```
1. Создайте файл TemplateService.gs
2. Скопируйте весь код
3. Сохраните
4. Перезагрузите таблицу
```

---

### Проблема: "CollectConfigUI_v2 not found"

**Причина:** Неправильное имя HTML файла

**Решение:**
```
1. В редакторе скриптов: File → New → HTML file
2. Назовите ТОЧНО: CollectConfigUI_v2 (БЕЗ .html)
3. Вставьте код
4. Сохраните
```

---

### Проблема: UI не обновился

**Причина:** Кэш браузера

**Решение:**
```
1. Ctrl+F5 (жёсткая перезагрузка)
2. Или: Очистите кэш браузера
3. Закройте и откройте таблицу снова
```

---

### Проблема: "Cannot read property 'config' of null"

**Причина:** Несовместимость версий данных

**Решение:**
```
1. Откройте редактор скриптов
2. Выполните:
   PropertiesService.getScriptProperties().deleteProperty('COLLECT_CONFIG_TEMPLATES')
3. Создайте шаблоны заново
```

---

## 📋 Чеклист интеграции

Используйте этот чек-лист:

- [ ] 1. Создан файл `TemplateService.gs`
- [ ] 2. Создан файл `MIGRATION.gs`
- [ ] 3. Создан HTML `CollectConfigUI_v2`
- [ ] 4. Обновлён `CollectConfigUI.gs` (добавлены endpoints)
- [ ] 5. Изменена функция `openCollectConfigUI()`
- [ ] 6. Сохранены все файлы
- [ ] 7. Перезагружена таблица
- [ ] 8. Протестировано создание шаблона
- [ ] 9. Протестирована загрузка шаблона
- [ ] 10. Протестировано удаление шаблона
- [ ] 11. Выполнена миграция (если нужно)
- [ ] 12. Обновлена документация пользователя

---

## 🔧 Кастомизация

### Изменить лимиты:

В `TemplateService.gs`:

```javascript
const MAX_TEMPLATE_SIZE = 8000;        // Размер шаблона в байтах
const MAX_TEMPLATES_PER_USER = 100;    // Количество шаблонов
const TEMPLATES_LOCK_TIMEOUT = 30000;  // Таймаут блокировки (мс)
```

### Изменить UI:

В `CollectConfigUI_v2.html` секция `<style>`:

```css
.templates-section {
  background: #f1f3f4;  /* Цвет фона секции шаблонов */
  padding: 16px;
  border-radius: 8px;
}

.btn-primary {
  background: #1a73e8;  /* Цвет кнопки "Запустить" */
}
```

### Добавить валидацию:

В `TemplateService.gs` → `_validateTemplateConfig()`:

```javascript
// Добавьте свою валидацию:
if (config.userData.length > 50) {
  return { 
    valid: false, 
    error: 'Слишком много источников данных (max 50)' 
  };
}
```

---

## 📊 Мониторинг и логи

### Проверить storage:

```javascript
// В редакторе скриптов выполните:
var props = PropertiesService.getScriptProperties();
var data = props.getProperty('COLLECT_CONFIG_TEMPLATES');
Logger.log('Storage size: ' + (data ? data.length : 0) + ' bytes');
Logger.log(JSON.stringify(JSON.parse(data), null, 2));
```

### Получить статистику:

```javascript
var stats = getTemplatesStats('your@email.com');
Logger.log(JSON.stringify(stats, null, 2));

// Вывод:
// {
//   "count": 5,
//   "maxCount": 100,
//   "totalSize": 2450,
//   "maxSize": 800000,
//   "oldestTemplate": "2025-10-18T10:00:00.000Z",
//   "newestTemplate": "2025-10-18T14:30:00.000Z",
//   "templates": ["Template 1", "Template 2", ...]
// }
```

---

## 🔐 Безопасность

### Multi-user:

✅ Каждый пользователь видит только свои шаблоны  
✅ Идентификация по email через `Session.getActiveUser()`  
✅ Нет доступа к чужим данным

### Защита данных:

✅ LockService предотвращает race conditions  
✅ Валидация входных данных  
✅ Ограничение размера данных  
✅ Обработка ошибок парсинга JSON

---

## 🎉 Готово!

После интеграции у вас будет:

- ✅ Полнофункциональная система шаблонов
- ✅ Современный UI
- ✅ Миграция старых данных
- ✅ Экспорт/импорт
- ✅ Multi-user поддержка

**Время интеграции:** 15-30 минут  
**Сложность:** Низкая  
**Совместимость:** 100% с существующим кодом

---

## 📞 Поддержка

**Документация:**
- `TEMPLATES_GUIDE.md` — Руководство пользователя
- `COLLECT_CONFIG_FLOW.md` — Архитектура системы

**Код:**
- `TemplateService.gs` — API шаблонов
- `MIGRATION.gs` — Утилиты миграции

**Вопросы?** Проверьте логи:
```
Просмотр → Журнал выполнения (Execution log)
```

---

**Happy coding!** 🚀
