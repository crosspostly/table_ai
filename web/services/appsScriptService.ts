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
 * Получение списка функций из Apps Script проекта через динамический API
 */
export const getScriptFunctions = async (
  scriptId: string,
  token: string
): Promise<{ functions: ScriptFunction[], error?: string }> => {
  try {
    // Вызываем новую динамическую функцию listExposedFunctions
    const response = await fetch(`${SCRIPTS_BASE_URL}/${scriptId}:run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        function: 'listExposedFunctions',
        parameters: []
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to call listExposedFunctions: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Script error: ${result.error.message}`);
    }

    const scriptResponse = result.response?.result;
    
    if (!scriptResponse || !scriptResponse.success) {
      throw new Error(scriptResponse?.error || 'Failed to get functions list');
    }

    // Преобразуем функции из скрипта в наш формат
    const functions: ScriptFunction[] = scriptResponse.functions.map((func: any) => ({
      name: func.name,
      label: func.label,
      description: func.description,
      category: func.category,
      menuPath: func.menuPath,
      order: func.order,
      returnsHtml: func.returnsHtml || false,
      parameters: func.parameters || []
    }));

    return {
      functions: functions.sort((a, b) => a.order - b.order)
    };

  } catch (error: any) {
    console.error('Error getting script functions:', error);
    
    // Fallback к hardcoded списку в случае ошибки
    const fallbackFunctions: ScriptFunction[] = [
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

    return {
      functions: fallbackFunctions,
      error: `Используется fallback список. Ошибка динамического получения: ${error.message}`
    };
  }
};

/**
 * Выполнение функции с расширенным логированием
 */
export const executeScriptFunction = async (
  scriptId: string,
  functionName: string,
  parameters: any = {},
  token: string
): Promise<{ success: boolean, result?: any, error?: string, executionTime?: number }> => {
  try {
    const response = await fetch(`${SCRIPTS_BASE_URL}/${scriptId}:run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        function: 'executeFunction',
        parameters: [functionName, parameters]
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to execute function: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Script execution error: ${result.error.message}`);
    }

    const scriptResponse = result.response?.result;
    
    if (!scriptResponse) {
      throw new Error('No response from script');
    }

    return {
      success: scriptResponse.success,
      result: scriptResponse.result,
      error: scriptResponse.error,
      executionTime: scriptResponse.executionTime
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Ошибка выполнения функции: ${error.message}`
    };
  }
};

/**
 * Получение статуса скрипта
 */
export const getScriptStatus = async (
  scriptId: string,
  token: string
): Promise<{ success: boolean, status?: any, error?: string }> => {
  try {
    const response = await fetch(`${SCRIPTS_BASE_URL}/${scriptId}:run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        function: 'getScriptStatus',
        parameters: []
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get script status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Script error: ${result.error.message}`);
    }

    const scriptResponse = result.response?.result;
    
    if (!scriptResponse || !scriptResponse.success) {
      throw new Error(scriptResponse?.error || 'Failed to get script status');
    }

    return {
      success: true,
      status: scriptResponse
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Ошибка получения статуса: ${error.message}`
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