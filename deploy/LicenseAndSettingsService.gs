/**
 * LicenseAndSettingsService.gs - Управление лицензиями и настройками
 * Версия: 1.0.0
 *
 * ЗАВИСИМОСТИ:
 * - LoggingService.gs: addLog()
 *
 * Функции:
 * - getLicenseEmail() / getLicenseToken() - получение лицензии
 * - hasStoredLicense() - проверка наличия лицензии
 * - serverStatus() - проверка статуса лицензии
 * - checkLicenseStatusUI() - UI проверки лицензии
 * - openSettingsUI() / getSettingsData() / saveSettingsData() - управление настройками
 */

// ====== КОНСТАНТЫ ======
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec';

// ====== УПРАВЛЕНИЕ ЛИЦЕНЗИЕЙ ======
/* eslint-disable-next-line no-unused-vars */
function getLicenseEmail() {
  return getScriptProp('LICENSEEMAIL') || '';
}

/* eslint-disable-next-line no-unused-vars */
function getLicenseToken() {
  return getScriptProp('LICENSETOKEN') || '';
}

/* eslint-disable-next-line no-unused-vars */
function hasStoredLicense() {
  const email = getLicenseEmail();
  const token = getLicenseToken();
  return !!(email && token);
}

/* eslint-disable-next-line no-unused-vars */
function getScriptProp(key) {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(key);
  } catch (e) {
    addLog('❌ Ошибка чтения свойства ' + key + ': ' + e.message, 'ERROR');
    return null;
  }
}

/* eslint-disable-next-line no-unused-vars */
function setScriptProp(key, value) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(key, value);
    addLog('✅ Свойство ' + key + ' сохранено', 'DEBUG');
  } catch (e) {
    addLog('❌ Ошибка сохранения свойства ' + key + ': ' + e.message, 'ERROR');
  }
}

/* eslint-disable-next-line no-unused-vars */
function setLicenseCredentialsUI() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    '🔑 Введите данные лицензии',
    'Email:\nТокен:',
    ui.ButtonSet.OK_CANCEL,
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const input = result.getResponseText();
    const lines = input.split('\n').map((line) => line.trim()).filter((line) => line);

    if (lines.length >= 2) {
      const email = lines[0];
      const token = lines[1];

      if (email && token) {
        setScriptProp('LICENSEEMAIL', email);
        setScriptProp('LICENSETOKEN', token);
        ui.alert('✅ Данные лицензии сохранены');
        addLog('✅ Лицензия обновлена: ' + email, 'INFO');
      } else {
        ui.alert('❌ Email и токен не могут быть пустыми');
      }
    } else {
      ui.alert('❌ Введите email и токен на разных строках');
    }
  }
}

/* eslint-disable-next-line no-unused-vars */
function seedLicenseCredentialsFromParametersSheet() {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    const alreadySeeded = scriptProps.getProperty('LICENSE_SEEDED_FLAG') === 'true';
    if (alreadySeeded) {
      addLog('📝 LICENSE: already seeded from parameters, skip', 'DEBUG');
      return false;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Параметры');
    if (!sheet) {
      addLog('DEBUG', 'params_sheet_missing', 'client', 'Sheet "Параметры" not found');
      return false;
    }

    const email = String(sheet.getRange('G1').getDisplayValue() || '').trim();
    const token = String(sheet.getRange('H1').getDisplayValue() || '').trim();
    if (!email || !token) {
      addLog('DEBUG', 'params_cells_empty', 'client', `G1 or H1 empty (G1="${email}", H1="${token ? '***' : ''}')`);
      return false;
    }

    scriptProps.setProperty('LICENSEEMAIL', email);
    scriptProps.setProperty('LICENSETOKEN', token);
    scriptProps.setProperty('LICENSE_SEEDED_FLAG', 'true');
    addLog('INFO', 'license_credentials_seeded', 'client', `Email=${email}, Token=${token.substring(0, 4)}***`);
    return true;
  } catch (e) {
    addLog('WARN', 'seed_license_from_params_error', 'client', e.message);
    return false;
  }
}

/* eslint-disable-next-line no-unused-vars */
function serverStatus() {
  // 0) Если лицензии нет — один раз попробовать засидить из Параметры!G1/H1
  if (!hasStoredLicense()) {
    seedLicenseCredentialsFromParametersSheet();
  }

  // 1) Читаем значения из ScriptProperties (после возможного seed)
  const email = getLicenseEmail();
  const token = getLicenseToken();
  const sheetId = SpreadsheetApp.getActive().getId();

  if (DEV_MODE) {
    addLog(`STATUS REQUEST: email=${email}, token=${token ? token.substring(0, 4) : null}`, 'DEBUG');
  }

  const payload = {
    action: 'status',
    email: email,
    token: token,
    sheetId: sheetId,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const resp = UrlFetchApp.fetch(SERVER_URL, options);
    const code = resp.getResponseCode();
    const responseText = resp.getContentText();

    if (DEV_MODE) {
      addLog(`STATUS RAW: HTTP ${code}`, 'DEBUG');
      addLog(`STATUS CONTENT: ${responseText.substring(0, 200)}...`, 'DEBUG');
    }

    const data = JSON.parse(responseText);

    if (DEV_MODE) {
      addLog(`STATUS RESULT ok=${data.ok ? true : false}`, 'DEBUG');
      if (data && data.message) addLog(`STATUS MESSAGE: ${data.message}`, 'DEBUG');
      if (data && data.quota) addLog(`STATUS QUOTA: ${JSON.stringify(data.quota)}`, 'DEBUG');
      if (data && data.error) addLog(`STATUS ERROR: ${data.error}`, 'ERROR');
    }

    if (code !== 200) {
      return {ok: false, error: data ? data.error : `HTTP ${code}`};
    }
    return data;
  } catch (e) {
    addLog(`STATUS REQUEST FAILED: ${e.message}`, 'ERROR');
    return {ok: false, error: `REQUEST_FAILED: ${e.message}`};
  }
}

/* eslint-disable-next-line no-unused-vars */
function checkLicenseStatusUI() {
  try {
    const st = serverStatus();
    if (st.ok) SpreadsheetApp.getUi().alert('Лицензия', '✅ Активна' + (st.until ? (' до ' + st.until) : ''), SpreadsheetApp.getUi().ButtonSet.OK);
    else SpreadsheetApp.getUi().alert('Лицензия', '❌ ' + (st.error || 'Неизвестная ошибка'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Лицензия', 'Ошибка: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ====== УПРАВЛЕНИЕ НАСТРОЙКАМИ ======
/* eslint-disable-next-line no-unused-vars */
function openSettingsUI() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('SettingsUI')
      .setWidth(600)
      .setHeight(700);
    SpreadsheetApp.getUi().showModalDialog(html, '⚙️ Настройки Table AI');
    addLog('✅ Открыто окно настроек', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка открытия окна настроек: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('❌ Ошибка открытия настроек: ' + e.message);
  }
}

/* eslint-disable-next-line no-unused-vars */
function getSettingsData() {
  try {
    const props = PropertiesService.getScriptProperties();
    return {
      apiKey: props.getProperty('GEMINI_API_KEY') || '',
      email: props.getProperty('LICENSEEMAIL') || '',
      token: props.getProperty('LICENSETOKEN') || '',
    };
  } catch (e) {
    addLog('❌ Ошибка чтения настроек: ' + e.message, 'ERROR');
    return {apiKey: '', email: '', token: ''};
  }
}

/* eslint-disable-next-line no-unused-vars */
function saveSettingsData(data) {
  try {
    const props = PropertiesService.getScriptProperties();
    const updated = [];

    if (data.apiKey) {
      props.setProperty('GEMINI_API_KEY', data.apiKey);
      updated.push('API ключ');
      addLog('✅ API ключ Gemini обновлён', 'INFO');
    }

    if (data.email) {
      props.setProperty('LICENSE_EMAIL', data.email);
      updated.push('Email');
      addLog('✅ Email лицензии обновлён: ' + data.email, 'INFO');
    }

    if (data.token) {
      props.setProperty('LICENSE_TOKEN', data.token);
      updated.push('Токен');
      addLog('✅ Токен лицензии обновлён', 'INFO');
    }

    if (updated.length === 0) {
      return {success: false, message: 'Нет данных для сохранения'};
    }

    return {
      success: true,
      message: 'Сохранено: ' + updated.join(', '),
    };
  } catch (e) {
    addLog('❌ Ошибка сохранения настроек: ' + e.message, 'ERROR');
    return {success: false, message: 'Ошибка: ' + e.message};
  }
}

