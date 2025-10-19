/**
 * Template Service для Collect Config System
 * Управляет шаблонами конфигураций через PropertiesService
 *
 * Основные возможности:
 * - Создание и сохранение шаблонов конфигураций
 * - Загрузка шаблонов по имени
 * - Удаление шаблонов
 * - Multi-user поддержка (по email)
 * - Защита от race conditions через LockService
 * - Валидация размера данных (лимит PropertiesService 9KB)
 *
 * Version: 1.0.0
 * Author: Droid (Factory AI) + Gemini
 * Created: 2025-10-18
 */

const TEMPLATES_STORAGE_KEY = 'COLLECT_CONFIG_TEMPLATES';
const TEMPLATES_LOCK_TIMEOUT = 30000; // 30 секунд
const MAX_TEMPLATE_SIZE = 8000; // 8KB (запас от лимита 9KB)
const MAX_TEMPLATES_PER_USER = 100; // Максимум шаблонов на пользователя

/**
 * Получает данные из storage с блокировкой для предотвращения race conditions
 * @private
 * @return {{lock: GoogleAppsScript.Lock.Lock, storage: Object}}
 */
function _getTemplateStorageWithLock() {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(TEMPLATES_LOCK_TIMEOUT);
  } catch (e) {
    throw new Error('Не удалось получить блокировку хранилища. Попробуйте позже. ' + e.message);
  }

  const properties = PropertiesService.getScriptProperties();
  const jsonString = properties.getProperty(TEMPLATES_STORAGE_KEY);
  let storage = {};

  if (jsonString) {
    try {
      storage = JSON.parse(jsonString);
    } catch (e) {
      // Если парсинг не удался, логируем и начинаем с чистого объекта
      console.error('[TemplateService] Ошибка парсинга storage: ' + e.message);
      if (typeof addSystemLog === 'function') {
        addSystemLog('Template storage corrupted, resetting: ' + e.message, 'ERROR', 'TEMPLATE_SERVICE');
      }
      storage = {};
    }
  }

  return {lock, storage};
}

/**
 * Сохраняет изменённый storage обратно в PropertiesService и освобождает блокировку
 * @private
 * @param {GoogleAppsScript.Lock.Lock} lock - Объект блокировки
 * @param {Object} storage - Изменённый объект storage
 */
function _saveTemplateStorageAndUnlock(lock, storage) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const jsonString = JSON.stringify(storage);

    // Проверка размера всего storage
    if (jsonString.length > 500000) { // ~500KB - общий лимит PropertiesService
      throw new Error('Превышен общий лимит хранилища. Удалите неиспользуемые шаблоны.');
    }

    properties.setProperty(TEMPLATES_STORAGE_KEY, jsonString);
  } catch (e) {
    throw new Error('Ошибка сохранения в storage: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Валидация конфигурации шаблона
 * @private
 * @param {Object} config - Конфигурация для валидации
 * @return {{valid: boolean, error?: string}}
 */
function _validateTemplateConfig(config) {
  if (!config || typeof config !== 'object') {
    return {valid: false, error: 'Конфигурация должна быть объектом'};
  }

  // Проверка структуры
  if (config.systemPrompt && typeof config.systemPrompt !== 'object') {
    return {valid: false, error: 'systemPrompt должен быть объектом'};
  }

  if (config.systemPrompt) {
    if (!config.systemPrompt.sheet || !config.systemPrompt.cell) {
      return {valid: false, error: 'systemPrompt должен содержать sheet и cell'};
    }
  }

  if (config.userData && !Array.isArray(config.userData)) {
    return {valid: false, error: 'userData должен быть массивом'};
  }

  if (config.userData) {
    for (let i = 0; i < config.userData.length; i++) {
      const item = config.userData[i];
      if (!item.sheet || !item.cell) {
        return {valid: false, error: 'Каждый элемент userData должен содержать sheet и cell'};
      }
    }
  }

  // Проверка размера
  const configSize = JSON.stringify(config).length;
  if (configSize > MAX_TEMPLATE_SIZE) {
    return {
      valid: false,
      error: 'Конфигурация слишком большая (' + configSize + ' байт). Максимум ' + MAX_TEMPLATE_SIZE + ' байт.',
    };
  }

  return {valid: true};
}

/**
 * Получить идентификатор текущего пользователя
 * @private
 * @return {string} Email пользователя или 'anonymous'
 */
function _getCurrentUser() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email || 'anonymous';
  } catch (e) {
    return 'anonymous';
  }
}

/**
 * Получает все шаблоны для указанного пользователя
 * @param {string} [user] - Email пользователя (опционально, по умолчанию текущий)
 * @return {Object} Объект с шаблонами пользователя
 */
function getAllTemplates(user) {
  user = user || _getCurrentUser();

  if (!user) {
    throw new Error('Не удалось определить пользователя');
  }

  const {lock, storage} = _getTemplateStorageWithLock();
  const userTemplates = storage[user] || {};
  lock.releaseLock();

  return userTemplates;
}

/**
 * Получает один шаблон по имени для пользователя
 * @param {string} user - Email пользователя
 * @param {string} templateName - Имя шаблона
 * @return {Object|null} Объект конфигурации или null если не найден
 */
function getTemplate(user, templateName) {
  if (!user || !templateName) {
    throw new Error('Требуются параметры user и templateName');
  }

  const userTemplates = getAllTemplates(user);
  return userTemplates[templateName] || null;
}

/**
 * Сохраняет или обновляет шаблон для пользователя
 * @param {string} user - Email пользователя
 * @param {string} templateName - Имя шаблона
 * @param {Object} config - Объект конфигурации
 * @return {{success: boolean, message: string, size?: number}}
 */
function saveTemplate(user, templateName, config) {
  if (!user || !templateName || !config) {
    return {
      success: false,
      message: 'Требуются параметры: user, templateName и config',
    };
  }

  // Валидация имени шаблона
  if (templateName.length > 100) {
    return {
      success: false,
      message: 'Имя шаблона слишком длинное (максимум 100 символов)',
    };
  }

  // Валидация конфигурации
  const validation = _validateTemplateConfig(config);
  if (!validation.valid) {
    return {
      success: false,
      message: 'Некорректная конфигурация: ' + validation.error,
    };
  }

  try {
    const {lock, storage} = _getTemplateStorageWithLock();

    // Инициализация хранилища пользователя
    if (!storage[user]) {
      storage[user] = {};
    }

    // Проверка количества шаблонов
    const templateCount = Object.keys(storage[user]).length;
    if (templateCount >= MAX_TEMPLATES_PER_USER && !storage[user][templateName]) {
      lock.releaseLock();
      return {
        success: false,
        message: 'Достигнут лимит шаблонов (' + MAX_TEMPLATES_PER_USER + '). Удалите неиспользуемые.',
      };
    }

    // Добавляем метаданные
    const templateWithMeta = {
      config: config,
      created: storage[user][templateName] ? storage[user][templateName].created : new Date().toISOString(),
      updated: new Date().toISOString(),
      version: '1.0',
    };

    storage[user][templateName] = templateWithMeta;

    _saveTemplateStorageAndUnlock(lock, storage);

    const configSize = JSON.stringify(config).length;

    // Логирование
    if (typeof addSystemLog === 'function') {
      addSystemLog(
        'Template saved: ' + templateName + ' (' + configSize + ' bytes)',
        'INFO',
        'TEMPLATE_SERVICE',
      );
    }

    return {
      success: true,
      message: 'Шаблон "' + templateName + '" сохранён',
      size: configSize,
    };
  } catch (e) {
    return {
      success: false,
      message: 'Ошибка сохранения: ' + e.message,
    };
  }
}

/**
 * Удаляет шаблон пользователя
 * @param {string} user - Email пользователя
 * @param {string} templateName - Имя шаблона для удаления
 * @return {{success: boolean, message: string}}
 */
function deleteTemplate(user, templateName) {
  if (!user || !templateName) {
    return {
      success: false,
      message: 'Требуются параметры: user и templateName',
    };
  }

  try {
    const {lock, storage} = _getTemplateStorageWithLock();

    if (storage[user] && storage[user][templateName]) {
      delete storage[user][templateName];

      // Удаляем пустой объект пользователя
      if (Object.keys(storage[user]).length === 0) {
        delete storage[user];
      }

      _saveTemplateStorageAndUnlock(lock, storage);

      // Логирование
      if (typeof addSystemLog === 'function') {
        addSystemLog('Template deleted: ' + templateName, 'INFO', 'TEMPLATE_SERVICE');
      }

      return {
        success: true,
        message: 'Шаблон "' + templateName + '" удалён',
      };
    } else {
      lock.releaseLock();
      return {
        success: false,
        message: 'Шаблон "' + templateName + '" не найден',
      };
    }
  } catch (e) {
    return {
      success: false,
      message: 'Ошибка удаления: ' + e.message,
    };
  }
}

/**
 * Заменяет все шаблоны пользователя (используется для импорта)
 * @param {string} user - Email пользователя
 * @param {Object} newTemplates - Объект с новыми шаблонами
 * @return {{success: boolean, message: string, count?: number}}
 */
function replaceAllTemplates(user, newTemplates) {
  if (!user || typeof newTemplates !== 'object') {
    return {
      success: false,
      message: 'Требуются параметры: user и объект newTemplates',
    };
  }

  // Валидация всех шаблонов
  const templateNames = Object.keys(newTemplates);

  if (templateNames.length > MAX_TEMPLATES_PER_USER) {
    return {
      success: false,
      message: 'Слишком много шаблонов (' + templateNames.length + '). Максимум ' + MAX_TEMPLATES_PER_USER,
    };
  }

  for (let i = 0; i < templateNames.length; i++) {
    const name = templateNames[i];
    const template = newTemplates[name];
    const config = template.config || template; // Поддержка обоих форматов

    const validation = _validateTemplateConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        message: 'Шаблон "' + name + '" некорректен: ' + validation.error,
      };
    }
  }

  try {
    const {lock, storage} = _getTemplateStorageWithLock();
    storage[user] = newTemplates;
    _saveTemplateStorageAndUnlock(lock, storage);

    // Логирование
    if (typeof addSystemLog === 'function') {
      addSystemLog(
        'All templates replaced for user: ' + templateNames.length + ' templates',
        'INFO',
        'TEMPLATE_SERVICE',
      );
    }

    return {
      success: true,
      message: 'Импортировано ' + templateNames.length + ' шаблонов',
      count: templateNames.length,
    };
  } catch (e) {
    return {
      success: false,
      message: 'Ошибка импорта: ' + e.message,
    };
  }
}

/**
 * Экспортирует все шаблоны пользователя в JSON
 * @param {string} [user] - Email пользователя (опционально)
 * @return {string} JSON строка с шаблонами
 */
function exportTemplatesJSON(user) {
  user = user || _getCurrentUser();
  const templates = getAllTemplates(user);
  return JSON.stringify(templates, null, 2);
}

/**
 * Получает статистику по шаблонам
 * @param {string} [user] - Email пользователя (опционально)
 * @return {Object} Объект со статистикой
 */
function getTemplatesStats(user) {
  user = user || _getCurrentUser();
  const templates = getAllTemplates(user);
  const templateNames = Object.keys(templates);

  let totalSize = 0;
  let oldestDate = null;
  let newestDate = null;

  for (let i = 0; i < templateNames.length; i++) {
    const template = templates[templateNames[i]];
    const config = template.config || template;
    totalSize += JSON.stringify(config).length;

    if (template.created) {
      const created = new Date(template.created);
      if (!oldestDate || created < oldestDate) {
        oldestDate = created;
      }
    }

    if (template.updated) {
      const updated = new Date(template.updated);
      if (!newestDate || updated > newestDate) {
        newestDate = updated;
      }
    }
  }

  return {
    count: templateNames.length,
    maxCount: MAX_TEMPLATES_PER_USER,
    totalSize: totalSize,
    maxSize: MAX_TEMPLATE_SIZE * MAX_TEMPLATES_PER_USER,
    oldestTemplate: oldestDate ? oldestDate.toISOString() : null,
    newestTemplate: newestDate ? newestDate.toISOString() : null,
    templates: templateNames,
  };
}
