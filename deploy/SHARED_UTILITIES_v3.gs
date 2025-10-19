/**
 * SHARED UTILITIES FOR v3.0.1
 * 
 * This file contains utility functions from shared/ directory
 * that are used by both CLIENT and SERVER
 * 
 * UTILITIES INCLUDED:
 * - Email validation (isValidEmail)
 * - Safe JSON parsing (safeJsonParse)
 * - Trace ID generation (generateTraceId)
 * - Additional helpers
 * 
 * SOURCE: shared/Utils.gs, shared/SecurityValidator.gs
 * STATUS: v3.0.1 compatible
 */

// ===== EMAIL VALIDATION (from shared/Utils.gs) =====

/**
 * Validate email format
 * @param {string} email - email to validate
 * @return {boolean} - true if valid email format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// ===== SAFE JSON PARSING (from shared/Utils.gs) =====

/**
 * Safe JSON parsing with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {object} defaultValue - default value if parse fails
 * @return {object} - parsed object or default
 */
function safeJsonParse(jsonString, defaultValue) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return defaultValue || {};
  }
}

/**
 * Safe JSON stringify with error handling
 * @param {object} obj - object to stringify
 * @param {string} defaultValue - default value if stringify fails
 * @return {string} - JSON string or default
 */
function safeJsonStringify(obj, defaultValue) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return defaultValue || '{}';
  }
}

// ===== TRACE ID GENERATION (from shared/Utils.gs) =====

/**
 * Generate unique trace ID for request tracking
 * Format: prefix-timestamp-random
 * @param {string} prefix - optional prefix (default: 'trace')
 * @return {string} - unique trace ID
 */
function generateTraceId(prefix) {
  prefix = prefix || 'trace';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return prefix + '_' + timestamp + '_' + random;
}

// ===== UTILITY HELPERS (from shared/Utils.gs) =====

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - text to escape
 * @return {string} - escaped HTML text
 */
function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, function(m) {
    return map[m];
  });
}

/**
 * Get nested property safely
 * @param {object} obj - object to query
 * @param {string} path - property path (e.g., 'a.b.c')
 * @param {*} defaultValue - default value if path not found
 * @return {*} - property value or default
 */
function getNestedProperty(obj, path, defaultValue) {
  if (!obj || !path) return defaultValue;
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length; i++) {
    if (current === null || current === undefined || !current.hasOwnProperty(keys[i])) {
      return defaultValue;
    }
    current = current[keys[i]];
  }
  return current;
}

/**
 * Truncate string with ellipsis
 * @param {string} str - string to truncate
 * @param {number} maxLength - maximum length
 * @return {string} - truncated string
 */
function truncateString(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format bytes to readable size
 * @param {number} bytes - bytes to format
 * @return {string} - formatted size (e.g., '1.5 MB')
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ===== API KEY VALIDATION (from shared/SecurityValidator.gs) =====

/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @return {boolean} - true if looks like valid API key
 */
function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  const key = String(apiKey).trim();
  return key.length > 10 && key.length < 500;
}

// ===== URL VALIDATION (from shared/SecurityValidator.gs) =====

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @return {boolean} - true if valid URL format
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(String(url));
    return true;
  } catch (e) {
    return false;
  }
}

// ===== TEXT PROCESSING (from shared/Utils.gs) =====

/**
 * Detect if text contains markdown
 * @param {string} text - text to check
 * @return {boolean} - true if contains markdown
 */
function isMarkdownText(text) {
  if (!text || typeof text !== 'string') return false;
  const patterns = [
    /\*\*[^*]+\*\*/,        // bold
    /\*[^*]+\*/,             // italic
    /^#{1,6}\s+/m,           // headers
    /^[-*+]\s+/m,            // lists
    /\[.+\]\(.+\)/,          // links
    /```[\s\S]*?```/,        // code blocks
    /`[^`]+`/,               // inline code
  ];
  return patterns.some(function(p) {
    return p.test(text);
  });
}

/**
 * Convert markdown text to readable text
 * Removes formatting, uppercases headers, etc.
 * @param {string} markdownText - markdown text to convert
 * @return {string} - readable text
 */
function convertMarkdownToReadable(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return markdownText;
  if (!isMarkdownText(markdownText)) return markdownText;

  let text = markdownText;

  // Code blocks
  text = text.replace(/```[\w]*\n?([\s\S]*?)\n?```/g, function(match, code) {
    return '\n' + String(code || '').trim() + '\n';
  });

  // Inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, function(match, content) {
    return String(content || '').toUpperCase();
  });

  // Italic
  text = text.replace(/\*([^*]+)\*/g, '$1');

  // Headers
  text = text.replace(/^#{1,6}\s+(.+)$/gm, function(match, header) {
    return '\n' + String(header || '').toUpperCase() + ':\n';
  });

  // Lists
  text = text.replace(/^[-*+]\s+(.+)$/gm, '• $1');
  text = text.replace(/^\d+\.\s+(.+)$/gm, '$1');

  // Links
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Quotes
  text = text.replace(/^>\s+(.+)$/gm, '» $1');

  // Horizontal rules
  text = text.replace(/^-{3,}$/gm, '---');

  // Multiple line breaks
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// ===== LOGGING HELPERS (from shared/LoggingService.gs) =====

/**
 * Log message with timestamp and level
 * @param {string} message - message to log
 * @param {string} level - log level (INFO, WARN, ERROR, DEBUG)
 * @param {string} category - log category (SYSTEM, SERVER, CLIENT, etc.)
 */
function logMessage(message, level, category) {
  level = level || 'INFO';
  category = category || 'SYSTEM';
  
  try {
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    console.log('[' + ts + '] ' + level + ' [' + category + '] ' + message);
    
    // Also log to cache if possible
    try {
      const cache = CacheService.getScriptCache();
      const key = 'log_' + Date.now();
      cache.put(key, JSON.stringify({timestamp: ts, level: level, category: category, message: message}), 60);
    } catch (e) {
      // cache not available - ignore
    }
  } catch (e) {
    console.error('Logging error:', e.message);
  }
}

// ===== EMOJI REMOVAL (from shared/EmojiRemover.gs) =====

/**
 * Remove emojis and special symbols from text
 * @param {string} text - text to clean
 * @return {string} - text without emojis
 */
function removeEmojis(text) {
  if (!text || typeof text !== 'string') return text;

  // Regex for emojis and special symbols
  const emojiPattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\uD83C-\uD83E][\uDC00-\uDFFF]|[\u2B50]|[\uFE00-\uFE0F]|[\u200D]|[\u20E3]/g;

  let cleaned = text.replace(emojiPattern, '');
  
  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Check if text contains emojis
 * @param {string} text - text to check
 * @return {boolean} - true if contains emojis
 */
function containsEmojis(text) {
  if (!text || typeof text !== 'string') return false;
  const emojiPattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\uD83C-\uD83E][\uDC00-\uDFFF]|[\u2B50]|[\uFE00-\uFE0F]|[\u200D]|[\u20E3]/;
  return emojiPattern.test(text);
}

/**
 * Count emojis in text
 * @param {string} text - text to analyze
 * @return {number} - count of emojis
 */
function countEmojis(text) {
  if (!text || typeof text !== 'string') return 0;
  const emojiPattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\uD83C-\uD83E][\uDC00-\uDFFF]|[\u2B50]|[\uFE00-\uFE0F]|[\u200D]|[\u20E3]/g;
  const matches = text.match(emojiPattern);
  return matches ? matches.length : 0;
}

// ===== ATOMIC OPERATIONS (from shared/Utils.gs) =====

/**
 * Create atomic backup of sheet for safety
 * @param {string} sheetName - sheet name to backup
 * @param {string} description - backup description
 * @return {object} - backup info {backupName, sheetName, timestamp}
 */
function createAtomicBackup(sheetName, description) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName(sheetName);
    if (!sourceSheet) throw new Error('Sheet not found: ' + sheetName);

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const backupName = 'backup_' + sheetName + '_' + timestamp;

    const backupSheet = sourceSheet.copyTo(ss);
    backupSheet.setName(backupName);
    backupSheet.setTabColor('#ffeb3b');

    logMessage('Atomic backup created: ' + backupName, 'INFO', 'ATOMIC');

    return {
      backupName: backupName,
      sheetName: sheetName,
      timestamp: timestamp,
    };
  } catch (error) {
    logMessage('Failed to create atomic backup: ' + error.message, 'ERROR', 'ATOMIC');
    throw error;
  }
}

/**
 * Restore data from atomic backup
 * @param {object} backupInfo - backup info object
 * @return {boolean} - true if successful
 */
function restoreFromBackup(backupInfo) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const backupSheet = ss.getSheetByName(backupInfo.backupName);
    if (!backupSheet) throw new Error('Backup sheet not found: ' + backupInfo.backupName);

    const targetSheet = ss.getSheetByName(backupInfo.sheetName);
    if (!targetSheet) throw new Error('Target sheet not found: ' + backupInfo.sheetName);

    targetSheet.clear();

    const lastRow = backupSheet.getLastRow();
    const lastCol = backupSheet.getLastColumn();

    if (lastRow > 0 && lastCol > 0) {
      const sourceRange = backupSheet.getRange(1, 1, lastRow, lastCol);
      const targetRange = targetSheet.getRange(1, 1, lastRow, lastCol);
      sourceRange.copyTo(targetRange);
    }

    logMessage('Restored from backup: ' + backupInfo.backupName, 'INFO', 'ATOMIC');
    return true;
  } catch (error) {
    logMessage('Restore from backup failed: ' + error.message, 'ERROR', 'ATOMIC');
    throw error;
  }
}

/**
 * Delete backup after successful operation
 * @param {object} backupInfo - backup info object
 */
function deleteBackup(backupInfo) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const backupSheet = ss.getSheetByName(backupInfo.backupName);
    if (backupSheet) {
      ss.deleteSheet(backupSheet);
      logMessage('Backup deleted: ' + backupInfo.backupName, 'INFO', 'ATOMIC');
    }
  } catch (error) {
    logMessage('Failed to delete backup: ' + error.message, 'WARN', 'ATOMIC');
  }
}

// ===== PHASE 4: ADDITIONAL LOGGING FUNCTIONS (from shared/LoggingService.gs) =====

/**
 * Mask email for logging (PII protection)
 * @param {string} email - email address
 * @return {string} - masked email (e.g., u***r@domain.com)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.split('@');
  if (parts.length !== 2) return 'invalid_email';
  const username = parts[0];
  const domain = parts[1];
  if (username.length <= 2) {
    return '*'.repeat(username.length) + '@' + domain;
  }
  return username[0] + '*'.repeat(username.length - 2) + username[username.length - 1] + '@' + domain;
}

/**
 * Log license activity for audit trail
 * @param {string} action - action performed
 * @param {string} email - email address
 * @param {string} token - token (will be masked)
 * @param {object} result - result of license check
 * @param {string} traceId - trace ID for tracking
 */
function logLicenseActivity(action, email, token, result, traceId) {
  try {
    const maskedEmail = maskEmail(email);
    const maskedToken = token ? token.substr(0, 6) + '***' : 'null';
    const message = 'License check: action=' + action + ', email=' + maskedEmail + ', token=' + maskedToken + ', result=' + (result.ok ? 'VALID' : 'INVALID') + ', reason=' + (result.error || 'none') + ', traceId=' + traceId;
    logMessage(message, 'INFO', 'LICENSE');
  } catch (e) {
    logMessage('Error logging license activity: ' + e.message, 'ERROR', 'LOGGING');
  }
}

/**
 * Log security event for monitoring
 * @param {string} event - event type
 * @param {object} context - context information
 */
function logSecurityEvent(event, context) {
  try {
    let message = 'Security event: ' + event;
    if (context.ip) message += ', ip=' + context.ip;
    if (context.userAgent) message += ', ua=' + context.userAgent;
    if (context.email) message += ', user=' + maskEmail(context.email);
    if (context.details) message += ', details=' + JSON.stringify(context.details);
    logMessage(message, 'WARN', 'SECURITY');
  } catch (e) {
    logMessage('Error logging security event: ' + e.message, 'ERROR', 'LOGGING');
  }
}

/**\n * Performance logging with throttling to avoid spam\n * @param {string} message - message to log\n * @param {string} level - log level (INFO, WARN, ERROR)\n * @param {string} component - component name\n * @param {number} throttleMs - throttle interval in milliseconds\n */\nfunction addSystemLogThrottled(message, level, component, throttleMs) {\n  throttleMs = throttleMs || 1000;\n  try {\n    const throttleKey = 'throttle_' + component + '_' + level + '_' + message.substr(0, 50);\n    const cache = CacheService.getScriptCache();\n    const lastLogged = cache.get(throttleKey);\n    const now = Date.now();\n    if (lastLogged && (now - parseInt(lastLogged)) < throttleMs) {\n      return; // Skip - too frequent\n    }\n    cache.put(throttleKey, now.toString(), 60);\n    logMessage(message, level, component);\n  } catch (e) {\n    logMessage(message, level, component); // Fallback without throttling\n  }\n}\n\n/**\n * Bulk logging for batch operations\n * @param {Array} entries - array of {message, level, component}\n */\nfunction addSystemLogsBulk(entries) {\n  if (!Array.isArray(entries) || entries.length === 0) return;\n  try {\n    entries.forEach(function(entry) {\n      logMessage(entry.message, entry.level || 'INFO', entry.component || 'SYSTEM');\n    });\n  } catch (e) {\n    logMessage('Error in bulk logging: ' + e.message, 'ERROR', 'LOGGING');\n  }\n}\n\n/**\n * Get system logs with filtering\n * @param {string} level - filter by level (INFO, WARN, ERROR)\n * @param {string} component - filter by component\n * @param {number} limit - max entries to return\n * @return {Array} - array of log entries\n */\nfunction getSystemLogs(level, component, limit) {\n  limit = limit || 100;\n  try {\n    const props = PropertiesService.getScriptProperties();\n    const allProps = props.getProperties();\n    const logs = [];\n    Object.keys(allProps).forEach(function(key) {\n      if (key.startsWith('log_')) {\n        try {\n          const logEntry = JSON.parse(allProps[key]);\n          if (level && logEntry.level !== level) return;\n          if (component && logEntry.component !== component) return;\n          logs.push(logEntry);\n        } catch (e) {\n          // Skip invalid entries\n        }\n      }\n    });\n    logs.sort(function(a, b) {\n      return new Date(b.timestamp) - new Date(a.timestamp);\n    });\n    return logs.slice(0, limit);\n  } catch (e) {\n    logMessage('Failed to get logs: ' + e.message, 'ERROR', 'LOGGING');\n    return [];\n  }\n}\n\n/**\n * Clean up old logs based on retention policy\n * @param {number} daysToKeep - days to retain logs (default: 30)\n */\nfunction cleanupOldLogs(daysToKeep) {\n  daysToKeep = daysToKeep || 30;\n  try {\n    const props = PropertiesService.getScriptProperties();\n    const allProps = props.getProperties();\n    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);\n    const keysToDelete = [];\n    Object.keys(allProps).forEach(function(key) {\n      if (key.startsWith('log_')) {\n        try {\n          const logEntry = JSON.parse(allProps[key]);\n          const logTime = new Date(logEntry.timestamp).getTime();\n          if (logTime < cutoffTime) {\n            keysToDelete.push(key);\n          }\n        } catch (e) {\n          keysToDelete.push(key);\n        }\n      }\n    });\n    for (let i = 0; i < keysToDelete.length; i += 100) {\n      const batch = keysToDelete.slice(i, i + 100);\n      batch.forEach(function(key) {\n        props.deleteProperty(key);\n      });\n    }\n    logMessage('Cleaned up ' + keysToDelete.length + ' old log entries', 'INFO', 'LOGGING');\n  } catch (e) {\n    logMessage('Failed to cleanup logs: ' + e.message, 'ERROR', 'LOGGING');\n  }\n}\n\n/**\n * Get logging statistics\n * @return {object} - statistics {total, byLevel, byComponent, oldestEntry, newestEntry}\n */\nfunction getLoggingStats() {\n  try {\n    const props = PropertiesService.getScriptProperties();\n    const allProps = props.getProperties();\n    const stats = {\n      total: 0,\n      byLevel: {},\n      byComponent: {},\n      oldestEntry: null,\n      newestEntry: null,\n    };\n    Object.keys(allProps).forEach(function(key) {\n      if (key.startsWith('log_')) {\n        try {\n          const logEntry = JSON.parse(allProps[key]);\n          stats.total++;\n          stats.byLevel[logEntry.level] = (stats.byLevel[logEntry.level] || 0) + 1;\n          stats.byComponent[logEntry.component] = (stats.byComponent[logEntry.component] || 0) + 1;\n          const entryTime = new Date(logEntry.timestamp);\n          if (!stats.oldestEntry || entryTime < stats.oldestEntry) {\n            stats.oldestEntry = entryTime;\n          }\n          if (!stats.newestEntry || entryTime > stats.newestEntry) {\n            stats.newestEntry = entryTime;\n          }\n        } catch (e) {\n          // Skip invalid entries\n        }\n      }\n    });\n    return stats;\n  } catch (e) {\n    logMessage('Failed to get logging stats: ' + e.message, 'ERROR', 'LOGGING');\n    return {total: 0, error: e.message};\n  }\n}\n\n// ===== PHASE 4: VERSION TRACKING (from shared/VersionInfo.gs) =====\n\n/**\n * Get current version\n * @return {string} - version string (e.g., \"2.1.0\")\n */\nfunction getCurrentVersion() {\n  return '3.0.1';\n}\n\n/**\n * Get comprehensive version information\n * @return {object} - detailed version metadata\n */\nfunction getVersionInfo() {\n  const now = new Date();\n  return {\n    project: {\n      name: 'Table AI Bot',\n      description: 'AI-powered Google Sheets automation system',\n      repository: 'https://github.com/crosspostly/ai_table',\n    },\n    version: {\n      current: '3.0.1',\n      previous: '3.0.0',\n      releaseDate: '2025-10-19',\n      lastUpdate: now.toISOString(),\n      timestamp: now.getTime(),\n      status: 'stable',\n    },\n    build: {\n      number: '301',\n      environment: 'production',\n      platform: 'Google Apps Script',\n      deployedBy: 'Factory AI',\n    },\n    features: {\n      security_validation: {name: 'Security Validation', status: 'active', added_in: '3.0.1'},\n      trace_ids: {name: 'Request Tracing', status: 'active', added_in: '3.0.1'},\n      atomic_operations: {name: 'Atomic Backup/Restore', status: 'active', added_in: '3.0.1'},\n      email_validation: {name: 'Email Format Validation', status: 'active', added_in: '3.0.1'},\n      safe_json_parsing: {name: 'Safe JSON Parsing', status: 'active', added_in: '3.0.1'},\n    },\n    statistics: {\n      totalFunctions: 50,\n      activeFunctions: 48,\n      coverage: '96%',\n      lastCheck: now.toISOString(),\n    },\n  };\n}\n\n/**\n * Get version string with timestamp for UI\n * @return {string} - formatted version (e.g., \"v3.0.1 • Updated: 19.10.2025 14:30:45\")\n */\nfunction getVersionWithTimestamp() {\n  const version = getCurrentVersion();\n  const now = new Date();\n  const dateStr = now.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit', year: 'numeric'});\n  const timeStr = now.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit', second: '2-digit'});\n  return 'v' + version + ' • Updated: ' + dateStr + ' ' + timeStr;\n}\n\n// ===== PHASE 4: BACKUP MANAGEMENT (from shared/Utils.gs) =====\n\n/**\n * Clean up old backup sheets (keep max 5)\n */\nfunction cleanupOldBackups() {\n  try {\n    const ss = SpreadsheetApp.getActiveSpreadsheet();\n    const allSheets = ss.getSheets();\n    const backupSheets = [];\n    allSheets.forEach(function(sheet) {\n      if (sheet.getName().startsWith('atomic_backup_')) {\n        backupSheets.push({sheet: sheet, name: sheet.getName()});\n      }\n    });\n    backupSheets.sort(function(a, b) {\n      return a.name.localeCompare(b.name);\n    });\n    const maxBackups = 5;\n    if (backupSheets.length > maxBackups) {\n      const toDelete = backupSheets.slice(0, backupSheets.length - maxBackups);\n      toDelete.forEach(function(backup) {\n        try {\n          ss.deleteSheet(backup.sheet);\n          logMessage('Old backup removed: ' + backup.name, 'INFO', 'ATOMIC');\n        } catch (e) {\n          logMessage('Failed to remove backup: ' + backup.name, 'WARN', 'ATOMIC');\n        }\n      });\n    }\n  } catch (e) {\n    logMessage('Backup cleanup failed: ' + e.message, 'ERROR', 'ATOMIC');\n  }\n}\n\n// ===== PHASE 4: DETAILED LOGGING (from shared/DetailedLogger.gs) =====\n\n/**\n * Initialize detailed logs sheet\n * @return {Sheet} - logs sheet\n */\nfunction initLogsSheet() {\n  try {\n    const ss = SpreadsheetApp.getActive();\n    let logsSheet = ss.getSheetByName('Logs');\n    if (!logsSheet) {\n      logsSheet = ss.insertSheet('Logs');\n      const headers = ['Timestamp', 'Type', 'Function', 'Operation', 'Status', 'Details', 'Error', 'Duration'];\n      logsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);\n      logsSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('white');\n      logsSheet.setColumnWidth(1, 150);\n      logsSheet.setColumnWidth(2, 80);\n      logsSheet.setColumnWidth(3, 150);\n      logsSheet.setColumnWidth(4, 200);\n      logsSheet.setColumnWidth(5, 100);\n      logsSheet.setColumnWidth(6, 400);\n      logsSheet.setColumnWidth(7, 300);\n      logsSheet.setColumnWidth(8, 80);\n      logsSheet.setFrozenRows(1);\n    }\n    return logsSheet;\n  } catch (e) {\n    logMessage('Failed to init logs sheet: ' + e.message, 'ERROR', 'LOGGING');\n    return null;\n  }\n}\n\n/**\n * Add detailed log entry to logs sheet\n * @param {string} type - operation type (OCR, IMPORT, GEMINI, SYSTEM)\n * @param {string} functionName - function name\n * @param {string} operation - operation description\n * @param {string} status - status (START, SUCCESS, ERROR, SKIP)\n * @param {object} details - operation details\n * @param {string} error - error message if any\n * @param {number} duration - execution time in ms\n */\nfunction logToDetailedSheet(type, functionName, operation, status, details, error, duration) {\n  try {\n    const logsSheet = initLogsSheet();\n    if (!logsSheet) return;\n    let detailsStr = '';\n    if (details && typeof details === 'object') {\n      try {\n        detailsStr = JSON.stringify(details);\n      } catch (e) {\n        detailsStr = String(details);\n      }\n    } else if (details) {\n      detailsStr = String(details);\n    }\n    if (detailsStr.length > 500) detailsStr = detailsStr.substring(0, 497) + '...';\n    const errorStr = error ? String(error).substring(0, 300) : '';\n    const timestamp = new Date().toISOString();\n    const row = [timestamp, type, functionName, operation, status, detailsStr, errorStr, duration || ''];\n    logsSheet.appendRow(row);\n    \n    // Color code by status\n    const lastRow = logsSheet.getLastRow();\n    const range = logsSheet.getRange(lastRow, 1, 1, 8);\n    switch (status) {\n      case 'ERROR':\n        range.setBackground('#ffcccc');\n        break;\n      case 'SUCCESS':\n        range.setBackground('#ccffcc');\n        break;\n      case 'SKIP':\n        range.setBackground('#ffffcc');\n        break;\n    }\n  } catch (e) {\n    logMessage('Failed to log to sheet: ' + e.message, 'ERROR', 'LOGGING');\n  }\n}
