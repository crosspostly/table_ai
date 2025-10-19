# 🤖 TABLE AI v3.0 - AI-powered Google Sheets Automation

> **Полнофункциональная система автоматизации Google Sheets с AI, OCR, импортом из социальных сетей и системой шаблонов**

[![Version](https://img.shields.io/badge/Version-3.0.0-green.svg)](CHANGELOG.md)
[![Status](https://img.shields.io/badge/Status-Production--Ready-success.svg)](deploy/)
[![Tests](https://img.shields.io/badge/Tests-43%20passing-success.svg)](__tests__/)
[![Google Sheets](https://img.shields.io/badge/Platform-Google%20Sheets-34A853.svg)](https://sheets.google.com)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%202.0-4285F4.svg)](https://ai.google.dev/)

**Последнее обновление:** 18 октября 2025

---

## 📋 СОДЕРЖАНИЕ

- [О проекте](#-о-проекте)
- [Основные возможности](#-основные-возможности)
- [Быстрый старт](#-быстрый-старт)
- [Архитектура](#-архитектура)
- [Документация](#-документация)
- [Развертывание](#-развертывание)

---

## 🎯 О ПРОЕКТЕ

**Table AI** — это комплексная система для автоматизации работы с данными в Google Sheets, включающая:

- 🧠 **AI-анализ** через Gemini 2.0 Flash
- 📱 **Импорт** из VK, Instagram, Telegram
- 📷 **OCR** для распознавания текста из изображений
- 🔄 **Умные цепочки** последовательной обработки данных
- 🎯 **Template System v2.0** - система управления AI промптами и шаблонами
- 📝 **Логирование** всех операций
- 🔐 **Лицензирование** и мульти-пользовательская поддержка

---

## ✨ ОСНОВНЫЕ ВОЗМОЖНОСТИ

### 🧠 Gemini AI Integration

#### Базовые функции:
- **`GM(prompt, maxTokens, temperature)`** - запрос к Gemini AI
- **`GM_IF(condition, prompt, maxTokens, temperature)`** - условный запрос
- Автоматическое преобразование Markdown в читаемый текст
- Кэширование ответов (6 часов)
- Встроенная система логирования

#### Пример использования:
```javascript
=GM("Переведи на английский: " & A1, 25000, 0.7)
=GM_IF($A3<>"", "Проанализируй текст: " & $A3, 25000, 0.7)
```

### 🎯 Template System v2.0 (NEW!)

**Новая система управления AI промптами:**

- 💾 **Сохранение шаблонов** - создавайте и сохраняйте промпты
- 🔄 **Быстрое применение** - применяйте шаблоны к любым ячейкам
- 👥 **Multi-user** - каждый пользователь со своими шаблонами
- ⚡ **10x быстрее** - PropertiesService вместо листов
- 🔒 **LockService** - защита от race conditions

#### Доступ через меню:
```
🤖 Table AI → 🎯 AI Конструктор → 🎯 Настроить запрос
```

**Подробнее:** [docs/TEMPLATE_SYSTEM.md](docs/TEMPLATE_SYSTEM.md)

### 📱 Импорт из социальных сетей

#### Поддерживаемые платформы:
- ✅ **VK** (ВКонтакте) - через VK Parser сервис
- ✅ **Instagram** - через основной сервер
- ✅ **Telegram** - через Bot API

#### Настройка импорта:

1. Создайте лист **"Параметры"**
2. Заполните:
   - **B1**: `owner` (для VK: username или ID группы)
   - **B2**: `count` (количество постов)

3. Запустите импорт:
```
🤖 Table AI → 📥 Импорт VK постов
```

**Подробнее:** [VK_IMPORT_DOCUMENTATION.md](VK_IMPORT_DOCUMENTATION.md)

### 📷 OCR (Optical Character Recognition)

Распознавание текста из изображений:

- Поддержка: Google Drive, VK, Yandex.Disk, Dropbox
- Автоматический AI-анализ распознанного текста
- Пакетная обработка изображений

#### Использование:
```
🤖 Table AI → 🖼️ Транскрибация отзывов
```

### 🔄 Умные цепочки (Smart Chain)

Последовательная обработка данных с автоматическим выполнением:

#### Примеры работы:

**Базовая цепочка для A3:**
```
A3 (ввод) → B3 (шаг 1) → C3 (шаг 2) → D3 (шаг 3)...
```

**Умный режим (из Prompt_box):**
```
Prompt_box!B2: "B3"  → Формула в B3
Prompt_box!B3: "C3"  → Формула в C3
...
```

#### Настройка:
```
🤖 Table AI → ▶️ Подготовить формулы (умный режим)
```

### 📝 Логирование

Встроенная система логирования всех операций:

- 📊 **300 последних записей** в кэше
- 🔍 **Уровни:** DEBUG, INFO, WARN, ERROR
- 📥 **Экспорт** в Google Sheets
- 🧹 **Очистка** логов

#### Доступ к логам:
```
🧰 DEV → 📝 Показать логи
🧰 DEV → ⬇️ Экспорт логов
🧰 DEV → 🗑 Очистить логи
```

### 🔐 Лицензирование

Система лицензий с серверной проверкой:

- Email + Token аутентификация
- Проверка статуса лицензии
- Интеграция с основным сервером

#### Настройка:
```
🤖 Table AI → 🔐 Лицензия → Ввести Email + Токен
🤖 Table AI → 🔐 Лицензия → Проверить статус
```

---

## 🚀 БЫСТРЫЙ СТАРТ

### Шаг 1: Установка

1. Откройте Google Sheets документ
2. **Расширения → Apps Script**
3. Скопируйте файлы из папки **`deploy/`**:
   - `Main.gs`
   - `server.gs`
   - `TemplateService.gs`
   - `CollectConfigUI.gs`
   - `CollectConfigUI_v2.html`
   - `MIGRATION.gs`

**Подробная инструкция:** [deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md)

### Шаг 2: Настройка API ключа

1. Получите Gemini API ключ: https://aistudio.google.com/app/apikey
2. В Google Sheets:
```
🤖 Table AI → 🔑 Установить API ключ Gemini
```
3. Вставьте ключ и нажмите OK

### Шаг 3: Проверка работы

Откройте меню **🤖 Table AI** — вы увидите все доступные функции!

---

## 🏗️ АРХИТЕКТУРА

### Структура проекта:

```
table_ai/
├── 📁 deploy/                       # 🎯 PRODUCTION-READY ПАКЕТ
│   ├── Main.gs                     # Ядро: меню, GM формулы (1027 строк)
│   ├── server.gs                   # Лицензии, API прокси (293 строки)
│   ├── ocrRunV2_client.gs          # OCR транскрибация (437 строк)
│   ├── CollectConfig.gs            # AI конструктор v3.0 (705 строк)
│   ├── TemplateService.gs          # Управление шаблонами (432 строки)
│   ├── CollectConfigUi.html        # UI для AI конструктора (~900 строк)
│   ├── SettingsUI.html             # Единое окно настроек (~500 строк)
│   ├── appsscript.json             # Манифест, OAuth scopes
│   └── README.md                   # Быстрый старт
│
├── 📁 __tests__/                    # Тесты (43/43 passing ✅)
│   ├── CollectDataFromRange.test.js
│   └── ...
│
├── 📁 docs/                         # Документация
│   ├── CURRENT_FILE_STRUCTURE.md   # Актуальная структура файлов
│   ├── FUNCTIONS_REFERENCE.md      # Справочник функций
│   └── ...
│
├── 📄 REAL_ARCHITECTURE.md          # 🏗️ Подробная архитектура v3.0
├── 📄 AUDIT_UNUSED_CODE.md          # Отчёт по очистке кода (-37%)
├── 📄 DEPLOYMENT_INSTRUCTIONS.md    # Инструкции по развёртыванию
└── 📄 README.md                     # Этот файл

**Итого:** 5 файлов .gs (3,725 строк), 2 HTML, 1 JSON, 43 теста ✅
```

### Клиент-Серверная архитектура:

```
┌─────────────────────────────────────────┐
│   GOOGLE SHEETS (Клиент)              │
│   ├── Main.gs                          │
│   ├── Template System                  │
│   └── UI Components                    │
│            ↓ ↑                          │
│      UrlFetchApp                        │
└─────────────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────────────┐
│   SERVER_URL (Основной сервер)         │
│   ├── Лицензирование                   │
│   ├── OCR Processing                   │
│   └── Social Import Proxy              │
│            ↓ ↑                          │
└─────────────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────────────┐
│   VK_PARSER_URL (VK Parser)            │
│   └── VK API Integration               │
└─────────────────────────────────────────┘
              ↓ ↑
┌─────────────────────────────────────────┐
│   GEMINI_API_URL (Google AI)           │
│   └── Gemini 2.0 Flash API             │
└─────────────────────────────────────────┘
```

### Хранение данных:

| Тип данных | Хранилище | Пример |
|------------|-----------|---------|
| **API ключи** | PropertiesService | GEMINI_API_KEY |
| **Шаблоны** | PropertiesService | User templates |
| **Лицензии** | PropertiesService | EMAIL, TOKEN |
| **Логи** | CacheService (24ч) | System logs |
| **Кэш AI** | CacheService (6ч) | Gemini responses |
| **Конфигурации** | Sheet "Параметры" | VK owner, count |

---

## 📚 ДОКУМЕНТАЦИЯ

### Основные документы:

| Документ | Описание |
|----------|----------|
| **[deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md)** | 🚀 Пошаговое развертывание |
| **[deploy/README.md](deploy/README.md)** | 📦 Production пакет |
| **[docs/TEMPLATE_SYSTEM.md](docs/TEMPLATE_SYSTEM.md)** | 🎯 Template System v2.0 |
| **[VK_IMPORT_DOCUMENTATION.md](VK_IMPORT_DOCUMENTATION.md)** | 📱 Импорт из VK |
| **[collect_config/TEMPLATES_GUIDE.md](collect_config/TEMPLATES_GUIDE.md)** | 📚 Руководство пользователя |

### Дополнительная документация:

- [AGENT_READ_FIRST.md](AGENT_READ_FIRST.md) - Для AI-ассистентов
- [FILE_STRUCTURE_RULES.md](FILE_STRUCTURE_RULES.md) - Правила структуры
- [docs/FUNCTIONS_REFERENCE.md](docs/FUNCTIONS_REFERENCE.md) - Справочник функций
- [docs/INSTALLATION.md](docs/INSTALLATION.md) - Детальная установка

---

## 🎨 МЕНЮ СИСТЕМЫ

```
🤖 Table AI
├── ▶️ Подготовить формулы (умный режим)
├── 🔁 Обновить текущую ячейку (GM)
├── 🧹 Очистить B3..G3
│
├── ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── 🎯 AI Конструктор (Template System v2.0) ⭐ NEW!
│   ├── 🎯 Настроить запрос
│   ├── 🔄 Обновить ячейку
│   ├── 📦 Миграция данных (ConfigData → Templates)
│   ├── 💾 Экспорт шаблонов в лист
│   └── ❓ Справка
│
├── ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├── 📥 Импорт VK постов
├── 🖼️ Транскрибация отзывов
│
└── ⚙️ Настройки
    ├── 🔑 Установить API ключ Gemini
    ├── ━━━━━━━━━━━━━━━━━━━━━━━━
    ├── 🔐 Ввести лицензию
    └── 🔐 Проверить статус лицензии

🧰 DEV (в DEV_MODE)
├── 📝 Показать логи
├── ⬇️ Экспорт логов
├── 🗑 Очистить логи
└── 🧪 Откат миграции
```

---

## 📦 РАЗВЕРТЫВАНИЕ

### Production-Ready пакет

Папка **`deploy/`** содержит полностью готовый к развертыванию код:

```bash
deploy/
├── Main.gs                    # 60 KB - основной файл
├── server.gs                  # 13 KB - серверные функции
├── TemplateService.gs         # 15 KB - управление шаблонами
├── CollectConfigUI.gs         # 15 KB - UI функции
├── CollectConfigUI_v2.html    # 17 KB - HTML интерфейс
├── MIGRATION.gs               # 13 KB - миграция данных
├── DEPLOYMENT_GUIDE.md        # Подробное руководство
└── README.md                  # Быстрый старт
```

### Шаги развертывания:

1. **Прочитайте** [deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md)
2. **Скопируйте** файлы из `deploy/` в Google Apps Script
3. **Настройте** Gemini API ключ
4. **Готово!** Система работает

**Время развертывания:** ~10-15 минут

---

## 🔧 ТРЕБОВАНИЯ

### Необходимо:
- ✅ Google Account
- ✅ Google Sheets
- ✅ Gemini API ключ ([получить](https://aistudio.google.com/app/apikey))

### Рекомендуется:
- 📚 Базовые знания Google Apps Script
- 🔍 Понимание работы с Google Sheets

### Ограничения:
- **PropertiesService:** 500 KB лимит (достаточно для ~100 шаблонов)
- **CacheService:** 24 часа TTL для логов
- **Gemini API:** Квоты зависят от вашего плана

---

## 📊 СТАТИСТИКА ПРОЕКТА

```
Версия:              2.0.0
Дата релиза:         18 октября 2025

Код:
├── Всего строк:     ~5500+ строк
├── Функций:         ~50+ функций
├── Файлов:          15+ файлов
└── Документации:    ~1200+ строк

Возможности:
├── AI функции:      ✅ GM, GM_IF
├── Template System: ✅ v2.0
├── Social Import:   ✅ VK, Instagram, Telegram
├── OCR:             ✅ v2 с AI анализом
├── Smart Chain:     ✅ Умные цепочки
└── Logging:         ✅ Полное логирование
```

---

## 🎉 НОВОЕ В v2.0

### ✨ Template System v2.0

**Главное нововведение** этой версии:

- 🎯 **AI Конструктор** - визуальный интерфейс для создания промптов
- 💾 **Сохранение шаблонов** - создавайте библиотеку промптов
- ⚡ **10x ускорение** - PropertiesService вместо листов
- 👥 **Multi-user** - изоляция данных пользователей
- 🔒 **LockService** - защита от конфликтов

### 🔄 Миграция из v1.0

Автоматическая миграция из старого ConfigData:

```
🤖 Table AI → 🎯 AI Конструктор → 📦 Миграция данных
```

---

## 🐛 УСТРАНЕНИЕ НЕПОЛАДОК

### Проблема: Меню не появляется

**Решение:**
1. Обновите страницу (F5)
2. Проверьте, что файл `Main.gs` загружен
3. Проверьте функцию `onOpen()`

### Проблема: "API key not set"

**Решение:**
```
🤖 Table AI → 🔑 Установить API ключ Gemini
```

### Проблема: Импорт VK не работает

**Решение:**
- VK_TOKEN настраивается на VK_PARSER сервере (не на клиенте!)
- Проверьте параметры: B1 (owner), B2 (count)

### Проблема: Шаблоны не сохраняются

**Решение:**
1. Проверьте логи: `🧰 DEV → 📝 Показать логи`
2. Убедитесь, что `TemplateService.gs` загружен
3. Проверьте квоту PropertiesService (500KB)

**Полный список:** [deploy/DEPLOYMENT_GUIDE.md#устранение-неполадок](deploy/DEPLOYMENT_GUIDE.md#-устранение-неполадок)

---

## 🤝 ВКЛАД В ПРОЕКТ

Мы приветствуем вклад в проект! 

### Как помочь:
1. 🐛 Сообщайте о багах через Issues
2. 💡 Предлагайте новые функции
3. 📝 Улучшайте документацию
4. 🧪 Пишите тесты

### Правила разработки:
- Следуйте [FILE_STRUCTURE_RULES.md](FILE_STRUCTURE_RULES.md)
- Документируйте все изменения
- Тестируйте перед PR

---

## 📄 ЛИЦЕНЗИЯ

Проект распространяется под лицензией для образовательных и коммерческих целей.

**Контакты:** support@tableai.com

---

## 🏆 АВТОРЫ

Разработано командой **Crosspostly** с использованием AI-ассистентов.

**GitHub:** https://github.com/crosspostly/table_ai

---

## 🔗 ПОЛЕЗНЫЕ ССЫЛКИ

- 🌐 **Gemini API:** https://ai.google.dev/
- 📚 **Google Apps Script:** https://developers.google.com/apps-script
- 🔐 **VK API:** https://dev.vk.com/
- 📖 **Документация:** [docs/](docs/)

---

## 📞 ПОДДЕРЖКА

### Возникли вопросы?

1. 📖 Проверьте [deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md)
2. 🔍 Посмотрите логи: `🧰 DEV → 📝 Показать логи`
3. 🐛 Создайте Issue на GitHub
4. 📧 Напишите: support@tableai.com

---

**Последнее обновление:** 18 октября 2025  
**Версия документа:** 2.0  
**Автор:** Droid @ Factory AI

---

**🎊 Готово к использованию! Happy automation! 🚀**
