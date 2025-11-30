/**
 * TABLE AI - DEVELOPMENT TOOLS (CLIENT)
 *
 * ⚠️ DEVELOPMENT ONLY - DELETE BEFORE PRODUCTION DEPLOYMENT
 *
 * This file contains all development and debugging functionality:
 * - DEV menu
 * - Self-tests
 * - Debug functions
 * - Direct Gemini API fallback
 *
 * To deploy to production:
 * 1. Delete this file from deploy/ directory
 * 2. Update .claspignore to exclude DevTools.gs
 * 3. Run: clasp push --force
 */

/* exported runDevSelfTest, debugGeminiKeys, debugOTAFlow, debugOTAStatus */
/* exported createDevMenu */
/* eslint-disable indent, no-multiple-empty-lines, padded-blocks */

// ====== DEV FLAG ======
// ⭐ DEV MODE is now stored in Script Properties
// Access via getDevMode() function below

// ====== DEV UTILITIES ======
// eslint-disable-next-line no-unused-vars
/**
 * Get current dev mode status
 * @return {boolean}
 */
function getDevMode() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('DEV_MODE') === 'true';
  } catch (e) {
    return false;
  }
}

// eslint-disable-next-line no-unused-vars
/**
 * Set dev mode status
 * @param {boolean} enabled
 */
function setDevMode(enabled) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('DEV_MODE', enabled ? 'true' : 'false');
    addLog('🔧 DEV_MODE set to: ' + enabled, 'INFO');
    return true;
  } catch (e) {
    addLog('❌ Error setting DEV_MODE: ' + e.message, 'ERROR');
    return false;
  }
}

// ====== DEV MENU ======
// eslint-disable-next-line no-unused-vars
function createDevMenu() {
  const ui = SpreadsheetApp.getUi();
  return ui.createMenu('🧰 DEV')
    .addItem('📝 Показать логи', 'showLogsDialog')
    .addItem('⬇️ Экспорт логов', 'exportLogsToSheet')
    .addItem('🗑 Очистить логи', 'clearLogs')
    .addItem('🔍 Тест сервера', 'testServerConnection')
    .addItem('🧪 Dev Self Test', 'runDevSelfTest')
    .addItem('🔄 Обновить вручную', 'checkForUpdatesManual_')
    .addSeparator()
    .addItem('🔑 Debug Gemini Keys', 'debugGeminiKeys');
}

// ====== DEV FALLBACK: Direct Gemini API call (when server fails) ======
/**
 * DEV fallback function: tries direct Gemini API call if server fails
 * ONLY used when DEV_MODE is true
 */
// eslint-disable-next-line no-unused-vars
function gmDevFallback_(prompt, maxTokens, temperature, serr) {
  if (!getDevMode()) return null;

  addLog('⚠️ DEV fallback → прямой Gemini. Причина: ' + (serr || 'UNKNOWN'), 'WARN');
  try {
    const apiKey = getGeminiApiKey();
    const body = {
      contents: [{parts: [{text: prompt}]}],
      generationConfig: {maxOutputTokens: maxTokens, temperature: temperature},
    };
    const options = {method: 'POST', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true};
    const resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
    const code = resp.getResponseCode();
    const data = JSON.parse(resp.getContentText());
    addLog('← GM (direct): HTTP ' + code, 'DEBUG');
    if (code !== 200) {
      const message = data && data.error && data.error.message ? data.error.message : 'Unknown error';
      const msg = 'Error: ' + message;
      gmCachePut_(errKey, msg, 60);
      addLog('❌ Прямой Gemini: ' + message, 'ERROR');
      return msg;
    }
    const candidate = data.candidates && data.candidates[0];
    const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    const txt = content && content.text ? content.text : '';
    const processed2 = processGeminiResponse(txt);
    gmCachePut_(key, processed2, 21600);
    addLog('✅ Прямой Gemini успешно: ' + txt.length + ' символов', 'DEBUG');
    return processed2;
  } catch (e2) {
    const em = 'Error: ' + e2.message;
    gmCachePut_(errKey, em, 60);
    addLog('❌ Прямой Gemini упал: ' + e2.message, 'ERROR');
    return em;
  }
}

// ====== DEV SELF-TEST ======
/**
 * DEV автотесты - проверяет основные функции
 * НЕ включать в продакшн (DEV_MODE=false)
 */
// eslint-disable-next-line no-unused-vars
function runDevSelfTest() {
  const failures = [];
  try {
    // 1) columnToLetter
    const map = {1: 'A', 2: 'B', 7: 'G', 26: 'Z', 27: 'AA', 28: 'AB'};
    Object.keys(map).forEach((k) => {
      const got = columnToLetter(parseInt(k, 10));
      if (got !== map[k]) failures.push('columnToLetter(' + k + ') → ' + got + ' (ожидалось ' + map[k] + ')');
    });

    // 2) Markdown detection & conversion
    const md = '**bold**\n- a\n- b\n';
    if (!isMarkdownText(md)) failures.push('isMarkdownText не распознал MD');
    const conv = convertMarkdownToReadableText(md);
    if (!conv || conv.indexOf('BOLD') === -1) failures.push('convertMarkdownToReadableText не преобразовал **bold** → BOLD');

    // 3) GM_IF sleep behavior
    const r = GM_IF(false, 'no-call');
    if (r !== '') failures.push('GM_IF при false условии должен возвращать пусто');

    // 4) Формулы для A3 (не трогаем содержимое, только проверяем, что ставятся корректно)
    const ss = SpreadsheetApp.getActive();
    const existed = !!ss.getSheetByName('Распаковка');
    const rSheet = existed ? ss.getSheetByName('Распаковка') : ss.insertSheet('Распаковка');
    const snapshot = [];
    for (let c=2; c<=7; c++) {
      snapshot.push(rSheet.getRange(3, c).getFormula());
    }
    prepareChainForA3();
    const expectedB3 = '=GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)';
    const gotB3 = rSheet.getRange(3, 2).getFormula();
    if (gotB3 !== expectedB3) failures.push('B3 формула некорректна: '+gotB3);
    clearChainForA3();
    // Восстановление прежних формул
    for (let c2=2; c2<=7; c2++) {
      if (snapshot[c2-2]) rSheet.getRange(3, c2).setFormula(snapshot[c2-2]);
    }
    if (!existed) ss.deleteSheet(rSheet);

    // 5) Умный режим: Prompt_box!B2:B3 → B3,C3 с якорем от A3
    const pbExisted = !!ss.getSheetByName('Prompt_box');
    const pb = pbExisted ? ss.getSheetByName('Prompt_box') : ss.insertSheet('Prompt_box');
    const bSnap = pb.getRange(2, 2, 2, 1).getDisplayValues(); // B2:B3
    const fSnap = pb.getRange(2, 6, 2, 1).getFormulas(); // F2:F3
    pb.getRange(2, 2).setValue('B3');
    pb.getRange(3, 2).setValue('C3');
    pb.getRange(2, 6).setFormula('="P1"');
    pb.getRange(3, 6).setFormula('="P2"');

    const rSheet2 = ss.getSheetByName('Распаковка') || ss.insertSheet('Распаковка');
    const b3Before = rSheet2.getRange(3, 2).getFormula();
    const c3Before = rSheet2.getRange(3, 3).getFormula();

    prepareChainSmart();

    const phrase2 = getCompletionPhrase() || COMPLETION_PHRASE;
    const phraseEsc2 = phrase2.replace(/"/g, '""');
    const expB3 = '=GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)';
    const expC3 = '=GM_IF(LEFT(B3, LEN("' + phraseEsc2 + '"))="' + phraseEsc2 + '", Prompt_box!$F$3, 25000, 0.7)';
    const gotB3_2 = rSheet2.getRange(3, 2).getFormula();
    const gotC3_2 = rSheet2.getRange(3, 3).getFormula();
    if (gotB3_2 !== expB3) failures.push('Smart-режим: формула B3 некорректна: ' + gotB3_2);
    if (gotC3_2 !== expC3) failures.push('Smart-режим: формула C3 некорректна: ' + gotC3_2);

    // Восстановление
    if (b3Before) rSheet2.getRange(3, 2).setFormula(b3Before); else rSheet2.getRange(3, 2).clearContent();
    if (c3Before) rSheet2.getRange(3, 3).setFormula(c3Before); else rSheet2.getRange(3, 3).clearContent();
    pb.getRange(2, 2, 2, 1).setValues(bSnap);
    pb.getRange(2, 6, 2, 1).setFormulas(fSnap);
    if (!pbExisted) ss.deleteSheet(pb);
  } catch (e) {
    failures.push('Исключение автотестов: '+e.message);
  }

  if (failures.length) {
    addLog('❌ DEV-тесты: провалено '+failures.length+' пункт(ов)\n'+failures.join('\n'), 'ERROR');
    SpreadsheetApp.getUi().alert('❌ DEV-тесты: есть проблемы', failures.join('\n'));
  } else {
    addLog('✅ DEV-тесты: всё зелёное', 'INFO');
    SpreadsheetApp.getUi().alert('Готово', '✅ DEV-тесты пройдены', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ====== DEBUG FUNCTIONS ======

/**
 * Отладка Gemini ключей
 */
// eslint-disable-next-line no-unused-vars
function debugGeminiKeys() {
  Logger.log('=== DEBUG GEMINI KEYS ===');

  try {
    // 1. Информация о ключах
    const info = getGeminiKeyInfo();
    Logger.log('Client key configured: ' + info.hasClientKey);
    Logger.log('Current key preview: ' + (info.clientKeyPreview || 'using server default'));
    Logger.log('Source: ' + info.source);

    // 2. Попытка получить ключ
    Logger.log('Attempting to get Gemini key...');
    const apiKey = getGeminiApiKey();
    Logger.log('API Key obtained: ' + (apiKey ? '✅ YES' : '❌ NO'));

    if (apiKey) {
      Logger.log('Key preview: ' + apiKey.substring(0, 10) + '...');
    }

  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}

/**
 * Отладочная функция для проверки полного OTA-потока
 */
// eslint-disable-next-line no-unused-vars
function debugOTAFlow() {
  Logger.log('=== DEBUG OTA FLOW ===');

  Logger.log('1️⃣ Calling serverStatus()...');
  const status = serverStatus();
  Logger.log('   Result: ' + JSON.stringify(status));
  Logger.log('   scriptId: ' + ((status && status.scriptId) ? status.scriptId : 'UNDEFINED'));

  Logger.log('2️⃣ CLIENT_VERSION: ' + (typeof CLIENT_VERSION !== 'undefined' ? CLIENT_VERSION : 'UNDEFINED'));
  Logger.log('3️⃣ SERVER_URL: ' + SERVER_URL);
  Logger.log('4️⃣ ScriptApp.getScriptId(): ' + ScriptApp.getScriptId());
  Logger.log('5️⃣ getLicenseEmail(): ' + getLicenseEmail());
  const token = getLicenseToken();
  Logger.log('6️⃣ getLicenseToken(): ' + (token ? 'SET' : 'NOT SET'));
}

/**
 * Полная диагностика OTA системы
 * Проверяет:
 * - Версии клиента и сервера
 * - Доступность лицензии
 * - Доступность сервера
 * - Логи OTA операций
 */
// eslint-disable-next-line no-unused-vars
function debugOTAStatus() {
  Logger.log('═══════════════════════════════════════════════════════════════');
  Logger.log('🔍 OTA SYSTEM DIAGNOSTIC');
  Logger.log('═══════════════════════════════════════════════════════════════');
  Logger.log('⏱️  Time: ' + new Date().toISOString());

  // 1. CLIENT INFORMATION
  Logger.log('\n📱 CLIENT INFORMATION:');
  Logger.log('   Client version: ' + CLIENT_VERSION);
  Logger.log('   Script ID: ' + ScriptApp.getScriptId().substring(0, 12) + '...');
  Logger.log('   Spreadsheet ID: ' + SpreadsheetApp.getActiveSpreadsheet().getId().substring(0, 12) + '...');

  // 2. LICENSE INFORMATION
  Logger.log('\n🔑 LICENSE INFORMATION:');
  const email = getLicenseEmail();
  const token = getLicenseToken();
  Logger.log('   Email: ' + (email ? email : 'NOT SET'));
  Logger.log('   Token: ' + (token ? 'SET (length: ' + token.length + ')' : 'NOT SET'));

  // 3. SERVER INFORMATION
  Logger.log('\n🖥️  SERVER INFORMATION:');
  Logger.log('   Server URL: ' + SERVER_URL);
  Logger.log('   Server endpoint is reachable: testing...');

  try {
    const testPayload = {
      action: 'ota',
      subaction: 'checkUpdates',
      clientVersion: CLIENT_VERSION,
      email: email,
      token: token,
      scriptId: ScriptApp.getScriptId(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    };

    const resp = UrlFetchApp.fetch(SERVER_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true,
    });

    const respCode = resp.getResponseCode();
    Logger.log('   ✉️ Server response code: ' + respCode);

    if (respCode === 200) {
      Logger.log('   ✅ Server is reachable and responding');
      const respBody = resp.getContentText();
      try {
        const data = JSON.parse(respBody);
        Logger.log('   📋 Response: ' + JSON.stringify(data));
      } catch (e) {
        Logger.log('   ⚠️ Cannot parse response: ' + e.message);
      }
    } else if (respCode === 403) {
      Logger.log('   ❌ Server returned 403 (License issue?)');
      const respBody = resp.getContentText();
      Logger.log('   Response: ' + respBody.substring(0, 200));
    } else {
      Logger.log('   ⚠️ Server returned ' + respCode);
      const respBody = resp.getContentText();
      Logger.log('   Response: ' + respBody.substring(0, 200));
    }
  } catch (e) {
    Logger.log('   ❌ Cannot reach server: ' + e.message);
  }

  // 4. OTA LOGS
  Logger.log('\n📝 OTA LOGS (recent 20):');
  const allLogs = getLogs(50);
  const lines = allLogs.split('\n');
  const otaLogs = lines.filter((l) => l.includes('UPDATE') || l.includes('OTA') || l.includes('checkUpdates') || l.includes('applyUpdates'));
  otaLogs.slice(-20).forEach((log) => {
    Logger.log('   ' + log);
  });

  if (otaLogs.length === 0) {
    Logger.log('   (no OTA logs found)');
  }

  Logger.log('\n═══════════════════════════════════════════════════════════════');
  Logger.log('📊 DIAGNOSTIC COMPLETE');
  Logger.log('═══════════════════════════════════════════════════════════════');
  Logger.log('\n💡 NEXT STEPS:');
  Logger.log('   1. Check SERVER logs: server.gs Execution log');
  Logger.log('   2. Check CLIENT logs: View → Logs (in this script)');
  Logger.log('   3. Manual test: Extensions → DEV → Обновить вручную');
  Logger.log('   4. Show logs: Extensions → DEV → Показать логи');
}
