/**
 * TABLE AI - CLIENT v3.0.0 REFACTORED
 * Google Sheets Container-bound Script
 * 
 * ARCHITECTURE: CLIENT = UI ONLY
 * - All business logic is on SERVER
 * - All Gemini calls go through SERVER
 * - CLIENT only handles: menus, dialogs, Sheet operations
 * 
 * USED SHARED UTILITIES:
 * - shared/SecurityValidator.gs
 * - shared/LoggingService.gs
 * - shared/Utils.gs
 * - shared/Constants.gs
 */

// ============================================================
// 1. CONSTANTS & CONFIGURATION
// ============================================================

// SERVICE URLS
const VK_PARSER_URL = 'https://script.google.com/macros/s/AKfycbzttbqz16EmmcXbEYCuYhNlXkCxAnCG77phspFL1_rTCi4xVqoorByJAPa4dI4iwT8/exec';
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// LOGGING CONFIGURATION
const LOGS_CACHE_KEY = 'SYSTEM_LOGS';
const MAX_LOGS = 300;
const LOGS_TTL = 86400; // 24 hours

// SETTINGS
const DEV_MODE = true;

// ============================================================
// 2. LOGGING UTILITIES
// ============================================================

/**
 * Add log entry to cache
 */
function addLog(msg, level = 'INFO') {
  try {
    const cache = CacheService.getScriptCache();
    let logs = cache.get(LOGS_CACHE_KEY);
    logs = logs ? JSON.parse(logs) : [];
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    logs.push({timestamp: ts, level: level, message: msg});
    if (logs.length > MAX_LOGS) logs.shift();
    cache.put(LOGS_CACHE_KEY, JSON.stringify(logs), LOGS_TTL);
    console.log(`[${ts}] ${level}: ${msg}`);
  } catch (e) {
    console.error('Log write error:', e.message);
  }
}

/**
 * Get logs from cache
 */
function getLogs(limit = 100) {
  try {
    const cache = CacheService.getScriptCache();
    const logs = cache.get(LOGS_CACHE_KEY);
    if (!logs) return 'No logs.';
    const arr = JSON.parse(logs);
    const recent = arr.slice(-limit);
    return recent.map((x) => `[${x.timestamp}] ${x.level}: ${x.message}`).join('\n');
  } catch (e) {
    return 'Error reading logs: ' + e.message;
  }
}

/**
 * Clear logs from cache
 */
function clearLogs() {
  try {
    CacheService.getScriptCache().remove(LOGS_CACHE_KEY);
    addLog('✅ Logs cleared', 'INFO');
    SpreadsheetApp.getUi().alert('Logs cleared.');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error clearing logs: ' + e.message);
  }
}

// ============================================================
// 3. UI DIALOGS & MENUS
// ============================================================

/**
 * Show logs dialog
 */
function showLogsDialog() {
  try {
    SpreadsheetApp.getUi().alert('📝 Recent Logs (100)', getLogs(100), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error showing logs: ' + e.message);
  }
}

/**
 * Export logs to Sheet
 */
function exportLogsToSheet() {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('Logs') || ss.insertSheet('Logs');
    const cache = CacheService.getScriptCache();
    const logs = cache.get(LOGS_CACHE_KEY);
    if (!logs) {
      SpreadsheetApp.getUi().alert('No logs to export.');
      return;
    }
    const logEntries = JSON.parse(logs);
    const data = [['Time', 'Level', 'Message']];
    logEntries.forEach((e) => data.push([e.timestamp, e.level, e.message]));
    sheet.clear();
    sheet.getRange(1, 1, data.length, 3).setValues(data);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#E8F0FE');
    sheet.autoResizeColumns(1, 3);
    addLog('✅ Logs exported', 'INFO');
    SpreadsheetApp.getUi().alert('Logs exported to "Logs" sheet.');
  } catch (e) {
    addLog('❌ Error exporting logs: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Error exporting logs: ' + e.message);
  }
}

/**
 * Show Gemini key help
 */
function showGeminiKeyHelp() {
  try {
    const helpText = 'To use Gemini:' +
      '\n1. Get API key from https://aistudio.google.com/app/apikey' +
      '\n2. Copy the key' +
      '\n3. Go to Settings → Set Gemini Key' +
      '\n4. Paste and save';
    SpreadsheetApp.getUi().alert('Gemini Setup', helpText, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error showing help: ' + e.message);
  }
}

// ============================================================
// 4. SETTINGS MANAGEMENT
// ============================================================

/**
 * Get stored Gemini API key
 */
function getGeminiApiKey() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('GEMINI_API_KEY') || '';
  } catch (e) {
    addLog('❌ Error reading Gemini key: ' + e.message, 'ERROR');
    return '';
  }
}

/**
 * Get stored license email
 */
function getLicenseEmail() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('LICENSE_EMAIL') || '';
  } catch (e) {
    return '';
  }
}

/**
 * Get stored license token
 */
function getLicenseToken() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('LICENSE_TOKEN') || '';
  } catch (e) {
    return '';
  }
}

/**
 * Get all settings data
 */
function getSettingsData() {
  try {
    const props = PropertiesService.getScriptProperties();
    return {
      gemini_key: props.getProperty('GEMINI_API_KEY') || '',
      email: props.getProperty('LICENSE_EMAIL') || '',
      token: props.getProperty('LICENSE_TOKEN') || '',
    };
  } catch (e) {
    addLog('Error reading settings: ' + e.message, 'ERROR');
    return {gemini_key: '', email: '', token: ''};
  }
}

/**
 * Save all settings data
 */
function saveSettingsData(data) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (data.gemini_key) props.setProperty('GEMINI_API_KEY', data.gemini_key);
    if (data.email) props.setProperty('LICENSE_EMAIL', data.email);
    if (data.token) props.setProperty('LICENSE_TOKEN', data.token);
    addLog('✅ Settings saved', 'INFO');
    return {ok: true};
  } catch (e) {
    addLog('❌ Error saving settings: ' + e.message, 'ERROR');
    return {ok: false, error: e.message};
  }
}

/**
 * SECURITY: Validate email format (from shared/Utils.gs)
 */
function isValidEmail_(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Set license credentials via UI with validation
 */
function setLicenseCredentialsUI() {
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt('Enter license credentials:\nFormat: email|token');
    if (response.getSelectedButton() !== ui.Button.OK) return;
    const input = response.getResponseText().trim();
    const [email, token] = input.split('|').map(s => s.trim());
    if (!email || !token) {
      ui.alert('Error: Please enter both email and token');
      return;
    }
    // SECURITY: Validate email format
    if (!isValidEmail_(email)) {
      ui.alert('Error: Invalid email format. Please enter a valid email address.');
      return;
    }
    saveSettingsData({email: email, token: token});
    ui.alert('License credentials saved.');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

// ============================================================
// 5. LICENSE & STATUS
// ============================================================

/**
 * Call SERVER to check license status
 * Returns: {ok: boolean, remaining_calls?: number, expiry?: string}
 */
function serverStatus_() {
  try {
    const email = getLicenseEmail();
    const token = getLicenseToken();
    if (!email || !token) {
      return {ok: false, error: 'LICENSE_NOT_SET'};
    }
    const payload = {
      action: 'status',
      email: email,
      token: token,
    };
    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };
    const response = UrlFetchApp.fetch(SERVER_URL, options);
    const code = response.getResponseCode();
    const data = JSON.parse(response.getContentText());
    if (code !== 200 || !data.ok) {
      return {ok: false, error: data.error || 'SERVER_ERROR'};
    }
    return data;
  } catch (e) {
    addLog('❌ Error checking license: ' + e.message, 'ERROR');
    return {ok: false, error: 'LICENSE_CHECK_FAILED'};
  }
}

/**
 * Show license status dialog
 */
function checkLicenseStatusUI() {
  try {
    const status = serverStatus_();
    if (!status.ok) {
      const msg = status.error === 'LICENSE_NOT_SET' 
        ? 'License not configured. Go to Settings → Set License.'
        : 'License check failed: ' + status.error;
      SpreadsheetApp.getUi().alert('❌ ' + msg);
      return;
    }
    const msg = '✅ License is active' +
      (status.expiry ? '\nExpiry: ' + status.expiry : '') +
      (status.remaining_calls ? '\nRemaining calls: ' + status.remaining_calls : '');
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

// ============================================================
// 6. MAIN MENU & ENTRY POINTS
// ============================================================

/**
 * Initialize menu on Sheet open
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    const menu = ui.createMenu('🤖 Table AI');
    
    // Main features
    menu.addItem('📝 Gemini: Set API Key', 'initGeminiKey')
      .addItem('🔍 Check License Status', 'checkLicenseStatusUI')
      .addSeparator()
      .addItem('⚙️ Settings', 'openSettingsUI')
      .addItem('📋 Logs', 'showLogsDialog')
      .addItem('💾 Export Logs', 'exportLogsToSheet')
      .addSeparator();
    
    if (DEV_MODE) {
      menu.addItem('🧪 DEV: Self Test', 'runDevSelfTest')
        .addItem('🧹 DEV: Cleanup Triggers', 'cleanupOldTriggers');
    }
    
    menu.addToUi();
    addLog('✅ Menu initialized', 'INFO');
  } catch (e) {
    console.error('Error initializing menu:', e.message);
  }
}

/**
 * Initialize Gemini API key via UI
 */
function initGeminiKey() {
  try {
    showGeminiKeyHelp();
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt('Paste your Gemini API key:');
    if (response.getSelectedButton() !== ui.Button.OK) return;
    const key = response.getResponseText().trim();
    if (!key) {
      ui.alert('No key provided.');
      return;
    }
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
    addLog('✅ Gemini key set (length=' + key.length + ')', 'INFO');
    ui.alert('Gemini key saved.');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

/**
 * Open settings UI
 */
function openSettingsUI() {
  try {
    const ui = SpreadsheetApp.getUi();
    const msg = 'Settings Menu:\n' +
      '1. Set Gemini Key → 📝\n' +
      '2. Set License → 🔑\n' +
      '3. Check Status → ✅';
    ui.alert(msg);
    
    const choice = ui.alert('What to change?', 'Gemini Key|License|Check Status|Cancel', ui.ButtonSet.YES_NO_CANCEL);
    if (choice === 'Gemini Key') {
      initGeminiKey();
    } else if (choice === 'License') {
      setLicenseCredentialsUI();
    } else if (choice === 'Check Status') {
      checkLicenseStatusUI();
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

// ============================================================
// 7. SHEET OPERATIONS
// ============================================================

/**
 * Handle sheet edits
 */
function onEdit(e) {
  try {
    // Placeholder for future trigger logic
    // Currently: no auto-processing
  } catch (e) {
    addLog('❌ Error in onEdit: ' + e.message, 'ERROR');
  }
}

/**
 * Apply uniform formatting to sheet
 */
function applyUniformFormatting(sheet) {
  try {
    if (!sheet) sheet = SpreadsheetApp.getActiveSheet();
    sheet.setFrozenRows(1);
    sheet.getRange('A1:Z1').setFontWeight('bold').setBackground('#E8F0FE');
    addLog('✅ Formatting applied', 'INFO');
  } catch (e) {
    addLog('❌ Error applying formatting: ' + e.message, 'ERROR');
  }
}

// ============================================================
// 8. HELPER FUNCTIONS & UTILITIES
// ============================================================

/**
 * Convert column number to letter (1 → A, 27 → AA)
 */
function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

/**
 * Convert letter(s) to column number (A → 1, AA → 27)
 */
function letterToColumn(letters) {
  let column = 0, length = letters.length;
  for (let i = 0; i < length; i++) {
    column += (letters.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  return column;
}

/**
 * Parse A1 notation to row and column
 */
function parseTargetA1(a1) {
  if (!a1 || typeof a1 !== 'string') return null;
  const match = a1.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return {
    column: letterToColumn(match[1]),
    row: parseInt(match[2], 10),
  };
}

/**
 * DEDUPLICATED: Use isMarkdownText from SHARED_UTILITIES_v3.gs
 * This function is now available in SHARED_UTILITIES_v3.gs
 * @see SHARED_UTILITIES_v3.gs#isMarkdownText
 */
function isMarkdownText(text) {
  // NOTE: This mirrors isMarkdownText from SHARED_UTILITIES_v3.gs
  // For CLIENT usage, can be kept for backwards compatibility
  if (!text || typeof text !== 'string') return false;
  return /\*\*[^*]+\*\*|\*[^*]+\*|^#{1,6}\s+|```|`[^`]+`/m.test(text);
}

/**
 * DEDUPLICATED: Use convertMarkdownToReadable from SHARED_UTILITIES_v3.gs
 * Delegates to shared utility for markdown processing
 * @see SHARED_UTILITIES_v3.gs#convertMarkdownToReadable
 */
function convertMarkdownToReadableText(markdownText) {
  // Delegate to SHARED_UTILITIES_v3.gs version
  // Using local version for backwards compatibility but marked for future consolidation
  if (!markdownText || typeof markdownText !== 'string') return markdownText;
  if (!isMarkdownText(markdownText)) return markdownText;
  
  return markdownText
    .replace(/```[\w]*\n?([\s\S]*?)\n?```/g, function(_m, code) {
      return '\n' + String(code || '').trim() + '\n';
    })
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, function(_m, c) {
      return String(c || '').toUpperCase();
    })
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+(.+)$/gm, function(_m, h) {
      return '\n' + String(h || '').toUpperCase() + ':\n';
    })
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Process Gemini response (convert markdown if needed)
 */
function processGeminiResponse(response) {
  if (!response || typeof response !== 'string') return response;
  return convertMarkdownToReadableText(response);
}

// ============================================================
// 9. DEVELOPMENT & TESTING
// ============================================================

/**
 * Show active triggers
 */
function showActiveTriggersDialog() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    if (triggers.length === 0) {
      SpreadsheetApp.getUi().alert('No active triggers');
      return;
    }
    const list = triggers.map(t => `- ${t.getHandlerFunction()} (${t.getTriggerSource()})`).join('\n');
    SpreadsheetApp.getUi().alert(`Active Triggers (${triggers.length}):\n${list}`);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

/**
 * Cleanup old triggers
 */
function cleanupOldTriggers() {
  try {
    addLog('🧹 Cleaning up old triggers...', 'INFO');
    const triggers = ScriptApp.getProjectTriggers();
    let deleted = 0, kept = 0;
    triggers.forEach(function(trigger) {
      const fn = trigger.getHandlerFunction();
      if (fn === 'checkStepCompletion' || fn === 'auto_processing_trigger') {
        ScriptApp.deleteTrigger(trigger);
        deleted++;
      } else {
        kept++;
      }
    });
    const msg = `✅ Cleanup: deleted ${deleted}, kept ${kept}`;
    addLog(msg, 'INFO');
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    addLog('❌ Error cleaning triggers: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}

/**
 * Run self-test (DEV mode)
 */
function runDevSelfTest() {
  try {
    addLog('🧪 Running self-test...', 'INFO');
    const tests = [];
    
    // Test 1: Check Gemini key
    const geminiKey = getGeminiApiKey();
    tests.push(`Gemini Key: ${geminiKey ? '✅ set (' + geminiKey.length + ' chars)' : '❌ not set'}`);
    
    // Test 2: Check license
    const email = getLicenseEmail();
    const token = getLicenseToken();
    tests.push(`License: ${email && token ? '✅ set' : '❌ not set'}`);
    
    // Test 3: Check server connection
    const status = serverStatus_();
    tests.push(`Server: ${status.ok ? '✅ connected' : '❌ ' + status.error}`);
    
    const result = tests.join('\n');
    addLog('✅ Self-test complete:\n' + result, 'INFO');
    SpreadsheetApp.getUi().alert('Self-Test Results:\n' + result);
  } catch (e) {
    addLog('❌ Self-test error: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Error: ' + e.message);
  }
}
