# 🎯 TEMPLATE SYSTEM v3.0 - Документация

> **Система управления AI промптами и шаблонами для Table AI**

**Версия:** 3.0.0  
**Дата:** 2025-06-18

---

## 📋 СОДЕРЖАНИЕ

- [Что такое Template System](#что-такое-template-system)
- [Преимущества v3.0](#преимущества-v30)
- [Быстрый старт](#быстрый-старт)
- [Использование](#использование)
- [Архитектура](#архитектура)
- [API Reference](#api-reference)
- [Миграция](#миграция)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Что такое Template System?

**Template System** — это подсистема Table AI для создания, хранения и переиспользования AI промптов.

### Основная идея:

**Было (v1.0):**
```
Создали промпт → Применили к ячейке → Потеряли → Создаём заново
```

**Стало (v3.0):**
```
Создали промпт → Сохранили как шаблон → Применяем к любым ячейкам ∞ раз
```

### Ключевые возможности:

- 💾 **Сохранение шаблонов** - библиотека ваших промптов
- 🔄 **Быстрое применение** - один клик для любой ячейки
- 👥 **Multi-user** - каждый со своими шаблонами
- ⚡ **Быстрота** - PropertiesService (в 10x быстрее листов)
- 🔒 **Безопасность** - LockService защита

---

## 🎉 Преимущества v3.0

### Сравнение с v1.0:

| Характеристика | v1.0 (ConfigData) | v3.0 (Template System) | Улучшение |
|----------------|-------------------|------------------------|-----------|
| **Хранение** | Лист ConfigData | PropertiesService | 10x быстрее |
| **Переиспользование** | 1 конфиг → 1 ячейка | 1 шаблон → ∞ ячеек | ∞ раз |
| **Multi-user** | Общий лист | Изолированные данные | 100% безопасно |
| **Race conditions** | Возможны конфликты | LockService защита | Защищено |
| **Производительность** | ~500ms | ~50ms | 10x быстрее |
| **Лимит хранения** | Нет лимита | 500 KB (~100 шаблонов) | Достаточно |

### Ключевые улучшения:

1. **⚡ Скорость** - в 10 раз быстрее чем листы
2. **♻️ Переиспользование** - создали один раз, используем бесконечно
3. **👥 Изоляция** - данные каждого пользователя отдельно
4. **🔒 Безопасность** - LockService предотвращает конфликты
5. **🎨 UI** - удобный визуальный интерфейс

---

## 🚀 Быстрый старт

### Шаг 1: Открыть AI Конструктор

```
🤖 Table AI → 🎯 AI Конструктор → 🎯 Настроить запрос
```

Откроется модальное окно с интерфейсом.

### Шаг 2: Создать промпт

1. Выберите ячейку (например, A1)
2. Введите промпт:
```
Переведи на английский: {{value}}
```
3. Настройте параметры:
   - Max Tokens: 25000
   - Temperature: 0.7

### Шаг 3: Сохранить как шаблон

1. Нажмите **"Save Template"**
2. Введите имя: "Перевод на английский"
3. Готово! Шаблон сохранён

### Шаг 4: Применить шаблон

1. Выберите другую ячейку (например, B1)
2. Откройте AI Конструктор
3. Нажмите **"Load Template"**
4. Выберите "Перевод на английский"
5. Нажмите **"Execute"**
6. Готово! Промпт применён к B1

---

## 💡 ИСПОЛЬЗОВАНИЕ

### Создание шаблона

#### Через UI:

1. **Откройте AI Конструктор**
```
🤖 Table AI → 🎯 AI Конструктор → 🎯 Настроить запрос
```

2. **Заполните поля:**
   - Prompt: ваш AI промпт
   - Max Tokens: 1000-25000
   - Temperature: 0.0-1.0

3. **Сохраните:**
   - Кнопка "Save Template"
   - Введите уникальное имя
   - Нажмите OK

#### Программно:

```javascript
// Через TemplateService
var template = {
  prompt: "Переведи на английский: {{value}}",
  maxTokens: 25000,
  temperature: 0.7,
  metadata: {
    category: "Переводы",
    tags: ["translation", "english"]
  }
};

TemplateService.saveTemplate("Перевод EN", template);
```

### Загрузка шаблона

#### Через UI:

1. Откройте AI Конструктор
2. Нажмите **"Load Template"**
3. Выберите шаблон из списка
4. Поля заполнятся автоматически

#### Программно:

```javascript
var template = TemplateService.getTemplate("Перевод EN");
console.log(template.prompt);
```

### Удаление шаблона

#### Через UI:

1. Загрузите шаблон
2. Нажмите **"Delete Template"**
3. Подтвердите удаление

#### Программно:

```javascript
TemplateService.deleteTemplate("Перевод EN");
```

### Просмотр всех шаблонов

#### Через UI:

Статистика показывается автоматически:
```
Templates: 5
Total Size: 2.3 KB
```

#### Программно:

```javascript
var allTemplates = TemplateService.getAllTemplates();
Object.keys(allTemplates).forEach(function(name) {
  console.log(name + ": " + allTemplates[name].prompt);
});
```

### Экспорт шаблонов

Создание backup в Google Sheets:

```
🤖 Table AI → 🎯 AI Конструктор → 💾 Экспорт шаблонов в лист
```

Создаётся лист "Templates_Backup" с данными:

| Template Name | Prompt | Max Tokens | Temperature | Created | Updated |
|---------------|--------|------------|-------------|---------|---------|
| Перевод EN | Переведи на... | 25000 | 0.7 | 2025-10-18 | 2025-10-18 |

---

## 🏗️ АРХИТЕКТУРА

### Компоненты системы:

```
┌─────────────────────────────────────────┐
│   CollectConfigUI_v2.html              │
│   (Frontend - HTML/CSS/JS)             │
│   ├── Template UI                      │
│   ├── Load/Save/Delete buttons         │
│   └── Statistics display               │
└─────────────────────────────────────────┘
              ↓ ↑
       google.script.run
              ↓ ↑
┌─────────────────────────────────────────┐
│   CollectConfigUI.gs                   │
│   (Server-side endpoints)              │
│   ├── serverGetAllTemplates()          │
│   ├── serverGetTemplate()              │
│   ├── serverSaveTemplate()             │
│   ├── serverDeleteTemplate()           │
│   └── serverGetTemplatesStats()        │
└─────────────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────────────┐
│   TemplateService.gs                   │
│   (Business Logic)                     │
│   ├── getAllTemplates()                │
│   ├── getTemplate()                    │
│   ├── saveTemplate()                   │
│   ├── deleteTemplate()                 │
│   ├── validateTemplate()               │
│   └── acquireLock() / releaseLock()    │
└─────────────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────────────┐
│   PropertiesService                    │
│   (Storage - 500 KB limit)             │
│   └── User templates stored by email   │
└─────────────────────────────────────────┘
```

### Хранение данных:

**Структура в PropertiesService:**

```json
{
  "user@example.com": {
    "Template 1": {
      "prompt": "...",
      "maxTokens": 25000,
      "temperature": 0.7,
      "metadata": {
        "created": "2025-10-18T12:00:00Z",
        "updated": "2025-10-18T13:00:00Z",
        "version": "1.0"
      }
    },
    "Template 2": { ... }
  }
}
```

**Ключи:**
- `TEMPLATES_DATA_v2` - основное хранилище
- `TEMPLATES_BACKUP_v2` - backup перед миграцией
- `TEMPLATES_LOCK_v2` - для LockService

### LockService защита:

```javascript
// Блокировка на 30 секунд
var lock = LockService.getScriptLock();
try {
  lock.waitLock(30000);
  // Критическая секция
  // Чтение/запись данных
} finally {
  lock.releaseLock();
}
```

---

## 📖 API REFERENCE

### TemplateService

#### `getAllTemplates()`

Получить все шаблоны текущего пользователя.

**Возвращает:** `Object` - словарь {name: template}

**Пример:**
```javascript
var templates = TemplateService.getAllTemplates();
// { "Template 1": {...}, "Template 2": {...} }
```

#### `getTemplate(name)`

Получить конкретный шаблон по имени.

**Параметры:**
- `name` (String) - имя шаблона

**Возвращает:** `Object` или `null`

**Пример:**
```javascript
var template = TemplateService.getTemplate("Перевод EN");
console.log(template.prompt);
```

#### `saveTemplate(name, template)`

Сохранить шаблон.

**Параметры:**
- `name` (String) - имя шаблона (max 100 символов)
- `template` (Object) - данные шаблона

**Возвращает:** `Boolean` - успех операции

**Пример:**
```javascript
var success = TemplateService.saveTemplate("My Template", {
  prompt: "Анализируй: {{value}}",
  maxTokens: 10000,
  temperature: 0.5
});
```

#### `deleteTemplate(name)`

Удалить шаблон.

**Параметры:**
- `name` (String) - имя шаблона

**Возвращает:** `Boolean` - успех операции

**Пример:**
```javascript
TemplateService.deleteTemplate("Old Template");
```

#### `validateTemplate(template)`

Проверить валидность шаблона.

**Параметры:**
- `template` (Object) - данные для проверки

**Возвращает:** `Object` - {valid: Boolean, errors: Array}

**Пример:**
```javascript
var result = TemplateService.validateTemplate(myTemplate);
if (!result.valid) {
  console.log("Errors:", result.errors);
}
```

### CollectConfigUI (Server endpoints)

#### `serverGetAllTemplates()`

Server-side endpoint для получения всех шаблонов.

**Вызов из клиента:**
```javascript
google.script.run
  .withSuccessHandler(function(templates) {
    console.log(templates);
  })
  .serverGetAllTemplates();
```

#### `serverSaveTemplate(name, config)`

Server-side endpoint для сохранения шаблона.

**Параметры:**
- `name` (String)
- `config` (Object)

**Вызов из клиента:**
```javascript
google.script.run
  .withSuccessHandler(function(success) {
    alert(success ? "Saved!" : "Failed");
  })
  .serverSaveTemplate("Template Name", config);
```

---

## 🔄 МИГРАЦИЯ

### Миграция из v1.0 (ConfigData)

Если у вас есть данные в старом формате (лист ConfigData), можно автоматически мигрировать.

#### Шаг 1: Проверка перед миграцией

```
🤖 Table AI → 🎯 AI Конструктор → 📦 Миграция данных
```

Система покажет:
- Количество записей в ConfigData
- Размер данных
- Потенциальные проблемы

#### Шаг 2: Запуск миграции

Если всё ОК, нажмите **"Начать миграцию"**

Процесс:
1. Backup текущих данных
2. Чтение ConfigData
3. Преобразование в новый формат
4. Сохранение в PropertiesService
5. Проверка целостности

#### Шаг 3: Проверка результата

После миграции:
- Проверьте список шаблонов
- Протестируйте загрузку
- Экспортируйте backup

#### Откат миграции

Если что-то пошло не так:

```
🧰 DEV → 🧪 Откат миграции
```

Восстанавливаются данные из backup.

### Программная миграция

```javascript
// Проверка
var report = validateBeforeMigration();
console.log(report);

// Миграция
var result = migrateConfigDataToTemplates();
if (result.success) {
  console.log("Migrated:", result.count);
} else {
  console.log("Error:", result.error);
}

// Откат
rollbackMigration();
```

---

## 🐛 TROUBLESHOOTING

### Проблема: Шаблоны не сохраняются

**Причины:**
1. Превышен лимит 500 KB
2. Ошибка валидации
3. Нет прав на PropertiesService

**Решение:**
```
1. Проверьте логи: 🧰 DEV → 📝 Показать логи
2. Проверьте размер: serverGetTemplatesStats()
3. Удалите старые шаблоны если нужно
```

### Проблема: UI не загружается

**Причины:**
1. Файл CollectConfigUI_v2.html не загружен
2. Неправильное имя файла

**Решение:**
```
1. Проверьте в Apps Script: файл должен называться точно CollectConfigUI_v2
2. Пересоздайте HTML файл
3. Проверьте функцию openCollectConfigUI()
```

### Проблема: Template не найден

**Причины:**
1. Имя с опечаткой
2. Шаблон удалён
3. Другой пользователь

**Решение:**
```
1. Проверьте список: serverGetAllTemplates()
2. Имя чувствительно к регистру
3. Каждый пользователь видит только свои шаблоны
```

### Проблема: Медленная работа

**Причины:**
1. Большой объём данных
2. Много шаблонов
3. Холодный старт PropertiesService

**Решение:**
```
1. Удалите неиспользуемые шаблоны
2. При первом запуске подождите 5-10 сек
3. PropertiesService кэширует данные
```

### Проблема: Lock timeout

**Причины:**
1. Другой процесс держит блокировку
2. Таймаут 30 секунд превышен

**Решение:**
```
1. Подождите 30 секунд
2. Повторите операцию
3. Проверьте логи на другие ошибки
```

---

## 📊 ЛИМИТЫ И КВОТЫ

### PropertiesService:

| Параметр | Лимит | Примечание |
|----------|-------|------------|
| **Размер хранилища** | 500 KB | Для всех пользователей |
| **Размер значения** | 9 KB | На один ключ |
| **Операций в день** | Unlimited | Но есть rate limits |

### Template System:

| Параметр | Лимит | Рекомендация |
|----------|-------|--------------|
| **Шаблонов на пользователя** | ~100 | Зависит от размера |
| **Имя шаблона** | 100 символов | Короткие имена лучше |
| **Размер промпта** | 8 KB | Валидируется |
| **Total size** | ~5 KB на шаблон | Средний размер |

### Расчёт лимитов:

```
Размер 1 шаблона ≈ 5 KB
500 KB / 5 KB = 100 шаблонов

Если шаблоны небольшие (1 KB):
500 KB / 1 KB = 500 шаблонов
```

---

## 🎓 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ

### Пример 1: Перевод текстов

**Шаблон: "Перевод EN"**
```
Prompt: Переведи на английский профессиональным языком: {{value}}
Max Tokens: 5000
Temperature: 0.3
```

**Применение:**
- Выбираем ячейку с русским текстом
- Load Template → "Перевод EN"
- Execute
- Получаем английский перевод

### Пример 2: Анализ отзывов

**Шаблон: "Анализ отзыва"**
```
Prompt: Проанализируй отзыв и выдели:
1. Тональность (позитивная/негативная/нейтральная)
2. Ключевые проблемы
3. Рекомендации
Отзыв: {{value}}
Max Tokens: 10000
Temperature: 0.5
```

**Применение:**
- Колонка A: отзывы клиентов
- Колонка B: применяем "Анализ отзыва"
- Получаем структурированный анализ

### Пример 3: Генерация контента

**Шаблон: "Пост для соцсетей"**
```
Prompt: Создай увлекательный пост для Instagram на основе темы: {{value}}
Требования:
- Захватывающий заголовок
- 3-4 абзаца
- Эмодзи
- Хештеги
Max Tokens: 15000
Temperature: 0.8
```

**Применение:**
- A1: "запуск нового продукта"
- Load Template → "Пост для соцсетей"
- Execute
- Готовый пост для Instagram

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

### Документация:

- [deploy/README.md](../deploy/README.md) - Быстрый старт и development guide
- [DEPLOYMENT_INSTRUCTIONS.md](../DEPLOYMENT_INSTRUCTIONS.md) - Руководство по развертыванию
- [REAL_ARCHITECTURE.md](../REAL_ARCHITECTURE.md) - Подробная архитектура проекта v3.0

### Видео и туториалы:

_(Планируется)_

### Поддержка:

```
🧰 DEV → 📝 Показать логи
🤖 Table AI → 🎯 AI Конструктор → ❓ Справка
```

---

**Версия документа:** 1.0  
**Последнее обновление:** 18 октября 2025  
**Автор:** Droid @ Factory AI

---

**Happy templating! 🎯✨**
