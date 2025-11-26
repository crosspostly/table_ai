
import { TableAiFunction } from '../types';

export const TABLE_AI_FUNCTIONS: TableAiFunction[] = [
  // --- AI CATEGORY ---
  {
    id: 'ai-constructor',
    name: 'openCollectConfigUI',
    label: 'AI Конструктор',
    description: 'Создание и настройка AI-запросов',
    icon: '🎯',
    category: 'ai',
    returnsHtml: true
  },
  {
    id: 'ocr-run',
    name: 'ocrRun',
    label: 'OCR Распознавание',
    description: 'Транскрибация текста с изображений',
    icon: '🖼️',
    category: 'ai',
    returnsHtml: false
  },
  {
    id: 'ai-generate',
    name: 'generateColumns', // Assumed name based on logic
    label: 'Генерация колонок',
    description: 'Запуск обработки данных',
    icon: '✨',
    category: 'ai',
    returnsHtml: false
  },

  // --- DATA CATEGORY ---
  {
    id: 'unpacking-viewer',
    name: 'openUnpackingViewer',
    label: 'Распаковка',
    description: 'Просмотр распакованных данных',
    icon: '📦',
    category: 'data',
    returnsHtml: true
  },
  {
    id: 'import-vk',
    name: 'importVkPosts',
    label: 'Импорт VK',
    description: 'Загрузка постов из ВКонтакте',
    icon: 'vk', // We'll handle text icon in UI
    category: 'data',
    returnsHtml: false
  },

  // --- SETTINGS CATEGORY ---
  {
    id: 'settings',
    name: 'openSettingsUI',
    label: 'Настройки',
    description: 'Конфигурация Table AI',
    icon: '⚙️',
    category: 'settings',
    returnsHtml: true
  }
];
