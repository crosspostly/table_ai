/**
 * Client-Side Template Management Functions
 * Адаптированные функции для работы с серверным Apps Script через API
 * 
 * Version: 1.0.0
 * Created: 2024-10-18
 */

/**
 * Получить все шаблоны с сервера
 */
function serverGetAllTemplates() {
  try {
    const response = callServerAPI('getAllTemplates');
    return response.data || {};
  } catch (e) {
    Logger.log('serverGetAllTemplates error: ' + e.message);
    return {};
  }
}

/**
 * Получить конкретный шаблон по имени с сервера
 */
function serverGetTemplate(templateName) {
  try {
    const response = callServerAPI('getTemplate', { templateName: templateName });
    return response.data || null;
  } catch (e) {
    Logger.log('serverGetTemplate error: ' + e.message);
    return null;
  }
}

/**
 * Сохранить шаблон на сервер
 */
function serverSaveTemplate(templateName, config) {
  try {
    const response = callServerAPI('saveTemplate', { 
      templateName: templateName, 
      config: config 
    });
    return response.data || { success: false, message: 'Unknown error' };
  } catch (e) {
    Logger.log('serverSaveTemplate error: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Удалить шаблон с сервера
 */
function serverDeleteTemplate(templateName) {
  try {
    const response = callServerAPI('deleteTemplate', { templateName: templateName });
    return response.data || { success: false, message: 'Unknown error' };
  } catch (e) {
    Logger.log('serverDeleteTemplate error: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Выполнить конфигурацию на сервере
 */
function serverExecuteConfig(config, cellInfo) {
  try {
    const response = callServerAPI('executeConfig', { 
      config: config, 
      cellInfo: cellInfo 
    });
    return response.data || { success: false, error: 'Unknown error' };
  } catch (e) {
    Logger.log('serverExecuteConfig error: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Получить статистику шаблонов с сервера
 */
function serverGetTemplatesStats() {
  try {
    const response = callServerAPI('getTemplatesStats');
    return response.data || { count: 0, totalSize: 0, maxCount: 100 };
  } catch (e) {
    Logger.log('serverGetTemplatesStats error: ' + e.message);
    return { count: 0, totalSize: 0, maxCount: 100 };
  }
}