# 🛠️ Table AI Mobile - Руководство разработчика

## 🏗️ Архитектура

### Структура приложения
```
web/
├── components/           # React компоненты
│   ├── SheetViewer.tsx     # Основной экран таблицы
│   ├── EnhancedActionPanel.tsx  # Улучшенная панель действий
│   ├── DiagnosticsPanel.tsx     # Панель диагностики
│   └── ResultModal.tsx          # Модальное окно результатов
├── services/            # API сервисы
│   ├── googleSheets.ts          # Google Sheets API
│   └── appsScriptService.ts     # Apps Script API (NEW)
├── types.ts             # TypeScript типы
└── App.tsx              # Главный компонент приложения
```

### Ключевые изменения

#### 1. Автоматический поиск Script ID
- **Файл**: `services/appsScriptService.ts`
- **Функция**: `findScriptIdForSpreadsheet()`
- **API**: Apps Script API v1 (`projects.list`)
- **Логика**: Поиск по `parentResource.id === spreadsheetId`

#### 2. Динамическое обнаружение функций
- **Файл**: `services/appsScriptService.ts`
- **Функция**: `getScriptFunctions()`
- **Источник**: Анализ `onOpen()` из Main.gs
- **Результат**: Все доступные функции с метаданными

#### 3. Система диагностики
- **Компонент**: `DiagnosticsPanel.tsx`
- **Функционал**: Логи поиска, статус, ошибки
- **UI**: Прозрачная индикация процессов

---

## 🔧 API Интеграция

### Apps Script API
```typescript
// Поиск скрипта для таблицы
const searchResult = await findScriptIdForSpreadsheet(spreadsheetId, token);

// Проверка доступности
const availability = await checkScriptAvailability(scriptId, token);

// Получение функций
const functions = await getScriptFunctions(scriptId, token);
```

### Google Sheets API
```typescript
// Чтение данных
const values = await readSheetValues(spreadsheetId, sheetName, range, token);

// Запись данных
await writeCell(spreadsheetId, sheetName, cellAddress, value, token);

// Выполнение функции скрипта
const result = await executeGoogleScript(scriptId, functionName, parameters, token);
```

---

## 📊 Структура данных

### ScriptStatus
```typescript
interface ScriptStatus {
  scriptId: string | null;      // Найденный Script ID
  available: boolean;           // Доступность скрипта
  lastChecked: string;          // Время последней проверки
  searchLogs: SearchScriptLog[]; // Логи поиска
  functions: ScriptFunction[];   // Доступные функции
  error?: string;              // Ошибка если есть
}
```

### ScriptFunction
```typescript
interface ScriptFunction {
  name: string;                // Имя функции в GAS
  label: string;               // Отображаемое название
  description: string;          // Описание
  category: 'ai' | 'data' | 'settings' | 'dev';
  menuPath: string;            // Путь в меню
  order: number;               // Порядок в меню
  returnsHtml?: boolean;        // Возвращает HTML?
}
```

---

## 🔄 Поток выполнения

### 1. Выбор таблицы
```
handleSelectFile() → refreshScriptStatus() → findScriptIdForSpreadsheet()
```

### 2. Проверка доступности
```
checkScriptAvailability() → getScriptFunctions() → update ScriptStatus
```

### 3. Выполнение функции
```
handleExecute() → executeGoogleScript() → show ResultModal
```

---

## 🎨 UI Компоненты

### EnhancedActionPanel
- **Авто-фильтрация**: По категориям и меню
- **Статусы**: Визуальная индикация доступности
- **Ошибки**: Понятные сообщения пользователю
- **Группировка**: Функции сгруппированы по меню

### DiagnosticsPanel
- **Логи поиска**: Детальный лог каждого шага
- **Статус скрипта**: Визуальные индикаторы
- **Инструкции**: Помощь пользователю
- **Обновление**: Повторный поиск

---

## 🔍 Поиск и отладка

### Логи консоли
```typescript
// Включить DEV_MODE в Main.gs
const DEV_MODE = true;

// Логи в мобильном приложении
console.log('Script search result:', searchResult);
```

### Диагностика в приложении
1. Откройте таблицу
2. Перейдите в "НАСТРОЙКИ"
3. Посмотрите "Логи поиска"
4. Проверьте "Статус скрипта"

### Common ошибки
- **403**: Недостаточно прав для Apps Script API
- **404**: Скрипт не найден
- **CORS**: Проблемы с браузерным доступом

---

## 🚀 Разработка новых функций

### Добавление функции в меню
1. **В Main.gs**:
```javascript
ui.createMenu('🤖 Table AI')
  .addItem('🆕 Новая функция', 'newFunctionName')
  .addToUi();
```

2. **В appsScriptService.ts**:
```typescript
const knownFunctions: ScriptFunction[] = [
  {
    name: 'newFunctionName',
    label: '🆕 Новая функция',
    description: 'Описание новой функции',
    category: 'data',
    menuPath: '🤖 Table AI',
    order: 8
  }
];
```

### Batch операции
```javascript
// В reniewcell.gs
const BATCH_OPERATIONS = {
  newBatch: {
    name: '🆕 Новая операция',
    startRow: 100,
    endRow: 150,
  }
};
```

---

## 🔒 Безопасность

### OAuth Scopes
```typescript
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',      // Таблицы
  'https://www.googleapis.com/auth/script.projects',   // Скрипты
  'https://www.googleapis.com/auth/drive.readonly',     // Файлы
  'https://www.googleapis.com/auth/userinfo.email'       // Email
];
```

### Token Management
- Хранение в `localStorage`
- Автообновление при истечении
- Безопасная передача в API

---

## 📱 Мобильная оптимизация

### Performance
- Ленивая загрузка данных
- Пагинация больших таблиц
- Кэширование результатов

### UX
- Индикаторы загрузки
- Swipe навигация
- Адаптивные модальные окна

### Offline
- Кэширование метаданных
- Очередь изменений
- Синхронизация при онлайн

---

## 🧪 Тестирование

### Unit тесты
```bash
# Запуск тестов
npm test

# Покрытие
npm run test:coverage
```

### E2E тесты
```typescript
// Тест поиска скрипта
test('should find script ID', async () => {
  const result = await findScriptIdForSpreadsheet(spreadsheetId, token);
  expect(result.found).toBe(true);
});
```

---

## 🚀 Деплой

### Сборка
```bash
npm run build
```

### Переменные окружения
```bash
# .env.local
VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_APP_NAME=Table AI Mobile
```

---

## 📚 Дополнительные ресурсы

### API документация
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Apps Script API](https://developers.google.com/apps-script/api)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

### React документация
- [React Hooks](https://reactjs.org/docs/hooks-intro.html)
- [TypeScript](https://www.typescriptlang.org/docs/)

---

**Готово к разработке!** 🎉