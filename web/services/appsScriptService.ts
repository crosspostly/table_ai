import { ScriptProject } from '../types';

// Временной интерфейс для ScriptFunction (будет определен в types.ts)
interface ScriptFunction {
  name: string;
  label: string;
  description: string;
  category: 'ai' | 'data' | 'settings' | 'dev';
  menuPath: string;
  order: number;
  returnsHtml?: boolean;
}

const SCRIPTS_BASE_URL = 'https://script.googleapis.com/v1';
const PROJECTS_BASE_URL = 'https://script.googleapis.com/v1/projects';

export interface SearchScriptLog {
  timestamp: string;
  action: string;
  details: string;
  success?: boolean;
  error?: string;
}

export interface ScriptSearchResult {
  scriptId: string | null;
  logs: SearchScriptLog[];
  found: boolean;
  message: string;
}

/**
 * Автоматический поиск Script ID для таблицы через Apps Script API
 */
export const findScriptIdForSpreadsheet = async (
  spreadsheetId: string,
  token: string
): Promise<ScriptSearchResult> => {
  const logs: SearchScriptLog[] = [];
  const startTime = new Date().toISOString();

  const addLog = (action: string, details: string, success?: boolean, error?: string) => {
    logs.push({
      timestamp: new Date().toISOString(),
      action,
      details,
      success,
      error
    });
  };

  try {
    addLog('SEARCH_START', `Начало поиска Script ID для таблицы ${spreadsheetId}`);

    // Ищем все проекты Apps Script
    let pageToken: string | null = null;
    let foundScriptId: string | null = null;
    let totalProjects = 0;

    do {
      addLog('FETCH_PAGE', `Запрос списка проектов (pageToken: ${pageToken || 'first'})`);

      const params = new URLSearchParams({
        pageSize: '50',
        ...(pageToken && { pageToken })
      });

      const response = await fetch(`${PROJECTS_BASE_URL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API Error ${response.status}: ${errorText}`;
        addLog('FETCH_ERROR', errorMsg, false, errorMsg);
        
        return {
          scriptId: null,
          logs,
          found: false,
          message: `Ошибка доступа к Apps Script API: ${response.status}. Убедитесь что предоставлены права на управление скриптами.`
        };
      }

      const data = await response.json();
      const projects = data.projects || [];
      totalProjects += projects.length;

      addLog('FETCH_SUCCESS', `Получено ${projects.length} проектов`);

      // Ищем проект с нужным parentId
      for (const project of projects) {
        if (project.parentResource && project.parentResource.id === spreadsheetId) {
          foundScriptId = project.scriptId;
          addLog('SCRIPT_FOUND', `Найден Script ID: ${project.scriptId}`, true);
          break;
        }
      }

      if (foundScriptId) break;

      pageToken = data.nextPageToken || null;
    } while (pageToken);

    if (foundScriptId) {
      addLog('SEARCH_COMPLETE', `Успешно найден Script ID после проверки ${totalProjects} проектов`, true);
      return {
        scriptId: foundScriptId,
        logs,
        found: true,
        message: `Script ID найден: ${foundScriptId}`
      };
    } else {
      addLog('NOT_FOUND', `Script ID не найден после проверки ${totalProjects} проектов`, false);
      return {
        scriptId: null,
        logs,
        found: false,
        message: `В выбранной таблице не найден скрипт Table AI. Убедитесь что:\n1. Скрипт добавлен в таблицу через Extensions → Apps Script\n2. Скрипт содержит код Table AI\n3. У вас есть права на доступ к скриптам`
      };
    }

  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    addLog('EXCEPTION', `Исключение: ${errorMsg}`, false, errorMsg);
    
    return {
      scriptId: null,
      logs,
      found: false,
      message: `Критическая ошибка при поиске Script ID: ${errorMsg}`
    };
  }
};

/**
 * Получение списка функций из Apps Script проекта
 */
export const getScriptFunctions = async (
  scriptId: string,
  token: string
): Promise<{ functions: ScriptFunction[], error?: string }> => {
  try {
    // Пытаемся получить метаданные проекта
    const response = await fetch(`${PROJECTS_BASE_URL}/${scriptId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get project metadata: ${response.status}`);
    }

    const project = await response.json();
    
    // Базовые функции из onOpen (известные из кода)
    const knownFunctions: ScriptFunction[] = [
      {
        name: 'openCollectConfigUI',
        label: '🎯 AI Конструктор',
        description: 'Создание и настройка AI-запросов',
        category: 'ai',
        menuPath: '🎯 AI Конструктор',
        order: 1
      },
      {
        name: 'refreshCellWithConfig',
        label: '🔄 Обновить ячейку',
        description: 'Обновить выбранную ячейку с конфигурацией',
        category: 'ai',
        menuPath: '🎯 AI Конструктор',
        order: 2
      },
      {
        name: 'openUnpackingViewer',
        label: '📦 Просмотр Распаковки',
        description: 'Просмотр результатов обработки данных',
        category: 'data',
        menuPath: '🤖 Table AI',
        order: 3
      },
      {
        name: 'importVkPosts',
        label: '📥 Импорт VK постов',
        description: 'Загрузка постов из ВКонтакте',
        category: 'data',
        menuPath: '🤖 Table AI',
        order: 4
      },
      {
        name: 'ocrRun',
        label: '🖼️ Транскрибация отзывов',
        description: 'Распознавание текста с изображений',
        category: 'ai',
        menuPath: '🤖 Table AI',
        order: 5
      },
      {
        name: 'openSettingsUI',
        label: '⚙️ Настройки',
        description: 'Конфигурация Table AI',
        category: 'settings',
        menuPath: '🤖 Table AI',
        order: 6
      },
      {
        name: 'checkLicenseStatusUI',
        label: '🔒 Проверить лицензию',
        description: 'Проверка статуса лицензии',
        category: 'settings',
        menuPath: '🤖 Table AI',
        order: 7
      }
    ];

    // Добавляем batch операции (если есть)
    const batchOperations = [
      { key: 'etap1', name: '📋 обновить Презентация' },
      { key: 'etap2_1', name: '📦 обновить Рефлексия (часть 1)' },
      { key: 'etap2_2', name: '🎯 обновить Рефлексия (часть 2)' },
      { key: 'faza1', name: '🎯 обновить Фаза 1' },
      { key: 'archetype', name: '🎯 обновить Архетип' },
      { key: 'common_ca', name: '🎯 обновить ЦА (общая)' },
      { key: 'faza2', name: '🎯 обновить Фаза 2' },
      { key: 'faza3', name: '🎯 обновить фаза 3' }
    ];

    batchOperations.forEach((op, index) => {
      const funcName = op.key.charAt(0).toUpperCase() + op.key.slice(1);
      knownFunctions.push({
        name: funcName,
        label: op.name,
        description: `Batch операция: ${op.name}`,
        category: 'data',
        menuPath: '🎯 AI Конструктор',
        order: 10 + index
      });
    });

    // Dev функции (если в DEV_MODE)
    const devFunctions: ScriptFunction[] = [
      {
        name: 'showLogsDialog',
        label: '📝 Показать логи',
        description: 'Показать системные логи',
        category: 'dev',
        menuPath: '🧰 DEV',
        order: 100
      },
      {
        name: 'exportLogsToSheet',
        label: '⬇️ Экспорт логов',
        description: 'Экспортировать логи в лист',
        category: 'dev',
        menuPath: '🧰 DEV',
        order: 101
      },
      {
        name: 'clearLogs',
        label: '🗑 Очистить логи',
        description: 'Очистить системные логи',
        category: 'dev',
        menuPath: '🧰 DEV',
        order: 102
      }
    ];

    return {
      functions: [...knownFunctions, ...devFunctions].sort((a, b) => a.order - b.order)
    };

  } catch (error: any) {
    return {
      functions: [],
      error: `Ошибка получения функций: ${error.message}`
    };
  }
};

/**
 * Проверка доступности скрипта
 */
export const checkScriptAvailability = async (
  scriptId: string,
  token: string
): Promise<{ available: boolean, error?: string }> => {
  try {
    const response = await fetch(`${PROJECTS_BASE_URL}/${scriptId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          available: false,
          error: 'Доступ запрещен. Убедитесь что у вас есть права на выполнение скрипта.'
        };
      } else if (response.status === 404) {
        return {
          available: false,
          error: 'Скрипт не найден. Проверьте Script ID.'
        };
      } else {
        return {
          available: false,
          error: `Ошибка доступа: ${response.status}`
        };
      }
    }

    return { available: true };

  } catch (error: any) {
    return {
      available: false,
      error: `Ошибка проверки доступности: ${error.message}`
    };
  }
};