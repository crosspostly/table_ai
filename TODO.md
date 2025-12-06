# TODO.md - Table AI Roadmap

> **Последнее обновление:** 06.12.2025  
> **Версия:** 3.5.2  
> **Цель:** Подготовка к коммерциализации и улучшение UX/DX

---

## 🎯 КРАТКОСРОЧНЫЕ ЗАДАЧИ (1-2 недели)

### 🚨 КРИТИЧЕСКИЕ (блокеры для продажи)

- [ ] **MOBILE UI FIX** - Исправить мобильный интерфейс CollectConfigUi.html
  - [ ] Добавить responsive meta viewport для реальных устройств
  - [ ] Оптимизировать размеры кнопок (минимум 44x44px для touch)
  - [ ] Исправить переполнение контента на малых экранах
  - [ ] Добавить bottom padding для iOS Safari (safe-area-inset-bottom)
  - [ ] Тестирование на iPhone/Android реальных устройствах
  - [ ] Проблема: текущий дизайн max-width: 300px не адаптируется к мобильным

- [ ] **TESTS** - Создать базовую систему тестирования
  - [ ] Unit-тесты для Core функций (collectConfig, OTA logic, license validation)
  - [ ] Интеграционный тест OTA обновлений (mock GitHub responses)
  - [ ] Smoke-тесты после deploy (проверка критических функций)
  - [ ] CI/CD pipeline (GitHub Actions для автоматических тестов)
  - [ ] Проблема: 0 тестов в проекте = высокий риск регрессии

- [ ] **ROLLBACK MECHANISM** - Система отката обновлений
  - [ ] Хранить предыдущую версию кода на сервере (backup перед обновлением)
  - [ ] Функция `rollbackToVersion(version)` на сервере
  - [ ] UI кнопка "Откатить обновление" в DEV меню
  - [ ] Логирование истории версий (кто, когда, что обновил)
  - [ ] Проблема: если OTA ломает клиентов - нет способа вернуться назад

### 🔥 ВЫСОКИЙ ПРИОРИТЕТ (для запуска продаж)

- [ ] **LANDING PAGE** - Создать продающую страницу
  - [ ] Использовать Webflow/Carrd/Framer для быстрого создания
  - [ ] Демо-видео (2-3 минуты) на YouTube:
    - Установка add-on
    - Парсинг VK поста
    - AI трансформация данных
    - OCR отзыва с картинки
  - [ ] Pricing страница (3 тарифа: Starter/Pro/Enterprise)
  - [ ] Lead-форма (Email + "Попробовать бесплатно")
  - [ ] Trust badges (Google Workspace Compatible, AI-Powered)
  - [ ] Проблема: негде показать продукт потенциальным клиентам

- [ ] **GOOGLE WORKSPACE MARKETPLACE** - Листинг add-on
  - [ ] OAuth 2.0 Consent Screen (настроить в Google Cloud Console)
  - [ ] Подготовить описание на английском (перевод из README)
  - [ ] Скриншоты (5-6 штук: UI, результаты, настройки)
  - [ ] Демо-видео для листинга
  - [ ] Privacy Policy страница (обязательно для Marketplace)
  - [ ] Terms of Service страница
  - [ ] Пройти Google Review (обычно 2-4 недели)
  - [ ] Проблема: нет органического трафика без Marketplace

- [ ] **PAYMENT INTEGRATION** - Прием платежей
  - [ ] Stripe Connect интеграция:
    - Создать Stripe аккаунт
    - Настроить Products и Prices (подписки)
    - Webhook для активации лицензий (payment_intent.succeeded)
  - [ ] Альтернатива: Gumroad/LemonSqueezy для MVP (проще начать)
  - [ ] Автоматическая активация лицензии после оплаты:
    - Email → script_id + sheet_id в таблицу лицензий
  - [ ] Email-уведомления (успешная оплата, активация)
  - [ ] Проблема: нет способа принимать деньги от клиентов

---

## 📅 СРЕДНЕСРОЧНЫЕ ЗАДАЧИ (1-2 месяца)

### 🌐 ЛОКАЛИЗАЦИЯ И UX

- [ ] **i18n СИСТЕМА** - Многоязычность
  - [ ] Создать локализационные файлы (ru.json, en.json)
  - [ ] Функция `t(key)` для перевода строк в UI
  - [ ] Переключатель языка в настройках (⚙️ Settings → Language)
  - [ ] Перевести весь UI на английский:
    - CollectConfigUi.html
    - SettingsUI.html
    - UnpackingViewerUI.html
    - Все меню и диалоги
  - [ ] Обновить README_EN.md (английская версия)
  - [ ] Проблема: только русский интерфейс = ограничен российский рынок

- [ ] **ONBOARDING FLOW** - Пошаговый туториал
  - [ ] Первый запуск → Show tutorial (модальное окно)
  - [ ] 5 шагов:
    1. Установить Gemini API ключ (опционально)
    2. Создать первую AI трансформацию
    3. Попробовать VK парсинг
    4. Настроить автообновления
    5. Изучить шаблоны (Templates)
  - [ ] Skip tutorial (галочка "Не показывать снова")
  - [ ] Кнопка "Показать туториал" в меню Help
  - [ ] Проблема: новые пользователи не понимают как использовать

- [ ] **USER DOCUMENTATION** - Документация для пользователей
  - [ ] Создать docs/user/:
    - QUICKSTART.md (5-минутный старт)
    - FEATURES.md (все возможности с примерами)
    - FAQ.md (частые вопросы)
    - TROUBLESHOOTING.md (решение проблем)
    - VIDEO_TUTORIALS.md (ссылки на видео)
  - [ ] GitBook/Notion для красивой документации
  - [ ] Встроенная помощь (Help → User Guide)
  - [ ] Проблема: есть только dev docs, пользователи теряются

### 🔧 ТЕХНИЧЕСКОЕ ДОЛГ

- [ ] **REFACTOR Main.gs** - Разбить монолитный файл
  - [ ] Создать модули:
    - ui_menu.gs (меню и UI)
    - collect_config.gs (логика AI трансформаций)
    - vk_parser.gs (парсинг VK)
    - ocr_client.gs (OCR функции)
    - utilities.gs (утилиты)
  - [ ] Использовать namespace pattern для изоляции
  - [ ] Проблема: Main.gs = 2150 строк, сложно поддерживать

- [ ] **API VERSIONING** - Версионирование server API
  - [ ] Добавить `/v1/`, `/v2/` префиксы к endpoints
  - [ ] Клиенты отправляют: `{ "api_version": "v1", ... }`
  - [ ] Сервер поддерживает старые версии (backward compatibility)
  - [ ] Deprecation warnings в ответах старых версий
  - [ ] Проблема: изменения API могут сломать старых клиентов

- [ ] **ERROR HANDLING** - Консистентная обработка ошибок
  - [ ] Стандартный формат ошибок:
    ```javascript
    {
      "success": false,
      "error": {
        "code": "GEMINI_API_ERROR",
        "message": "Rate limit exceeded",
        "details": { ... }
      }
    }
    ```
  - [ ] Try-catch во всех async функциях
  - [ ] Централизованный error handler (logError, showError)
  - [ ] Проблема: инконсистентная обработка ошибок по всему коду

- [ ] **SECURITY IMPROVEMENTS** - Улучшение безопасности
  - [ ] Шифрование API ключей в ScriptProperties (AES-256)
  - [ ] Rate limiting на сервере (макс 60 запросов/минуту на клиента)
  - [ ] HMAC подписи для OTA запросов (защита от подделки)
  - [ ] Валидация входных данных (sanitize user input)
  - [ ] Проблема: ключи хранятся в открытом виде, нет rate limiting

---

## 🚀 ДОЛГОСРОЧНЫЕ ЗАДАЧИ (3-6 месяцев)

### 📊 АНАЛИТИКА И МЕТРИКИ

- [ ] **ANALYTICS INTEGRATION** - Трекинг использования
  - [ ] Google Analytics 4 (GA4) интеграция:
    - Установка add-on
    - Запуск AI трансформации
    - VK парсинг
    - OCR использование
    - Ошибки и crashes
  - [ ] Mixpanel для product analytics (cohort analysis)
  - [ ] Dashboard метрик:
    - DAU/MAU (Daily/Monthly Active Users)
    - Retention rate (7-day, 30-day)
    - Churn rate
    - Most used features
  - [ ] Проблема: нет понимания как пользователи используют продукт

- [ ] **CENTRALIZED LOGGING** - Центральный сбор логов
  - [ ] Logz.io / Datadog / Google Cloud Logging
  - [ ] OTA логи со всех клиентов → центральный сервер
  - [ ] Алерты на критические ошибки (Slack/Telegram webhook)
  - [ ] Dashboard мониторинга (Grafana/Kibana)
  - [ ] Проблема: логи разбросаны по клиентам, нет мониторинга

### 🎨 РАСШИРЕНИЕ ФУНКЦИОНАЛА

- [ ] **MULTI-AI SUPPORT** - Поддержка разных AI моделей
  - [ ] Claude 3.5 (Anthropic API)
  - [ ] GPT-4 Turbo (OpenAI API)
  - [ ] Llama 3.2 (Groq API)
  - [ ] Настройка в UI: Model selector (Gemini / Claude / GPT-4)
  - [ ] Fallback логика (если одна модель недоступна → переключиться)
  - [ ] Проблема: зависимость от одной AI модели (Gemini)

- [ ] **NEW DATA SOURCES** - Новые источники данных
  - [ ] Instagram парсинг (posts, comments, profile info)
  - [ ] Twitter/X парсинг (tweets, threads)
  - [ ] YouTube парсинг (video info, transcripts, comments)
  - [ ] Telegram парсинг (channels, chats)
  - [ ] Reddit парсинг (posts, comments)
  - [ ] Проблема: только VK поддерживается

- [ ] **ADVANCED ANALYTICS** - Расширенная аналитика данных
  - [ ] Sentiment analysis (анализ тональности текста)
  - [ ] Topic modeling (выделение тем в текстах)
  - [ ] Named Entity Recognition (извлечение имен, мест, организаций)
  - [ ] Text summarization (авто-резюме длинных текстов)
  - [ ] Keyword extraction (ключевые слова)
  - [ ] Проблема: базовая функциональность, нет advanced features

### 🏢 ENTERPRISE FEATURES

- [ ] **TEAM COLLABORATION** - Совместная работа
  - [ ] Shared templates (команды могут шарить шаблоны)
  - [ ] Role-based access (Admin/Editor/Viewer)
  - [ ] Audit logs (кто, когда, что изменил)
  - [ ] Team workspace (общие настройки, API ключи)
  - [ ] Проблема: нет командной работы, только индивидуальное использование

- [ ] **WHITE LABEL** - Ребрендинг для enterprise
  - [ ] Кастомизация названия add-on
  - [ ] Кастомные иконки и цвета
  - [ ] Custom domain для сервера
  - [ ] Убрать "Powered by Table AI" branding
  - [ ] Проблема: крупные компании не могут ребрендировать

- [ ] **SAAS DASHBOARD** - Веб-панель управления
  - [ ] Next.js / React dashboard:
    - Управление лицензиями
    - Статистика использования
    - Биллинг и подписки
    - Техподдержка (tickets)
  - [ ] API для dashboard (REST или GraphQL)
  - [ ] Проблема: управление через Google Sheets неудобно для бизнеса

---

## 🧪 A/B ТЕСТИРОВАНИЕ И ЭКСПЕРИМЕНТЫ

### OTA EXPERIMENTS

- [ ] **STAGED ROLLOUTS** - Поэтапные обновления
  - [ ] Canary deployment (5% клиентов → 25% → 100%)
  - [ ] Feature flags (включение новых фич для subset пользователей)
  - [ ] Rollback на основе error rate (если >5% ошибок → откат)
  - [ ] Проблема: все клиенты обновляются одновременно = высокий риск

### UI/UX EXPERIMENTS

- [ ] **A/B тесты UI элементов**
  - [ ] Тест 1: Onboarding (с туториалом vs без)
  - [ ] Тест 2: Pricing page (3 тарифа vs 2 тарифа)
  - [ ] Тест 3: CTA кнопки ("Попробовать" vs "Начать бесплатно")
  - [ ] Metric: Conversion rate (sign up → active user)

---

## 🎓 МАРКЕТИНГ И ПРОДВИЖЕНИЕ

### КОНТЕНТ-МАРКЕТИНГ

- [ ] **BLOG POSTS** - Статьи для SEO
  - [ ] Medium/Habr/Dev.to:
    - "Как автоматизировать Google Sheets с помощью AI"
    - "Парсинг VK постов в Google Sheets без кода"
    - "OCR для отзывов клиентов: кейс автоматизации"
    - "Система OTA обновлений для Google Apps Script"
  - [ ] SEO оптимизация (ключевые слова)

- [ ] **VIDEO TUTORIALS** - Видео-гайды
  - [ ] YouTube канал:
    - Quickstart (5 минут)
    - VK парсинг (10 минут)
    - AI трансформации (15 минут)
    - Advanced templates (20 минут)
  - [ ] Shorts/Reels для TikTok/Instagram

- [ ] **CASE STUDIES** - Кейсы клиентов
  - [ ] 3-5 реальных кейсов:
    - Маркетолог: автоматизация анализа конкурентов
    - HR: парсинг резюме и отзывов
    - Аналитик: трансформация данных с AI
  - [ ] Результаты (время сэкономлено, ROI)

### COMMUNITY BUILDING

- [ ] **DISCORD/SLACK COMMUNITY** - Сообщество пользователей
  - [ ] Каналы: #общее, #помощь, #фичи, #баги
  - [ ] Q&A сессии (раз в неделю)
  - [ ] Показ новых фич (demos)

- [ ] **NEWSLETTER** - Email рассылка
  - [ ] Weekly tips (советы по использованию)
  - [ ] New features announcements
  - [ ] Best templates (лучшие шаблоны недели)

---

## 🔬 ИССЛЕДОВАНИЯ И ИННОВАЦИИ

### AI IMPROVEMENTS

- [ ] **FINE-TUNING** - Дообучение моделей
  - [ ] Fine-tune Gemini на специфичных задачах:
    - Парсинг VK постов (улучшить точность)
    - Трансформация табличных данных
    - OCR русского текста с картинок

- [ ] **PROMPT ENGINEERING** - Улучшение промптов
  - [ ] Library готовых промптов для разных задач
  - [ ] A/B тесты промптов (какой дает лучший результат)
  - [ ] Community-contributed prompts

### NEW TECHNOLOGIES

- [ ] **VECTOR SEARCH** - Поиск по семантике
  - [ ] Embeddings для данных (Gemini Embeddings API)
  - [ ] Semantic search по историческим данным
  - [ ] Рекомендации похожих трансформаций

- [ ] **AI AGENTS** - Автономные агенты
  - [ ] Multi-step AI workflows (цепочки действий)
  - [ ] Auto-healing (агент сам исправляет ошибки)
  - [ ] Scheduled agents (запуск по расписанию)

---

## 🐛 ИЗВЕСТНЫЕ БАГИ И ПРОБЛЕМЫ

### КРИТИЧЕСКИЕ

- [x] ~~OTA backward compatibility (v3.5.2 FIXED)~~
- [ ] Mobile UI overflow на экранах <375px
- [ ] CollectConfig не сохраняет prompt_table в некоторых случаях
- [ ] Race condition в OTA (два клиента одновременно обновляются)

### ВЫСОКИЙ ПРИОРИТЕТ

- [ ] Gemini API rate limit не обрабатывается корректно (нужен exponential backoff)
- [ ] VK API иногда возвращает пустые посты (парсинг сломан)
- [ ] OCR не работает с некоторыми форматами изображений (HEIC, WebP)
- [ ] Template selector не обновляется после удаления шаблона

### СРЕДНИЙ ПРИОРИТЕТ

- [ ] Dev logs не очищаются автоматически (растут до infinity)
- [ ] License validation не кэшируется (лишние запросы к серверу)
- [ ] System prompt preview не обновляется при изменении checkbox "весь столбец"
- [ ] Status messages перекрывают друг друга (нет queue)

### НИЗКИЙ ПРИОРИТЕТ

- [ ] UI кнопки без keyboard navigation (accessibility)
- [ ] No dark mode для UI (всё светлое)
- [ ] Inconsistent spacing в некоторых диалогах
- [ ] Logs panel scroll не всегда работает корректно

---

## 📈 МЕТРИКИ УСПЕХА (KPI)

### PRODUCT METRICS

- [ ] **Activation Rate:** % пользователей, сделавших первую AI трансформацию (цель: >60%)
- [ ] **Retention Rate (7-day):** % пользователей, вернувшихся через неделю (цель: >40%)
- [ ] **Retention Rate (30-day):** % пользователей, активных через месяц (цель: >25%)
- [ ] **Feature Adoption:** % пользователей, использовавших VK парсинг, OCR, Templates (цель: >30% каждую)

### BUSINESS METRICS

- [ ] **MRR (Monthly Recurring Revenue):** Ежемесячная выручка (цель: $5,000 в первые 6 месяцев)
- [ ] **Churn Rate:** % отписавшихся клиентов (цель: <5% monthly)
- [ ] **LTV (Lifetime Value):** Средняя выручка с клиента (цель: $200+)
- [ ] **CAC (Customer Acquisition Cost):** Стоимость привлечения клиента (цель: <$50)
- [ ] **LTV/CAC Ratio:** Соотношение (цель: >3)

### TECHNICAL METRICS

- [ ] **OTA Success Rate:** % успешных обновлений (цель: >95%)
- [ ] **API Error Rate:** % ошибок Gemini API (цель: <2%)
- [ ] **Server Uptime:** Доступность сервера (цель: 99.9%)
- [ ] **Average Response Time:** Время ответа server API (цель: <2s)

---

## 🏆 ПРИОРИТИЗАЦИЯ (MoSCoW)

### MUST HAVE (для запуска продаж)
- Mobile UI fix
- Tests (критические функции)
- Rollback mechanism
- Landing page
- Google Workspace Marketplace
- Payment integration

### SHOULD HAVE (для роста)
- Локализация (i18n)
- Onboarding flow
- User documentation
- Refactor Main.gs
- API versioning
- Error handling improvements

### COULD HAVE (для масштабирования)
- Analytics integration
- Multi-AI support
- New data sources
- Team collaboration
- A/B testing infrastructure

### WON'T HAVE NOW (отложено)
- White label
- SaaS dashboard
- Vector search
- AI agents

---

## 📝 ПРОЦЕСС РАБОТЫ

### WEEKLY SPRINTS

```
ПОНЕДЕЛЬНИК:
- Sprint planning (выбор задач из TODO)
- Оценка сложности (Story Points)

ВТОРНИК-ЧЕТВЕРГ:
- Development
- Code review
- Testing

ПЯТНИЦА:
- Deploy to production
- Retrospective (что прошло хорошо/плохо)
- Update TODO.md
```

### GIT WORKFLOW

```
main ← production-ready код
  ↑
develop ← feature branches merge сюда
  ↑
feature/mobile-ui-fix ← отдельная ветка на фичу
```

### COMMIT CONVENTION

```
feat: добавить новую фичу
fix: исправить баг
docs: обновить документацию
refactor: рефакторинг кода
test: добавить тесты
chore: изменения в конфиге/CI
```

---

## 🎯 NEXT SPRINT (06.12.2025 - 13.12.2025)

**Цель:** Исправить критические блокеры для продажи

### Tasks:
1. [ ] **Mobile UI Fix** (CollectConfigUi.html)
   - Responsive design для <768px
   - Touch-friendly buttons (44x44px min)
   - Safe area для iOS
   - Тест на реальных устройствах

2. [ ] **Basic Tests** (jest/mocha)
   - collectConfig() unit test
   - OTA checkForUpdates() mock test
   - License validation test

3. [ ] **Rollback Function**
   - serverRollbackToVersion(version)
   - Backup mechanism перед OTA
   - UI для rollback в DEV menu

4. [ ] **Landing Page MVP** (Carrd/Webflow)
   - Hero section с демо-видео
   - 3 benefits blocks
   - Pricing (3 plans)
   - Email lead form

**Deliverable:** Проект готов к первым продажам (manual sales через Gumroad)

---

**Автор:** @daoqub  
**Контрибьюторы:** Welcome! 🚀  
**Версия TODO:** 1.0
