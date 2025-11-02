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
6. [API клиент-сервер](#api-клиент--сервер)
7. [Тестирование](#тестирование)
8. [Troubleshooting](#troubleshooting)

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

### Критично: Синхронизация функций

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

### Основные API функции

#### 1. Инициализация
```javascript
// HTML → Server
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
// Сохранить шаблон
serverSaveTemplate(templateName, config) → {success, message}

// Загрузить шаблон  
serverGetTemplate(templateName) → config | null

// Все шаблоны
serverGetAllTemplates() → {templateName: config, ...}

// Удалить шаблон
serverDeleteTemplate(templateName) → {success, message}
```

---

## 🧪 ТЕСТИРОВАНИЕ

### Автоматические тесты

**Запуск всех тестов:**
```bash
npm test
```

**Ожидаемый результат:**
```
✅ PASS __tests__/ClientServer.test.js (10 tests)
✅ PASS __tests__/TemplateService.test.js (18 tests)  
✅ PASS __tests__/CollectDataFromRange.test.js (15 tests)

📊 Test Suites: 3 passed, 3 total
📊 Tests: 43 passed, 43 total
📊 Coverage: ~85%
```

### Ручное тестирование

**1. Открытие UI:**
- Меню → AI Конструктор → Настроить запрос
- ✅ UI открывается
- ✅ Показывает версию: "CollectConfig v3.0.0"

**2. Базовый шаблон:**
- Dropdown "Шаблоны"
- ✅ Есть шаблон "По умолчанию"
- ✅ Поля заполняются корректно

**3. Выполнение запроса:**
- Нажать "Запустить"
- ✅ Логи показывают прогресс
- ✅ Результат записывается в ячейку

---

## 🐛 TROUBLESHOOTING

### Проблема 1: "Template not found"

**Ошибка:**
```
Exception: Template 'CollectConfigUi' not found
```

**Решение:**
1. ✅ HTML файл должен называться **`CollectConfigUi`** (без .html)
2. ✅ В коде: `HtmlService.createHtmlOutputFromFile('CollectConfigUi')`

### Проблема 2: Функция не работает в UI

**Симптомы:**
- Нажимаешь кнопку → ничего не происходит
- В консоли F12: `myFunction is not defined`

**Решение:**
1. **Открой консоль браузера** (F12)
2. **Найди ошибку:** `Failed to load: myFunction`
3. **Добавь функцию в .gs файл**

### Проблема 3: Нет меню "AI Tools"

**Решение:**
1. ✅ Файл `server.gs` загружен
2. ✅ Функция `onOpen()` существует
3. ✅ Запустите `onOpen()` вручную
4. ✅ Обновите страницу (F5)

### Проблема 4: "GM is not defined"

**Решение:**
1. ✅ Файл `Main.gs` загружен
2. ✅ Функция `GM()` существует
3. ✅ API ключ настроен в Properties

### Проблема 5: Шаблоны не сохраняются

**Решение:**
1. ✅ Файл `TemplateService.gs` загружен
2. ✅ PropertiesService доступен
3. ✅ Проверьте лимит 500KB

---

## 📊 СТАТИСТИКА ПРОЕКТА

```
📈 МЕТРИКИ ПРОЕКТА
├── Версия: 3.0.0
├── Дата релиза: 2 ноября 2025
├── Статус: ✅ Production Ready
└── Тестирование: ✅ 43/43 tests passing

💻 КОД
├── Всего строк: ~3500+ строк
├── Функций: ~50+ функций
├── Файлов: 5 основных файлов
└── Документации: ~1000+ строк

🎯 ВОЗМОЖНОСТИ
├── ✅ AI Конструктор v3.0
├── ✅ Система шаблонов
├── ✅ Мульти-пользователь
├── ✅ Полное логирование
└── ✅ Клиент-сервер архитектура
```

---

## 📞 ПОДДЕРЖКА

### Нужна помощь?

1. 📖 **Документация:** Прочитайте этот README
2. 🧪 **Тесты:** Запустите `npm test`
3. 🐛 **Баги:** Создайте Issue на GitHub
4. 💬 **Вопросы:** Напишите в Discussions

### Полезные ссылки

- 🌐 **Gemini API:** https://aistudio.google.com/
- 📚 **Apps Script:** https://developers.google.com/apps-script
- 🔧 **Google Clasp:** https://developers.google.com/apps-script/guides/clasp
- 📖 **GitHub:** https://github.com/crosspostly/table_ai

---

## 🏆 КОМАНДА

**Разработано:** Crosspostly Team  
**GitHub:** https://github.com/crosspostly/table_ai  
**Контакт:** support@crosspostly.com

**Особая благодарность:** AI-ассистентам за помощь в разработке!

---

## 📄 ЛИЦЕНЗИЯ

Этот проект распространяется под лицензией MIT.

**Copyright © 2025 Crosspostly**

---

**🎊 Готово к использованию! Happy AI automation! 🚀**

**Последнее обновление:** 2 ноября 2025  
**Версия документа:** 3.0.0  
**Автор:** Crosspostly Team