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
