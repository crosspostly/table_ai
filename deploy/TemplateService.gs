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
const TEMPLATE_KEY_PREFIX = 'COLLECT_TPL_V2:'; // Пер-элементное хранилище

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
 * Выполняет миграцию старого формата (по email) в общий 'default' namespace
 * Безопасно объединяет все шаблоны пользователей в storage['default']
 * Конфликты имён разрешаются добавлением суффикса " (email)" с инкрементом
 * @private
 * @param {Object} storage - Текущее хранилище шаблонов
 * @return {boolean} Было ли внесено изменение (true если мигрировали)
 */
function _migrateTemplatesToDefaultIfNeeded(storage) {
  if (!storage || typeof storage !== 'object') {
    return false;
  }

  const allUserKeys = Object.keys(storage);
  const nonDefaultKeys = [];
  for (let i = 0; i < allUserKeys.length; i++) {
    const key = allUserKeys[i];
    if (key !== 'default' && storage[key] && typeof storage[key] === 'object') {
      nonDefaultKeys.push(key);
    }
  }

  if (nonDefaultKeys.length === 0) {
    return false; // нечего мигрировать
  }

  const target = storage['default'] || {};
  let changed = false;

  // Объединяем все шаблоны из старых ключей в 'default'
  for (let k = 0; k < nonDefaultKeys.length; k++) {
    const userKey = nonDefaultKeys[k];
    const userTemplates = storage[userKey] || {};
    const templateNames = Object.keys(userTemplates);
    for (let t = 0; t < templateNames.length; t++) {
      const originalName = templateNames[t];
      const templateValue = userTemplates[originalName];

      let finalName = originalName;
      if (Object.prototype.hasOwnProperty.call(target, finalName)) {
        // Разрешаем конфликт имён: добавляем суффикс с email и, при необходимости, счётчик
        const safeUserSuffix = ' (' + String(userKey).replace(/[^a-zA-Z0-9._@-]+/g, '_').slice(0, 30) + ')';
        finalName = originalName + safeUserSuffix;
        let counter = 2;
        while (Object.prototype.hasOwnProperty.call(target, finalName)) {
          finalName = originalName + safeUserSuffix + ' ' + counter;
          counter++;
        }
      }

      target[finalName] = templateValue;
      changed = true;
    }
  }

  if (changed) {
    storage['default'] = target;
    // Удаляем старые ключи
    for (let j = 0; j < nonDefaultKeys.length; j++) {
      delete storage[nonDefaultKeys[j]];
    }
  }

  return changed;
}

/**
 * Построить ключ для хранения конкретного шаблона пользователя
 * @private
 */
function _buildTemplateKey(user, templateName) {
  const userKey = String(user || 'default');
  const nameKey = String(templateName || '').slice(0, 200);
  return TEMPLATE_KEY_PREFIX + userKey + ':' + nameKey;
}

/**
 * Получить список ключей шаблонов для пользователя
 * @private
 */
function _listTemplateKeysForUser(props, user) {
  const all = props.getProperties();
  const prefix = TEMPLATE_KEY_PREFIX + String(user || 'default') + ':';
  const keys = [];
  for (const k in all) {
    if (Object.prototype.hasOwnProperty.call(all, k) && k.indexOf(prefix) === 0) {
      keys.push(k);
    }
  }
  return keys;
}

/**
 * Миграция из монолитного свойства COLLECT_CONFIG_TEMPLATES в пер-элементное хранилище
 * Также объединяет старые user-неймспейсы в 'default'
 * Выполняется под lock
 * @private
 * @return {boolean} true если были изменения
 */
function _migrateMonolithToPerTemplateIfNeeded_(props) {
  try {
    const jsonString = props.getProperty(TEMPLATES_STORAGE_KEY);
    if (!jsonString) return false;

    let storage = {};
    try {
      storage = JSON.parse(jsonString) || {};
    } catch (_e) {
      // Если битые данные — сбрасываем монолит и выходим
      props.deleteProperty(TEMPLATES_STORAGE_KEY);
      return true;
    }

    // Объединим в 'default', если нужно
    try {
      _migrateTemplatesToDefaultIfNeeded(storage);
    } catch (_e2) {}

    const userStore = storage['default'] || {};
    const names = Object.keys(userStore);
    const nowIso = new Date().toISOString();

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const entry = userStore[name];
      const config = entry && entry.config ? entry.config : entry;
      const templateWithMeta = {
        config: config,
        created: entry && entry.created ? entry.created : nowIso,
        updated: nowIso,
        version: '1.0',
      };
      const key = _buildTemplateKey('default', name);
      props.setProperty(key, JSON.stringify(templateWithMeta));
    }

    // Удаляем монолитное свойство после успешной миграции
    props.deleteProperty(TEMPLATES_STORAGE_KEY);

    if (typeof addSystemLog === 'function') {
      addSystemLog('Migrated templates to per-template storage (' + names.length + ')', 'INFO', 'TEMPLATE_SERVICE');
    }
    return true;
  } catch (_e) {
    // Не препятствуем работе при ошибке миграции
    return false;
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
 * @return {string} Всегда возвращает 'default' (общее хранилище для всех)
 */
function _getCurrentUser() {
  // Используем общее хранилище для всех пользователей
  // Это избегает проблем с разрешениями Session API
  return 'default';
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

  const lock = LockService.getScriptLock();
  lock.waitLock(TEMPLATES_LOCK_TIMEOUT);
  try {
    const props = PropertiesService.getScriptProperties();
    // Одноразовая миграция из монолита
    _migrateMonolithToPerTemplateIfNeeded_(props);

    const keys = _listTemplateKeysForUser(props, user);
    const prefix = TEMPLATE_KEY_PREFIX + String(user) + ':';
    const result = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const name = key.substring(prefix.length);
      try {
        const raw = props.getProperty(key);
        if (!raw) continue;
        result[name] = JSON.parse(raw);
      } catch (_e) {}
    }
    return result;
  } finally {
    lock.releaseLock();
  }
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

  const lock = LockService.getScriptLock();
  lock.waitLock(TEMPLATES_LOCK_TIMEOUT);
  try {
    const props = PropertiesService.getScriptProperties();
    _migrateMonolithToPerTemplateIfNeeded_(props);
    const key = _buildTemplateKey(user, templateName);
    const raw = props.getProperty(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  } finally {
    lock.releaseLock();
  }
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
    const lock = LockService.getScriptLock();
    lock.waitLock(TEMPLATES_LOCK_TIMEOUT);
    try {
      const props = PropertiesService.getScriptProperties();
      _migrateMonolithToPerTemplateIfNeeded_(props);

      const existingKeys = _listTemplateKeysForUser(props, user);
      const key = _buildTemplateKey(user, templateName);
      const exists = !!props.getProperty(key);
      if (!exists && existingKeys.length >= MAX_TEMPLATES_PER_USER) {
        return {
          success: false,
          message: 'Достигнут лимит шаблонов (' + MAX_TEMPLATES_PER_USER + '). Удалите неиспользуемые.',
        };
      }

      const nowIso = new Date().toISOString();
      let createdIso = nowIso;
      if (exists) {
        try {
          const prev = JSON.parse(props.getProperty(key));
          if (prev && prev.created) createdIso = prev.created;
        } catch (_e) {}
      }

      const templateWithMeta = {
        config: config,
        created: createdIso,
        updated: nowIso,
        version: '1.0',
      };

      const payload = JSON.stringify(templateWithMeta);
      if (payload.length > 8900) {
        return {
          success: false,
          message: 'Шаблон слишком большой для PropertiesService (лимит 9KB на запись)',
        };
      }

      props.setProperty(key, payload);

      const configSize = JSON.stringify(config).length;

      if (typeof addSystemLog === 'function') {
        addSystemLog('Template saved: ' + templateName + ' (' + configSize + ' bytes)', 'INFO', 'TEMPLATE_SERVICE');
      }

      return {
        success: true,
        message: 'Шаблон "' + templateName + '" сохранён',
        size: configSize,
      };
    } finally {
      lock.releaseLock();
    }
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
    const lock = LockService.getScriptLock();
    lock.waitLock(TEMPLATES_LOCK_TIMEOUT);
    try {
      const props = PropertiesService.getScriptProperties();
      _migrateMonolithToPerTemplateIfNeeded_(props);
      const key = _buildTemplateKey(user, templateName);
      const existed = !!props.getProperty(key);
      if (existed) {
        props.deleteProperty(key);
        if (typeof addSystemLog === 'function') {
          addSystemLog('Template deleted: ' + templateName, 'INFO', 'TEMPLATE_SERVICE');
        }
        return {success: true, message: 'Шаблон "' + templateName + '" удалён'};
      }
      return {success: false, message: 'Шаблон "' + templateName + '" не найден'};
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return {success: false, message: 'Ошибка удаления: ' + e.message};
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
    const lock = LockService.getScriptLock();
    lock.waitLock(TEMPLATES_LOCK_TIMEOUT);
    try {
      const props = PropertiesService.getScriptProperties();
      _migrateMonolithToPerTemplateIfNeeded_(props);

      // Удаляем все текущие шаблоны пользователя
      const existingKeys = _listTemplateKeysForUser(props, user);
      for (let i = 0; i < existingKeys.length; i++) {
        props.deleteProperty(existingKeys[i]);
      }

      // Записываем новые
      const names = Object.keys(newTemplates);
      for (let n = 0; n < names.length; n++) {
        const name = names[n];
        const template = newTemplates[name];
        const config = template && template.config ? template.config : template;
        const entry = {
          config: config,
          created: (template && template.created) ? template.created : new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0',
        };
        const payload = JSON.stringify(entry);
        if (payload.length > 8900) {
          return {success: false, message: 'Шаблон "' + name + '" слишком большой для хранения (лимит 9KB)'};
        }
        props.setProperty(_buildTemplateKey(user, name), payload);
      }

      if (typeof addSystemLog === 'function') {
        addSystemLog('All templates replaced for user: ' + templateNames.length + ' templates', 'INFO', 'TEMPLATE_SERVICE');
      }

      return {success: true, message: 'Импортировано ' + templateNames.length + ' шаблонов', count: templateNames.length};
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return {success: false, message: 'Ошибка импорта: ' + e.message};
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
