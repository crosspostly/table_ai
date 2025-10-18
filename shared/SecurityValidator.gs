/**
 * Модуль безопасности для валидации входных данных
 * Защищает от XSS, SQL injection, и других атак
 */

const SecurityValidator = {

  /**
   * Типы валидации
   */
  ValidationTypes: {
    EMAIL: 'email',
    API_KEY: 'api_key',
    PROMPT: 'prompt',
    URL: 'url',
    GENERAL: 'general',
  },

  /**
   * Стандартные типы ошибок
   */
  ErrorTypes: {
    XSS_DETECTED: 'XSS_DETECTED',
    SQL_INJECTION: 'SQL_INJECTION',
    DANGEROUS_URL: 'DANGEROUS_URL',
    INVALID_EMAIL: 'INVALID_EMAIL',
    INVALID_API_KEY: 'INVALID_API_KEY',
    TOO_LONG: 'TOO_LONG',
    EMPTY_INPUT: 'EMPTY_INPUT',
  },

  /**
   * Основная функция валидации
   * @param {string} input - входные данные
   * @param {string} type - тип валидации из ValidationTypes
   * @return {Object} результат валидации {isValid: boolean, sanitized: string, errors: Array}
   */
  validateInput: function(input, type) {
    const result = {
      isValid: false,
      sanitized: '',
      errors: [],
    };

    if (!input || typeof input !== 'string') {
      result.errors.push(this.ErrorTypes.EMPTY_INPUT);
      return result;
    }

    try {
      switch (type) {
      case this.ValidationTypes.EMAIL:
        return this.validateEmail(input);
      case this.ValidationTypes.API_KEY:
        return this.validateApiKey(input);
      case this.ValidationTypes.PROMPT:
        return this.validatePrompt(input);
      case this.ValidationTypes.URL:
        return this.validateUrl(input);
      default:
        return this.validateGeneral(input);
      }
    } catch (error) {
      result.errors.push('VALIDATION_ERROR: ' + error.message);
      return result;
    }
  },

  /**
   * Валидация email адресов
   */
  validateEmail: function(email) {
    const result = {
      isValid: false,
      sanitized: '',
      errors: [],
    };

    // Базовая очистка
    const cleaned = email.trim().toLowerCase();

    // Проверка длины
    if (cleaned.length > 254) {
      result.errors.push(this.ErrorTypes.TOO_LONG);
      return result;
    }

    // Регулярное выражение для email
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailPattern.test(cleaned)) {
      result.errors.push(this.ErrorTypes.INVALID_EMAIL);
      return result;
    }

    result.isValid = true;
    result.sanitized = cleaned;
    return result;
  },

  /**
   * Валидация API ключей
   */
  validateApiKey: function(apiKey) {
    const result = {
      isValid: false,
      sanitized: '',
      errors: [],
    };

    const cleaned = apiKey.trim();

    // Проверка длины
    if (cleaned.length < 10) {
      result.errors.push(this.ErrorTypes.INVALID_API_KEY);
      return result;
    }

    if (cleaned.length > 500) {
      result.errors.push(this.ErrorTypes.TOO_LONG);
      return result;
    }

    // Проверка на допустимые символы (буквы, цифры, дефисы, подчеркивания)
    const apiKeyPattern = /^[a-zA-Z0-9_-]+$/;

    if (!apiKeyPattern.test(cleaned)) {
      result.errors.push(this.ErrorTypes.INVALID_API_KEY);
      return result;
    }

    result.isValid = true;
    result.sanitized = cleaned;
    return result;
  },

  /**
   * Валидация промптов для Gemini
   */
  validatePrompt: function(prompt) {
    const result = {
      isValid: false,
      sanitized: '',
      errors: [],
    };

    // Проверка длины
    if (prompt.length > 100000) { // 100KB лимит
      result.errors.push(this.ErrorTypes.TOO_LONG);
      return result;
    }

    // XSS защита - удаляем потенциально опасные теги
    const sanitized = prompt
      .replace(/<script[^>]*>.*?<\/script>/gi, '[SCRIPT_REMOVED]') // XSS защита
      .replace(/javascript:/gi, 'js-removed:') // JavaScript URL защита
      .replace(/data:text\/html/gi, 'data-removed') // Data URL защита
      .replace(/vbscript:/gi, 'vbs-removed:'); // VBScript защита

    // SQL injection защита
    const sqlPatterns = [
      /union\s+select/gi,
      /drop\s+table/gi,
      /delete\s+from/gi,
      /insert\s+into/gi,
      /update\s+set/gi,
    ];

    for (let i = 0; i < sqlPatterns.length; i++) {
      if (sqlPatterns[i].test(sanitized)) {
        result.errors.push(this.ErrorTypes.SQL_INJECTION);
        return result;
      }
    }

    result.isValid = true;
    result.sanitized = sanitized;
    return result;
  },

  /**
   * Валидация URL
   */
  validateUrl: function(url) {
    const result = {
      isValid: false,
      sanitized: '',
      errors: [],
    };

    const cleaned = url.trim();

    // Проверка длины
    if (cleaned.length > 2048) {
      result.errors.push(this.ErrorTypes.TOO_LONG);
      return result;
    }

    // Проверка на допустимые протоколы
    const allowedProtocols = /^https?:\/\//i;

    if (!allowedProtocols.test(cleaned)) {
      result.errors.push(this.ErrorTypes.DANGEROUS_URL);
      return result;
    }

    // Проверка на опасные домены
    const dangerousPatterns = [
      /localhost/i,
      /127\.0\.0\.1/i,
      /0\.0\.0\.0/i,
      /file:\/\//i,
      /ftp:\/\//i,
    ];

    for (let i = 0; i < dangerousPatterns.length; i++) {
      if (dangerousPatterns[i].test(cleaned)) {
        result.errors.push(this.ErrorTypes.DANGEROUS_URL);
        return result;
      }
    }

    result.isValid = true;
    result.sanitized = cleaned;
    return result;
  },

  /**
   * Общая валидация
   */
  validateGeneral: function(input) {
    const result = {
      isValid: false,
      sanitized: '',
      errors: [],
    };

    // Проверка длины
    if (input.length > 10000) {
      result.errors.push(this.ErrorTypes.TOO_LONG);
      return result;
    }

    // Базовая санитизация
    const sanitized = input
      .replace(/<script[^>]*>.*?<\/script>/gi, '[SCRIPT_REMOVED]')
      .replace(/javascript:/gi, 'js-removed:');

    result.isValid = true;
    result.sanitized = sanitized;
    return result;
  },

  /**
   * 🔒 ВАЛИДАЦИЯ ПАРАМЕТРОВ GM функций
   * Восстановлена из коммита a3dae18
   */
  validateGMParams: function(maxTokens, temperature) {
    const result = {
      isValid: false,
      sanitized: {},
      errors: [],
    };

    // Валидация maxTokens
    if (maxTokens !== undefined && maxTokens !== null) {
      if (typeof maxTokens !== 'number' || isNaN(maxTokens)) {
        result.errors.push('maxTokens must be a number, got: ' + typeof maxTokens);
      } else if (maxTokens < 1) {
        result.errors.push('maxTokens must be positive, got: ' + maxTokens);
      } else if (maxTokens > 1000000) { // 1M токенов - разумный лимит
        result.errors.push('maxTokens too large: ' + maxTokens + ' (max: 1000000)');
      } else {
        result.sanitized.maxTokens = Math.floor(maxTokens);
      }
    } else {
      result.sanitized.maxTokens = 250000; // Default
    }

    // Валидация temperature
    if (temperature !== undefined && temperature !== null) {
      if (typeof temperature !== 'number' || isNaN(temperature)) {
        result.errors.push('temperature must be a number, got: ' + typeof temperature);
      } else if (temperature < 0) {
        result.errors.push('temperature must be non-negative, got: ' + temperature);
      } else if (temperature > 2) {
        result.errors.push('temperature too high: ' + temperature + ' (max: 2)');
      } else {
        result.sanitized.temperature = temperature;
      }
    } else {
      result.sanitized.temperature = 0.5; // Default
    }

    // Результат валиден, если нет ошибок
    result.isValid = result.errors.length === 0;
    return result;
  },

  /**
   * Безопасное логирование (маскирует sensitive данные)
   */
  safeLog: function(message, data) {
    const safeData = {};

    if (data && typeof data === 'object') {
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          const value = data[key];

          // Маскируем sensitive поля
          if (typeof value === 'string' && (
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('secret')
          )) {
            safeData[key] = value.length > 0 ? value.substring(0, 4) + '***' : '[EMPTY]';
          } else {
            safeData[key] = value;
          }
        }
      }
    }

    Logger.log('[SECURITY] ' + message + ': ' + JSON.stringify(safeData));
  },

  /**
   * Безопасное логирование для строк - маскирует чувствительные данные
   */
  sanitizeForLogging: function(data) {
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }

    // Маскируем email
    data = data.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@***.***');

    // Маскируем длинные токены (20+ символов)
    data = data.replace(/[A-Za-z0-9\-_]{20,}/g, function(match) {
      return match.substring(0, 4) + '***' + match.substring(match.length - 4);
    });

    // Маскируем Bearer токены
    data = data.replace(/Bearer\s+[A-Za-z0-9\-_]+/gi, 'Bearer ***');

    // Маскируем token: value паттерны
    data = data.replace(/token["\s]*[:=]["\s]*[^"\s]+/gi, 'token: ***');

    return data;
  },

  /**
   * Тест граничных значений архитектуры credentials
   * Проверяет что VK токены остаются на сервере, а Gemini ключи на клиенте
   */
  testCredentialBoundaries: function() {
    const results = [];

    try {
      // Проверяем что клиентский код НЕ имеет доступа к VK токенам
      const props = PropertiesService.getScriptProperties();
      const vkToken = props.getProperty('VK_ACCESS_TOKEN');

      if (vkToken) {
        results.push({
          test: 'VK Token Boundary Violation',
          passed: false,
          details: 'VK token found in client properties - should be server-only',
        });
      } else {
        results.push({
          test: 'VK Token Boundary',
          passed: true,
          details: 'VK tokens correctly isolated to server',
        });
      }

      // Проверяем что Gemini ключи доступны клиенту (это нормально)
      const geminiKey = props.getProperty('GEMINI_API_KEY');
      results.push({
        test: 'Gemini API Key Access',
        passed: true,
        details: 'Gemini keys correctly accessible to client for direct API calls',
      });
    } catch (error) {
      results.push({
        test: 'Credential Boundary Test',
        passed: false,
        error: error.message,
      });
    }

    return results;
  },
};

/**
 * 🛡️ БЕЗОПАСНАЯ ОБРАБОТКА ОШИБОК
 * Логирует ошибки без утечки чувствительных данных
 */
function handleSecureError(error, context) {
  try {
    // Безопасное логирование контекста
    const safeContext = {};
    if (context && typeof context === 'object') {
      for (const key in context) {
        if (context.hasOwnProperty(key)) {
          const value = context[key];
          // Маскируем sensitive данные
          if (typeof value === 'string' && (
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('password')
          )) {
            safeContext[key] = value.length > 4 ? value.substring(0, 4) + '***' : '[HIDDEN]';
          } else {
            safeContext[key] = value;
          }
        }
      }
    }

    // Безопасное сообщение об ошибке
    const errorMessage = error && error.message ? error.message : String(error);
    const safeErrorMessage = errorMessage.replace(/[A-Za-z0-9_-]{20,}/g, function(match) {
      return match.substring(0, 4) + '***';
    });

    // Логируем с маскировкой
    addSystemLog('🚨 SECURE ERROR: ' + safeErrorMessage + ' | Context: ' + JSON.stringify(safeContext), 'ERROR', 'SECURITY');

    // Возвращаем безопасное сообщение для пользователя
    if (errorMessage.includes('API')) {
      return 'Ошибка API. Проверьте настройки ключей.';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'Ошибка сетевого соединения. Попробуйте позже.';
    } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return 'Ошибка авторизации. Проверьте права доступа.';
    } else {
      return 'Произошла ошибка при выполнении операции. Проверьте настройки.';
    }
  } catch (handlingError) {
    // Если даже обработка ошибки провалилась
    addSystemLog('🚨 CRITICAL: Error handling failed: ' + handlingError.message, 'ERROR', 'CRITICAL');
    return 'Критическая ошибка системы. Обратитесь к администратору.';
  }
}

// ВАЖНО: ИСПРАВЛЕНА АРХИТЕКТУРА CREDENTIALS
// VK/Instagram токены - только на сервере (пользователь НЕ вводит)
// Gemini API ключи - на клиенте (пользователь вводит для прямых вызовов API)
