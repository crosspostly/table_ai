# 🎯 Table AI - AI Конструктор v3.0.0

**Google Sheets AI Integration с системой управления промптами и шаблонами**

**Последнее обновление:** 2 ноября 2025  
**Версия:** 3.0.0  
**Статус:** ✅ Production Ready

---

## 📋 ОГЛАВЛЕНИЕ
1. [Что это](#что-это)
2. [Быстрый старт](#быстрый-старт)
3. [Архитектура](#архитектура)
4. [Файлы проекта](#файлы-проекта)
5. [Развертывание](#развертывание)
6. [API: Клиент → Сервер](#api-клиент--сервер)
7. [Как работает](#как-работает)
8. [Тестирование](#тестирование)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## 🎯 ЧТО ЭТО

**Table AI** — система для интеграции Google Sheets с Gemini AI через удобный интерфейс управления промптами.

### Проблема
Google Sheets ограничивает формулы 50,000 символами. При работе с большими данными:
```javascript
=GM("Промпт: " & A1 & A2 & ... & A1000)
```
❌ **Формула слишком длинная = ОШИБКА!**

### Решение
AI Конструктор собирает данные **на сервере** Apps Script:
1. ✅ **Нет лимита** размера формулы
2. ✅ **Логирование** всех операций
3. ✅ **Шаблоны** для повторного использования
4. ✅ **Мульти-пользователь** поддержка

---

## 🚀 БЫСТРЫЙ СТАРТ

### Шаг 1: Развертывание

1. **Откройте Google Sheets**
2. **Extensions → Apps Script**
3. **Скопируйте файлы из проекта:**
   ```
   Main.gs           ← Основная логика
   TemplateService.gs ← Система шаблонов
   CollectConfig.gs  ← AI Конструктор сервер
   CollectConfigUi.html ← UI интерфейс
   server.gs         ← Меню
   ```

**⚠️ ВАЖНО:** HTML файл должен называться точно **`CollectConfigUi`** (без .html)!

### Шаг 2: Настройка Gemini API

1. **Получите API ключ:** https://aistudio.google.com/app/apikey
2. **В Apps Script:** Добавьте в Properties:
   ```javascript
   PropertiesService.getScriptProperties().setProperties({
     'GEMINI_API_KEY': 'ваш-api-ключ'
   });
   ```

### Шаг 3: Первый запуск

1. **Обновите Google Sheets** (F5)
2. **Появится меню:** 🤖 AI Tools
3. **Выберите:** 🎯 AI Конструктор → Настроить запрос
4. **✅ Готово!**

---

## 🏗️ АРХИТЕКТУРА

### Клиент-Сервер модель

```
┌─────────────────────────────────────┐
│  HTML UI (CollectConfigUi.html)    │
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

### Система хранения

| Тип данных | Хранилище | Назначение |
|------------|-----------|------------|
| **API ключи** | PropertiesService | GEMINI_API_KEY |
| **Шаблоны** | PropertiesService | Пользовательские шаблоны |
| **Конфигурации** | Скрытый лист "ConfigData" | Настройки ячеек |
| **Логи** | Глобальная переменная | Отладочная информация |
| **Кэш** | CacheService | Ответы Gemini (6 часов) |

---

## 📦 ФАЙЛЫ ПРОЕКТА

### Основные файлы (обязательные)

| Файл | Строк | Назначение |
|------|-------|-----------|
| **`Main.gs`** | 1200+ | **Ядро системы** - GM функции, меню, API |
| **`CollectConfig.gs`** | 630 | **AI Конструктор сервер** - обработка запросов |
| **`CollectConfigUi.html`** | 983 | **HTML интерфейс** - UI для пользователя |
| **`TemplateService.gs`** | 432 | **Система шаблонов** - сохранение/загрузка |
| **`server.gs`** | 293 | **Меню Google Sheets** - добавление пунктов |

### Вспомогательные файлы

| Файл | Назначение |
|------|------------|
| `appsscript.json` | Манифест проекта Apps Script |
| `package.json` | npm зависимости для разработки |
| `__tests__/` | Юнит-тесты (43 теста) |
| `DEPLOYMENT_GUIDE.md` | Подробное руководство по развертыванию |

---

## 🚀 РАЗВЕРТЫВАНИЕ

### Автоматическое развертывание

**Используйте Google Clasp CLI:**

```bash
# 1. Установка
npm install -g @google/clasp

# 2. Авторизация
clasp login

# 3. Клонирование
clasp clone [SCRIPT_ID]

# 4. Развертывание
clasp push
```

### Ручное развертывание

**Порядок добавления файлов ВАЖЕН:**

```bash
1. Main.gs           # Сначала основные функции
2. TemplateService.gs # Система шаблонов
3. CollectConfig.gs   # AI Конструктор сервер
4. server.gs          # Меню
5. CollectConfigUi.html # UI (Files → + → HTML file)
```

**⚠️ КРИТИЧНО:**
- HTML файл должен называться **`CollectConfigUi`** (без .html в названии!)
- В коде: `HtmlService.createHtmlOutputFromFile('CollectConfigUi')`
- Если название не совпадёт → ошибка "Template not found"

### Проверка развертывания

1. **Сохраните проект** (💾 Save)
2. **Выберите функцию** `onOpen` в выпадающем меню
3. **Запустите** (▶️ Run)
4. **Разрешите доступ** (первый раз)
5. **Обновите Google Sheets** (F5)
6. **Проверьте меню** 🤖 AI Tools

✅ **Готово!**

---

## 🔌 API: КЛИЕНТ → СЕРВЕР

[Полный список и примеры вызовов перенесены сюда из deploy/README.md и размещены ниже]

### Основные API функции

#### 1. Инициализация
```javascript
getCollectConfigInitData() → {
  sheetName: "Лист1",
  cellAddress: "A1",
  sheets: ["Лист1", "Лист2"],
  version: "3.0.0",
  logs: [...]
}
```

#### 2. Предпросмотр данных
```javascript
getCellPreview(sheetName, cellAddress) → "Первые 100 символов..."
```

#### 3. Выполнение запроса
```javascript
saveAndExecuteCollectConfig(sheetName, cellAddress, config) → {
  success: true,
  result: "Ответ от AI",
  logs: [...]
}
```

#### 4. Управление шаблонами
```javascript
serverSaveTemplate(templateName, config) → {success, message}
serverGetTemplate(templateName) → config | null
serverGetAllTemplates() → {templateName: config, ...}
serverDeleteTemplate(templateName) → {success, message}
```

#### 5. Работа с конфигурациями
```javascript
saveCollectConfig(sheetName, cellAddress, config) → boolean
loadCollectConfig(sheetName, cellAddress) → {systemPrompt, userData} | null
deleteCollectConfig(sheetName, cellAddress) → {success, message}
```

#### 6. Вспомогательные функции
```javascript
getAllSheetNames() → ["Лист1", "Лист2", ...]
hasConfigForCurrentCell() → boolean
```

---

## ⚙️ КАК РАБОТАЕТ

[Перенесено из deploy/README.md — с примерами функций openCollectConfigUI, getCollectConfigInitData, saveAndExecuteCollectConfig, executeCollectConfig, readData]

---

## 🧪 ТЕСТИРОВАНИЕ

[Перенесено из deploy/README.md — команды, ожидаемые результаты, таблица тестов и сценарии ручной проверки]

---

## 🐛 TROUBLESHOOTING

[Перенесено из deploy/README.md — 6 типовых проблем с решениями]

---

## 🎓 BEST PRACTICES

[Перенесено из deploy/README.md — синхронизация HTML↔GS, логирование, валидация, структурированные ответы]

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ

[Перенесено из deploy/README.md — структура ConfigData и TemplatesData]

---

## 📝 CHANGELOG

[Перенесено из deploy/README.md — v3.0.0, v2.1.0, v2.0.0]

---

## 📞 ПОДДЕРЖКА

[Ссылки и порядок проверки]

---

## 📄 ЛИЦЕНЗИЯ

MIT
