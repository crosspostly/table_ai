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
 * RESTORED: Real functional menu for v3.0.1
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    
    ui.createMenu('🤖 Table AI')
      .addItem('▶️ Подготовить формулы (умный режим)', 'prepareChainSmart')
      .addItem('🔁 Обновить текущую ячейку (GM)', 'refreshCurrentGMCell')
      .addSeparator()
      .addItem('🧹 Очистить B3..G3', 'clearChainForA3')
      .addSeparator()
      .addSubMenu(ui.createMenu('🎯 AI Конструктор')
        .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
        .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
        .addSeparator()
        .addItem('🗂️ Управление шаблонами', 'openTemplatesUI')
        .addItem('❓ Справка', 'showCollectConfigHelp')
      )
      .addSeparator()
      .addItem('📥 Импорт VK постов', 'importVkPosts')
      .addItem('🖼️ Транскрибация отзывов', 'ocrRun')
      .addSeparator()
      .addItem('⚙️ Настройки', 'openSettingsUI')
      .addToUi();
    
    if (DEV_MODE) {
      ui.createMenu('🧰 DEV')
        .addItem('📝 Показать логи', 'showLogsDialog')
        .addItem('⬇️ Экспорт логов', 'exportLogsToSheet')
        .addItem('🗑 Очистить логи', 'clearLogs')
        .addToUi();
    }
    
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

// ============================================================
// GEMINI FORMULA FUNCTIONS (for use in Sheet formulas)
// ============================================================

/**
 * CACHE KEY GENERATION
 * Creates unique cache key for prompt+params
 */
function gmCacheKey_(prompt, maxTokens, temperature) {
  try {
    const s = 'p:' + String(prompt) + '|mx:' + String(maxTokens) + '|t:' + String(temperature);
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      let v = (bytes[i] & 0xFF).toString(16);
      if (v.length === 1) v = '0' + v;
      hex += v;
    }
    return 'gm:' + hex.substring(0, 64);
  } catch (e) {
    return 'gm:fallback:' + (String(prompt).length) + ':' + String(maxTokens) + ':' + String(temperature);
  }
}

/**
 * GET FROM CACHE
 * Retrieves cached result for prompt
 */
function gmCacheGet_(key) {
  try {
    return CacheService.getScriptCache().get(key);
  } catch (e) {
    return null;
  }
}

/**
 * PUT TO CACHE
 * Stores result in cache with TTL
 */
function gmCachePut_(key, value, ttlSec) {
  try {
    const ttl = Math.max(5, Math.min(21600, Math.floor(ttlSec || 300)));
    CacheService.getScriptCache().put(key, value, ttl);
  } catch (e) {}
}

/**
 * CALL SERVER FOR GEMINI
 * CLIENT sends {email, token, apiKey, prompt, ...} to SERVER
 * SERVER calls Gemini and returns result
 */
function serverGM_(prompt, maxTokens, temperature) {
  const email = getLicenseEmail();
  const token = getLicenseToken();
  const apiKey = getGeminiApiKey();
  const payload = {
    action: 'gm',
    email: email,
    token: token,
    apiKey: apiKey,
    prompt: prompt,
    maxTokens: maxTokens,
    temperature: temperature
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const resp = UrlFetchApp.fetch(SERVER_URL, options);
  const code = resp.getResponseCode();
  const data = JSON.parse(resp.getContentText());
  if (code !== 200) {
    return {
      ok: false,
      error: (data && data.error) || ('HTTP_' + code)
    };
  }
  return data;
}

/**
 * GM - MAIN FORMULA FUNCTION
 * Use in Sheet formulas: =GM("prompt text")
 * 
 * Architecture: CLIENT (this) → SERVER → Gemini
 * - Checks license
 * - Uses cache to avoid redundant calls
 * - Falls back gracefully on errors
 */
function GM(prompt, maxTokens, temperature) {
  // License is required
  try {
    const _email = getLicenseEmail();
    const _token = getLicenseToken();
    if (!_email || !_token) {
      addLog('🚫 Rejection: license not configured (email/token empty)', 'WARN');
      return 'Error: LICENSE_REQUIRED';
    }
    const st0 = serverStatus_();
    if (!st0 || !st0.ok) {
      addLog('🚫 Rejection: license inactive or server unavailable', 'WARN');
      return 'Error: LICENSE_OR_SERVER';
    }
  } catch (eLic) {
    addLog('🚫 Rejection: license check failed: ' + eLic.message, 'WARN');
    return 'Error: LICENSE_CHECK_FAILED';
  }

  if (maxTokens == null) maxTokens = 25000;
  if (temperature == null) temperature = 0.7;
  addLog('→ GM: prompt=' + (prompt ? prompt.slice(0, 60) + '...' : 'none') + ' (' + (prompt ? prompt.length : 0) + ')', 'INFO');
  
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be non-empty string');
  }
  if (prompt.length > 50000) {
    throw new Error('Prompt exceeds 50,000 characters');
  }

  // Check cache
  const key = gmCacheKey_(prompt, maxTokens, temperature);
  const cached = gmCacheGet_(key);
  if (cached) {
    addLog('⚡ GM cache-hit', 'DEBUG');
    return cached;
  }

  // Check error cache (retry exponential backoff)
  const errKey = 'gm_err:' + key;
  const lastErr = gmCacheGet_(errKey);
  if (lastErr) {
    addLog('⏳ GM last-error cached, skip call', 'DEBUG');
    return lastErr;
  }

  // Call SERVER
  let ok = false, text = '', serr = null;
  try {
    const r = serverGM_(prompt, maxTokens, temperature);
    if (r && r.ok) {
      ok = true;
      text = r.data || '';
    } else {
      serr = (r && r.error) || 'SERVER_ERROR';
    }
  } catch (e) {
    serr = e.message;
  }

  if (ok) {
    const processed = processGeminiResponse(text);
    gmCachePut_(key, processed, 21600); // 6 hours TTL
    return processed;
  }

  // Error handling
  const errorMsg = 'Error: ' + (serr || 'Unknown');
  gmCachePut_(errKey, errorMsg, 60); // Cache error for 1 minute
  addLog('❌ GM error: ' + serr, 'ERROR');
  return errorMsg;
}

/**
 * GM_IF - CONDITIONAL GEMINI CALL
function prepareChainSmart() {
  var ss = SpreadsheetApp.getActive();
  var prompt = ss.getSheetByName('Prompt_box');
  var hasTargets = false;
  if (prompt) {
    var lastRow = Math.max(2, prompt.getLastRow());
    var vals = prompt.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0] || '').trim()) { hasTargets = true; break; }
    }
  }
  if (hasTargets) {
    prepareChainFromPromptBox();
  } else {
    prepareChainForA3();
  }
}

function prepareChainFromPromptBox() {
  var ss = SpreadsheetApp.getActive();
  var prompt = ss.getSheetByName('Prompt_box');
  var pack = ss.getSheetByName('Распаковка');
  if (!prompt) { SpreadsheetApp.getUi().alert('Лист "Prompt_box" не найден'); return; }
  if (!pack) { SpreadsheetApp.getUi().alert('Лист "Распаковка" не найден'); return; }

  var lastRow = Math.max(2, prompt.getLastRow());
  var targets = prompt.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
  var mappings = [];
  for (var r = 2; r <= lastRow; r++) {
    var targetStr = String(targets[r - 2][0] || '').trim();
    if (!targetStr) continue;
    try {
      var parsed = parseTargetA1(targetStr);
      mappings.push({ promptRow: r, targetRow: parsed.row, targetCol: parsed.col, targetA1: parsed.a1 });
    } catch (e) {
      addLog('⚠️ Пропуск строки Prompt_box!B' + r + ': ' + e.message, 'WARN');
    }
  }

  if (!mappings.length) { SpreadsheetApp.getUi().alert('Нет целевых ячеек в Prompt_box!B, ничего не сделано.'); return; }

  var phrase = getCompletionPhrase() || COMPLETION_PHRASE;
  var phraseEscaped = phrase.replace(/"/g, '""');

  for (var i = 0; i < mappings.length; i++) {
    var m = mappings[i];
    var cond;
    if (i === 0) {
      cond = '$A3<>""';
    } else {
      var prev = mappings[i - 1];
      cond = 'LEFT(' + prev.targetA1 + ', LEN("' + phraseEscaped + '"))="' + phraseEscaped + '"';
    }
    var formula = '=GM_IF(' + cond + ', Prompt_box!$F$' + m.promptRow + ', 25000, 0.7)';
    pack.getRange(m.targetRow, m.targetCol).setFormula(formula);
    addLog('📝 Формула установлена → Распаковка!' + m.targetA1 + ' из Prompt_box!F' + m.promptRow, 'INFO');
  }

  SpreadsheetApp.getUi().alert('✅ Готово: формулы расставлены по целям из Prompt_box!B.\nПервая ячейка запустится при заполнении соответствующего A-столбца, далее — по фразе готовности.');
}

function prepareChainForA3() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName('Распаковка');
  if (!sheet) { SpreadsheetApp.getUi().alert('Лист "Распаковка" не найден'); return; }
  var row = 3;
  var startCol = 2;
  var steps = 6;
  var endCol = startCol + steps - 1;
  var phrase = getCompletionPhrase() || COMPLETION_PHRASE;
  var phraseEscaped = phrase.replace(/"/g, '""');

  for (var col = startCol; col <= endCol; col++) {
    var stepIndex = col - 1;
    var promptRow = stepIndex + 1;
    var target = sheet.getRange(row, col);
    var promptRef = 'Prompt_box!$F$' + promptRow;
    var formula;
    if (col === 2) {
      formula = '=GM_IF($A3<>"", ' + promptRef + ', 25000, 0.7)';
    } else {
      var prevColLetter = columnToLetter(col - 1);
      formula = '=GM_IF(LEFT(' + prevColLetter + '3, LEN("' + phraseEscaped + '"))="' + phraseEscaped + '", ' + promptRef + ', 25000, 0.7)';
    }
    target.setFormula(formula);
    addLog('📝 Формула ' + target.getA1Notation() + ' установлена', 'DEBUG');
  }
  SpreadsheetApp.getUi().alert('✅ Готово: формулы B3..G3 проставлены.\nЗаполните A3 — шаги пойдут по очереди.');
}

function clearChainForA3() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName('Распаковка');
  if (!sheet) { SpreadsheetApp.getUi().alert('Лист "Распаковка" не найден'); return; }
  sheet.getRange(3, 2, 1, 6).clearContent();
  SpreadsheetApp.getUi().alert('🧹 Очищено: B3..G3');
}

function importVkPosts() {
  addLog('→ Импорт VK-постов с фильтрацией', 'INFO');
  var ss = SpreadsheetApp.getActive();
  var params = ss.getSheetByName('Параметры');
  if (!params) { addLog('❌ Нет листа "Параметры"', 'ERROR'); SpreadsheetApp.getUi().alert('Лист "Параметры" не найден!'); return; }
  var owner = params.getRange('B1').getValue();
  var count = params.getRange('B2').getValue();
  if (!owner || !count) { addLog('❌ Не указаны owner или count', 'ERROR'); SpreadsheetApp.getUi().alert('Введите owner и count на листе "Параметры"'); return; }
  var url = VK_PARSER_URL + '?owner=' + encodeURIComponent(owner) + '&count=' + encodeURIComponent(count);
  try {
    var resp = UrlFetchApp.fetch(url);
    var arr = JSON.parse(resp.getContentText());
  } catch (e) {
    addLog('❌ Ошибка запроса VK: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка запроса VK Parser: ' + e);
    return;
  }
  if (!Array.isArray(arr)) { addLog('❌ Неверный массив от VK', 'ERROR'); SpreadsheetApp.getUi().alert('Неверный формат данных от VK Parser'); return; }

  var headers = [
    'Дата', 'Ссылка на пост', 'Текст поста', 'Номер поста',
    'Стоп-слова', 'Отфильтрованные посты', 'Новый номер',
    'Позитивные слова', 'Посты с позитивными словами', 'Новый номер (позитивные)'
  ];
  var out = [headers];
  arr.forEach(function(o, i) {
    var number = o.number !== undefined ? o.number : i + 1;
    out.push([o.date, o.link, o.text, number, '', '', '', '', '', '']);
  });

  var sheet = ss.getSheetByName('посты');
  if (!sheet) { addLog('❌ Лист "посты" не найден!', 'ERROR'); SpreadsheetApp.getUi().alert('Создайте лист "посты".'); return; }

  sheet.clear();
  sheet.getRange(1, 1, out.length, headers.length).setValues(out);
  applyUniformFormatting(sheet);
  createStopWordsFormulas(sheet, out.length);
  addLog('✅ Импортировано ' + (out.length-1) + ' постов', 'INFO');
  SpreadsheetApp.getUi().alert('Импорт завершён: ' + (out.length - 1) + ' постов. Формулы фильтрации добавлены.');
}

function createStopWordsFormulas(sheet, totalRows) {
  try {
    addLog('→ Создание формул фильтрации', 'INFO');
    var stopWordsRange = '$E$2:$E$100';
    for (var row = 2; row <= totalRows; row++) {
      var formulaF = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + stopWordsRange + ', C' + row + ')))*(' + stopWordsRange + '<>"")) > 0, "", C' + row + ')';
      sheet.getRange(row, 6).setFormula(formulaF);
      var formulaG = '=IF(F' + row + '<>"", COUNTA(F$2:F' + row + '), "")';
      sheet.getRange(row, 7).setFormula(formulaG);
    }
    var positiveWordsRange = '$H$2:$H$100';
    for (var row = 2; row <= totalRows; row++) {
      var formulaI = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + positiveWordsRange + ', C' + row + ')))*(' + positiveWordsRange + '<>"")) > 0, C' + row + ', "")';
      sheet.getRange(row, 9).setFormula(formulaI);
      var formulaJ = '=IF(I' + row + '<>"", COUNTA(I$2:I' + row + '), "")';
      sheet.getRange(row, 10).setFormula(formulaJ);
    }
    sheet.getRange(1, 5, 1, 3).setFontWeight('bold').setBackground('#FFF2CC');
    sheet.getRange(1, 8, 1, 3).setFontWeight('bold').setBackground('#D9EAD3');
    sheet.autoResizeColumns(5, 6);
    addLog('✅ Формулы фильтрации созданы', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка создания формул: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка создания формул: ' + e.message);
  }
}

function refreshCurrentGMCell() {
  try {
    var ss = SpreadsheetApp.getActive();
    var range = ss.getActiveRange();
    if (!range) { SpreadsheetApp.getUi().alert('Выберите ячейку на листе "Распаковка"'); return; }
    var cell = range.getCell(1, 1);
    var sheet = cell.getSheet();
    if (sheet.getName() !== 'Распаковка') { SpreadsheetApp.getUi().alert('Выберите ячейку на листе "Распаковка"'); return; }
    var row = cell.getRow();
    var col = cell.getColumn();

    var formula = cell.getFormula();
    var hasGm = formula && (/^\s*=\s*GM_IF\s*\(/i.test(formula) || /\bGM\s*\(/i.test(formula));
    if (!hasGm) {
      var promptSheet = ss.getSheetByName('Prompt_box');
      if (promptSheet) {
        var lastRow = Math.max(2, promptSheet.getLastRow());
        var targets = promptSheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
        var mappings = [];
        for (var r = 2; r <= lastRow; r++) {
          var tstr = String(targets[r - 2][0] || '').trim();
          if (!tstr) continue;
          try {
            var parsed = parseTargetA1(tstr);
            mappings.push({ promptRow: r, targetA1: parsed.a1, targetRow: parsed.row, targetCol: parsed.col });
          } catch (e) {}
        }
        if (mappings.length) {
          var currentA1 = columnToLetter(col) + row;
          var idx = -1;
          for (var i = 0; i < mappings.length; i++) {
            if (mappings[i].targetA1 === currentA1) { idx = i; break; }
          }
          if (idx >= 0) {
            var phrase = getCompletionPhrase() || COMPLETION_PHRASE;
            var phraseEscaped = phrase.replace(/"/g, '""');
            var cond;
            if (idx === 0) {
              cond = '$A3<>""';
            } else {
              var prev = mappings[idx - 1];
              cond = 'LEFT(' + prev.targetA1 + ', LEN("' + phraseEscaped + '"))="' + phraseEscaped + '"';
            }
            var promptRef = 'Prompt_box!$F$' + mappings[idx].promptRow;
            formula = '=GM_IF(' + cond + ', ' + promptRef + ', 25000, 0.7)';
          }
        }
      }
    }
    if (!formula) { SpreadsheetApp.getUi().alert('Нечего обновлять: в ячейке нет GM-формулы и нет соответствия в Prompt_box!B'); return; }

    cell.clearContent();
    SpreadsheetApp.flush();
    Utilities.sleep(50);
    cell.setFormula(formula);
    SpreadsheetApp.flush();
    addLog('🔁 Обновлена ячейка ' + cell.getA1Notation(), 'INFO');
  } catch (e) {
    addLog('❌ Ошибка обновления ячейки: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}
