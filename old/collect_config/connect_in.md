### Как включалась функция `CollectConfig` (AI Конструктор)

Система `CollectConfig`, также известная как "AI Конструктор", была интегрирована в проект для создания сложных AI-запросов. Она имела как back-end, так и front-end компоненты.

#### 1. Активация через меню

Основной способ вызова `CollectConfig` был через специальное меню в Google Sheets.

**Файл:** `table/client/Menu.gs`

В функции `onOpen()` создавалось подменю "🎯 AI Конструктор (без лимитов)", которое содержало следующие пункты:

```javascript
// .addSubMenu(ui.createMenu('🎯 AI Конструктор (без лимитов)')
//       .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
//       .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
//       .addSeparator()
//       .addItem('📋 Менеджер пресетов', 'showPresetsManager')
//       .addItem('🎨 Применить пресет', 'applyPresetToCurrentCell')
//       .addSeparator()
//       .addItem('❓ Что это?', 'showCollectConfigHelp'))
```

-   **`openCollectConfigUI`**: Открывала основной интерфейс "AI Конструктора".
-   **`refreshCellWithConfig`**: Обновляла ячейку с использованием существующей конфигурации.
-   **`showPresetsManager`**: Открывала менеджер пресетов.
-   **`applyPresetToCurrentCell`**: Применяла выбранный пресет к текущей ячейке.
-   **`showCollectConfigHelp`**: Показывала справку.

Также в меню "🧰 DEV" был пункт для просмотра логов:

```javascript
// .addItem('🔍 Показать логи AI Конструктора', 'showCollectConfigLogs')
```

#### 2. Ключевые файлы системы

Система `CollectConfig` состояла из нескольких ключевых файлов:

**Back-end (Server-side):**

-   `table/server/ConfigurationManager.gs` (позже `collect_config/ConfigurationManager.gs`):
    -   `saveAndExecuteCollectConfig()`: Сохраняла и выполняла конфигурацию.
    -   `deleteCollectConfig()`: Удаляла конфигурацию.
    -   `executeCollectConfig()`: Выполняла AI-запрос на основе сохраненной конфигурации.
    -   `saveCollectConfig()`: Сохраняла конфигурацию в `PropertiesService`.
    -   `loadCollectConfig()`: Загружала конфигурацию.

-   `table/server/ConfigurationPresets.gs` (позже `collect_config/ConfigurationPresets.gs`):
    -   Управляла пресетами (сохранение, загрузка, применение).

**Front-end (Client-side):**

-   `table/web/CollectConfigUI.gs` (позже `collect_config/CollectConfigUI.gs`):
    -   `openCollectConfigUI()`: Создавала и отображала HTML-интерфейс.
    -   `getCollectConfigInitData()`: Получала начальные данные для UI.
    -   `showCollectConfigHelp()`: Показывала справку.

-   `table/web/CollectConfigUI.html` (позже `collect_config/CollectConfigUI.html`):
    -   HTML-разметка интерфейса "AI Конструктора".
    -   Использовала `google.script.run` для вызова серверных функций (`saveAndExecuteCollectConfig`, `deleteCollectConfig` и т.д.).

**Общие (Shared):**

-   `table/shared/GoogleSheetsLogger.gs` (позже `collect_config/GoogleSheetsLogger.gs`):
    -   `logCollectConfigOperation()`: Специализированная функция для логирования операций `CollectConfig`.

#### 3. Процесс работы

1.  Пользователь нажимал в меню "🎯 Настроить запрос".
2.  Вызывалась функция `openCollectConfigUI()` из `Menu.gs`.
3.  `openCollectConfigUI()` (в `CollectConfigUI.gs`) создавала HTML-интерфейс из `CollectConfigUI.html`.
4.  Интерфейс загружал начальные данные, вызывая `getCollectConfigInitData()`.
5.  Пользователь настраивал запрос в UI и нажимал "Сохранить и выполнить".
6.  UI вызывал `google.script.run.saveAndExecuteCollectConfig()`, передавая данные на сервер.
7.  Серверная функция `saveAndExecuteCollectConfig()` в `ConfigurationManager.gs` сохраняла конфигурацию и запускала `executeCollectConfig()`.
8.  `executeCollectConfig()` формировала запрос к Gemini API и записывала результат в ячейку.
9.  Все операции логировались с помощью `logCollectConfigOperation`.
