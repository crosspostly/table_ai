# 📦 ФАЙЛЫ ДЛЯ ПЕРЕНОСА В GOOGLE APPS SCRIPT

> **Точный список файлов, которые нужно скопировать в Google Apps Script**

---

## ✅ ОБЯЗАТЕЛЬНЫЕ ФАЙЛЫ (6 файлов)

### Из папки `deploy/`:

#### 1. **Main.gs** (60 KB)
```
Расположение: deploy/Main.gs
Тип в Apps Script: Script (.gs)
Название файла: Main
```
**Что содержит:**
- Основное меню Table AI
- Все функции из Main.txt
- Интеграция Template System v2.0
- GM, GM_IF функции
- VK импорт
- OCR функции
- Умные цепочки
- Логирование
- Лицензирование

---

#### 2. **server.gs** (13 KB)
```
Расположение: deploy/server.gs
Тип в Apps Script: Script (.gs)
Название файла: server
```
**Что содержит:**
- Серверные функции
- Интеграция с SERVER_URL
- OCR обработка
- Review функции

---

#### 3. **TemplateService.gs** (15 KB)
```
Расположение: deploy/TemplateService.gs
Тип в Apps Script: Script (.gs)
Название файла: TemplateService
```
**Что содержит:**
- Управление шаблонами
- PropertiesService storage
- LockService защита
- Валидация шаблонов
- Multi-user поддержка

---

#### 4. **CollectConfigUI.gs** (15 KB)
```
Расположение: deploy/CollectConfigUI.gs
Тип в Apps Script: Script (.gs)
Название файла: CollectConfigUI
```
**Что содержит:**
- Server-side endpoints для UI
- serverGetAllTemplates()
- serverSaveTemplate()
- serverDeleteTemplate()
- serverExecuteConfig()
- serverGetTemplatesStats()

---

#### 5. **CollectConfigUI_v2.html** (17 KB)
```
Расположение: deploy/CollectConfigUI_v2.html
Тип в Apps Script: HTML (.html)
Название файла: CollectConfigUI_v2
```
**Что содержит:**
- HTML/CSS/JavaScript интерфейс
- Template management UI
- Load/Save/Delete buttons
- Statistics display

---

#### 6. **MIGRATION.gs** (13 KB)
```
Расположение: deploy/MIGRATION.gs
Тип в Apps Script: Script (.gs)
Название файла: MIGRATION
```
**Что содержит:**
- Миграция из ConfigData
- validateBeforeMigration()
- migrateConfigDataToTemplates()
- rollbackMigration()
- exportTemplatesToSheet()

---

## 📋 ПОШАГОВАЯ ИНСТРУКЦИЯ

### Шаг 1: Открыть Google Apps Script

1. Откройте ваш Google Sheets документ
2. **Расширения → Apps Script**
3. Вы увидите редактор кода

### Шаг 2: Создать .gs файлы (5 файлов)

#### 2.1. Main.gs
```
1. Нажмите [+] → Script
2. Назовите: Main
3. Откройте файл: deploy/Main.gs
4. Скопируйте весь код (Ctrl+A, Ctrl+C)
5. Вставьте в редактор (Ctrl+V)
6. Сохраните (Ctrl+S)
```

#### 2.2. server.gs
```
1. Нажмите [+] → Script
2. Назовите: server
3. Откройте файл: deploy/server.gs
4. Скопируйте весь код
5. Вставьте в редактор
6. Сохраните (Ctrl+S)
```

#### 2.3. TemplateService.gs
```
1. Нажмите [+] → Script
2. Назовите: TemplateService
3. Откройте файл: deploy/TemplateService.gs
4. Скопируйте весь код
5. Вставьте в редактор
6. Сохраните (Ctrl+S)
```

#### 2.4. CollectConfigUI.gs
```
1. Нажмите [+] → Script
2. Назовите: CollectConfigUI
3. Откройте файл: deploy/CollectConfigUI.gs
4. Скопируйте весь код
5. Вставьте в редактор
6. Сохраните (Ctrl+S)
```

#### 2.5. MIGRATION.gs
```
1. Нажмите [+] → Script
2. Назовите: MIGRATION
3. Откройте файл: deploy/MIGRATION.gs
4. Скопируйте весь код
5. Вставьте в редактор
6. Сохраните (Ctrl+S)
```

### Шаг 3: Создать .html файл (1 файл)

#### 3.1. CollectConfigUI_v2.html
```
1. Нажмите [+] → HTML
2. Назовите: CollectConfigUI_v2
3. Откройте файл: deploy/CollectConfigUI_v2.html
4. Скопируйте весь HTML код
5. Вставьте в редактор
6. Сохраните (Ctrl+S)
```

### Шаг 4: Проверить структуру

В левой панели Apps Script вы должны видеть:

```
Файлы
├── 📄 Main.gs
├── 📄 server.gs
├── 📄 TemplateService.gs
├── 📄 CollectConfigUI.gs
├── 📄 MIGRATION.gs
└── 📄 CollectConfigUI_v2.html
```

### Шаг 5: Сохранить проект

1. Кнопка **💾 Сохранить проект**
2. Дайте имя: **"Table AI v2.0"**
3. Закройте редактор
4. **Обновите страницу Google Sheets (F5)**

### Шаг 6: Первый запуск

1. В меню появится **🤖 Table AI**
2. При первом клике Google попросит разрешения
3. Нажмите **"Продолжить"**
4. Выберите ваш аккаунт
5. Нажмите **"Разрешить"**

### Шаг 7: Настройка API ключа

```
🤖 Table AI → 🔑 Установить API ключ Gemini
```

Вставьте ваш Gemini API ключ (получите на https://aistudio.google.com/app/apikey)

---

## ❌ ЧТО НЕ НУЖНО КОПИРОВАТЬ

### Документация (только для чтения):
- ❌ deploy/DEPLOYMENT_GUIDE.md
- ❌ deploy/README.md
- ❌ README.md
- ❌ docs/*.md
- ❌ collect_config/*.md

### Исходные TXT файлы (только для разработки):
- ❌ Main.txt
- ❌ server.txt
- ❌ ocrRunV2_client.txt
- ❌ review_client.txt
- ❌ VK_PARSER.txt

### Другие файлы разработки:
- ❌ Main_integrated.gs (это intermediate файл)
- ❌ .git/
- ❌ node_modules/

---

## 📊 ИТОГОВАЯ ТАБЛИЦА

| # | Файл | Расположение | Тип | Размер | Обязателен |
|---|------|--------------|-----|--------|------------|
| 1 | Main.gs | deploy/ | Script | 60 KB | ✅ ДА |
| 2 | server.gs | deploy/ | Script | 13 KB | ✅ ДА |
| 3 | TemplateService.gs | deploy/ | Script | 15 KB | ✅ ДА |
| 4 | CollectConfigUI.gs | deploy/ | Script | 15 KB | ✅ ДА |
| 5 | CollectConfigUI_v2.html | deploy/ | HTML | 17 KB | ✅ ДА |
| 6 | MIGRATION.gs | deploy/ | Script | 13 KB | ✅ ДА |

**Всего:** 6 файлов (~140 KB)

---

## ✅ ПРОВЕРКА ПОСЛЕ УСТАНОВКИ

### Тест 1: Меню появилось
- [ ] Меню **🤖 Table AI** видно
- [ ] Подменю **🎯 AI Конструктор** есть
- [ ] Все пункты кликабельны

### Тест 2: AI Конструктор открывается
```
🤖 Table AI → 🎯 AI Конструктор → 🎯 Настроить запрос
```
- [ ] Диалог открывается
- [ ] UI загружается

### Тест 3: Функции работают
```
🤖 Table AI → 🔑 Установить API ключ Gemini
```
- [ ] Диалог открывается
- [ ] Ключ сохраняется

### Тест 4: Логи работают
```
🧰 DEV → 📝 Показать логи
```
- [ ] Логи отображаются

---

## 🐛 ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ

### Проблема: Меню не появляется
**Решение:**
1. Обновите страницу (F5)
2. Проверьте, что все 6 файлов загружены
3. Проверьте имена файлов (без ошибок)

### Проблема: "CollectConfigUI_v2 not found"
**Решение:**
1. Проверьте HTML файл: название должно быть **точно** `CollectConfigUI_v2`
2. Тип должен быть HTML (не Script)
3. Пересоздайте файл если нужно

### Проблема: Функции не работают
**Решение:**
1. Проверьте, что все .gs файлы загружены
2. Проверьте логи: `🧰 DEV → 📝 Показать логи`
3. Убедитесь, что дали разрешения Google

---

## 📞 ДОПОЛНИТЕЛЬНАЯ ПОМОЩЬ

### Документация:
- 📖 [deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md) - Подробное руководство
- 📚 [README.md](README.md) - Обзор проекта
- 🎯 [docs/TEMPLATE_SYSTEM.md](docs/TEMPLATE_SYSTEM.md) - Template System

### Поддержка:
- Проверьте логи в приложении
- Создайте Issue на GitHub
- Email: support@tableai.com

---

## ⏱️ ВРЕМЯ УСТАНОВКИ

- **Копирование файлов:** ~5 минут
- **Первый запуск:** ~2 минуты
- **Настройка API ключа:** ~2 минуты
- **Итого:** ~10 минут

---

**Версия:** 2.0.0  
**Дата:** 18 октября 2025  
**Автор:** Droid @ Factory AI

---

**Готово! Следуйте инструкции и всё заработает! 🚀**
