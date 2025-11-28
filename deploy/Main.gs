/**
 * ===== LICENSE & SERVER PROXY (FIXED!) =====
 *
 * Теперь ВСЕГДА используется только
 * 'LICENSE_EMAIL', 'LICENSE_TOKEN' в ScriptProperties
 */
function migrateLicenseKeysIfNeeded_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const oldEmail = props.getProperty('LICENSEEMAIL');
    const oldToken = props.getProperty('LICENSETOKEN');
    const newEmail = props.getProperty('LICENSE_EMAIL');
    const newToken = props.getProperty('LICENSE_TOKEN');
    let migrated = false;
    if (oldEmail && !newEmail) {
      props.setProperty('LICENSE_EMAIL', oldEmail);
      props.deleteProperty('LICENSEEMAIL');
      migrated = true;
    }
    if (oldToken && !newToken) {
      props.setProperty('LICENSE_TOKEN', oldToken);
      props.deleteProperty('LICENSETOKEN');
      migrated = true;
    }
    if (migrated) {
      addLog('✅ Миграция лицензионных ключей в LICENSE_EMAIL/ LICENSE_TOKEN', 'INFO');
    }
    return migrated;
  } catch (e) {
    Logger.log('migration error: ' + e.message);
    return false;
  }
}
function getLicenseEmail() {
  migrateLicenseKeysIfNeeded_();
  return PropertiesService.getScriptProperties().getProperty('LICENSE_EMAIL') || '';
}
function getLicenseToken() {
  migrateLicenseKeysIfNeeded_();
  return PropertiesService.getScriptProperties().getProperty('LICENSE_TOKEN') || '';
}
function hasStoredLicense() {
  migrateLicenseKeysIfNeeded_();
  try {
    const email = getLicenseEmail();
    const token = getLicenseToken();
    return !!(email && token && String(email).trim() && String(token).trim());
  } catch (e) {
    addLog('hasStoredLicense: ' + e.message, 'WARN');
    return false;
  }
}
/** Чтение/запись лицензии теперь только через LICENSE_EMAIL / LICENSE_TOKEN */
// eslint-disable-next-line no-unused-vars
function setLicenseCredentialsUI() {
  const ui = SpreadsheetApp.getUi();
  const curEmail = getLicenseEmail();
  const curToken = getLicenseToken();
  const emailRes = ui.prompt('🔐 Лицензия — Email', 'Введите Email (для проверки лицензии). Текущий: ' + (curEmail || '—'), ui.ButtonSet.OK_CANCEL);
  if (emailRes.getSelectedButton() !== ui.Button.OK) return;
  const email = (emailRes.getResponseText() || '').trim();
  const tokenRes = ui.prompt('🔐 Лицензия — Токен', 'Введите Токен (из таблицы лицензий). Текущий: ' + (curToken ? (curToken.substring(0, 4)+'****') : '—'), ui.ButtonSet.OK_CANCEL);
  if (tokenRes.getSelectedButton() !== ui.Button.OK) return;
  const token = (tokenRes.getResponseText() || '').trim();
  if (!email || !token) {
    ui.alert('Email и Токен обязательны.'); return;
  }
  PropertiesService.getScriptProperties().setProperty('LICENSE_EMAIL', email);
  PropertiesService.getScriptProperties().setProperty('LICENSE_TOKEN', token);
  ui.alert('✅ Лицензия сохранена.');
}
// saveSettingsData FIXED
function saveSettingsData(data) {
  try {
    Logger.log('=== saveSettingsData START ===');
    Logger.log('data.apiKey: ' + (data.apiKey ? 'SET, length: ' + data.apiKey.length : 'NOT SET'));
    Logger.log('data.email: ' + (data.email ? 'SET' : 'NOT SET'));
    Logger.log('data.token: ' + (data.token ? 'SET, length: ' + data.token.length : 'NOT SET'));
    const props = PropertiesService.getScriptProperties();
    const updated = [];
    // ===== API KEY (safe) =====
    if (data.apiKey !== undefined && data.apiKey && String(data.apiKey).trim()) {
      props.setProperty('GEMINI_API_KEY', String(data.apiKey).trim());
      updated.push('API ключ обновлён');
      Logger.log('✅ GEMINI_API_KEY UPDATED, length: ' + data.apiKey.length);
    }
    // ===== LICENSE EMAIL =====
    if (data.email !== undefined && data.email && String(data.email).trim()) {
      props.setProperty('LICENSE_EMAIL', String(data.email).trim());
      updated.push('Email обновлён');
      Logger.log('✅ LICENSE_EMAIL UPDATED: ' + data.email);
    }
    // ===== LICENSE TOKEN =====
    if (data.token !== undefined && data.token && String(data.token).trim()) {
      props.setProperty('LICENSE_TOKEN', String(data.token).trim());
      updated.push('Токен обновлён');
      Logger.log('✅ LICENSE_TOKEN UPDATED, length: ' + data.token.length);
    }
    if (updated.length === 0) {
      Logger.log('saveSettingsData: Нет новых данных для сохранения');
      return {success: false, message: 'Нет данных для сохранения'};
    }
    Logger.log('Settings saved successfully: ' + updated.join(', '));
    addLog('✅ Настройки сохранены: ' + updated.join(', '), 'INFO');
    return {
      success: true,
      message: '✅ Сохранено: ' + updated.join(', '),
    };
  } catch (e) {
    Logger.log('saveSettingsData ERROR: ' + e.message);
    addLog('❌ Ошибка сохранения настроек: ' + e.message, 'ERROR');
    return {success: false, message: '❌ Ошибка: ' + e.message};
  }
}
// getSettingsData FIXED
function getSettingsData() {
  try {
    Logger.log('=== getSettingsData START ===');
    migrateLicenseKeysIfNeeded_();
    const userProps = PropertiesService.getUserProperties();
    const scriptProps = PropertiesService.getScriptProperties();
    // Priority: user key first, then script key
    const userApiKey = userProps.getProperty('GEMINI_API_KEY');
    const scriptApiKey = scriptProps.getProperty('GEMINI_API_KEY');
    const currentApiKey = userApiKey || scriptApiKey || '';
    const keySource = userApiKey ? 'USER' : (scriptApiKey ? 'DEFAULT' : 'NONE');
    const email = scriptProps.getProperty('LICENSE_EMAIL') || '';
    const token = scriptProps.getProperty('LICENSE_TOKEN') || '';
    Logger.log('currentApiKey: ' + (currentApiKey ? 'SET (' + keySource + ', length: ' + currentApiKey.length + ')' : 'NOT SET'));
    Logger.log('email: ' + (email ? 'SET' : 'NOT SET'));
    Logger.log('token: ' + (token ? 'SET' : 'NOT SET'));
    return {
      apiKey: currentApiKey,
      email: email,
      token: token,
      keySource: keySource,
    };
  } catch (e) {
    Logger.log('getSettingsData ERROR: ' + e.message);
    addLog('❌ Ошибка чтения настроек: ' + e.message, 'ERROR');
    return {apiKey: '', email: '', token: '', keySource: 'NONE'};
  }
}
/**
 * seedLicenseCredentialsFromParametersSheet - фиксация: теперь только новый формат!
 */
function seedLicenseCredentialsFromParametersSheet() {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    const curEmail = scriptProps.getProperty('LICENSE_EMAIL');
    const curToken = scriptProps.getProperty('LICENSE_TOKEN');
    if (curEmail && curToken) return false;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Параметры');
    if (!sheet) return false;
    const email = String(sheet.getRange('G1').getDisplayValue() || '').trim();
    const token = String(sheet.getRange('H1').getDisplayValue() || '').trim();
    if (!email || !token) return false;
    scriptProps.setProperty('LICENSE_EMAIL', email);
    scriptProps.setProperty('LICENSE_TOKEN', token);
    Logger.log('INFO: License credentials seeded from Параметры sheet');
    Logger.log('  - LICENSE_EMAIL: ' + email);
    Logger.log('  - LICENSE_TOKEN: ' + token.substring(0, 4) + '***');
    addLog('✅ Лицензия загружена из листа "Параметры"', 'INFO');
    return true;
  } catch (e) {
    Logger.log('WARN: seed_license_from_params_error: ' + e.message);
    return false;
  }
}
