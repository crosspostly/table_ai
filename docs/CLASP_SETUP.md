# 📖 CLASP_SETUP.md - Настройка Google Apps Script CLI

**Версия:** 3.0.0  
**Для:** Разработчиков Table AI

---

## 🎯 Что такое clasp?

**clasp** - это Command Line Apps Script Projects, официальный инструмент Google для разработки Apps Script проектов локально с использованием современных инструментов.

### Преимущества
- 📝 **Локальная разработка** - используйте ваш любимый редактор
- 🔄 **Git интеграция** - версионный контроль кода
- 🛠️ **Современные инструменты** - ESLint, Prettier, Webpack
- 🚀 **Автоматический деплой** - CI/CD интеграция
- 📦 **Управление зависимостями** - npm/yarn поддержка

---

## 🚀 Быстрая установка

### 1. Установка Node.js
```bash
# Установите Node.js (v16 или выше)
# Скачайте с https://nodejs.org/ или используйте менеджер версий

# Проверка версии
node --version  # должно быть v16+
npm --version   # должно быть 8+
```

### 2. Установка clasp
```bash
# Глобальная установка
npm install -g @google/clasp

# Проверка установки
clasp --version
```

### 3. Вход в Google Account
```bash
# Авторизация
clasp login

# Откроется браузер для авторизации
# Разрешите доступ к Google Apps Script
```

---

## 📋 Настройка проекта Table AI

### 1. Клонирование репозитория
```bash
# Клонируйте проект
git clone https://github.com/your-repo/table-ai.git
cd table-ai

# Установите зависимости
npm install
```

### 2. Инициализация clasp
```bash
# Если проект уже существует
clasp clone <script-id>

# Или создайте новый проект
clasp create --title "Table AI" --type sheets

# Для существующего проекта:
# Найдите Script ID в URL Apps Script:
# https://script.google.com/d/<SCRIPT-ID>/edit
```

### 3. Конфигурация .clasp.json
```json
{
  "scriptId": "your-script-id-here",
  "rootDir": "deploy",
  "projectId": "your-google-cloud-project-id",
  "filePushOrder": [
    "Main.gs",
    "server.gs",
    "Menu.gs",
    "GeminiClient.gs",
    "Utils.gs",
    "Constants.gs",
    "LoggingService.gs",
    "CollectConfig.gs",
    "VK.gs",
    "UnpackingViewer.gs",
    "TemplateService.gs",
    "ocrRunV2_client.gs",
    "reniewcell.gs"
  ]
}
```

---

## 🔧 Основные команды clasp

### Управление файлами
```bash
# Скачать все файлы с сервера
clasp pull

# Загрузить все файлы на сервер
clasp push

# Загрузить конкретный файл
clasp push --watch

# Отслеживать изменения и автоматически загружать
clasp push --watch
```

### Управление проектом
```bash
# Открыть проект в браузере
clasp open

# Показать статус проекта
clasp status

# Показать список файлов
clasp list

# Создать новый файл
clasp create --type server "NewFile.gs"

# Удалить файл
clasp delete "OldFile.gs"
```

### Версионирование
```bash
# Создать новую версию
clasp version "Version description"

# Показать список версий
clasp versions

# Откатить на предыдущую версию
clasp redeploy --versionId <version-number>
```

---

## 📁 Структура проекта

### Папки и файлы
```
table-ai/
├── .clasp.json           # Конфигурация clasp
├── .claspignore          # Файлы для игнорирования
├── package.json          # Зависимости проекта
├── deploy/               # Основной код Apps Script
│   ├── *.gs             # Apps Script файлы
│   └── *.html           # HTML файлы для UI
├── shared/              # Общие утилиты
├── __tests__/           # Тесты
├── docs/                # Документация
└── system_integrations/ # CI/CD скрипты
```

### .claspignore
```
# Игнорировать node_modules
node_modules/**

# Игнорировать тесты
__tests__/**

# Игнорировать документацию
docs/**

# Игнорировать системные файлы
.git/
.gitignore
.vscode/

# Игнорировать логи
*.log

# Игнорировать временные файлы
.tmp/
.temp/
```

---

## 🔄 Рабочий процесс

### Ежедневная разработка
```bash
# 1. Скачайте последние изменения
git pull
clasp pull

# 2. Создайте feature branch
git checkout -b feature/new-feature

# 3. Вносите изменения в код
# Используйте ваш любимый редактор

# 4. Загрузите изменения для тестирования
clasp push

# 5. Тестируйте в Google Sheets
# Откройте: clasp open

# 6. Если всё работает, коммитьте
git add .
git commit -m "feat: add new feature"
git push

# 7. Создайте Pull Request
```

### Деплой в production
```bash
# 1. Слейте изменения в main
git checkout main
git merge feature/new-feature

# 2. Загрузите в production
clasp push

# 3. Создайте версию
clasp version "Add new feature description"

# 4. Обновите manifest при необходимости
```

---

## 🛠️ Интеграция с другими инструментами

### ESLint
```bash
# Установка ESLint
npm install --save-dev eslint

# Конфигурация .eslintrc.json
{
  "extends": ["eslint:recommended"],
  "env": {
    "browser": true,
    "es6": true,
    "googleappsscript": true
  },
  "globals": {
    "SpreadsheetApp": "readonly",
    "Logger": "readonly",
    "Utilities": "readonly"
  }
}
```

### Prettier
```bash
# Установка Prettier
npm install --save-dev prettier

# Конфигурация .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Git Hooks
```bash
# Установка husky для git hooks
npm install --save-dev husky

# Конфигурация package.json
{
  "husky": {
    "hooks": {
      "pre-push": "npm run lint && npm test"
    }
  }
}
```

---

## 🚀 Продвинутые возможности

### Множественные окружения
```bash
# Создайте разные .clasp.json для разных окружений
# .clasp.staging.json
{
  "scriptId": "staging-script-id",
  "rootDir": "deploy"
}

# .clasp.production.json
{
  "scriptId": "production-script-id", 
  "rootDir": "deploy"
}

# Используйте разные конфиги
cp .clasp.staging.json .clasp.json
clasp push  # деплой в staging

cp .clasp.production.json .clasp.json
clasp push  # деплой в production
```

### Batch операции
```bash
# Загрузить только изменённые файлы
clasp push --force

# Игнорировать .claspignore
clasp push --noignore

# Показать diff перед загрузкой
clasp push --dryrun
```

### Работа с библиотеками
```bash
# Показать используемые библиотеки
clasp libs

# Добавить библиотеку
clasp libs add <library-id>

# Удалить библиотеку
clasp libs remove <library-id>
```

---

## 🔧 Troubleshooting

### Частые проблемы

#### 1. Ошибка авторизации
```bash
# Решение
clasp logout
clasp login
```

#### 2. Проблемы с путями
```bash
# Проверьте .clasp.json
cat .clasp.json

# Убедитесь что rootDir правильный
ls deploy/
```

#### 3. Конфликты версий
```bash
# Принудительная загрузка
clasp push --force

# Или сбросить и загрузить заново
clasp pull
clasp push
```

#### 4. Проблемы с .claspignore
```bash
# Проверьте что не игнорируете нужные файлы
cat .claspignore

# Временно отключите игнорирование
clasp push --noignore
```

### Логирование и отладка
```bash
# Включить verbose режим
clasp push --verbose

# Показать статус
clasp status

# Показать список файлов
clasp list
```

---

## 📚 Полезные ресурсы

### Официальная документация
- [clasp GitHub](https://github.com/google/clasp)
- [Apps Script Documentation](https://developers.google.com/apps-script)
- [Google Cloud Console](https://console.cloud.google.com/)

### Сообщество
- [Stack Overflow](https://stackoverflow.com/questions/tagged/google-apps-script)
- [Google Apps Script Community](https://developers.google.com/apps-script/community)
- [GitHub Discussions](https://github.com/google/clasp/discussions)

### Примеры и туториалы
- [clasp Examples](https://github.com/google/clasp/tree/master/samples)
- [Apps Script Tutorials](https://developers.google.com/apps-script/tutorials)
- [Table AI Examples](https://github.com/your-repo/table-ai/examples)

---

## 🎯 Лучшие практики

### 1. Версионный контроль
```bash
# Всегда коммитьте перед push
git add .
git commit -m "feat: implement new feature"
clasp push

# Используйте осмысленные сообщения коммитов
git commit -m "fix: resolve API timeout issue"
git commit -m "docs: update README"
```

### 2. Управление средами
```bash
# Используйте разные скрипты для staging/production
# staging
cp .clasp.staging.json .clasp.json
clasp push

# production
cp .clasp.production.json .clasp.json
clasp push
```

### 3. Безопасность
```bash
# Не храните чувствительные данные в коде
# Используйте PropertiesService
# Добавьте .env в .claspignore
echo ".env" >> .claspignore
```

### 4. Автоматизация
```bash
# Настройте автоматический деплой
npm run deploy

# Добавьте в package.json
{
  "scripts": {
    "deploy": "clasp push",
    "deploy:staging": "cp .clasp.staging.json .clasp.json && clasp push",
    "deploy:production": "cp .clasp.production.json .clasp.json && clasp push"
  }
}
```

---

## 🆘 Поддержка

Если у вас возникли проблемы:

1. **Проверьте логи** - используйте `--verbose` флаг
2. **Посмотрите в Issues** - возможно, проблема уже известна
3. **Создайте Issue** - подробно опишите проблему
4. **Обратитесь в сообщество** - Stack Overflow или GitHub Discussions

### Шаблон для Issue:
```markdown
## Описание проблемы
Краткое описание проблемы с clasp

## Команда
Ваша команда и вывод

## Ожидаемый результат
Что должно было произойти

## Фактический результат
Что произошло на самом деле

## Окружение
- clasp версия: `clasp --version`
- Node.js версия: `node --version`
- ОС: `uname -a`

## Дополнительная информация
.clasp.json, .claspignore, другая полезная информация
```

---

**Удачной разработки с clasp!** 🚀

Этот инструмент значительно упростит вашу работу с Google Apps Script и позволит использовать современные практики разработки.